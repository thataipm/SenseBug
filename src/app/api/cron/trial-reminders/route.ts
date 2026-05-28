/**
 * Trial reminder cron job.
 *
 * Runs daily at 09:00 UTC (configured in vercel.json).
 * For each user on a non-paid trial:
 *   - Day 7  (7 days into trial): midpoint reminder
 *   - Day 12 (2 days before end):  ending-soon reminder
 *   - Day 14 (trial ended):        expiry email
 *
 * The user_plans table tracks which reminders have been sent via the
 * `trial_reminders_sent` jsonb column. If that column doesn't exist yet,
 * we treat absence as "not sent" and the SQL update is a safe upsert.
 *
 * Add CRON_SECRET to Vercel env. Vercel passes it as Authorization: Bearer <secret>.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendTrialMidpointEmail,
  sendTrialEndingEmail,
  sendTrialExpiredEmail,
} from '@/lib/email'
import { getPlanDisplayName } from '@/lib/plan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type ReminderKind = 'midpoint' | 'ending' | 'expired'

interface UserPlanRow {
  user_id: string
  plan: string
  trial_started_at: string | null
  trial_ends_at: string | null
  payment_subscription_id: string | null
  trial_reminders_sent: Record<string, boolean> | null
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // Pull every user on a trial (trial_ends_at is set, not paid yet).
  // Cap at 1000 for safety — at any reasonable scale you'd add pagination.
  const { data: rows, error } = await supabase
    .from('user_plans')
    .select('user_id, plan, trial_started_at, trial_ends_at, payment_subscription_id, trial_reminders_sent')
    .not('trial_ends_at', 'is', null)
    .is('payment_subscription_id', null)
    .limit(1000)

  if (error) {
    console.error('[cron/trial-reminders] DB query error:', error.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    console.log('[cron/trial-reminders] No trial users to process.')
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  let skipped = 0

  for (const row of rows as UserPlanRow[]) {
    if (!row.trial_started_at || !row.trial_ends_at) continue

    const startedAt = new Date(row.trial_started_at)
    const endsAt    = new Date(row.trial_ends_at)
    const daysSinceStart = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24))
    const daysUntilEnd   = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    let reminderToSend: ReminderKind | null = null
    if (now >= endsAt)                            reminderToSend = 'expired'
    else if (daysUntilEnd <= 2 && daysUntilEnd > 0) reminderToSend = 'ending'
    else if (daysSinceStart >= 7 && daysUntilEnd > 2) reminderToSend = 'midpoint'

    if (!reminderToSend) { skipped++; continue }

    const sentMap = row.trial_reminders_sent ?? {}
    if (sentMap[reminderToSend]) { skipped++; continue }

    // Get the user's email
    const { data: userData } = await supabase.auth.admin.getUserById(row.user_id)
    const email = userData?.user?.email
    if (!email) { skipped++; continue }

    const planName = getPlanDisplayName(row.plan)

    try {
      if (reminderToSend === 'midpoint') {
        // Count bugs analysed in current month — gives the email some personalisation
        const { count } = await supabase
          .from('triage_results')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', row.user_id)
        await sendTrialMidpointEmail({
          to: email,
          planName,
          daysLeft: Math.max(0, daysUntilEnd),
          bugsAnalyzed: count ?? 0,
        })
      } else if (reminderToSend === 'ending') {
        await sendTrialEndingEmail({
          to: email,
          planName,
          daysLeft: daysUntilEnd,
        })
      } else if (reminderToSend === 'expired') {
        await sendTrialExpiredEmail({
          to: email,
          planName,
        })
      }

      // Mark this reminder as sent (avoid double-sends on retry / next-day runs)
      const updatedMap = { ...sentMap, [reminderToSend]: true }
      await supabase
        .from('user_plans')
        .update({ trial_reminders_sent: updatedMap })
        .eq('user_id', row.user_id)

      sent++
      console.log(`[cron/trial-reminders] Sent ${reminderToSend} to ${email}`)
    } catch (e) {
      console.error(`[cron/trial-reminders] Send failed for ${email}:`, e instanceof Error ? e.message : e)
    }
  }

  console.log(`[cron/trial-reminders] Done — sent: ${sent}, skipped: ${skipped}`)
  return NextResponse.json({ sent, skipped })
}

/**
 * Renewal reminder cron job.
 *
 * Runs daily at 08:00 UTC (configured in vercel.json).
 * Finds all paid subscribers whose next_billing_date falls 3 days from now
 * and sends them a heads-up email.
 *
 * Prerequisite — run this SQL in Supabase before deploying:
 *   ALTER TABLE user_plans ADD COLUMN IF NOT EXISTS next_billing_date timestamptz;
 *
 * Add CRON_SECRET to your Vercel environment variables.
 * Vercel automatically passes this header when invoking the cron route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRenewalReminderEmail, formatBillingAmount, formatEmailDate } from '@/lib/email'
import { getDodo } from '@/lib/dodo'
import type { Subscription } from 'dodopayments/resources/subscriptions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Vercel sends Authorization: Bearer <CRON_SECRET> automatically for cron routes.
  // When testing manually, include the same header.
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const dodo = getDodo()

  // Target window: subscriptions whose next_billing_date is 3 days from now (±12 h)
  const now = new Date()
  const target = new Date(now)
  target.setUTCDate(target.getUTCDate() + 3)

  const windowStart = new Date(target)
  windowStart.setUTCHours(0, 0, 0, 0)

  const windowEnd = new Date(target)
  windowEnd.setUTCHours(23, 59, 59, 999)

  // Fetch plans renewing in this window that still have a live subscription
  const { data: plans, error } = await supabase
    .from('user_plans')
    .select('user_id, plan, payment_subscription_id, next_billing_date')
    .in('plan', ['pro', 'max'])
    .gte('next_billing_date', windowStart.toISOString())
    .lte('next_billing_date', windowEnd.toISOString())
    .not('payment_subscription_id', 'is', null)

  if (error) {
    console.error('[cron/renewal-reminder] DB query error:', error.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!plans || plans.length === 0) {
    console.log('[cron/renewal-reminder] No renewals due in 3 days.')
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  let failed = 0

  for (const planRow of plans) {
    try {
      // Get the user's email from Supabase Auth
      const { data: userData, error: authErr } = await supabase.auth.admin.getUserById(
        planRow.user_id
      )
      if (authErr || !userData?.user?.email) {
        console.warn('[cron/renewal-reminder] Could not get email for user', planRow.user_id)
        failed++
        continue
      }

      const email = userData.user.email

      // Fetch live subscription details from Dodo to get current amount + currency
      let sub: Subscription | null = null
      try {
        sub = await dodo.subscriptions.retrieve(planRow.payment_subscription_id)
      } catch (e) {
        console.warn('[cron/renewal-reminder] Could not fetch Dodo subscription', planRow.payment_subscription_id, e)
      }

      const planName = planRow.plan === 'pro' ? 'Pro' : 'Max'
      const amount = sub
        ? formatBillingAmount(sub.recurring_pre_tax_amount, sub.currency)
        : planRow.plan === 'pro' ? '$19.00/month' : '$49.00/month'

      const renewalDate = formatEmailDate(planRow.next_billing_date)

      await sendRenewalReminderEmail({
        to: email,
        planName,
        amount,
        renewalDate,
      })

      sent++
      console.log(`[cron/renewal-reminder] Sent reminder to ${email} (renews ${renewalDate})`)
    } catch (e) {
      console.error('[cron/renewal-reminder] Error processing user', planRow.user_id, e)
      failed++
    }
  }

  console.log(`[cron/renewal-reminder] Done — sent: ${sent}, failed: ${failed}`)
  return NextResponse.json({ sent, failed })
}

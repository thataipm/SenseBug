/**
 * Weekly backlog digest cron job.
 *
 * Runs every Monday at 08:00 UTC (configured in vercel.json).
 * For each user who has at least one triage run, computes a health score
 * from their most recent run, stores a snapshot, and sends the digest email.
 *
 * Add CRON_SECRET to your Vercel environment variables.
 * Vercel passes it automatically as Authorization: Bearer <CRON_SECRET>.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeHealthScore, metricsFromResults } from '@/lib/health-score'
import { sendWeeklyDigestEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const weekLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Fetch all users who have at least one triage run — we identify them by
  // selecting distinct user_ids from triage_runs.
  const { data: runUsers, error: runUsersErr } = await supabase
    .from('triage_runs')
    .select('user_id')

  if (runUsersErr) {
    console.error('[cron/weekly-digest] Failed to fetch run users:', runUsersErr.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  const uniqueUserIds = [...new Set((runUsers ?? []).map((r: { user_id: string }) => r.user_id))]

  if (uniqueUserIds.length === 0) {
    console.log('[cron/weekly-digest] No users with runs — nothing to send.')
    return NextResponse.json({ sent: 0, failed: 0 })
  }

  let sent = 0
  let failed = 0

  for (const userId of uniqueUserIds) {
    try {
      // ── 1. Get the user's most recent run ──────────────────────────────────
      const { data: latestRun } = await supabase
        .from('triage_runs')
        .select('id')
        .eq('user_id', userId)
        .order('run_at', { ascending: false })
        .limit(1)
        .single()

      if (!latestRun) continue

      // ── 2. Fetch all triage_results for that run ───────────────────────────
      const { data: results } = await supabase
        .from('triage_results')
        .select('priority, severity, gap_flags, pm_action, bug_id, title, quick_reason')
        .eq('run_id', latestRun.id)

      if (!results || results.length === 0) continue

      // ── 3. Compute health score ────────────────────────────────────────────
      const metrics = metricsFromResults(results)
      const scored  = computeHealthScore(metrics)

      // ── 4. Get previous snapshot for delta ────────────────────────────────
      const { data: prevSnapshot } = await supabase
        .from('backlog_health_snapshots')
        .select('score')
        .eq('user_id', userId)
        .order('computed_at', { ascending: false })
        .limit(1)
        .single()

      const scoreDelta = prevSnapshot ? scored.score - prevSnapshot.score : null

      // ── 5. Store new snapshot ──────────────────────────────────────────────
      await supabase.from('backlog_health_snapshots').insert({
        user_id:            userId,
        run_id:             null,    // cron snapshot — not tied to a specific upload
        score:              scored.score,
        total_bugs:         scored.total_bugs,
        p1_count:           scored.p1_count,
        p2_count:           scored.p2_count,
        critical_count:     scored.critical_count,
        flagged_count:      scored.flagged_count,
        missing_repro_count: scored.missing_repro_count,
        duplicate_count:    scored.duplicate_count,
        over_pri_count:     scored.over_pri_count,
        p1_rate:            scored.p1_rate,
        quality_flag_rate:  scored.quality_flag_rate,
        noise_rate:         scored.noise_rate,
      })

      // ── 6. Get the user's email ────────────────────────────────────────────
      const { data: userData, error: authErr } = await supabase.auth.admin.getUserById(userId)
      if (authErr || !userData?.user?.email) {
        console.warn('[cron/weekly-digest] Could not get email for user', userId)
        failed++
        continue
      }

      // ── 7. Build top P1 bugs (unreviewed, up to 3) ────────────────────────
      const topP1Bugs = results
        .filter((r: { priority: string; pm_action: string | null }) =>
          r.priority?.toUpperCase() === 'P1' && !r.pm_action
        )
        .slice(0, 3)
        .map((r: { bug_id: string; title: string; quick_reason: string | null }) => ({
          bug_id:       r.bug_id,
          title:        r.title,
          quick_reason: r.quick_reason,
        }))

      // ── 8. Send email ──────────────────────────────────────────────────────
      await sendWeeklyDigestEmail({
        to:               userData.user.email,
        score:            scored.score,
        scoreDelta,
        totalBugs:        scored.total_bugs,
        p1Count:          scored.p1_count,
        p2Count:          scored.p2_count,
        qualityFlagRate:  scored.quality_flag_rate,
        topP1Bugs,
        weekLabel,
      })

      sent++
      console.log(`[cron/weekly-digest] Sent to ${userData.user.email} (score: ${scored.score})`)
    } catch (e) {
      console.error('[cron/weekly-digest] Error processing user', userId, e)
      failed++
    }
  }

  console.log(`[cron/weekly-digest] Done — sent: ${sent}, failed: ${failed}`)
  return NextResponse.json({ sent, failed })
}

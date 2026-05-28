/**
 * Bulk import existing Jira bugs into the SenseBug backlog.
 *
 * POST /api/integrations/jira/sync-all
 *
 * Imports as many bugs as the user's monthly quota allows, paginating through
 * Jira results until quota is exhausted, no more bugs exist, or the function
 * is about to hit Vercel's timeout.
 *
 * Order of operations:
 *   1. Auth + trial-expiry gate
 *   2. Compute remaining monthly quota
 *   3. Fetch a Jira page (50 bugs), skip already-in-backlog, triage each
 *   4. Time-budget check between bugs — bail early before Vercel kills us
 *   5. Quota check between bugs — never over-spend Haiku
 *   6. Paginate to next page, repeat until done or limit reached
 *
 * Returns { synced, skipped, total_in_jira, capped, capped_reason,
 *           monthly_quota_remaining, errors[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'
import { ensureUserPlan, getPlanLimits, getPlanStatus } from '@/lib/plan'
import { searchJiraBugs } from '@/lib/jira-api'
import { triageSingleBug } from '@/lib/triage-single'
import { getCalibrationBlock } from '@/lib/pm-calibration'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 300

// Time budget — leaves 60s of headroom before Vercel's 300s hard timeout.
// At ~2s sustained per bug (Jira fetch + Haiku call + DB write), this fits
// roughly 120 bugs in one request. Anything beyond is split across re-runs.
const TIME_BUDGET_MS = 240_000

// Jira REST search page size — Jira caps single-request results at 100.
const PAGE_SIZE = 50

// Flush the monthly bug counter every N successful triages. Smaller = more
// timeout-resistant (we lose at most N-1 bugs of quota if Vercel kills us
// mid-sync), larger = fewer DB writes. 10 is a good balance.
const COUNTER_FLUSH_EVERY = 10

// In-flight lock TTL — if a sync started more than this long ago and hasn't
// completed (because the previous request died), allow a fresh sync to take
// the lock. 10 minutes is well past Vercel's 300s hard timeout, so any "live"
// sync is definitely still inside the lock window.
const SYNC_LOCK_TTL_MS = 10 * 60_000

export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Plan + trial check (consistent with the rest of the AI pipeline) ────────
  const plan   = await ensureUserPlan(supabase, user.id)
  const status = getPlanStatus(plan)
  if (status.isTrialExpired) {
    return NextResponse.json(
      {
        error: 'Your free trial has ended. Subscribe to continue importing bugs.',
        trial_expired: true,
        upgrade_url:   '/pricing',
      },
      { status: 402 }
    )
  }

  const limits = getPlanLimits(status.effectivePlan)
  const bugsConsumedAtStart = plan.monthly_bugs_consumed || 0
  const monthlyLimit = limits.monthlyBugLimit
  const monthlyRemainingAtStart =
    monthlyLimit === Infinity ? Infinity : Math.max(0, monthlyLimit - bugsConsumedAtStart)

  if (monthlyRemainingAtStart === 0) {
    return NextResponse.json(
      {
        error: 'You\'ve used your monthly bug quota. Upgrade your plan or wait until next month.',
        monthly_quota_remaining: 0,
        upgrade_url: '/pricing',
      },
      { status: 403 }
    )
  }

  // ── Load Jira integration ───────────────────────────────────────────────────
  const { data: integration } = await supabase
    .from('integrations')
    .select('id, site_url, email, api_token, project_key, sync_started_at')
    .eq('user_id', user.id)
    .eq('provider', 'jira')
    .single()

  if (!integration) {
    return NextResponse.json(
      { error: 'No Jira integration connected. Connect Jira first.' },
      { status: 400 }
    )
  }

  // ── In-flight lock — prevent parallel sync calls from double-counting ───────
  // If a sync started recently (within SYNC_LOCK_TTL_MS) and hasn't cleared the
  // lock yet, refuse this request. The lock TTL is well past Vercel's max
  // function time, so any "live" sync is definitely still holding the lock.
  // A stale lock (from a dead function) auto-expires and the new request takes it.
  if (integration.sync_started_at) {
    const lockAgeMs = Date.now() - new Date(integration.sync_started_at).getTime()
    if (lockAgeMs < SYNC_LOCK_TTL_MS) {
      return NextResponse.json(
        {
          error: 'A Jira sync is already in progress. Please wait for it to finish, then try again.',
          retry_after_seconds: Math.ceil((SYNC_LOCK_TTL_MS - lockAgeMs) / 1000),
        },
        { status: 409 }
      )
    }
  }

  // Take the lock — every later return path must clear it (we use try/finally below)
  await supabase
    .from('integrations')
    .update({ sync_started_at: new Date().toISOString() })
    .eq('id', integration.id)

  // ── Load KB + calibration once (reused for every bug in this run) ───────────
  const { data: kb } = await supabase
    .from('knowledge_base')
    .select('product_overview, critical_flows, product_areas')
    .eq('user_id', user.id)
    .single()
  const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }
  const calibrationBlock = await getCalibrationBlock(supabase, user.id).catch(() => null)

  // ── Main loop — paginate through Jira, triage what fits in our budget ───────
  const now = new Date().toISOString()
  let synced  = 0
  let pendingCounterDelta = 0  // bugs synced since the last counter flush
  let skipped = 0
  let totalInJira = 0
  let startAt = 0
  let cappedReason: 'time' | 'quota' | null = null
  const errors: Array<{ bug_id: string; error: string }> = []

  /**
   * Flush the pending counter delta to user_plans.monthly_bugs_consumed.
   * Re-reads the row first to reduce the window where a concurrent webhook
   * write would be clobbered (still not perfectly atomic, but the race
   * window shrinks from "entire sync" to "single flush").
   */
  async function flushCounter() {
    if (pendingCounterDelta === 0) return
    const { data: row } = await supabase
      .from('user_plans')
      .select('monthly_bugs_consumed')
      .eq('user_id', user.id)
      .single()
    const current = row?.monthly_bugs_consumed ?? bugsConsumedAtStart
    await supabase
      .from('user_plans')
      .update({ monthly_bugs_consumed: current + pendingCounterDelta })
      .eq('user_id', user.id)
    pendingCounterDelta = 0
  }

  /**
   * Always-runs cleanup: clear the sync lock and flush any pending counter
   * delta. Wrapped in try/catch each so a failure in one doesn't block the other.
   */
  async function cleanup() {
    try { await flushCounter() }
    catch (e) { console.error('[sync-all] flushCounter on cleanup failed:', e) }
    try {
      await supabase
        .from('integrations')
        .update({ sync_started_at: null })
        .eq('id', integration.id)
    } catch (e) {
      console.error('[sync-all] sync-lock clear failed:', e)
    }
  }

  try {

  paginate: while (true) {
    // Time check — bail before fetching the next page if we're nearly out of budget
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      cappedReason = 'time'
      break
    }

    // Quota check — bail before fetching if we've already hit the user's monthly cap
    if (monthlyRemainingAtStart !== Infinity && synced >= monthlyRemainingAtStart) {
      cappedReason = 'quota'
      break
    }

    // Fetch a page from Jira
    let page
    try {
      page = await searchJiraBugs(
        integration.site_url,
        integration.email,
        integration.api_token,
        { projectKey: integration.project_key, startAt, maxResults: PAGE_SIZE }
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      // If we've already imported some bugs, return what we got rather than 502
      if (synced > 0 || skipped > 0) {
        cappedReason = 'time'  // treat as a soft stop — user can re-run
        console.error(`[sync-all] Jira fetch error after ${synced} synced:`, msg)
        break
      }
      return NextResponse.json(
        { error: `Could not fetch from Jira: ${msg}` },
        { status: 502 }
      )
    }

    totalInJira = page.total
    if (page.issues.length === 0) break

    // Skip bugs already in the backlog (idempotency — re-running is safe)
    const incomingKeys = page.issues.map(i => i.bug_id)
    const { data: existing } = await supabase
      .from('backlog')
      .select('bug_id')
      .eq('user_id', user.id)
      .in('bug_id', incomingKeys)
    const existingSet = new Set((existing ?? []).map(r => r.bug_id))

    for (const bug of page.issues) {
      // Per-bug time check — Haiku calls vary, so check before every triage
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        cappedReason = 'time'
        break paginate
      }
      // Per-bug quota check — never over-spend
      if (monthlyRemainingAtStart !== Infinity && synced >= monthlyRemainingAtStart) {
        cappedReason = 'quota'
        break paginate
      }

      if (existingSet.has(bug.bug_id)) { skipped++; continue }

      try {
        const result = await triageSingleBug(
          {
            bug_id:      bug.bug_id,
            title:       bug.title,
            description: bug.description,
            comments:    bug.comments,
            priority:    bug.reporter_priority,
            labels:      bug.labels,
            components:  bug.components,
            status:      bug.status,
            created:     bug.created,
            updated:     bug.updated,
          },
          kbData,
          calibrationBlock,
        )

        const { error: upsertErr } = await supabase
          .from('backlog')
          .upsert({
            user_id:              user.id,
            bug_id:               bug.bug_id,
            title:                bug.title,
            rank:                 result.rank,
            priority:             result.priority,
            severity:             result.severity,
            quick_reason:         result.quick_reason,
            gap_flags:            result.gap_flags,
            original_description: bug.description || null,
            original_comments:    bug.comments    || null,
            reporter_priority:    bug.reporter_priority,
            source_run_id:        null,
            last_seen_at:         now,
            detail_generated_at:  null,
          }, { onConflict: 'user_id,bug_id', ignoreDuplicates: false })

        if (upsertErr) {
          errors.push({ bug_id: bug.bug_id, error: upsertErr.message })
          continue
        }
        synced++
        pendingCounterDelta++

        // Flush the counter periodically so we don't lose all the increments
        // if Vercel kills the function at the 300s timeout. Worst case we
        // lose COUNTER_FLUSH_EVERY-1 bugs of accounting (not the bugs themselves —
        // those are already upserted into the backlog).
        if (pendingCounterDelta >= COUNTER_FLUSH_EVERY) {
          await flushCounter()
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error'
        console.error(`[sync-all] Triage error for ${bug.bug_id}:`, msg)
        errors.push({ bug_id: bug.bug_id, error: msg })

        // Store as pending so the jira-sync cron retries it later
        await supabase.from('backlog').upsert({
          user_id:              user.id,
          bug_id:               bug.bug_id,
          title:                bug.title,
          rank:                 null,
          priority:             null,
          severity:             null,
          quick_reason:         null,
          gap_flags:            [],
          original_description: bug.description || null,
          original_comments:    bug.comments    || null,
          reporter_priority:    bug.reporter_priority,
          source_run_id:        null,
          last_seen_at:         now,
          detail_generated_at:  null,
        }, { onConflict: 'user_id,bug_id', ignoreDuplicates: false })
      }
    }

    // Move to the next page. If we've already seen all of Jira's matching bugs, stop.
    startAt += page.issues.length
    if (startAt >= page.total) break
  }

  } finally {
    // ALWAYS runs — whether we broke out cleanly, hit an error, or threw.
    // Flushes any remaining counter delta and clears the in-flight lock.
    await cleanup()
  }

  const remainingAfter =
    monthlyRemainingAtStart === Infinity
      ? -1
      : Math.max(0, monthlyRemainingAtStart - synced)

  // "capped" means: more bugs exist that we didn't sync, either due to time or quota.
  // If cappedReason is null, we got everything available.
  const capped = cappedReason !== null

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
  console.log(`[sync-all] user=${user.id} synced=${synced} skipped=${skipped} ` +
              `total_in_jira=${totalInJira} errors=${errors.length} ` +
              `elapsed=${elapsedSec}s capped=${cappedReason ?? 'none'}`)

  return NextResponse.json({
    synced,
    skipped,
    total_in_jira: totalInJira,
    capped,
    capped_reason: cappedReason,  // 'time' | 'quota' | null
    monthly_quota_remaining: remainingAfter,
    errors,
  })
}

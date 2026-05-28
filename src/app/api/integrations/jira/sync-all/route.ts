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
    .select('site_url, email, api_token, project_key')
    .eq('user_id', user.id)
    .eq('provider', 'jira')
    .single()

  if (!integration) {
    return NextResponse.json(
      { error: 'No Jira integration connected. Connect Jira first.' },
      { status: 400 }
    )
  }

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
  let skipped = 0
  let totalInJira = 0
  let startAt = 0
  let cappedReason: 'time' | 'quota' | null = null
  const errors: Array<{ bug_id: string; error: string }> = []

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

  // ── Increment monthly bug counter (single update, not per-bug) ──────────────
  if (synced > 0) {
    await supabase
      .from('user_plans')
      .update({ monthly_bugs_consumed: bugsConsumedAtStart + synced })
      .eq('user_id', user.id)
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

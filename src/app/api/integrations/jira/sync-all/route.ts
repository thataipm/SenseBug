/**
 * Bulk import existing Jira bugs into the SenseBug backlog.
 *
 * POST /api/integrations/jira/sync-all
 *
 * - Fetches bugs from Jira via REST search (filtered by saved project_key)
 * - Skips bugs already in the backlog (idempotent — safe to re-run)
 * - Triages each NEW bug via the same Haiku pipeline the webhook uses
 * - Respects plan limits + monthly bug quota + trial expiry
 * - Capped at SYNC_HARD_CAP per request to stay within Vercel's 300s timeout
 *   (user re-runs if they have more bugs than one request can handle)
 *
 * Returns: { synced, skipped, total_in_jira, capped, monthly_quota_remaining, errors[] }
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

// Hard cap per request — keeps us comfortably inside Vercel's 300s function timeout
// even at ~3s per bug (Jira fetch latency + Haiku call + DB write). If the user has
// more bugs in Jira than this, the response sets capped=true and they can re-run.
const SYNC_HARD_CAP = 50

export async function POST(request: NextRequest) {
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
  const bugsConsumedSoFar = plan.monthly_bugs_consumed || 0
  const monthlyRemaining =
    limits.monthlyBugLimit === Infinity
      ? Infinity
      : Math.max(0, limits.monthlyBugLimit - bugsConsumedSoFar)

  if (monthlyRemaining === 0) {
    return NextResponse.json(
      {
        error: 'You\'ve used your monthly bug quota. Upgrade your plan or wait until next month to import more.',
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

  // ── Fetch a single page from Jira (sorted by updated DESC, most recent first) ─
  let page
  try {
    page = await searchJiraBugs(
      integration.site_url,
      integration.email,
      integration.api_token,
      {
        projectKey: integration.project_key,
        startAt:    0,
        maxResults: SYNC_HARD_CAP,
      }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json(
      { error: `Could not fetch from Jira: ${msg}` },
      { status: 502 }
    )
  }

  if (page.issues.length === 0) {
    return NextResponse.json({
      synced: 0, skipped: 0,
      total_in_jira: page.total,
      capped: false,
      monthly_quota_remaining: monthlyRemaining === Infinity ? -1 : monthlyRemaining,
      errors: [],
    })
  }

  // ── Skip bugs already in the backlog so re-running is idempotent ────────────
  const incomingKeys = page.issues.map(i => i.bug_id)
  const { data: existing } = await supabase
    .from('backlog')
    .select('bug_id')
    .eq('user_id', user.id)
    .in('bug_id', incomingKeys)

  const existingSet = new Set((existing ?? []).map(r => r.bug_id))
  const newBugs = page.issues.filter(i => !existingSet.has(i.bug_id))
  const skipped = page.issues.length - newBugs.length

  if (newBugs.length === 0) {
    return NextResponse.json({
      synced: 0, skipped,
      total_in_jira: page.total,
      capped: page.total > SYNC_HARD_CAP,
      monthly_quota_remaining: monthlyRemaining === Infinity ? -1 : monthlyRemaining,
      errors: [],
      message: 'All visible Jira bugs are already in your backlog.',
    })
  }

  // ── Cap to monthly quota — never over-spend Haiku for a user ────────────────
  const bugsToTriage =
    monthlyRemaining === Infinity
      ? newBugs
      : newBugs.slice(0, monthlyRemaining)

  // ── Load KB + calibration once (reused for every bug in this batch) ─────────
  const { data: kb } = await supabase
    .from('knowledge_base')
    .select('product_overview, critical_flows, product_areas')
    .eq('user_id', user.id)
    .single()
  const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }
  const calibrationBlock = await getCalibrationBlock(supabase, user.id).catch(() => null)

  // ── Triage + upsert each bug sequentially ───────────────────────────────────
  // Sequential (not parallel) on purpose: each Haiku call is ~1-2s, parallel
  // can blow past Anthropic rate limits and Jira API limits. 50 bugs × ~2s = 100s,
  // well inside our 300s budget.
  const now = new Date().toISOString()
  let synced = 0
  const errors: Array<{ bug_id: string; error: string }> = []

  for (const bug of bugsToTriage) {
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
      // Per-bug error — log and continue, don't fail the whole batch
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

  // ── Increment monthly bug counter ───────────────────────────────────────────
  if (synced > 0) {
    await supabase
      .from('user_plans')
      .update({ monthly_bugs_consumed: bugsConsumedSoFar + synced })
      .eq('user_id', user.id)
  }

  const remainingAfter =
    monthlyRemaining === Infinity ? -1 : Math.max(0, monthlyRemaining - synced)
  const capped =
    page.total > SYNC_HARD_CAP ||
    (newBugs.length > bugsToTriage.length)   // hit monthly quota mid-batch

  console.log(`[sync-all] User ${user.id} — synced ${synced}, skipped ${skipped}, errors ${errors.length}`)

  return NextResponse.json({
    synced,
    skipped,
    total_in_jira: page.total,
    capped,
    monthly_quota_remaining: remainingAfter,
    errors,
  })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserPlan } from '@/lib/plan'
import { computeHealthScore, metricsFromResults } from '@/lib/health-score'

export const dynamic = 'force-dynamic'

// Minimum triaged bugs required for a meaningful live health snapshot.
const LIVE_SNAPSHOT_MIN = 5

// Returns the last 8 health snapshots for the authenticated user, newest first.
// The dashboard uses the first entry (current) + second entry (prev) for the delta.
// The insights page uses all 8 for the trend chart.
//
// If no stored snapshots exist (common for Jira-only users who have never run a
// CSV analysis), a live snapshot is computed on-the-fly from the current backlog
// and returned as a single-item array (no delta, no trend chart).
//
// Gated to Pro+ — free (starter) users receive { gated: true }.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = await ensureUserPlan(supabase, user.id)
  if (plan.plan === 'starter') {
    return NextResponse.json({ gated: true }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('backlog_health_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('computed_at', { ascending: false })
    .limit(8)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stored snapshots exist — return them (the normal path for CSV users)
  if (data && data.length > 0) {
    return NextResponse.json(data)
  }

  // No stored snapshots — compute a live snapshot from the current backlog.
  // This serves Jira-only users who have never run a CSV analysis.
  const { data: bugs } = await supabase
    .from('backlog')
    .select('priority, severity, gap_flags')
    .eq('user_id', user.id)
    .not('priority', 'is', null)   // only triaged bugs, skip pending

  if (!bugs || bugs.length < LIVE_SNAPSHOT_MIN) {
    // Not enough data for a meaningful score yet
    return NextResponse.json([])
  }

  const metrics = metricsFromResults(
    bugs.map(b => ({
      priority:  String(b.priority),
      severity:  String(b.severity ?? 'Medium'),
      gap_flags: Array.isArray(b.gap_flags) ? (b.gap_flags as string[]) : [],
    }))
  )
  const scored = computeHealthScore(metrics)

  // Shape matches the backlog_health_snapshots table so the insights page
  // doesn't need any changes. run_id=null marks it as a Jira/live snapshot.
  const liveSnapshot = {
    id:                  'live',
    score:               scored.score,
    computed_at:         new Date().toISOString(),
    total_bugs:          scored.total_bugs,
    p1_count:            scored.p1_count,
    p2_count:            scored.p2_count,
    critical_count:      scored.critical_count,
    flagged_count:       scored.flagged_count,
    missing_repro_count: scored.missing_repro_count,
    duplicate_count:     scored.duplicate_count,
    over_pri_count:      scored.over_pri_count,
    p1_rate:             scored.p1_rate,
    quality_flag_rate:   scored.quality_flag_rate,
    noise_rate:          scored.noise_rate,
    run_id:              null,
  }

  return NextResponse.json([liveSnapshot])
}

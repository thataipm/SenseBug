import { SupabaseClient } from '@supabase/supabase-js'

// ── Scoring weights ────────────────────────────────────────────────────────────
const PRIORITY_SCORE: Record<string, number> = {
  P1: 4000, P2: 3000, P3: 2000, P4: 1000,
}
const SEVERITY_SCORE: Record<string, number> = {
  Critical: 300, High: 200, Medium: 100, Low: 0,
}
const GAP_PENALTY  = 30   // per quality flag  — more gaps = lower rank within tier
const AGREE_BONUS  = 50   // reporter priority matches AI verdict (well-filed ticket)
const PM_BONUS     = 100  // PM explicitly approved the verdict (higher confidence)

interface BugRow {
  id:                string
  priority:          string | null
  severity:          string | null
  gap_flags:         unknown
  reporter_priority: string | null
  pm_action:         string | null
  edited_priority:   string | null
}

function scoreForBug(bug: BugRow): number {
  // Use PM's overridden priority if they edited — that's the effective priority
  const effective = (bug.pm_action === 'edited' && bug.edited_priority)
    ? bug.edited_priority
    : bug.priority

  // Pending bugs have no priority yet — excluded from ranking
  if (!effective) return -1

  const base    = PRIORITY_SCORE[effective] ?? 0
  const sev     = SEVERITY_SCORE[bug.severity ?? ''] ?? 0
  const penalty = (Array.isArray(bug.gap_flags) ? (bug.gap_flags as string[]).length : 0) * GAP_PENALTY
  const agree   = bug.reporter_priority && bug.reporter_priority === effective ? AGREE_BONUS : 0
  const pm      = bug.pm_action === 'approved' ? PM_BONUS : 0

  return base + sev - penalty + agree + pm
}

/**
 * Re-ranks all triaged backlog bugs for a given user.
 *
 * Scoring: priority tier (P1-P4) → severity → quality flags → reporter agreement → PM approval.
 * Bugs are assigned a global rank 1-N (1 = most urgent) so the backlog list sort
 * (priority → rank → first_seen_at) produces a meaningful order within each priority bucket.
 *
 * Pending bugs (priority = null) are skipped — they get ranked once the cron triages them.
 * PM-rejected bugs retain their rank so they stay visible in the correct position.
 *
 * Returns the number of bugs that were re-ranked (0 if backlog is empty or all pending).
 */
export async function rerankBacklog(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data: bugs, error } = await supabase
    .from('backlog')
    .select('id, priority, severity, gap_flags, reporter_priority, pm_action, edited_priority')
    .eq('user_id', userId)
    .not('priority', 'is', null)   // skip pending

  if (error) {
    console.error('[rerank] DB fetch error:', error.message)
    return 0
  }
  if (!bugs || bugs.length === 0) return 0

  // Score every bug, drop any that scored -1 (still pending despite the filter),
  // sort highest-first, then assign sequential ranks 1-N.
  const ranked = (bugs as BugRow[])
    .map(b => ({ id: b.id, score: scoreForBug(b) }))
    .filter(b => b.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((b, i) => ({ id: b.id, rank: i + 1 }))

  if (ranked.length === 0) return 0

  // Batch update in parallel chunks to stay well under Supabase connection limits
  const CHUNK = 50
  for (let i = 0; i < ranked.length; i += CHUNK) {
    await Promise.all(
      ranked.slice(i, i + CHUNK).map(({ id, rank }) =>
        supabase
          .from('backlog')
          .update({ rank })
          .eq('id', id)
          .eq('user_id', userId),   // ownership guard
      ),
    )
  }

  return ranked.length
}

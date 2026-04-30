// Pure health score computation — no DB calls, no side effects.
// Called from the upload route (from in-memory results) and from the weekly cron
// (from a DB query). The same formula in both places.

export interface BacklogMetrics {
  total_bugs: number
  p1_count: number
  p2_count: number
  critical_count: number
  flagged_count: number        // bugs with ≥1 quality gap flag (excl. over-pri and duplicate)
  missing_repro_count: number
  duplicate_count: number
  over_pri_count: number
}

export interface HealthScoreResult extends BacklogMetrics {
  score: number          // 0–100
  p1_rate: number        // integer %
  quality_flag_rate: number
  noise_rate: number
}

// Score formula — start at 100, apply four independent deductions.
//
// P1 concentration  (max –35): 20% P1 → full penalty. Signals a backlog that is
//   either genuinely on fire or badly inflated. Both are problems.
//
// Quality flag rate (max –35): 60% of bugs flagged → full penalty. Poor ticket
//   quality means the AI (and the dev team) can't triage confidently.
//
// Missing repro     (max –15): 50% missing repro → full penalty. Tickets devs
//   can't act on are backlog debt, not bugs.
//
// Noise rate        (max –10): (duplicates + over-prioritised) / total.
//   Reporter bias at scale.
//
// A fresh run with no reviews, no P1s, and well-written tickets scores ~90+.
// A backlog stuffed with P1s and vague tickets will score 40–60.
export function computeHealthScore(m: BacklogMetrics): HealthScoreResult {
  if (m.total_bugs === 0) {
    return { ...m, score: 100, p1_rate: 0, quality_flag_rate: 0, noise_rate: 0 }
  }

  const p1_rate          = m.p1_count / m.total_bugs
  const quality_flag_rate = m.flagged_count / m.total_bugs
  const missing_repro_rate = m.missing_repro_count / m.total_bugs
  const noise_rate        = (m.duplicate_count + m.over_pri_count) / m.total_bugs

  // Each penalty is proportional up to a cap. The multiplier is chosen so the
  // "bad but realistic" threshold (e.g. 20% P1) hits the cap exactly.
  const p1_penalty      = Math.min(35, Math.round(p1_rate * 175))    // 20% → 35
  const quality_penalty = Math.min(35, Math.round(quality_flag_rate * 58)) // 60% → 35
  const repro_penalty   = Math.min(15, Math.round(missing_repro_rate * 30)) // 50% → 15
  const noise_penalty   = Math.min(10, Math.round(noise_rate * 30))   // 33% → 10

  const score = Math.max(0, Math.min(100,
    100 - p1_penalty - quality_penalty - repro_penalty - noise_penalty
  ))

  return {
    ...m,
    score,
    p1_rate:          Math.round(p1_rate * 100),
    quality_flag_rate: Math.round(quality_flag_rate * 100),
    noise_rate:        Math.round(noise_rate * 100),
  }
}

// Build BacklogMetrics from an array of triage_result rows (in-memory, post-upload).
// gap_flags is string[] stored as a JSON array in Supabase — already parsed by the
// Supabase JS client.
export function metricsFromResults(
  results: Array<{
    priority: string
    severity: string
    gap_flags: string[]
  }>
): BacklogMetrics {
  const QUALITY_FLAGS = new Set([
    'Missing description',
    'No reproduction steps',
    'Missing environment info',
    'Vague impact statement',
    'Unknown reporter context',
  ])

  let p1 = 0, p2 = 0, critical = 0, flagged = 0, missing_repro = 0, dupe = 0, over_pri = 0

  for (const r of results) {
    const pri = r.priority?.toUpperCase()
    const sev = r.severity
    const flags: string[] = Array.isArray(r.gap_flags) ? r.gap_flags : []

    if (pri === 'P1') p1++
    if (pri === 'P2') p2++
    if (sev === 'Critical') critical++
    if (flags.includes('Possible duplicate')) dupe++
    if (flags.includes('Likely over-prioritised')) over_pri++
    if (flags.includes('No reproduction steps')) missing_repro++
    if (flags.some(f => QUALITY_FLAGS.has(f))) flagged++
  }

  return {
    total_bugs:          results.length,
    p1_count:            p1,
    p2_count:            p2,
    critical_count:      critical,
    flagged_count:       flagged,
    missing_repro_count: missing_repro,
    duplicate_count:     dupe,
    over_pri_count:      over_pri,
  }
}

export function scoreLabel(score: number): 'Healthy' | 'Needs attention' | 'At risk' {
  if (score >= 70) return 'Healthy'
  if (score >= 40) return 'Needs attention'
  return 'At risk'
}

export function scoreColor(score: number): { text: string; bg: string; border: string } {
  if (score >= 70) return { text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' }
  if (score >= 40) return { text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' }
  return              { text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'   }
}

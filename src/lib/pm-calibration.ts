import Anthropic from '@anthropic-ai/sdk'
import { SupabaseClient } from '@supabase/supabase-js'

export interface CalibrationSignal {
  verdict_count: number
  approval_rates: Record<string, {
    approved: number
    edited: number
    rejected: number
    total: number
    approval_pct: number
  }>
  top_rejection_reasons: Array<{ reason: string; count: number }>
  gap_flag_rejection_rates: Array<{ flag: string; rejection_pct: number; sample_size: number }>
}

const ALL_GAP_FLAGS = [
  'Missing description',
  'No reproduction steps',
  'Missing environment info',
  'Vague impact statement',
  'Likely over-prioritised',
  'Possible duplicate',
  'Unknown reporter context',
]

// ── Signal computation ──────────────────────────────────────────────────────────

export async function computeCalibrationSignal(
  supabase: SupabaseClient,
  userId: string
): Promise<CalibrationSignal> {
  const { data: verdicts } = await supabase
    .from('backlog')
    .select('priority, pm_action, rejection_reason, gap_flags')
    .eq('user_id', userId)
    .not('pm_action', 'is', null)

  if (!verdicts || verdicts.length === 0) {
    return { verdict_count: 0, approval_rates: {}, top_rejection_reasons: [], gap_flag_rejection_rates: [] }
  }

  // Approval rates per priority tier
  const byPriority: Record<string, { approved: number; edited: number; rejected: number }> = {}
  for (const v of verdicts) {
    const p = String(v.priority ?? 'Unknown')
    if (!byPriority[p]) byPriority[p] = { approved: 0, edited: 0, rejected: 0 }
    if (v.pm_action === 'approved')      byPriority[p].approved++
    else if (v.pm_action === 'edited')   byPriority[p].edited++
    else if (v.pm_action === 'rejected') byPriority[p].rejected++
  }

  const approval_rates: CalibrationSignal['approval_rates'] = {}
  for (const [p, c] of Object.entries(byPriority)) {
    const total = c.approved + c.edited + c.rejected
    approval_rates[p] = {
      ...c,
      total,
      approval_pct: total > 0 ? Math.round(((c.approved + c.edited) / total) * 100) : 0,
    }
  }

  // Top rejection reasons (from rejection_reason field, max 5)
  const reasonCounts: Record<string, number> = {}
  for (const v of verdicts) {
    if (v.pm_action === 'rejected' && v.rejection_reason) {
      const r = String(v.rejection_reason)
      reasonCounts[r] = (reasonCounts[r] ?? 0) + 1
    }
  }
  const top_rejection_reasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }))

  // Gap flag rejection rates — minimum 3 bugs with that flag for signal to be meaningful
  const gap_flag_rejection_rates: CalibrationSignal['gap_flag_rejection_rates'] = []
  for (const flag of ALL_GAP_FLAGS) {
    const withFlag = verdicts.filter(v => Array.isArray(v.gap_flags) && v.gap_flags.includes(flag))
    if (withFlag.length < 3) continue
    const rejected = withFlag.filter(v => v.pm_action === 'rejected').length
    gap_flag_rejection_rates.push({
      flag,
      rejection_pct: Math.round((rejected / withFlag.length) * 100),
      sample_size:   withFlag.length,
    })
  }
  gap_flag_rejection_rates.sort((a, b) => b.rejection_pct - a.rejection_pct)

  return {
    verdict_count: verdicts.length,
    approval_rates,
    top_rejection_reasons,
    gap_flag_rejection_rates,
  }
}

// ── Haiku summary generation ────────────────────────────────────────────────────

function signalToText(signal: CalibrationSignal): string {
  const rates = Object.entries(signal.approval_rates)
    .map(([p, r]) => `  ${p}: ${r.approval_pct}% accepted (${r.approved} approved, ${r.edited} adjusted, ${r.rejected} rejected of ${r.total})`)
    .join('\n')

  const reasons = signal.top_rejection_reasons.length > 0
    ? signal.top_rejection_reasons.map(r => `  "${r.reason}": ${r.count}×`).join('\n')
    : '  (none recorded)'

  const flags = signal.gap_flag_rejection_rates.length > 0
    ? signal.gap_flag_rejection_rates.map(r => `  "${r.flag}": ${r.rejection_pct}% rejected (n=${r.sample_size})`).join('\n')
    : '  (insufficient data)'

  return `Verdict count: ${signal.verdict_count}

Acceptance rates by AI-assigned priority:
${rates}

Top rejection reasons:
${reasons}

Gap flag rejection rates:
${flags}`
}

export async function generateCalibrationInjection(
  signal: CalibrationSignal,
  anthropic: Anthropic
): Promise<string> {
  const model = process.env.ANTHROPIC_CALIBRATION_MODEL ?? 'claude-haiku-4-5-20251001'

  const message = await anthropic.messages.create({
    model,
    max_tokens: 400,
    temperature: 0,
    system: `You are a triage calibration assistant. Given quantitative data about how a PM has been accepting and rejecting AI bug-priority calls, write 3–6 concise, actionable sentences that a bug-ranking AI should follow to better match this PM's judgment.

Rules:
- Be specific and numerical where the data supports it
- Use imperative tone ("Treat...", "Rank...", "When...")
- No preamble, no caveats, no bullet points — output sentences only
- Do not invent patterns not supported by the data`,
    messages: [{
      role: 'user',
      content: `PM verdict data:\n\n${signalToText(signal)}\n\nWrite the calibration instructions.`,
    }],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

// ── Block formatter ─────────────────────────────────────────────────────────────

export function buildCalibrationBlock(injection: string, verdictCount: number): string {
  return `--- PM CALIBRATION (${verdictCount} verdicts) ---
${injection}
--- END CALIBRATION ---`
}

// ── DB read: returns formatted block or null ────────────────────────────────────

export async function getCalibrationBlock(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('pm_calibration')
    .select('verdict_count, prompt_injection')
    .eq('user_id', userId)
    .single()

  if (!data || !data.prompt_injection || data.verdict_count < 30) return null
  return buildCalibrationBlock(data.prompt_injection, data.verdict_count)
}

// ── Full recompute + store ──────────────────────────────────────────────────────

export async function recomputeAndStoreCalibration(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return

  const signal = await computeCalibrationSignal(supabase, userId)
  if (signal.verdict_count < 30) return

  const anthropic = new Anthropic({ apiKey })
  const injection = await generateCalibrationInjection(signal, anthropic)
  if (!injection) return

  await supabase
    .from('pm_calibration')
    .upsert({
      user_id:          userId,
      verdict_count:    signal.verdict_count,
      signal_json:      signal,
      prompt_injection: injection,
      computed_at:      new Date().toISOString(),
    }, { onConflict: 'user_id' })
}

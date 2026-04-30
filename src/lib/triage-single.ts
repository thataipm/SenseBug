import Anthropic from '@anthropic-ai/sdk'
import { RANK_SYSTEM_PROMPT } from '@/lib/triage-prompts'

interface SingleBugInput {
  bug_id: string
  title: string
  description?: string | null
  comments?: string | null
  priority?: string | null
}

export interface SingleTriageResult {
  bug_id: string
  title: string
  rank: number
  priority: string
  severity: string
  quick_reason: string | null
  gap_flags: string[]
}

function buildUserPrompt(
  kb: { product_overview: string; critical_flows: string; product_areas: string },
  bugsJson: string
): string {
  return `PRODUCT KNOWLEDGE BASE
Product overview: ${kb.product_overview}
Critical user flows: ${kb.critical_flows}
Product areas / modules: ${kb.product_areas}
Relevant documentation context: No relevant documentation context available.

BUGS TO PRIORITIZE
${bugsJson}`
}

function tryParseResult(raw: string): Record<string, unknown> | null {
  for (const candidate of [raw, raw + ']']) {
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0] as Record<string, unknown>
    } catch { /* try next */ }
  }
  // Find last complete object
  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace > 0) {
    try {
      const parsed = JSON.parse(raw.slice(0, lastBrace + 1) + ']')
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0] as Record<string, unknown>
    } catch { /* give up */ }
  }
  return null
}

/**
 * Triage a single bug using Haiku (same model as Pass 1 batch upload).
 * Used by the Jira webhook to rank a bug as it arrives.
 */
export async function triageSingleBug(
  bug: SingleBugInput,
  kb: { product_overview: string; critical_flows: string; product_areas: string }
): Promise<SingleTriageResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const anthropic = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

  const payload = [{
    bug_id:      bug.bug_id,
    title:       bug.title,
    description: bug.description || '[No description provided]',
    comments:    bug.comments || '',
    priority:    bug.priority || '',
  }]

  const userPrompt = buildUserPrompt(kb, JSON.stringify(payload, null, 2))

  const message = await anthropic.messages.create({
    model,
    max_tokens: 512,
    temperature: 0,
    system: [{ type: 'text', text: RANK_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      { role: 'user',      content: userPrompt },
      { role: 'assistant', content: '['        },
    ],
  })

  const raw = '[' + (message.content[0].type === 'text' ? message.content[0].text : '')
  const result = tryParseResult(raw)
  if (!result) throw new SyntaxError('AI returned an unparseable result for single bug triage')

  return {
    bug_id:       String(result.bug_id   ?? bug.bug_id),
    title:        String(result.title    ?? bug.title),
    rank:         1,
    priority:     String(result.priority ?? 'P4'),
    severity:     String(result.severity ?? 'Low'),
    quick_reason: result.quick_reason ? String(result.quick_reason) : null,
    gap_flags:    Array.isArray(result.gap_flags) ? (result.gap_flags as string[]) : [],
  }
}

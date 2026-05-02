import Anthropic from '@anthropic-ai/sdk'
import { JIRA_SINGLE_TRIAGE_PROMPT } from '@/lib/triage-prompts'

export interface SingleBugInput {
  bug_id:      string
  title:       string
  description?: string | null
  comments?:   string | null
  priority?:   string | null  // reporter priority, already normalised to P1–P4
  // Richer Jira fields
  labels?:     string[]
  components?: string[]
  status?:     string | null
  created?:    string | null
  updated?:    string | null
}

export interface SingleTriageResult {
  bug_id:       string
  title:        string
  rank:         number
  priority:     string
  severity:     string
  quick_reason: string | null
  gap_flags:    string[]
}

function buildUserPrompt(
  kb:  { product_overview: string; critical_flows: string; product_areas: string },
  bug: SingleBugInput
): string {
  const kbEmpty =
    !kb.product_overview?.trim() &&
    !kb.critical_flows?.trim()   &&
    !kb.product_areas?.trim()

  const kbBlock = kbEmpty
    ? 'PRODUCT KNOWLEDGE BASE\nNot configured — triage based on ticket content alone.\n'
    : `PRODUCT KNOWLEDGE BASE
Product overview: ${kb.product_overview || 'Not provided'}
Critical user flows: ${kb.critical_flows || 'Not provided'}
Product areas / modules: ${kb.product_areas || 'Not provided'}`

  // Build a structured ticket payload — include every available Jira field
  // so the AI has full context for scoring.
  const payload: Record<string, unknown> = {
    bug_id:            bug.bug_id,
    title:             bug.title,
    description:       bug.description || '[No description provided]',
    comments:          bug.comments    || '',
    reporter_priority: bug.priority    || 'Unknown',
  }
  if (bug.labels     && bug.labels.length > 0)     payload.labels     = bug.labels
  if (bug.components && bug.components.length > 0)  payload.components = bug.components
  if (bug.status)                                   payload.status     = bug.status
  if (bug.created)                                  payload.created    = bug.created.slice(0, 10)
  if (bug.updated)                                  payload.updated    = bug.updated.slice(0, 10)

  return `${kbBlock}

BUG TICKET
${JSON.stringify([payload], null, 2)}`
}

function tryParseResult(raw: string): Record<string, unknown> | null {
  for (const candidate of [raw, raw + ']']) {
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0] as Record<string, unknown>
    } catch { /* try next */ }
  }
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
 * Triage a single Jira bug using Haiku.
 * Uses a dedicated single-ticket prompt (not the batch CSV prompt) and
 * passes the full Jira context: labels, components, status, dates, attributed comments.
 */
export async function triageSingleBug(
  bug:              SingleBugInput,
  kb:               { product_overview: string; critical_flows: string; product_areas: string },
  calibrationBlock?: string | null
): Promise<SingleTriageResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const anthropic = new Anthropic({ apiKey })
  const model     = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

  const userPrompt = buildUserPrompt(kb, bug)

  const message = await anthropic.messages.create({
    model,
    max_tokens:  768,
    temperature: 0,
    system: [
      { type: 'text', text: JIRA_SINGLE_TRIAGE_PROMPT, cache_control: { type: 'ephemeral' } },
      ...(calibrationBlock ? [{ type: 'text' as const, text: calibrationBlock }] : []),
    ],
    messages: [
      { role: 'user',      content: userPrompt },
      { role: 'assistant', content: '['        },
    ],
  })

  const raw    = '[' + (message.content[0].type === 'text' ? message.content[0].text : '')
  const result = tryParseResult(raw)
  if (!result) throw new SyntaxError('AI returned an unparseable result for single bug triage')

  return {
    bug_id:       String(result.bug_id      ?? bug.bug_id),
    title:        String(result.title       ?? bug.title),
    rank:         1,
    priority:     String(result.priority    ?? 'P4'),
    severity:     String(result.severity    ?? 'Low'),
    quick_reason: result.quick_reason ? String(result.quick_reason) : null,
    gap_flags:    Array.isArray(result.gap_flags) ? (result.gap_flags as string[]) : [],
  }
}

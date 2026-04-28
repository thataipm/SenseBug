import Anthropic from '@anthropic-ai/sdk'
import { DETAIL_SYSTEM_PROMPT } from '@/lib/triage-prompts'
import { stripJiraMarkup } from '@/lib/jira'

export interface BugForDetail {
  bug_id: string
  title: string
  rank: number
  priority: string
  severity: string
  quick_reason: string | null
  gap_flags: string[]
  reporter_priority: string | null
  original_description: string | null
  original_comments: string | null
}

export interface GeneratedDetail {
  business_impact: string
  rationale: string
  improved_description: string | null
}

// Build the user-side prompt for the per-bug detail call.
// kb is the user's knowledge base (text fields); retrievedChunks is the
// optional vector-search context. Both come from the calling route.
export function buildDetailUserPrompt(args: {
  kb: Record<string, string>
  retrievedChunks: string
  bug: BugForDetail
}): string {
  const { kb, retrievedChunks, bug } = args
  const cleanDesc     = bug.original_description ? stripJiraMarkup(bug.original_description).slice(0, 4000) : ''
  const cleanComments = bug.original_comments    ? stripJiraMarkup(bug.original_comments).slice(0, 2000)    : ''

  return `PRODUCT KNOWLEDGE BASE
Product overview: ${kb.product_overview}
Critical user flows: ${kb.critical_flows}
Product areas / modules: ${kb.product_areas}
Relevant documentation: ${retrievedChunks}

BUG TICKET
Bug ID: ${bug.bug_id}
Title: ${bug.title}
Reporter priority: ${bug.reporter_priority ?? 'N/A'}
Description: ${cleanDesc || '[No description provided]'}
${cleanComments ? `Comments: ${cleanComments}` : ''}

ASSIGNED RANKING (from previous pass — do not re-derive, explain why this is correct)
Rank: ${bug.rank}
Priority: ${bug.priority}
Severity: ${bug.severity}
Quick reason: ${bug.quick_reason ?? ''}
Gap flags: ${bug.gap_flags.length > 0 ? bug.gap_flags.join(', ') : 'none'}

Generate the detail (business_impact, rationale, improved_description) for this single bug.`
}

// Tolerant JSON object parser — handles a few common Claude truncation patterns.
export function parseDetailJson(raw: string): {
  business_impact?: string
  rationale?: string
  improved_description?: string | null
} {
  try { return JSON.parse(raw) } catch {}
  try { return JSON.parse(raw + '}') } catch {}
  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace > 0) {
    try { return JSON.parse(raw.slice(0, lastBrace + 1)) } catch {}
  }
  throw new SyntaxError('Detail response was not valid JSON')
}

// Single Claude call: generates business_impact / rationale / improved_description
// for one bug. Used by both the on-demand detail route (Sonnet) and the bulk
// export-fill (Haiku, no vector context).
export async function generateDetailForBug(args: {
  anthropic: Anthropic
  model: string
  kb: Record<string, string>
  retrievedChunks: string
  bug: BugForDetail
}): Promise<GeneratedDetail> {
  const { anthropic, model, kb, retrievedChunks, bug } = args
  const userPrompt = buildDetailUserPrompt({ kb, retrievedChunks, bug })

  const message = await anthropic.messages.create({
    model,
    max_tokens:  1500,
    temperature: 0,
    // Cache the system prompt — when generating detail for many bugs in a row,
    // calls 2-N reuse the cached prompt at ~10% input cost.
    system:   [{ type: 'text', text: DETAIL_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [
      { role: 'user',      content: userPrompt },
      { role: 'assistant', content: '{'        }, // prefill — forces JSON object
    ],
  })

  const raw = '{' + (message.content[0].type === 'text' ? message.content[0].text : '')
  const parsed = parseDetailJson(raw)
  return {
    business_impact:      String(parsed.business_impact ?? ''),
    rationale:            String(parsed.rationale ?? ''),
    improved_description: parsed.improved_description == null ? null : String(parsed.improved_description),
  }
}

// Run an array of async tasks with a maximum concurrency limit.
// Tasks that throw are converted to null in the results array — the caller
// decides what to do with failures (count, log, etc.). This is duplicated from
// the upload route on purpose: keeps the export route self-contained without
// pulling in upload-route imports.
export async function runDetailTasksConcurrent<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null)
  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const i = nextIndex++
      try {
        results[i] = await tasks[i]()
      } catch (e) {
        // Logged at the task level — keep the slot null
        console.error(`[detail-bulk] task ${i} failed:`, e instanceof Error ? e.message : e)
        results[i] = null
      }
    }
  }
  const workerCount = Math.min(maxConcurrent, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}

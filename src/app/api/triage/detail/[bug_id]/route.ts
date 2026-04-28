import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidOrigin } from '@/lib/csrf'
import { stripJiraMarkup } from '@/lib/jira'
import { DETAIL_SYSTEM_PROMPT } from '@/lib/triage-prompts'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Helper: build the user prompt for the detail call ────────────────────────
function buildDetailPrompt(args: {
  kb: Record<string, string>
  retrievedChunks: string
  bug: {
    bug_id: string
    title: string
    rank: number
    priority: string
    severity: string
    quick_reason: string | null
    gap_flags: string[]
    reporter_priority: string | null
    description: string
    comments: string | null
  }
}): string {
  const { kb, retrievedChunks, bug } = args
  return `PRODUCT KNOWLEDGE BASE
Product overview: ${kb.product_overview}
Critical user flows: ${kb.critical_flows}
Product areas / modules: ${kb.product_areas}
Relevant documentation: ${retrievedChunks}

BUG TICKET
Bug ID: ${bug.bug_id}
Title: ${bug.title}
Reporter priority: ${bug.reporter_priority ?? 'N/A'}
Description: ${bug.description || '[No description provided]'}
${bug.comments ? `Comments: ${bug.comments}` : ''}

ASSIGNED RANKING (from previous pass — do not re-derive, explain why this is correct)
Rank: ${bug.rank}
Priority: ${bug.priority}
Severity: ${bug.severity}
Quick reason: ${bug.quick_reason ?? ''}
Gap flags: ${bug.gap_flags.length > 0 ? bug.gap_flags.join(', ') : 'none'}

Generate the detail (business_impact, rationale, improved_description) for this single bug.`
}

// ── Helper: tolerant JSON object parser ──────────────────────────────────────
function parseDetailJson(raw: string): {
  business_impact?: string
  rationale?: string
  improved_description?: string | null
} {
  try { return JSON.parse(raw) } catch {}
  // Append closing brace — handles responses truncated before '}'
  try { return JSON.parse(raw + '}') } catch {}
  // Find the last quote-comma and close the object after it
  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace > 0) {
    try { return JSON.parse(raw.slice(0, lastBrace + 1)) } catch {}
  }
  throw new SyntaxError('Detail response was not valid JSON')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { bug_id: string } }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 30 detail calls / minute / user — generous enough for prefetch + manual clicks
  const { allowed, retryAfterMs } = checkRateLimit(`triage_detail:${user.id}`, 30, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many detail requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  const { bug_id } = params
  const body = await request.json().catch(() => ({}))
  const runId = body.run_id as string | undefined
  if (!runId) return NextResponse.json({ error: 'run_id is required' }, { status: 400 })

  // ── Look up the result row + verify ownership via the run ──────────────────
  // Two-step lookup is cleaner than a join and avoids RLS quirks.
  const { data: run } = await supabase
    .from('triage_runs')
    .select('id')
    .eq('id', runId)
    .eq('user_id', user.id)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const { data: result, error: resultErr } = await supabase
    .from('triage_results')
    .select('id, bug_id, title, rank, priority, severity, quick_reason, gap_flags, reporter_priority, original_description, original_comments, business_impact, rationale, improved_description, detail_generated_at')
    .eq('run_id', runId)
    .eq('bug_id', bug_id)
    .single()

  if (resultErr || !result) return NextResponse.json({ error: 'Bug not found' }, { status: 404 })

  // ── Cache hit: detail was already generated, return it without an AI call ──
  if (result.detail_generated_at) {
    return NextResponse.json({
      business_impact:      result.business_impact,
      rationale:            result.rationale,
      improved_description: result.improved_description,
      cached:               true,
    })
  }

  // ── Build context: KB text fields + targeted vector chunks for this bug ────
  const { data: kb } = await supabase
    .from('knowledge_base')
    .select('product_overview, critical_flows, product_areas')
    .eq('user_id', user.id)
    .single()

  const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }

  let retrievedChunks = 'No relevant documentation context available.'
  try {
    const { count } = await supabase
      .from('kb_documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (count && count > 0) {
      const queryText = `${result.title} ${result.original_description ?? ''}`.slice(0, 4000)
      const embResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: queryText,
      })
      const { data: chunks } = await supabase.rpc('match_kb_documents', {
        query_embedding: embResponse.data[0].embedding,
        match_count: 2,
        filter_user_id: user.id,
      })
      if (chunks && chunks.length > 0) {
        retrievedChunks = chunks
          .map((c: { filename: string; chunk_text: string }) => `[${c.filename}]: ${c.chunk_text}`)
          .join('\n\n')
      }
    }
  } catch {
    // Non-fatal — proceed without vector context
  }

  // ── Strip Jira markup from stored raw text before sending to Claude ────────
  const cleanDesc     = result.original_description ? stripJiraMarkup(result.original_description).slice(0, 4000) : ''
  const cleanComments = result.original_comments    ? stripJiraMarkup(result.original_comments).slice(0, 2000)    : ''

  const userPrompt = buildDetailPrompt({
    kb: kbData,
    retrievedChunks,
    bug: {
      bug_id:            result.bug_id,
      title:             result.title,
      rank:              result.rank,
      priority:          result.priority,
      severity:          result.severity,
      quick_reason:      result.quick_reason,
      gap_flags:         Array.isArray(result.gap_flags) ? result.gap_flags : [],
      reporter_priority: result.reporter_priority,
      description:       cleanDesc,
      comments:          cleanComments || null,
    },
  })

  // ── Call Sonnet (high quality) for the detail ──────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const anthropic = new Anthropic({ apiKey })
  // Sonnet by default for detail; can be overridden per-env if cost is a concern.
  const model = process.env.ANTHROPIC_DETAIL_MODEL ?? 'claude-sonnet-4-5-20250929'

  let message: Awaited<ReturnType<typeof anthropic.messages.create>>
  try {
    message = await anthropic.messages.create({
      model,
      max_tokens:  1500,
      temperature: 0,
      // Cache the system prompt — when a user opens 5 bugs in a row, batches
      // 2-5 reuse the cached prompt (~75% input-token saving on those calls).
      system:   [{ type: 'text', text: DETAIL_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        { role: 'user',      content: userPrompt },
        { role: 'assistant', content: '{'        }, // prefill — forces JSON object output
      ],
    })
  } catch (apiErr) {
    console.error('[detail] Claude API error:', apiErr instanceof Error ? apiErr.message : apiErr)
    return NextResponse.json({ error: 'AI request failed. Please try again.' }, { status: 500 })
  }

  if (message.stop_reason === 'max_tokens') {
    console.warn('[detail] Sonnet output hit max_tokens for bug', bug_id)
  }

  const raw = '{' + (message.content[0].type === 'text' ? message.content[0].text : '')

  let parsed: { business_impact?: string; rationale?: string; improved_description?: string | null }
  try {
    parsed = parseDetailJson(raw)
  } catch (parseErr) {
    console.error('[detail] JSON parse failed:', raw.slice(0, 300), parseErr)
    return NextResponse.json({ error: 'AI returned a malformed response. Please try again.' }, { status: 500 })
  }

  const business_impact      = String(parsed.business_impact ?? '')
  const rationale            = String(parsed.rationale ?? '')
  const improved_description = parsed.improved_description == null
    ? null
    : String(parsed.improved_description)

  // ── Persist for cache hits on subsequent opens ─────────────────────────────
  const { error: updateErr } = await supabase
    .from('triage_results')
    .update({
      business_impact,
      rationale,
      improved_description,
      detail_generated_at: new Date().toISOString(),
    })
    .eq('id', result.id)

  if (updateErr) {
    // Non-fatal — return the generated detail so the user gets value even
    // if the cache write failed. They'll just regenerate next time.
    console.error('[detail] Failed to cache detail in DB:', updateErr.message)
  }

  return NextResponse.json({
    business_impact,
    rationale,
    improved_description,
    cached: false,
  })
}

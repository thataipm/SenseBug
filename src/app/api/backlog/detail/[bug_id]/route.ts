import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidOrigin } from '@/lib/csrf'
import { generateDetailForBug } from '@/lib/triage-detail'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * POST /api/backlog/detail/[bug_id]
 *
 * On-demand AI detail (business_impact, rationale, improved_description) for a
 * backlog entry.  Used for bugs that arrived via the Jira webhook and therefore
 * have no source_run_id — they can't use the /api/triage/detail endpoint which
 * requires a run_id.
 *
 * Works for ANY backlog entry; the caller decides which endpoint to use.
 */
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

  // 30 detail calls / minute / user
  const { allowed, retryAfterMs } = checkRateLimit(`triage_detail:${user.id}`, 30, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many detail requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  const { bug_id } = params

  // Ownership enforced by filtering on user_id
  const { data: entry, error: entryErr } = await supabase
    .from('backlog')
    .select('id, bug_id, title, rank, priority, severity, quick_reason, gap_flags, reporter_priority, original_description, original_comments, business_impact, rationale, improved_description, detail_generated_at')
    .eq('user_id', user.id)
    .eq('bug_id', bug_id)
    .single()

  if (entryErr || !entry) {
    return NextResponse.json({ error: 'Bug not found' }, { status: 404 })
  }

  // Cache hit — return immediately without an AI call
  if (entry.detail_generated_at) {
    return NextResponse.json({
      business_impact:      entry.business_impact,
      rationale:            entry.rationale,
      improved_description: entry.improved_description,
      cached:               true,
    })
  }

  // Knowledge base
  const { data: kb } = await supabase
    .from('knowledge_base')
    .select('product_overview, critical_flows, product_areas')
    .eq('user_id', user.id)
    .single()

  const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }

  // Vector context — non-fatal if unavailable
  let retrievedChunks = 'No relevant documentation context available.'
  try {
    const { count } = await supabase
      .from('kb_documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (count && count > 0) {
      const queryText = `${entry.title} ${entry.original_description ?? ''}`.slice(0, 4000)
      const embResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: queryText,
      })
      const { data: chunks } = await supabase.rpc('match_kb_documents', {
        query_embedding: embResponse.data[0].embedding,
        match_count:     2,
        filter_user_id:  user.id,
      })
      if (chunks && chunks.length > 0) {
        retrievedChunks = (chunks as { filename: string; chunk_text: string }[])
          .map(c => `[${c.filename}]: ${c.chunk_text}`)
          .join('\n\n')
      }
    }
  } catch {
    // Non-fatal — continue without vector context
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const anthropic = new Anthropic({ apiKey })
  const model     = process.env.ANTHROPIC_DETAIL_MODEL ?? 'claude-sonnet-4-5-20250929'

  let detail
  try {
    detail = await generateDetailForBug({
      anthropic,
      model,
      kb: kbData,
      retrievedChunks,
      bug: {
        bug_id:               entry.bug_id,
        title:                entry.title,
        rank:                 entry.rank ?? 1,
        priority:             entry.priority  ?? 'P4',
        severity:             entry.severity  ?? 'Low',
        quick_reason:         entry.quick_reason,
        gap_flags:            Array.isArray(entry.gap_flags) ? entry.gap_flags : [],
        reporter_priority:    entry.reporter_priority,
        original_description: entry.original_description,
        original_comments:    entry.original_comments,
      },
    })
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error('[backlog/detail] JSON parse failed for', bug_id, ':', e.message)
      return NextResponse.json({ error: 'AI returned a malformed response. Please try again.' }, { status: 500 })
    }
    console.error('[backlog/detail] Claude API error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'AI request failed. Please try again.' }, { status: 500 })
  }

  const { business_impact, rationale, improved_description } = detail

  // Cache in the backlog row so subsequent opens are instant
  await supabase
    .from('backlog')
    .update({
      business_impact,
      rationale,
      improved_description,
      detail_generated_at: new Date().toISOString(),
    })
    .eq('id', entry.id)

  return NextResponse.json({
    business_impact,
    rationale,
    improved_description,
    cached: false,
  })
}

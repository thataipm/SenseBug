import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidOrigin } from '@/lib/csrf'
import { generateDetailForBug } from '@/lib/triage-detail'
import { ensureUserPlan } from '@/lib/plan'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

  // Plan check — rewrites are Pro+ only; impact + rationale free for all
  const plan   = await ensureUserPlan(supabase, user.id)
  const isPaid = plan.plan !== 'starter'

  // ── Cache hit: detail was already generated, return it without an AI call ──
  // Guard also checks business_impact: if a previous run stored detail_generated_at
  // but left business_impact null, regenerate rather than serving empty fields forever.
  if (result.detail_generated_at && result.business_impact != null) {
    return NextResponse.json({
      business_impact:      result.business_impact,
      rationale:            result.rationale,
      improved_description: isPaid ? result.improved_description : null,
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

  // ── Call Sonnet (high quality) for the detail ──────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 })

  const anthropic = new Anthropic({ apiKey })
  // Sonnet by default for on-demand detail; bulk export-fill uses Haiku via
  // ANTHROPIC_DETAIL_BULK_MODEL.
  const model = process.env.ANTHROPIC_DETAIL_MODEL ?? 'claude-sonnet-4-5-20250929'

  let detail
  try {
    detail = await generateDetailForBug({
      anthropic,
      model,
      kb: kbData,
      retrievedChunks,
      bug: {
        bug_id:               result.bug_id,
        title:                result.title,
        rank:                 result.rank,
        priority:             result.priority,
        severity:             result.severity,
        quick_reason:         result.quick_reason,
        gap_flags:            Array.isArray(result.gap_flags) ? result.gap_flags : [],
        reporter_priority:    result.reporter_priority,
        original_description: result.original_description,
        original_comments:    result.original_comments,
      },
    })
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error('[detail] JSON parse failed for bug', bug_id, ':', e.message)
      return NextResponse.json({ error: 'AI returned a malformed response. Please try again.' }, { status: 500 })
    }
    console.error('[detail] Claude API error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'AI request failed. Please try again.' }, { status: 500 })
  }

  const { business_impact, rationale, improved_description } = detail

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

  // Keep the backlog row in sync — fire-and-forget.
  // Works for detail triggered from both the results page and the backlog page.
  // If no backlog row exists yet (pre-Phase 2 run), this is a silent no-op.
  supabase
    .from('backlog')
    .update({
      business_impact,
      rationale,
      improved_description,
      detail_generated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('bug_id', bug_id)
    .then(({ error: bErr }) => {
      if (bErr) console.error('[detail] backlog sync error:', bErr.message)
    })

  return NextResponse.json({
    business_impact,
    rationale,
    improved_description: isPaid ? improved_description : null,
    cached: false,
  })
}

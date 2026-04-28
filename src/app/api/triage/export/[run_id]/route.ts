import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDetailForBug, runDetailTasksConcurrent } from '@/lib/triage-detail'
import Anthropic from '@anthropic-ai/sdk'

// Two-pass architecture: bugs the user never opened in the UI have NULL
// business_impact / rationale / improved_description. The CSV is the
// deliverable, so the export endpoint fills those in (Haiku, no vector
// search — keeps cost ~$0.10 per 250-bug full export). Cached forever
// after first generation, so re-exports are instant and free.
export const maxDuration = 300

const BULK_MODEL = process.env.ANTHROPIC_DETAIL_BULK_MODEL ?? 'claude-haiku-4-5-20251001'
const BULK_CONCURRENCY = 8

export async function GET(
  request: NextRequest,
  { params }: { params: { run_id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { run_id } = params

  const { data: run } = await supabase
    .from('triage_runs')
    .select('*')
    .eq('id', run_id)
    .eq('user_id', user.id)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const { data: results } = await supabase
    .from('triage_results')
    .select('*')
    .eq('run_id', run_id)
    .order('rank', { ascending: true })

  if (!results) return NextResponse.json({ error: 'No results found' }, { status: 404 })

  // ── Bulk-fill any missing detail before exporting ──────────────────────────
  // Old runs (pre two-pass) have business_impact populated already and skip.
  // New runs only have detail for bugs the user opened in the UI.
  const missing = results.filter((r) => r.detail_generated_at == null && r.business_impact == null)

  if (missing.length > 0) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Fall through and export with empty cells rather than fail the download
      console.error('[export] ANTHROPIC_API_KEY not set — exporting with blank detail cells')
    } else {
      const anthropic = new Anthropic({ apiKey })

      // Single KB fetch shared across all bugs (no per-bug vector search —
      // keeps the bulk fill fast and cheap; clicked-in-UI detail uses vector).
      const { data: kb } = await supabase
        .from('knowledge_base')
        .select('product_overview, critical_flows, product_areas')
        .eq('user_id', user.id)
        .single()

      const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }

      // Generate detail concurrently
      const tasks = missing.map((r) => async () => {
        const detail = await generateDetailForBug({
          anthropic,
          model: BULK_MODEL,
          kb:    kbData,
          retrievedChunks: 'No relevant documentation context available.',
          bug: {
            bug_id:               r.bug_id,
            title:                r.title,
            rank:                 r.rank,
            priority:             r.priority,
            severity:             r.severity,
            quick_reason:         r.quick_reason,
            gap_flags:            Array.isArray(r.gap_flags) ? r.gap_flags : [],
            reporter_priority:    r.reporter_priority,
            original_description: r.original_description,
            original_comments:    r.original_comments,
          },
        })
        // Persist + patch in-memory result so the CSV writer sees full data
        await supabase
          .from('triage_results')
          .update({
            business_impact:      detail.business_impact,
            rationale:            detail.rationale,
            improved_description: detail.improved_description,
            detail_generated_at:  new Date().toISOString(),
          })
          .eq('id', r.id)
        r.business_impact      = detail.business_impact
        r.rationale            = detail.rationale
        r.improved_description = detail.improved_description
        r.detail_generated_at  = new Date().toISOString()
      })

      const taskResults = await runDetailTasksConcurrent(tasks, BULK_CONCURRENCY)
      const failures = taskResults.filter(t => t === null).length
      if (failures > 0) {
        console.warn(`[export] ${failures}/${missing.length} detail generations failed; CSV will have blank cells for those rows.`)
      }
    }
  }

  // ── Build CSV ──────────────────────────────────────────────────────────────
  const headers = [
    'rank', 'bug_id', 'title',
    'reporter_priority', 'original_description',
    'ai_priority', 'ai_severity', 'ai_quick_reason',
    'ai_business_impact', 'ai_rationale',
    'ai_gap_flags', 'ai_confidence', 'ai_improved_description',
    'pm_action', 'pm_rejection_reason', 'final_priority', 'final_severity',
  ]

  function getConfidence(flags: string[]): string {
    const quality = flags.filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
    if (quality.includes('Missing description') || quality.length >= 2) return 'Low'
    if (quality.length === 1) return 'Medium'
    return 'High'
  }

  const escape = (v: unknown) => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const rows = results.map((r) => {
    const finalPriority = r.pm_action === 'edited' && r.edited_priority ? r.edited_priority : r.priority
    const finalSeverity = r.pm_action === 'edited' && r.edited_severity ? r.edited_severity : r.severity
    return [
      r.rank,
      r.bug_id,
      r.title,
      r.reporter_priority || '',
      r.original_description || '',
      r.priority,
      r.severity,
      r.quick_reason || '',
      r.business_impact || '',
      r.rationale || '',
      (r.gap_flags || []).join('; '),
      getConfidence(r.gap_flags || []),
      r.improved_description || '',
      r.pm_action || '',
      r.rejection_reason || '',
      finalPriority,
      finalSeverity,
    ].map(escape).join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')
  const safeBase = run.filename
    .replace(/\.(csv|xlsx?|tsv|txt)$/i, '')
    .replace(/[^a-z0-9._-]/gi, '_')
    .slice(0, 60)
  const filename = `sensebug-${safeBase}-ranked.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

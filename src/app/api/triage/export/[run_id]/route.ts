import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  // Build CSV
  const headers = [
    'rank', 'bug_id', 'title',
    'reporter_priority', 'original_description',
    'ai_priority', 'ai_severity', 'ai_business_impact', 'ai_rationale',
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
      r.business_impact,
      r.rationale,
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

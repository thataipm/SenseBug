import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { run_id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { run_id } = params

  // Verify ownership first
  const { data: run } = await supabase
    .from('triage_runs')
    .select('id')
    .eq('id', run_id)
    .eq('user_id', user.id)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  // Cascade: delete results first, then the run
  await supabase.from('triage_results').delete().eq('run_id', run_id)
  const { error } = await supabase.from('triage_runs').delete().eq('id', run_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

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

  return NextResponse.json({ run, results: results || [] })
}

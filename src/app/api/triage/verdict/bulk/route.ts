import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'

export async function PATCH(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { run_id, action, filter } = await request.json()
  // filter: 'all_unreviewed' | 'p4_unreviewed'

  if (!run_id || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify run ownership
  const { data: run } = await supabase
    .from('triage_runs')
    .select('user_id')
    .eq('id', run_id)
    .eq('user_id', user.id)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  // Build query for unreviewed results only
  let query = supabase
    .from('triage_results')
    .select('id')
    .eq('run_id', run_id)
    .is('pm_action', null)

  if (filter === 'p4_unreviewed') {
    query = query.eq('priority', 'P4')
  }

  const { data: targets } = await query

  if (!targets || targets.length === 0) {
    return NextResponse.json({ updated: 0, ids: [] })
  }

  const ids = targets.map((t: { id: string }) => t.id)

  const { error } = await supabase
    .from('triage_results')
    .update({ pm_action: action })
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: ids.length, ids })
}

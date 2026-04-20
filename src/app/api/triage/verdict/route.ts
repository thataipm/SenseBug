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

  const { result_id, action, edited_priority, edited_severity, rejection_reason } = await request.json()

  if (!result_id || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (action === 'rejected' && !rejection_reason) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
  }

  const update: Record<string, unknown> = { pm_action: action }
  if (action === 'edited') {
    if (edited_priority) update.edited_priority = edited_priority
    if (edited_severity) update.edited_severity = edited_severity
  }
  if (action === 'rejected') {
    update.rejection_reason = rejection_reason
  }

  // Verify ownership via run
  const { data: result } = await supabase
    .from('triage_results')
    .select('id, run_id')
    .eq('id', result_id)
    .single()

  if (!result) return NextResponse.json({ error: 'Result not found' }, { status: 404 })

  const { data: run } = await supabase
    .from('triage_runs')
    .select('user_id')
    .eq('id', result.run_id)
    .single()

  if (!run || run.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { error } = await supabase
    .from('triage_results')
    .update(update)
    .eq('id', result_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

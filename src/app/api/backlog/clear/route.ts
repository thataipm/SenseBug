import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'

export const dynamic = 'force-dynamic'

// DELETE /api/backlog/clear
// Permanently removes ALL backlog entries and health snapshots for the
// authenticated user. Intended for "switch product context" workflows where
// the entire backlog needs a clean slate.
//
// Does NOT delete triage run history (CSV runs are kept for reference) or
// Knowledge Base content — the caller is expected to update KB separately.
// PM calibration is a separate endpoint: DELETE /api/calibration.
export async function DELETE(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Count first so we can report how many rows were removed
  const { count: backlogCount } = await supabase
    .from('backlog')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { error: backlogErr } = await supabase
    .from('backlog')
    .delete()
    .eq('user_id', user.id)

  if (backlogErr) {
    console.error('[backlog/clear] delete error:', backlogErr.message)
    return NextResponse.json({ error: backlogErr.message }, { status: 500 })
  }

  // Also clear health snapshots — they're derived from backlog data and would
  // show stale scores from the previous product if left behind.
  const { error: snapshotErr } = await supabase
    .from('backlog_health_snapshots')
    .delete()
    .eq('user_id', user.id)

  if (snapshotErr) {
    // Non-fatal — backlog is already cleared, log and continue
    console.error('[backlog/clear] snapshot delete error:', snapshotErr.message)
  }

  return NextResponse.json({ cleared: backlogCount ?? 0 })
}

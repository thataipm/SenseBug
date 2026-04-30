import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'

export const dynamic = 'force-dynamic'

const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 }

// GET /api/backlog
// Returns all backlog entries for the user ordered by priority → rank.
// Query params:
//   priority   — filter to a single priority (P1 / P2 / P3 / P4)
//   status     — 'unreviewed' | 'approved' | 'rejected' | 'edited' | 'all' (default all)
//   search     — substring match against bug_id and title (case-insensitive, server-side)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const priority = searchParams.get('priority')
  const status   = searchParams.get('status') ?? 'all'
  const search   = searchParams.get('search') ?? ''

  let query = supabase
    .from('backlog')
    .select('*')
    .eq('user_id', user.id)

  if (priority) query = query.eq('priority', priority)

  if (status === 'unreviewed') query = query.is('pm_action', null)
  else if (status === 'approved') query = query.eq('pm_action', 'approved')
  else if (status === 'rejected') query = query.eq('pm_action', 'rejected')
  else if (status === 'edited')   query = query.eq('pm_action', 'edited')

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let entries = data ?? []

  // Client-side search (Supabase ilike works but requires careful escaping;
  // with small-to-medium backlogs filtering in JS is fine and avoids an extra index)
  if (search) {
    const q = search.toLowerCase()
    entries = entries.filter(
      (e: { bug_id: string; title: string }) =>
        e.bug_id.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)
    )
  }

  // Sort: priority → rank within priority → first_seen_at for unranked
  entries.sort((a: { priority: string; rank: number | null; first_seen_at: string }, b: { priority: string; rank: number | null; first_seen_at: string }) => {
    const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 9
    const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 9
    if (pa !== pb) return pa - pb
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank
    if (a.rank !== null) return -1
    if (b.rank !== null) return 1
    return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime()
  })

  return NextResponse.json(entries)
}

// PATCH /api/backlog
// Updates a backlog entry — handles both PM verdicts and detail caching.
// Body: { id, action?, edited_priority?, edited_severity?, rejection_reason?,
//         business_impact?, rationale?, improved_description?, detail_generated_at? }
export async function PATCH(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, action, edited_priority, edited_severity, rejection_reason } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Verify ownership
  const { data: entry } = await supabase
    .from('backlog')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: Record<string, unknown> = {}

  if (action) {
    if (!['approved', 'edited', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    if (action === 'rejected' && !rejection_reason) {
      return NextResponse.json({ error: 'rejection_reason is required' }, { status: 400 })
    }
    update.pm_action = action
    if (action === 'edited') {
      if (edited_priority) update.edited_priority = edited_priority
      if (edited_severity) update.edited_severity = edited_severity
    }
    if (action === 'rejected') update.rejection_reason = rejection_reason
  }

  const { error } = await supabase
    .from('backlog')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserPlan } from '@/lib/plan'

export const dynamic = 'force-dynamic'

// Returns the last 8 health snapshots for the authenticated user, newest first.
// The dashboard uses the first entry (current) + second entry (prev) for the delta.
// The insights page uses all 8 for the trend chart.
// Gated to Pro+ — free (starter) users receive { gated: true }.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = await ensureUserPlan(supabase, user.id)
  if (plan.plan === 'starter') {
    return NextResponse.json({ gated: true }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('backlog_health_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('computed_at', { ascending: false })
    .limit(8)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

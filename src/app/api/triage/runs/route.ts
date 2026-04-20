import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('triage_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('run_at', { ascending: false })

  const runs = data || []

  // Fetch priority breakdown and review status for all runs in one query
  type PriorityMap = Record<string, { P1: number; P2: number; P3: number; P4: number }>
  type ReviewedMap = Record<string, number>
  let priorityByRun: PriorityMap = {}
  let reviewedByRun: ReviewedMap = {}

  if (runs.length > 0) {
    const runIds = runs.map((r: { id: string }) => r.id)
    const { data: resultsData } = await supabase
      .from('triage_results')
      .select('run_id, priority, pm_action')
      .in('run_id', runIds)

    priorityByRun = (resultsData || []).reduce((acc: PriorityMap, row: { run_id: string; priority: string; pm_action: string | null }) => {
      if (!acc[row.run_id]) acc[row.run_id] = { P1: 0, P2: 0, P3: 0, P4: 0 }
      const p = row.priority as keyof typeof acc[string]
      if (p in acc[row.run_id]) acc[row.run_id][p]++
      return acc
    }, {})

    reviewedByRun = (resultsData || []).reduce((acc: ReviewedMap, row: { run_id: string; pm_action: string | null }) => {
      if (!acc[row.run_id]) acc[row.run_id] = 0
      if (row.pm_action) acc[row.run_id]++
      return acc
    }, {})
  }

  const runsWithPriority = runs.map((run: { id: string; [key: string]: unknown }) => ({
    ...run,
    priority_counts: priorityByRun[run.id] || { P1: 0, P2: 0, P3: 0, P4: 0 },
    reviewed_count: reviewedByRun[run.id] || 0,
  }))

  return NextResponse.json(runsWithPriority)
}

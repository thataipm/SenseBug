import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureUserPlan, getPlanLimits, getPlanDisplayName } from '@/lib/plan'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const plan = await ensureUserPlan(supabase, user.id)
  const limits = getPlanLimits(plan.plan)

  const bugsAnalyzedThisMonth = plan.monthly_bugs_consumed || 0

  return NextResponse.json({
    plan: plan.plan,
    plan_display: getPlanDisplayName(plan.plan),
    monthly_runs_count: plan.monthly_runs_count,
    monthly_bug_limit: limits.monthlyBugLimit === Infinity ? -1 : limits.monthlyBugLimit,
    bugs_per_run_limit: limits.maxBugsPerRun,
    bugs_analyzed_this_month: bugsAnalyzedThisMonth,
    doc_upload: limits.docUpload,
  })
}

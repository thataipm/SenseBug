import { SupabaseClient } from '@supabase/supabase-js'

export interface UserPlan {
  id: string
  user_id: string
  plan: 'starter' | 'pro' | 'max' | 'admin'
  trial_started_at: string | null  // kept in DB for migration safety, no longer used
  trial_ends_at: string | null     // kept in DB for migration safety, no longer used
  monthly_runs_count: number
  monthly_bugs_consumed: number   // non-decreasing within the month — never reduced on run deletion
  last_reset_at: string
}

export interface PlanLimits {
  monthlyBugLimit: number   // total bugs analysed per calendar month (Infinity = unlimited)
  maxBugsPerRun: number     // per-run cap — controls AI cost per single request
  docUpload: boolean
}

export function getPlanLimits(plan: string): PlanLimits {
  switch (plan) {
    case 'starter':
      return { monthlyBugLimit: 50,  maxBugsPerRun: 50,  docUpload: false }
    case 'pro':
      return { monthlyBugLimit: 250, maxBugsPerRun: 100, docUpload: true  }
    case 'team': // legacy identifier — kept for existing DB rows
    case 'max':
      return { monthlyBugLimit: 500,      maxBugsPerRun: 250,  docUpload: true  }
    case 'admin':
      return { monthlyBugLimit: Infinity, maxBugsPerRun: 1000, docUpload: true  }
    default:
      return { monthlyBugLimit: 50,       maxBugsPerRun: 50,   docUpload: false }
  }
}

export function getPlanDisplayName(plan: string): string {
  switch (plan) {
    case 'starter': return 'Starter'
    case 'pro':     return 'Pro'
    case 'team':    // legacy
    case 'max':     return 'Max'
    case 'admin':   return 'Admin'
    default:        return 'Starter'
  }
}

export async function ensureUserPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPlan> {
  const { data: plan } = await supabase
    .from('user_plans')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!plan) {
    // New users start on Starter — no trial
    const { data: newPlan } = await supabase
      .from('user_plans')
      .insert({
        user_id: userId,
        plan: 'starter',
        monthly_runs_count: 0,
        monthly_bugs_consumed: 0,
        last_reset_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (!newPlan) throw new Error('Failed to create user plan')
    return newPlan as UserPlan
  }

  let currentPlan = plan as UserPlan
  const updates: Record<string, unknown> = {}

  // Legacy: if a user was on pro_trial before, move them to starter
  if ((currentPlan.plan as string) === 'pro_trial') {
    updates.plan = 'starter'
    currentPlan = { ...currentPlan, plan: 'starter' }
  }

  // Monthly quota reset
  const lastReset = new Date(currentPlan.last_reset_at)
  const now = new Date()
  if (
    lastReset.getUTCMonth() !== now.getUTCMonth() ||
    lastReset.getUTCFullYear() !== now.getUTCFullYear()
  ) {
    updates.monthly_runs_count = 0
    updates.monthly_bugs_consumed = 0
    updates.last_reset_at = now.toISOString()
    currentPlan = { ...currentPlan, monthly_runs_count: 0, monthly_bugs_consumed: 0 }
  }

  if (Object.keys(updates).length > 0) {
    const { data: updated } = await supabase
      .from('user_plans')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single()
    return (updated || currentPlan) as UserPlan
  }

  return currentPlan
}

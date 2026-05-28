import { SupabaseClient } from '@supabase/supabase-js'

// Trial length for new signups — Pro features for 14 days, no credit card.
export const TRIAL_DAYS = 14

export interface UserPlan {
  id: string
  user_id: string
  plan: 'pro' | 'max' | 'admin' | 'starter'  // 'starter' kept for legacy rows that haven't been migrated
  trial_started_at: string | null
  trial_ends_at: string | null
  monthly_runs_count: number
  monthly_bugs_consumed: number   // non-decreasing within the month — never reduced on run deletion
  last_reset_at: string
  payment_subscription_id?: string | null
}

export interface PlanLimits {
  monthlyBugLimit: number   // total bugs analysed per calendar month (Infinity = unlimited)
  maxBugsPerRun: number     // per-run cap — controls AI cost per single request
  docUpload: boolean
}

/**
 * Limits per plan tier.
 * Note: legacy 'starter' is aliased to Pro limits — during trial they get the Pro
 * experience, after trial they're blocked at the route level (see getPlanStatus).
 */
export function getPlanLimits(plan: string): PlanLimits {
  switch (plan) {
    case 'pro':
    case 'starter':  // legacy — during trial users see Pro limits; gating happens via trial expiry
      return { monthlyBugLimit: 250, maxBugsPerRun: 100, docUpload: true  }
    case 'team':     // legacy identifier — kept for existing DB rows
    case 'max':
      return { monthlyBugLimit: 500,      maxBugsPerRun: 250,  docUpload: true  }
    case 'admin':
      return { monthlyBugLimit: Infinity, maxBugsPerRun: 1000, docUpload: true  }
    default:
      // Unknown plan → safe default of Pro-level limits
      return { monthlyBugLimit: 250, maxBugsPerRun: 100, docUpload: true  }
  }
}

export function getPlanDisplayName(plan: string): string {
  switch (plan) {
    case 'starter': return 'Pro Trial'
    case 'pro':     return 'Pro'
    case 'team':    // legacy
    case 'max':     return 'Max'
    case 'admin':   return 'Admin'
    default:        return 'Pro'
  }
}

/**
 * Computed status that combines plan, trial dates, and payment state.
 * Use this everywhere instead of reading raw `plan.plan` so trial behaviour
 * is consistent across upload route, dashboard banner, and the /api/plan response.
 */
export interface PlanStatus {
  plan: string                  // canonical plan name for limit lookup ('pro' | 'max' | 'admin')
  effectivePlan: string         // same as above, for clarity
  isTrialing: boolean
  isTrialExpired: boolean
  isPaid: boolean
  daysLeftInTrial: number       // 0 if no trial / expired
  trialEndsAt: string | null
}

export function getPlanStatus(plan: UserPlan): PlanStatus {
  const now = new Date()
  const trialEndsAt = plan.trial_ends_at ? new Date(plan.trial_ends_at) : null
  const isPaid = !!plan.payment_subscription_id

  // Admin users bypass all trial logic
  if (plan.plan === 'admin') {
    return {
      plan: 'admin', effectivePlan: 'admin',
      isTrialing: false, isTrialExpired: false, isPaid: true,
      daysLeftInTrial: 0, trialEndsAt: null,
    }
  }

  // Paid Pro/Max — no trial concerns. Cast to string for legacy 'team' alias check.
  const planStr = plan.plan as string
  if (isPaid && (planStr === 'pro' || planStr === 'max' || planStr === 'team')) {
    const canonical = planStr === 'team' ? 'max' : planStr
    return {
      plan: canonical, effectivePlan: canonical,
      isTrialing: false, isTrialExpired: false, isPaid: true,
      daysLeftInTrial: 0, trialEndsAt: null,
    }
  }

  // Trial state — based on trial_ends_at.
  // "No payment AND no trial dates" → treat as expired/blocked. This catches:
  //   - Cancelled subscribers after subscription.expired runs
  //   - Legacy 'starter' users who weren't grandfathered with a trial date
  //   - Any unexpected state where the user has no valid access reason
  const hasTrialDate    = trialEndsAt !== null
  const isTrialing      = hasTrialDate && trialEndsAt! > now && !isPaid
  const isTrialExpired  = (hasTrialDate && trialEndsAt! <= now && !isPaid) || (!hasTrialDate && !isPaid)
  const daysLeftInTrial = isTrialing && trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // For limit lookup: use the plan they signed up for (legacy 'starter' rows alias to Pro)
  const limitPlan = (planStr === 'pro' || planStr === 'max') ? planStr : 'pro'

  return {
    plan: limitPlan,
    effectivePlan: limitPlan,
    isTrialing,
    isTrialExpired,
    isPaid,
    daysLeftInTrial,
    trialEndsAt: plan.trial_ends_at,
  }
}

/**
 * Ensure the user has a user_plans row.
 * New users start on a 14-day Pro trial.
 * Existing rows get monthly counters reset on month boundary.
 */
export async function ensureUserPlan(
  supabase: SupabaseClient,
  userId: string,
  initialPlan: 'pro' | 'max' = 'pro',
): Promise<UserPlan> {
  const { data: plan } = await supabase
    .from('user_plans')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!plan) {
    // New user — start a Pro trial (default) or Max trial if signup came via Max CTA
    const now = new Date()
    const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    const { data: newPlan } = await supabase
      .from('user_plans')
      .insert({
        user_id: userId,
        plan: initialPlan,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        monthly_runs_count: 0,
        monthly_bugs_consumed: 0,
        last_reset_at: now.toISOString(),
      })
      .select()
      .single()
    if (!newPlan) throw new Error('Failed to create user plan')
    return newPlan as UserPlan
  }

  let currentPlan = plan as UserPlan
  const updates: Record<string, unknown> = {}

  // Legacy: if a user was on pro_trial before, move them to starter (trial state)
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

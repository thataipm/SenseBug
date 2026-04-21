import { Webhooks } from '@dodopayments/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'

// Admin client is safe to initialise at module level — no request context needed
const supabase = createAdminClient()

// Helper: update the user_plans row identified by metadata.user_id
async function activatePlan(data: Record<string, unknown>) {
  const userId = (data.metadata as Record<string, string> | null)?.user_id
  const plan   = (data.metadata as Record<string, string> | null)?.plan
  const subId  = data.subscription_id as string | undefined
  const custId = (data.customer as Record<string, string> | null)?.customer_id

  if (!userId || !plan) {
    console.warn('[dodo/webhook] activatePlan: missing user_id or plan in metadata', data)
    return
  }

  await supabase
    .from('user_plans')
    .update({
      plan,
      stripe_subscription_id: subId ?? null,
      stripe_customer_id:     custId ?? null,
    })
    .eq('user_id', userId)
}

async function deactivatePlan(data: Record<string, unknown>) {
  const userId = (data.metadata as Record<string, string> | null)?.user_id

  if (!userId) {
    console.warn('[dodo/webhook] deactivatePlan: missing user_id in metadata', data)
    return
  }

  await supabase
    .from('user_plans')
    .update({ plan: 'starter', stripe_subscription_id: null })
    .eq('user_id', userId)
}

export const POST = Webhooks({
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,

  // Subscription activated (new subscriber or reactivation)
  onSubscriptionActive: async (payload) => {
    await activatePlan(payload.data as unknown as Record<string, unknown>)
  },

  // Subscription successfully renewed — keep plan active
  onSubscriptionRenewed: async (payload) => {
    await activatePlan(payload.data as unknown as Record<string, unknown>)
  },

  // Plan changed (upgrade / downgrade within Dodo portal)
  onSubscriptionPlanChanged: async (payload) => {
    await activatePlan(payload.data as unknown as Record<string, unknown>)
  },

  // Subscription cancelled by user or via portal
  onSubscriptionCancelled: async (payload) => {
    await deactivatePlan(payload.data as unknown as Record<string, unknown>)
  },

  // Subscription expired (end of billing period after cancel)
  onSubscriptionExpired: async (payload) => {
    await deactivatePlan(payload.data as unknown as Record<string, unknown>)
  },

  // Payment failed — log for now; Dodo will retry automatically
  onSubscriptionFailed: async (payload) => {
    const data = payload.data as unknown as Record<string, unknown>
    const userId = (data.metadata as Record<string, string> | null)?.user_id
    console.warn('[dodo/webhook] Subscription payment failed for user:', userId)
  },
})

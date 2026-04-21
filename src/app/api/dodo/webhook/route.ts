import { NextRequest, NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'
import { createAdminClient } from '@/lib/supabase/admin'

// Admin client is safe to initialise at module level — no API calls happen here
const supabase = createAdminClient()

/**
 * Look up a Supabase user ID by email.
 * The JS SDK doesn't expose an email-filter on listUsers, so we call the
 * Auth admin REST endpoint directly (requires service-role key).
 */
async function getUserIdByEmail(email: string): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    )
    if (!res.ok) return null
    const body = await res.json()
    return (body?.users?.[0]?.id as string) ?? null
  } catch {
    return null
  }
}

/**
 * Map a Dodo product_id back to a plan name.
 * Evaluated at request time so env vars are always resolved.
 */
function planFromProductId(productId: string | undefined): 'pro' | 'team' | null {
  if (!productId) return null
  if (productId === process.env.DODO_PRO_PRODUCT_ID)  return 'pro'
  if (productId === process.env.DODO_TEAM_PRODUCT_ID) return 'team'
  return null
}

type SubscriptionWebhookData = {
  subscription_id?: string
  product_id?: string
  customer?: { customer_id?: string; email?: string }
  metadata?: Record<string, string>
}

/** Resolve the Supabase user ID from webhook data (metadata first, then email lookup). */
async function resolveUserId(data: SubscriptionWebhookData): Promise<string | null> {
  // Primary: Dodo may propagate checkout-session metadata to the subscription
  if (data.metadata?.user_id) return data.metadata.user_id

  // Fallback: look up by the customer's email address
  if (data.customer?.email) {
    const id = await getUserIdByEmail(data.customer.email)
    if (id) return id
  }

  return null
}

async function activatePlan(data: SubscriptionWebhookData) {
  const userId = await resolveUserId(data)

  // Plan: prefer metadata value, fall back to product_id mapping
  const plan: string | null =
    data.metadata?.plan ?? planFromProductId(data.product_id)

  if (!userId || !plan) {
    console.error('[dodo/webhook] activatePlan: could not resolve userId or plan', {
      metadataUserId: data.metadata?.user_id,
      metadataPlan:   data.metadata?.plan,
      customerEmail:  data.customer?.email,
      productId:      data.product_id,
    })
    return
  }

  const { error } = await supabase
    .from('user_plans')
    .update({
      plan,
      payment_subscription_id: data.subscription_id ?? null,
      payment_customer_id:     data.customer?.customer_id ?? null,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('[dodo/webhook] activatePlan DB error:', error.message)
  } else {
    console.log(`[dodo/webhook] activatePlan: upgraded user ${userId} to plan "${plan}"`)
  }
}

async function deactivatePlan(data: SubscriptionWebhookData) {
  const userId = await resolveUserId(data)

  if (!userId) {
    console.error('[dodo/webhook] deactivatePlan: could not resolve userId', {
      metadataUserId: data.metadata?.user_id,
      customerEmail:  data.customer?.email,
    })
    return
  }

  const { error } = await supabase
    .from('user_plans')
    .update({ plan: 'starter', payment_subscription_id: null })
    .eq('user_id', userId)

  if (error) {
    console.error('[dodo/webhook] deactivatePlan DB error:', error.message)
  } else {
    console.log(`[dodo/webhook] deactivatePlan: reset user ${userId} to starter`)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()

  // All env var access inside the request handler — never at module load time
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY
  if (!webhookKey) {
    console.error('[dodo/webhook] DODO_PAYMENTS_WEBHOOK_KEY is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const verifier = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY || 'unused',
    webhookKey,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
  })

  let event: { type: string; data: SubscriptionWebhookData }
  try {
    event = verifier.webhooks.unwrap(body, {
      headers: {
        'webhook-id':        request.headers.get('webhook-id')        ?? '',
        'webhook-signature': request.headers.get('webhook-signature') ?? '',
        'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
      },
    }) as { type: string; data: SubscriptionWebhookData }
  } catch {
    console.error('[dodo/webhook] Signature verification failed')
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  // In test_mode log the full payload to Vercel Functions logs for debugging
  if (process.env.DODO_PAYMENTS_ENVIRONMENT !== 'live_mode') {
    console.log('[dodo/webhook] Event:', JSON.stringify({ type: event.type, data: event.data }, null, 2))
  }

  switch (event.type) {
    case 'subscription.active':
    case 'subscription.renewed':
    case 'subscription.plan_changed':
      await activatePlan(event.data)
      break

    case 'subscription.cancelled':
    case 'subscription.expired':
      await deactivatePlan(event.data)
      break

    case 'subscription.failed':
      console.warn('[dodo/webhook] Payment failed for customer:', event.data.customer?.email)
      break

    default:
      break
  }

  return NextResponse.json({ received: true })
}

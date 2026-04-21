import { NextRequest, NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'
import { createAdminClient } from '@/lib/supabase/admin'

// Admin client is safe to initialise at module level — no API calls happen here
const supabase = createAdminClient()

type SubscriptionData = {
  subscription_id?: string
  customer?: { customer_id?: string }
  metadata?: Record<string, string>
}

async function activatePlan(data: SubscriptionData) {
  const userId = data.metadata?.user_id
  const plan   = data.metadata?.plan

  if (!userId || !plan) {
    console.warn('[dodo/webhook] activatePlan: missing user_id or plan in metadata', data)
    return
  }

  await supabase
    .from('user_plans')
    .update({
      plan,
      stripe_subscription_id: data.subscription_id ?? null,
      stripe_customer_id:     data.customer?.customer_id ?? null,
    })
    .eq('user_id', userId)
}

async function deactivatePlan(data: SubscriptionData) {
  const userId = data.metadata?.user_id

  if (!userId) {
    console.warn('[dodo/webhook] deactivatePlan: missing user_id in metadata', data)
    return
  }

  await supabase
    .from('user_plans')
    .update({ plan: 'starter', stripe_subscription_id: null })
    .eq('user_id', userId)
}

export async function POST(request: NextRequest) {
  const body = await request.text()

  // All env var access is inside the request handler — never at module load time,
  // so Next.js build-time evaluation never sees missing secrets.
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY
  if (!webhookKey) {
    console.error('[dodo/webhook] DODO_PAYMENTS_WEBHOOK_KEY is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  // Instantiate a verifier client at request time — only the webhookKey matters here
  const verifier = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY || 'unused',
    webhookKey,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
  })

  let event: { type: string; data: SubscriptionData }
  try {
    event = verifier.webhooks.unwrap(body, {
      headers: {
        'webhook-id':        request.headers.get('webhook-id')        ?? '',
        'webhook-signature': request.headers.get('webhook-signature') ?? '',
        'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
      },
    }) as { type: string; data: SubscriptionData }
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
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

    case 'subscription.failed': {
      const userId = event.data.metadata?.user_id
      console.warn('[dodo/webhook] Subscription payment failed for user:', userId)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}

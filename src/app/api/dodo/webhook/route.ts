import { NextRequest, NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'
import type { Subscription } from 'dodopayments/resources/subscriptions'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendPurchaseConfirmationEmail,
  sendRenewalEmail,
  sendPaymentFailedEmail,
  sendCancellationEmail,
  formatBillingAmount,
  formatEmailDate,
} from '@/lib/email'

// Admin client is safe to initialise at module level — no API calls happen here
const supabase = createAdminClient()

// ─── User resolution ──────────────────────────────────────────────────────────

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
function planFromProductId(productId: string): 'pro' | 'max' | null {
  if (productId === process.env.DODO_PRO_PRODUCT_ID) return 'pro'
  if (productId === process.env.DODO_MAX_PRODUCT_ID) return 'max'
  return null
}

/** Resolve the Supabase user ID from a Dodo Subscription object. */
async function resolveUserId(data: Subscription): Promise<string | null> {
  // Primary: checkout-session metadata carries user_id through to the subscription
  if (data.metadata?.user_id) return data.metadata.user_id

  // Fallback: look up by the customer's email address
  return getUserIdByEmail(data.customer.email)
}

/** Capitalise a plan key for display ("pro" → "Pro"). */
function planDisplay(plan: string): string {
  return plan === 'pro' ? 'Pro' : plan === 'max' ? 'Max' : plan
}

// ─── Persist next_billing_date (non-critical — requires DB migration) ─────────
//
// Run this in your Supabase SQL editor before deploying:
//   ALTER TABLE user_plans ADD COLUMN IF NOT EXISTS next_billing_date timestamptz;
//
// Until then, this call fails silently — plan activation is unaffected.

async function storeNextBillingDate(userId: string, nextBillingDate: string) {
  const { error } = await supabase
    .from('user_plans')
    .update({ next_billing_date: nextBillingDate })
    .eq('user_id', userId)
  if (error) {
    console.warn('[dodo/webhook] Could not store next_billing_date (run migration):', error.message)
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/** subscription.active / subscription.plan_changed — new purchase or upgrade */
async function activatePlan(data: Subscription) {
  const userId = await resolveUserId(data)
  const plan: string | null = data.metadata?.plan ?? planFromProductId(data.product_id)

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
      payment_subscription_id: data.subscription_id,
      payment_customer_id:     data.customer.customer_id,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('[dodo/webhook] activatePlan DB error:', error.message)
    return
  }

  console.log(`[dodo/webhook] activatePlan: upgraded user ${userId} to plan "${plan}"`)

  // Store next_billing_date for renewal reminders (graceful failure if column missing)
  await storeNextBillingDate(userId, data.next_billing_date)

  // Send purchase confirmation email
  await sendPurchaseConfirmationEmail({
    to:              data.customer.email,
    planName:        planDisplay(plan),
    amount:          formatBillingAmount(data.recurring_pre_tax_amount, data.currency),
    nextBillingDate: formatEmailDate(data.next_billing_date),
  })
}

/** subscription.renewed — recurring charge succeeded */
async function handleRenewal(data: Subscription) {
  const userId = await resolveUserId(data)
  const plan: string | null = data.metadata?.plan ?? planFromProductId(data.product_id)

  if (!userId) {
    console.error('[dodo/webhook] handleRenewal: could not resolve userId', {
      metadataUserId: data.metadata?.user_id,
      customerEmail:  data.customer?.email,
    })
    return
  }

  // Re-assert the plan on renewal so any accidental drift gets corrected.
  // Also update next_billing_date for the renewal reminder cron.
  if (plan) {
    const updates: Record<string, unknown> = { next_billing_date: data.next_billing_date }
    // Only write plan if we have a valid value — avoids overwriting admin plans
    if (plan === 'pro' || plan === 'max') updates.plan = plan
    const { error } = await supabase.from('user_plans').update(updates).eq('user_id', userId)
    if (error) console.error('[dodo/webhook] handleRenewal DB error:', error.message)
  } else {
    await storeNextBillingDate(userId, data.next_billing_date)
  }

  // Send renewal receipt email
  await sendRenewalEmail({
    to:              data.customer.email,
    planName:        planDisplay(plan ?? 'Pro'),
    amount:          formatBillingAmount(data.recurring_pre_tax_amount, data.currency),
    billedDate:      formatEmailDate(data.previous_billing_date),
    nextBillingDate: formatEmailDate(data.next_billing_date),
  })

  console.log(`[dodo/webhook] handleRenewal: plan re-asserted and renewal email sent to ${data.customer.email}`)
}

/** subscription.expired — billing period ended after cancellation; downgrade to starter */
async function deactivatePlan(data: Subscription) {
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
    .update({ plan: 'starter', payment_subscription_id: null, next_billing_date: null })
    .eq('user_id', userId)

  if (error) {
    console.error('[dodo/webhook] deactivatePlan DB error:', error.message)
    return
  }

  console.log(`[dodo/webhook] deactivatePlan: reset user ${userId} to starter`)

  const plan = data.metadata?.plan ?? planFromProductId(data.product_id) ?? 'Pro'
  await sendCancellationEmail({
    to:          data.customer.email,
    planName:    planDisplay(plan),
    accessUntil: data.expires_at ?? null,
  })
}

/** subscription.failed — payment failed; subscription may go on_hold */
async function handlePaymentFailed(data: Subscription) {
  const plan = data.metadata?.plan ?? planFromProductId(data.product_id) ?? 'Pro'
  console.warn('[dodo/webhook] Payment failed for customer:', data.customer?.email)
  await sendPaymentFailedEmail({
    to:       data.customer.email,
    planName: planDisplay(plan),
  })
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.text()

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

  let event: { type: string; data: Subscription }
  try {
    event = verifier.webhooks.unwrap(body, {
      headers: {
        'webhook-id':        request.headers.get('webhook-id')        ?? '',
        'webhook-signature': request.headers.get('webhook-signature') ?? '',
        'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
      },
    }) as { type: string; data: Subscription }
  } catch {
    console.error('[dodo/webhook] Signature verification failed')
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  // Log full payload in test mode for debugging
  if (process.env.DODO_PAYMENTS_ENVIRONMENT !== 'live_mode') {
    console.log('[dodo/webhook] Event:', JSON.stringify({ type: event.type, data: event.data }, null, 2))
  }

  const { type, data } = event

  switch (type) {
    // New subscription activated or plan upgraded
    case 'subscription.active':
    case 'subscription.plan_changed':
      await activatePlan(data)
      break

    // Recurring charge succeeded — send renewal receipt
    case 'subscription.renewed':
      await handleRenewal(data)
      break

    // User requested cancellation — subscription stays active until period end.
    // DO NOT downgrade here; wait for subscription.expired.
    case 'subscription.cancelled':
      console.log('[dodo/webhook] Subscription scheduled for cancellation:', data.subscription_id)
      break

    // Billing period ended after cancellation — downgrade to starter
    case 'subscription.expired':
      await deactivatePlan(data)
      break

    // Payment failed — notify user to update payment method
    case 'subscription.failed':
      await handlePaymentFailed(data)
      break

    default:
      break
  }

  return NextResponse.json({ received: true })
}

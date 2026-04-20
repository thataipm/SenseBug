import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

// Test-mode webhook — uses STRIPE_TEST_WEBHOOK_SECRET and STRIPE_TEST_*_PRICE_ID
// so it can coexist with the live webhook without interference.
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_TEST_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const plan = session.metadata?.plan

      if (userId && plan) {
        await supabase
          .from('user_plans')
          .update({
            plan,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .eq('user_id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.user_id

      if (userId && subscription.status === 'active') {
        const priceId = subscription.items.data[0]?.price.id
        let newPlan = 'starter'
        if (priceId === process.env.STRIPE_TEST_PRO_PRICE_ID) newPlan = 'pro'
        if (priceId === process.env.STRIPE_TEST_TEAM_PRICE_ID) newPlan = 'team'

        await supabase
          .from('user_plans')
          .update({ plan: newPlan, stripe_subscription_id: subscription.id })
          .eq('user_id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.user_id

      if (userId) {
        await supabase
          .from('user_plans')
          .update({ plan: 'starter', stripe_subscription_id: null })
          .eq('user_id', userId)
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}

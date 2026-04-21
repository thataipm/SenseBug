import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe, STRIPE_PLANS } from '@/lib/stripe'
import { isValidOrigin } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await request.json()

  if (!STRIPE_PLANS[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  // Guard: price ID must be configured — gives a clear error instead of a cryptic 500
  const priceId = STRIPE_PLANS[plan].priceId
  if (!priceId) {
    console.error(`[stripe/checkout] STRIPE_${plan.toUpperCase()}_PRICE_ID is not set`)
    return NextResponse.json({ error: 'Checkout is not configured yet. Please contact support.' }, { status: 503 })
  }

  // Guard: app URL must be set so success/cancel redirects work
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('[stripe/checkout] NEXT_PUBLIC_APP_URL is not set')
    return NextResponse.json({ error: 'Checkout is not configured yet. Please contact support.' }, { status: 503 })
  }

  try {
    // Fetch existing Stripe customer ID if present
    const { data: userPlan } = await supabase
      .from('user_plans')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    let customerId = userPlan?.stripe_customer_id as string | undefined

    // Create a new Stripe customer if first time
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email!,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      await supabase
        .from('user_plans')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id)
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/settings?upgraded=1`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { user_id: user.id, plan },
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe/checkout] Stripe API error:', message)
    // Surface the Stripe error message directly — it's safe to expose (no keys/PII)
    // and saves digging through Vercel logs during setup.
    return NextResponse.json({ error: `Stripe error: ${message}` }, { status: 500 })
  }
}

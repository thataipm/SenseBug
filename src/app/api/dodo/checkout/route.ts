import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDodo, DODO_PLANS } from '@/lib/dodo'
import { isValidOrigin } from '@/lib/csrf'

const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, team: 2 }

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await request.json()

  if (!DODO_PLANS[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  // Guard: product ID must be configured
  const productId = DODO_PLANS[plan].productId
  if (!productId) {
    console.error(`[dodo/checkout] DODO_${plan.toUpperCase()}_PRODUCT_ID is not set`)
    return NextResponse.json({ error: 'Checkout is not configured yet. Please contact support.' }, { status: 503 })
  }

  // Guard: app URL must be set for redirect
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('[dodo/checkout] NEXT_PUBLIC_APP_URL is not set')
    return NextResponse.json({ error: 'Checkout is not configured yet. Please contact support.' }, { status: 503 })
  }

  // Guard: prevent duplicate subscriptions
  const { data: userPlanData } = await supabase
    .from('user_plans')
    .select('plan')
    .eq('user_id', user.id)
    .single()

  const currentRank = PLAN_RANK[userPlanData?.plan ?? 'starter'] ?? 0
  const requestedRank = PLAN_RANK[plan] ?? 0
  if (currentRank >= requestedRank) {
    return NextResponse.json({ error: 'already_subscribed' }, { status: 409 })
  }

  try {
    const fullName = (user.user_metadata?.full_name as string) ||
      user.email?.split('@')[0] || 'Customer'

    const session = await getDodo().checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email: user.email!,
        name: fullName,
      },
      return_url: `${appUrl}/settings?upgraded=1`,
      cancel_url: `${appUrl}/pricing`,
      // metadata is passed through to webhook payloads so we can
      // identify the user and plan when the subscription activates
      metadata: { user_id: user.id, plan },
    })

    return NextResponse.json({ url: session.checkout_url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[dodo/checkout] Dodo Payments API error:', message)
    return NextResponse.json({ error: `Dodo error: ${message}` }, { status: 500 })
  }
}

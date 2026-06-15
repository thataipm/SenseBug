import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDodo, getDodoPlans } from '@/lib/dodo'
import { isValidOrigin } from '@/lib/csrf'

const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, team: 2, max: 2 }

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await request.json()

  const dodoPlans = getDodoPlans()

  if (!dodoPlans[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  // Guard: product ID must be configured
  const productId = dodoPlans[plan].productId
  if (!productId) {
    const envVarName = plan === 'max' ? 'DODO_TEAM_PRODUCT_ID' : `DODO_${plan.toUpperCase()}_PRODUCT_ID`
    console.error(`[dodo/checkout] ${envVarName} is not set`)
    return NextResponse.json({ error: 'Checkout is not configured yet. Please contact support.' }, { status: 503 })
  }

  // Guard: app URL must be set for redirect
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('[dodo/checkout] NEXT_PUBLIC_APP_URL is not set')
    return NextResponse.json({ error: 'Checkout is not configured yet. Please contact support.' }, { status: 503 })
  }

  // Guard: prevent duplicate subscriptions — but ONLY for users who are already
  // PAYING. Trial users have plan='pro' with no payment_subscription_id; they
  // must be able to convert to a paid subscription. Checking the plan name alone
  // would block every trial→paid conversion in the single-plan model.
  const { data: userPlanData } = await supabase
    .from('user_plans')
    .select('plan, payment_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (userPlanData?.payment_subscription_id) {
    const currentRank = PLAN_RANK[userPlanData?.plan ?? 'starter'] ?? 0
    const requestedRank = PLAN_RANK[plan] ?? 0
    if (currentRank >= requestedRank) {
      return NextResponse.json({ error: 'already_subscribed' }, { status: 409 })
    }
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
      return_url: `${appUrl}/account?upgraded=1`,
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

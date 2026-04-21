import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDodo } from '@/lib/dodo'
import { isValidOrigin } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userPlan } = await supabase
    .from('user_plans')
    .select('plan, payment_subscription_id')
    .eq('user_id', user.id)
    .single()

  if (!userPlan?.payment_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found.' }, { status: 404 })
  }

  if (userPlan.plan === 'starter') {
    return NextResponse.json({ error: 'No paid subscription to cancel.' }, { status: 400 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = await (getDodo().subscriptions as any).update(
      userPlan.payment_subscription_id,
      { cancel_at_next_billing_date: true }
    )

    // next_billing_date is the date through which the subscription remains active
    const endsAt: string | null =
      subscription?.next_billing_date ?? subscription?.current_period_end ?? null

    return NextResponse.json({ cancelled: true, ends_at: endsAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[dodo/cancel] Dodo cancel error:', message)
    return NextResponse.json({ error: `Failed to cancel subscription: ${message}` }, { status: 500 })
  }
}

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

  // customer_id is stored in stripe_customer_id column (reusing column for Dodo's customer ID)
  const { data: userPlan } = await supabase
    .from('user_plans')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!userPlan?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  try {
    // Dodo customer portal — lets users manage subscriptions, update payment methods, etc.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const portal = await (getDodo().customers as any).customerPortal(userPlan.stripe_customer_id)
    const url = portal?.checkout_url ?? portal?.url
    if (!url) throw new Error('No portal URL returned')
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[dodo/portal] Dodo portal error:', message)
    return NextResponse.json({ error: `Failed to open billing portal: ${message}` }, { status: 500 })
  }
}

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
    .select('payment_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!userPlan?.payment_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  try {
    // Dodo customer portal — customerPortal is a sub-resource with a .create() method
    // Response shape: { link: string }
    const portal = await getDodo().customers.customerPortal.create(
      userPlan.payment_customer_id,
      { return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account` }
    )
    const url = portal?.link
    if (!url) throw new Error('No portal URL returned')
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[dodo/portal] Dodo portal error:', message)
    return NextResponse.json({ error: `Failed to open billing portal: ${message}` }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
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
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!userPlan?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: userPlan.stripe_customer_id as string,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  })

  return NextResponse.json({ url: session.url })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { product_overview, critical_flows, product_areas } = body

  // No server-side "all required" check here — the client form validates that for
  // the real save flow. handleSkip sends all-empty intentionally to mark KB as created
  // so the onboarding guard doesn't loop the user back. We just persist what we receive.
  const { error } = await supabase
    .from('knowledge_base')
    .upsert(
      {
        user_id: user.id,
        product_overview: (product_overview ?? '').trim(),
        critical_flows: (critical_flows ?? '').trim(),
        product_areas: (product_areas ?? '').trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

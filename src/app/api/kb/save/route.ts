import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'
import { ensureUserPlan } from '@/lib/plan'

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Initialize the user_plans row with the chosen trial tier if not yet created.
  // This is the first server-side action after signup confirmation — the natural
  // place to set whether the user is starting a Pro trial or a Max trial.
  const { searchParams } = new URL(request.url)
  const planParam = searchParams.get('plan')
  const initialPlan: 'pro' | 'max' = planParam === 'max' ? 'max' : 'pro'
  await ensureUserPlan(supabase, user.id, initialPlan)

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

  // Invalidate all cached AI details for this user's backlog.
  // Rationale and business_impact reference KB context (critical flows, product overview)
  // so they become stale the moment KB changes. Clearing detail_generated_at forces the
  // detail route to regenerate them with the new KB on the next time each bug is opened.
  // Fire-and-forget — don't fail the KB save if this errors.
  supabase
    .from('backlog')
    .update({
      detail_generated_at:  null,
      business_impact:      null,
      rationale:            null,
      improved_description: null,
    })
    .eq('user_id', user.id)
    .then(({ error: clearErr }) => {
      if (clearErr) console.error('[kb/save] Failed to clear cached details:', clearErr.message)
      else console.log(`[kb/save] Cleared cached details for user ${user.id}`)
    })

  return NextResponse.json({ success: true })
}

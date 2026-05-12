import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildCalibrationBlock } from '@/lib/pm-calibration'
import { isValidOrigin } from '@/lib/csrf'
import type { CalibrationSignal } from '@/lib/pm-calibration'

export const dynamic = 'force-dynamic'

// GET /api/calibration
// Returns the stored calibration snapshot for the authed user.
// Used by the Insights page — no AI call here, just reads what was pre-computed.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('pm_calibration')
    .select('verdict_count, signal_json, prompt_injection, computed_at')
    .eq('user_id', user.id)
    .single()

  if (!data) return NextResponse.json(null)

  return NextResponse.json({
    verdict_count:    data.verdict_count,
    signal:           data.signal_json as CalibrationSignal,
    prompt_injection: data.prompt_injection,
    prompt_block:     data.prompt_injection && data.verdict_count >= 30
      ? buildCalibrationBlock(data.prompt_injection, data.verdict_count)
      : null,
    computed_at:      data.computed_at,
  })
}

// DELETE /api/calibration
// Removes the stored PM calibration snapshot for the authenticated user.
// Future triage calls will use the base model until enough new verdicts
// (30+) accumulate to rebuild calibration for the new product context.
export async function DELETE(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('pm_calibration')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error('[calibration] delete error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reset: true })
}

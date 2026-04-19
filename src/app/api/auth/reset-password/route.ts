import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { password, token_hash, type, access_token, refresh_token } = await request.json()

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const supabase = await createClient()

  // Try PKCE flow (token_hash) first
  if (token_hash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type || 'recovery',
    })
    if (verifyError) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }
  } else if (access_token && refresh_token) {
    // Fallback: implicit flow
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
    if (sessionError) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Handle PKCE auth code exchange (magic link / OAuth)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
  }

  // Handle token_hash flow (email confirmation, password reset, email change)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as 'email' | 'recovery' | 'email_change' })
    if (!error) {
      if (type === 'recovery') {
        // Password reset — send to the update-password page
        return NextResponse.redirect(`${origin}/reset-password`)
      }
      if (type === 'email_change') {
        return NextResponse.redirect(`${origin}/account?email_updated=1`)
      }
      // email confirmation (signup)
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
  }

  // Fallback
  return NextResponse.redirect(`${origin}/login?error=missing_params`)
}

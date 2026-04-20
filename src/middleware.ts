import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PROTECTED = ['/dashboard', '/results', '/settings', '/onboarding', '/historyRun', '/account', '/processing']
const AUTH_ONLY = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))
  const isAuthOnly = AUTH_ONLY.some((p) => pathname === p)

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthOnly && user) {
    const url = request.nextUrl.clone()
    const plan = request.nextUrl.searchParams.get('plan')
    // If a valid paid plan param is present, send the already-logged-in user straight to
    // checkout so their upgrade intent isn't lost (e.g. they opened /signup?plan=pro while
    // already logged in, or navigated back to /login?plan=pro after confirming their email).
    if (plan === 'pro' || plan === 'team') {
      url.pathname = '/checkout'
      url.search = `?plan=${plan}`
    } else {
      url.pathname = '/dashboard'
      url.search = ''
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

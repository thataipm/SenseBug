'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import AuthPreviewPanel from '@/components/AuthPreviewPanel'

function SignupContent() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') // 'pro' | 'max' — if present, go to checkout after signup

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    const supabase = createClient()
    // After email confirmation, always go through onboarding first so KB gets set up.
    // Onboarding preserves the ?plan param and routes to checkout afterwards.
    const postConfirmUrl = plan
      ? `${window.location.origin}/onboarding?plan=${plan}`
      : `${window.location.origin}/onboarding`

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: postConfirmUrl,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (data?.user?.email_confirmed_at || data?.session) {
      // Immediate session — go to onboarding first, then checkout will follow later
      // (onboarding sets up KB; checkout can happen from settings too)
      if (plan) {
        router.push(`/onboarding?plan=${plan}`)
      } else {
        router.push('/onboarding')
      }
      router.refresh()
    } else {
      setCheckEmail(true)
    }
    setLoading(false)
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
        <div className="max-w-sm w-full text-center">
          <div className="font-black text-xl tracking-tight mb-8" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG AI</div>
          <h1 className="text-2xl font-black tracking-tighter mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Check your email</h1>
          <p className="text-sm text-black/55 mb-3">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
          {plan && (
            <p className="text-xs text-black/40 mb-6">After confirming, you&apos;ll set up your account first, then complete your {plan === 'pro' ? 'Pro' : 'Max'} upgrade.</p>
          )}
          <Link href="/login" className="text-sm text-black font-medium hover:underline">Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <AuthPreviewPanel footerTagline="Free plan — no credit card required." />

      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Link href="/" className="font-black text-xl tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG AI</Link>
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-1" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Create account</h1>
          <p className="text-sm text-black/45 mb-8">Free to start — no credit card required</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div data-testid="signup-error" className="border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>First name</label>
                <input data-testid="signup-firstname-input" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150" placeholder="Jane" />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Last name</label>
                <input data-testid="signup-lastname-input" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150" placeholder="Smith" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Email</label>
              <input data-testid="signup-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Password</label>
              <div className="relative">
                <input data-testid="signup-password-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm pr-12 transition-colors duration-150" placeholder="Min. 8 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button data-testid="signup-submit-button" type="submit" disabled={loading} className="w-full bg-black text-white py-3 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-black/45">
            Already have an account?{' '}
            <Link href={plan ? `/login?plan=${plan}` : '/login'} className="text-black font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}

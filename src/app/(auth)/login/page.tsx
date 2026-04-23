'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') // preserved from pricing → signup → login

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }
    // If user came via a pricing CTA with a plan, send them to checkout
    router.push(plan ? `/checkout?plan=${plan}` : '/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      {/* Left panel — product preview */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-black flex-col justify-between p-12">
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 40% 60%, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />

        {/* Wordmark */}
        <div className="relative z-10">
          <div className="font-black text-xl text-white tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG AI</div>
        </div>

        {/* Product mockup */}
        <div className="relative z-10">
          <p className="text-xs font-mono uppercase tracking-widest text-white/30 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>AI-ranked results</p>

          <div className="space-y-2 mb-8">
            {/* Bug 1 — promoted P3→P1 */}
            <div className="border border-white/10 bg-white/[0.05] px-4 py-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-white/30 font-mono mb-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>BUG-091</div>
                  <div className="text-sm text-white/90">Checkout fails on iOS 17+</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  <span className="text-xs text-white/20 line-through font-mono" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>P3</span>
                  <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 font-mono" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>P1</span>
                </div>
              </div>
            </div>

            {/* Bug 2 — stays P2 */}
            <div className="border border-white/10 bg-white/[0.05] px-4 py-3 animate-slide-up" style={{ animationDelay: '0.25s' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-white/30 font-mono mb-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>BUG-047</div>
                  <div className="text-sm text-white/90">Payment webhook timeout</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 font-mono" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>P2</span>
                </div>
              </div>
            </div>

            {/* Bug 3 — over-prioritised P1→P4 */}
            <div className="border border-white/[0.07] bg-white/[0.03] px-4 py-3 opacity-70 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-white/30 font-mono mb-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>BUG-023</div>
                  <div className="text-sm text-white/70 flex items-center gap-1.5">
                    <span className="text-purple-400 text-xs">⚑</span>
                    Dashboard widget alignment
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  <span className="text-xs text-white/20 line-through font-mono" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>P1</span>
                  <span className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 font-mono" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>P4</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <p className="text-xl font-black text-white tracking-tight mb-2" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Fix what actually matters.</p>
            <p className="text-sm text-white/40 leading-relaxed">AI strips reporter bias and re-ranks your backlog by real business impact.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs text-white/25">Make sense of your bugs.</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <Link href="/" className="font-black text-xl tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
              SENSEBUG AI
            </Link>
          </div>

          <h1 className="text-3xl font-black tracking-tighter mb-1" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Welcome back
          </h1>
          <p className="text-sm text-black/45 mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div data-testid="login-error" className="border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                Email
              </label>
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                Password
              </label>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm pr-12 transition-colors duration-150"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-2 text-right">
                <Link href="/forgot-password" className="text-xs text-black/40 hover:text-black transition-colors duration-150">
                  Forgot password?
                </Link>
              </div>
            </div>
            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-3 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-black/45">
            No account?{' '}
            <Link href={plan ? `/signup?plan=${plan}` : '/signup'} className="text-black font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}

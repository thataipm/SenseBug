'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

// Plan upgrade hierarchy: pro < max (Starter no longer exists post-trial-migration)
const PLAN_RANK: Record<string, number> = { starter: 0, pro: 1, team: 2, max: 2 }

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const plan = searchParams.get('plan') // 'pro' | 'max'
  const [error, setError] = useState('')

  useEffect(() => {
    const go = async () => {
      if (!plan || (plan !== 'pro' && plan !== 'max')) {
        router.replace('/pricing')
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in — send to signup with plan param preserved
        router.replace(`/signup?plan=${plan}`)
        return
      }

      // Guard: only block if the user is ALREADY PAID on this plan or higher.
      // Trial users have plan='pro' or 'max' but is_paid=false — they must be
      // allowed to upgrade to a real paid subscription. Without this check,
      // trial-Pro users clicking "Upgrade to Pro" would bounce to /settings.
      const planRes = await fetch('/api/plan')
      if (planRes.ok) {
        const userPlan = await planRes.json()
        if (userPlan?.is_paid) {
          const currentRank = PLAN_RANK[userPlan?.plan ?? 'starter'] ?? 0
          const requestedRank = PLAN_RANK[plan] ?? 0
          if (currentRank >= requestedRank) {
            // Already paid on this plan or higher — send to settings
            router.replace('/settings?already_subscribed=1')
            return
          }
        }
      }

      // Logged in + eligible — create a Dodo Payments checkout session and redirect
      const res = await fetch('/api/dodo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      if (!res.ok) {
        let msg = 'Failed to start checkout. Please try again.'
        try { const j = await res.json(); msg = j.error || msg } catch {}
        setError(msg)
        return
      }

      const { url } = await res.json()
      if (url) {
        window.location.href = url
      } else {
        setError('Failed to create checkout session. Please try again.')
      }
    }
    go()
  }, [plan, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
        <div className="max-w-sm w-full text-center">
          <div className="font-black text-xl tracking-tight mb-8" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG</div>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Link href="/pricing" className="text-sm text-black underline hover:no-underline">
            Back to pricing
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      <p className="text-sm text-black/40">Preparing your checkout…</p>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}

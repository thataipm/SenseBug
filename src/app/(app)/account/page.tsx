'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Loader2, ExternalLink } from 'lucide-react'

interface PlanInfo {
  plan: string
  monthly_runs_count: number
  monthly_bug_limit: number
  bugs_per_run_limit: number
  bugs_analyzed_this_month: number
}

const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', team: 'Max', max: 'Max' }

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null)
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      const meta = data.user.user_metadata ?? {}
      setFirstName(meta.first_name ?? '')
      setLastName(meta.last_name ?? '')
      const planRes = await fetch('/api/plan')
      if (planRes.ok) setPlan(await planRes.json())
      setLoading(false)
    }
    init()
  }, [router])

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameError('')
    setNameSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      },
    })
    setNameSaving(false)
    if (error) { setNameError(error.message); return }
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-black/30" />
    </div>
  )

  return (
    <div className="px-6 md:px-10 py-10 max-w-2xl mx-auto space-y-10" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <h1 className="text-2xl font-black tracking-tighter" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Account</h1>

      {/* Profile */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Profile</p>
        <div className="border border-gray-200 p-6 space-y-5">
          <form onSubmit={handleSaveName} className="space-y-4">
            {nameError && <div className="border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3">{nameError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>First name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-2.5 text-sm transition-colors duration-150" placeholder="Jane" />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Last name</label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-2.5 text-sm transition-colors duration-150" placeholder="Smith" />
              </div>
            </div>
            <button type="submit" disabled={nameSaving} className="bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50 flex items-center gap-2">
              {nameSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {nameSaved ? 'Saved ✓' : 'Save name'}
            </button>
          </form>
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div>
              <p className="text-xs font-mono text-black/40 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Email</p>
              <p className="text-sm font-medium" data-testid="account-email">{user?.email}</p>
            </div>
            <Link href="/forgot-password" className="text-sm text-black/50 hover:text-black transition-colors duration-150 inline-flex items-center gap-1">
              Change password <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* Plan */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Current Plan</p>
        <div className="border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-2xl font-black tracking-tighter" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }} data-testid="account-plan-name">
                {plan ? PLAN_LABELS[plan.plan] : '—'}
              </p>
            </div>
            {plan?.plan === 'starter' && (
              <Link
                href="/pricing"
                data-testid="account-upgrade-btn"
                className="bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/85 transition-colors duration-150"
              >
                Upgrade to Pro
              </Link>
            )}
          </div>
          {plan && (
            <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-5">
              <div>
                <p className="text-xs font-mono text-black/40 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Bugs / month</p>
                <p className="text-sm font-medium" data-testid="account-bugs-month">
                  {plan.monthly_bug_limit === -1 ? 'Unlimited' : `${plan.bugs_analyzed_this_month} / ${plan.monthly_bug_limit}`}
                </p>
              </div>
              <div>
                <p className="text-xs font-mono text-black/40 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Bugs / run</p>
                <p className="text-sm font-medium">Up to {plan.bugs_per_run_limit}</p>
              </div>
              <div>
                <p className="text-xs font-mono text-black/40 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Doc uploads</p>
                <p className="text-sm font-medium">{['pro', 'team', 'max'].includes(plan.plan) ? 'Included' : 'Not included'}</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Loader2, Check, ChevronRight, ExternalLink } from 'lucide-react'
import { Suspense } from 'react'

interface PlanInfo {
  plan: string
  monthly_runs_count: number
  monthly_bug_limit: number
  bugs_per_run_limit: number
  bugs_analyzed_this_month: number
  doc_upload: boolean
  is_trialing?: boolean
  is_trial_expired?: boolean
  is_paid?: boolean
  days_left_in_trial?: number
  trial_ends_at?: string | null
}

const PLAN_LABELS: Record<string, string> = { starter: 'Pro', pro: 'Pro', team: 'Max', max: 'Max', admin: 'Admin' }
const MONO = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

function AccountContent() {
  const [user, setUser] = useState<User | null>(null)
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')
  // Billing state
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')
  const [cancelStep, setCancelStep] = useState<'idle' | 'confirm' | 'done'>('idle')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelEndsAt, setCancelEndsAt] = useState<string | null>(null)
  // Danger zone
  const [clearBacklogStep, setClearBacklogStep]     = useState<'idle' | 'confirm' | 'done'>('idle')
  const [clearBacklogLoading, setClearBacklogLoading] = useState(false)
  const [clearBacklogError, setClearBacklogError]   = useState('')
  const [clearBacklogCount, setClearBacklogCount]   = useState(0)
  const [resetCalibStep, setResetCalibStep]         = useState<'idle' | 'confirm' | 'done'>('idle')
  const [resetCalibLoading, setResetCalibLoading]   = useState(false)
  const [resetCalibError, setResetCalibError]       = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const justUpgraded = searchParams.get('upgraded') === '1'

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

  // When redirected from Dodo checkout (?upgraded=1), poll until the webhook
  // fires and the plan is actually upgraded (webhook is async, takes a few sec).
  useEffect(() => {
    if (!justUpgraded) return
    let polls = 0
    const MAX_POLLS = 15 // 15 × 2 s = 30 s max wait
    const interval = setInterval(async () => {
      polls++
      const res = await fetch('/api/plan')
      if (res.ok) {
        const updated = await res.json()
        if (updated?.plan && updated.plan !== 'starter') {
          setPlan(updated)
          clearInterval(interval)
        }
      }
      if (polls >= MAX_POLLS) clearInterval(interval)
    }, 2000)
    return () => clearInterval(interval)
  }, [justUpgraded])

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

  const handleManageBilling = async () => {
    setPortalLoading(true)
    setPortalError('')
    try {
      const res = await fetch('/api/dodo/portal', { method: 'POST' })
      if (res.ok) {
        const { url } = await res.json()
        if (url) {
          window.location.href = url
        } else {
          setPortalError('No billing portal URL returned. Please contact support.')
          setPortalLoading(false)
        }
      } else {
        let msg = 'Failed to open billing portal.'
        try { const j = await res.json(); msg = j.error || msg } catch {}
        setPortalError(msg)
        setPortalLoading(false)
      }
    } catch {
      setPortalError('Network error. Please try again.')
      setPortalLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    setCancelLoading(true)
    setCancelError('')
    try {
      const res = await fetch('/api/dodo/cancel', { method: 'POST' })
      if (res.ok) {
        const { ends_at } = await res.json()
        setCancelEndsAt(ends_at ?? null)
        setCancelStep('done')
      } else {
        let msg = 'Failed to cancel subscription.'
        try { const j = await res.json(); msg = j.error || msg } catch {}
        setCancelError(msg)
      }
    } catch {
      setCancelError('Network error. Please try again.')
    }
    setCancelLoading(false)
  }

  const handleClearBacklog = async () => {
    setClearBacklogLoading(true)
    setClearBacklogError('')
    try {
      const res = await fetch('/api/backlog/clear', { method: 'DELETE' })
      if (res.ok) {
        const { cleared } = await res.json()
        setClearBacklogCount(cleared)
        setClearBacklogStep('done')
      } else {
        let msg = 'Failed to clear backlog.'
        try { const j = await res.json(); msg = j.error || msg } catch {}
        setClearBacklogError(msg)
      }
    } catch {
      setClearBacklogError('Network error. Please try again.')
    }
    setClearBacklogLoading(false)
  }

  const handleResetCalibration = async () => {
    setResetCalibLoading(true)
    setResetCalibError('')
    try {
      const res = await fetch('/api/calibration', { method: 'DELETE' })
      if (res.ok) {
        setResetCalibStep('done')
      } else {
        let msg = 'Failed to reset calibration.'
        try { const j = await res.json(); msg = j.error || msg } catch {}
        setResetCalibError(msg)
      }
    } catch {
      setResetCalibError('Network error. Please try again.')
    }
    setResetCalibLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-black/30" />
    </div>
  )

  const isAdmin       = plan?.plan === 'admin'
  // Truth source for billing UI: the /api/plan response, which knows about trial state.
  // A trial user has plan='pro' but is_paid=false — they shouldn't see the Cancel section.
  const isPaid        = !isAdmin && (plan?.is_paid ?? false)
  const isTrialing    = !isAdmin && (plan?.is_trialing ?? false)
  const isTrialExpired = !isAdmin && (plan?.is_trial_expired ?? false)
  const daysLeftInTrial = plan?.days_left_in_trial ?? 0

  return (
    <div className="px-6 md:px-10 py-10 max-w-2xl mx-auto space-y-10" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <h1 className="text-2xl font-black tracking-tighter" style={HEADING}>Account</h1>

      {/* Upgrade success banner — only show once plan is confirmed upgraded */}
      {justUpgraded && isPaid && (
        <div className="border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" strokeWidth={2.5} />
          <div>
            <p className="text-sm font-semibold text-green-800" style={HEADING}>You&apos;re all set!</p>
            <p className="text-xs text-green-700">Your plan has been upgraded. New limits apply immediately.</p>
          </div>
        </div>
      )}
      {/* While waiting for the webhook to fire after checkout */}
      {justUpgraded && !isPaid && (
        <div className="border border-gray-200 bg-gray-50 px-5 py-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-black/35 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-black/70" style={HEADING}>Verifying payment…</p>
            <p className="text-xs text-black/60">Confirming your plan upgrade — this usually takes a few seconds.</p>
          </div>
        </div>
      )}

      {/* Profile */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={MONO}>Profile</p>
        <div className="border border-gray-200 p-6 space-y-5">
          <form onSubmit={handleSaveName} className="space-y-4">
            {nameError && <div className="border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3">{nameError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={MONO}>First name</label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-2.5 text-sm transition-colors duration-150" placeholder="Jane" />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={MONO}>Last name</label>
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
              <p className="text-xs font-mono text-black/55 mb-1" style={MONO}>Email</p>
              <p className="text-sm font-medium" data-testid="account-email">{user?.email}</p>
            </div>
            <Link href="/forgot-password" className="text-sm text-black/65 hover:text-black transition-colors duration-150 inline-flex items-center gap-1">
              Change password <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* Plan */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={MONO}>Current Plan</p>
        <div className="border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-2xl font-black tracking-tighter" style={HEADING} data-testid="account-plan-name">
                {plan ? PLAN_LABELS[plan.plan] : '—'}
                {isTrialing && <span className="ml-2 text-sm font-medium text-orange-600">· Trial ({daysLeftInTrial} day{daysLeftInTrial === 1 ? '' : 's'} left)</span>}
                {isTrialExpired && <span className="ml-2 text-sm font-medium text-red-600">· Trial ended</span>}
              </p>
            </div>
            {(isTrialing || isTrialExpired) && !isAdmin && (
              <Link
                href="/pricing"
                data-testid="account-upgrade-btn"
                className="bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/85 transition-colors duration-150"
              >
                {isTrialExpired ? 'Subscribe to continue' : 'Subscribe now'}
              </Link>
            )}
          </div>
          {plan && (
            <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-5">
              <div>
                <p className="text-xs font-mono text-black/55 mb-1" style={MONO}>Bugs / month</p>
                <p className="text-sm font-medium" data-testid="account-bugs-month">
                  {plan.monthly_bug_limit === -1 ? 'Unlimited' : `${plan.bugs_analyzed_this_month} / ${plan.monthly_bug_limit}`}
                </p>
              </div>
              <div>
                <p className="text-xs font-mono text-black/55 mb-1" style={MONO}>Bugs / run</p>
                <p className="text-sm font-medium">Up to {plan.bugs_per_run_limit}</p>
              </div>
              <div>
                <p className="text-xs font-mono text-black/55 mb-1" style={MONO}>Doc uploads</p>
                <p className="text-sm font-medium">{plan.doc_upload ? 'Included' : 'Not included'}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Billing — Pro and Max only */}
      {isPaid && (
        <section>
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={MONO}>Billing</p>
          <div className="border border-gray-200 divide-y divide-gray-100">

            {/* Manage billing */}
            <div className="px-6 py-5">
              <p className="text-sm font-medium mb-1">Invoices &amp; payment method</p>
              <p className="text-xs text-black/60 mb-4" style={MONO}>View past invoices, download receipts, or update your payment method.</p>
              {portalError && <p className="text-xs text-red-600 mb-3">{portalError}</p>}
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="flex items-center gap-2 border border-gray-200 hover:border-black px-4 py-2 text-sm transition-colors duration-150 disabled:opacity-50"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" strokeWidth={1.5} />}
                {portalLoading ? 'Opening…' : 'Manage billing & invoices'}
              </button>
            </div>

            {/* Cancel subscription */}
            <div className="px-6 py-5">
              <p className="text-sm font-medium mb-1">Cancel subscription</p>
              <p className="text-xs text-black/60 mb-4" style={MONO}>
                Your {PLAN_LABELS[plan?.plan ?? '']} plan stays active through the end of the current billing period. After that your account becomes read-only — your backlog and history stay intact, but you won&apos;t be able to run new analyses until you re-subscribe.
              </p>

              {cancelStep === 'idle' && (
                <button
                  onClick={() => { setCancelStep('confirm'); setCancelError('') }}
                  className="text-xs text-black/40 hover:text-red-500 transition-colors duration-150 underline underline-offset-2"
                  style={MONO}
                >
                  Cancel subscription
                </button>
              )}

              {cancelStep === 'confirm' && (
                <div className="border border-red-100 bg-red-50 px-4 py-4 space-y-3">
                  <p className="text-sm font-semibold text-red-800" style={HEADING}>
                    Cancel your {PLAN_LABELS[plan?.plan ?? '']} subscription?
                  </p>
                  <p className="text-xs text-red-700">
                    You&apos;ll keep access until the end of this billing period. After that, your account reverts to Starter — 50 bugs / month, no document uploads.
                  </p>
                  {cancelError && <p className="text-xs text-red-600 font-medium">{cancelError}</p>}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancelLoading}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 text-xs font-semibold hover:bg-red-700 transition-colors duration-150 disabled:opacity-50"
                    >
                      {cancelLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      {cancelLoading ? 'Cancelling…' : 'Yes, cancel subscription'}
                    </button>
                    <button
                      onClick={() => { setCancelStep('idle'); setCancelError('') }}
                      disabled={cancelLoading}
                      className="px-4 py-2 text-xs border border-gray-200 hover:border-black transition-colors duration-150 disabled:opacity-50"
                    >
                      Keep subscription
                    </button>
                  </div>
                </div>
              )}

              {cancelStep === 'done' && (
                <div className="border border-gray-200 bg-gray-50 px-4 py-3 flex items-start gap-3">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                  <div>
                    <p className="text-sm font-semibold" style={HEADING}>Subscription cancelled</p>
                    <p className="text-xs text-black/65 mt-0.5">
                      {cancelEndsAt
                        ? `Your ${PLAN_LABELS[plan?.plan ?? '']} plan remains active until ${new Date(cancelEndsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`
                        : `Your ${PLAN_LABELS[plan?.plan ?? '']} plan remains active until the end of the current billing period.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {/* Danger Zone */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={MONO}>Danger Zone</p>
        <div className="border border-red-100 divide-y divide-red-100">

          {/* Clear backlog */}
          <div className="px-6 py-5">
            <p className="text-sm font-medium mb-1">Clear backlog</p>
            <p className="text-xs text-black/55 mb-4 leading-relaxed" style={MONO}>
              Permanently deletes all bugs from your backlog and resets health scores.
              Use this when switching to a different product context — re-upload your
              CSV or let Jira re-sync to start fresh.
            </p>

            {clearBacklogStep === 'idle' && (
              <button
                onClick={() => { setClearBacklogStep('confirm'); setClearBacklogError('') }}
                className="text-xs text-black/40 hover:text-red-500 transition-colors duration-150 underline underline-offset-2"
                style={MONO}
              >
                Clear all backlog data
              </button>
            )}

            {clearBacklogStep === 'confirm' && (
              <div className="border border-red-200 bg-red-50 px-4 py-4 space-y-3">
                <p className="text-sm font-semibold text-red-800" style={HEADING}>Clear your entire backlog?</p>
                <p className="text-xs text-red-700 leading-relaxed">
                  This deletes every bug and health snapshot in your backlog. Your CSV run history and
                  Knowledge Base are not affected. This cannot be undone.
                </p>
                {clearBacklogError && <p className="text-xs text-red-600 font-medium">{clearBacklogError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={handleClearBacklog}
                    disabled={clearBacklogLoading}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 text-xs font-semibold hover:bg-red-700 transition-colors duration-150 disabled:opacity-50"
                  >
                    {clearBacklogLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    {clearBacklogLoading ? 'Clearing…' : 'Yes, clear backlog'}
                  </button>
                  <button
                    onClick={() => { setClearBacklogStep('idle'); setClearBacklogError('') }}
                    disabled={clearBacklogLoading}
                    className="px-4 py-2 text-xs border border-gray-200 hover:border-black transition-colors duration-150 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {clearBacklogStep === 'done' && (
              <div className="border border-gray-200 bg-gray-50 px-4 py-3 flex items-start gap-3">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                <p className="text-sm">
                  <span className="font-semibold" style={HEADING}>Backlog cleared.</span>
                  <span className="text-black/55 ml-1 text-xs" style={MONO}>{clearBacklogCount} bug{clearBacklogCount !== 1 ? 's' : ''} removed.</span>
                </p>
              </div>
            )}
          </div>

          {/* Reset AI calibration */}
          <div className="px-6 py-5">
            <p className="text-sm font-medium mb-1">Reset AI calibration</p>
            <p className="text-xs text-black/55 mb-4 leading-relaxed" style={MONO}>
              Removes the learned judgment model built from your past verdicts.
              The AI returns to its base model until 30+ new verdicts are recorded
              for the new product context.
            </p>

            {resetCalibStep === 'idle' && (
              <button
                onClick={() => { setResetCalibStep('confirm'); setResetCalibError('') }}
                className="text-xs text-black/40 hover:text-red-500 transition-colors duration-150 underline underline-offset-2"
                style={MONO}
              >
                Reset calibration data
              </button>
            )}

            {resetCalibStep === 'confirm' && (
              <div className="border border-red-200 bg-red-50 px-4 py-4 space-y-3">
                <p className="text-sm font-semibold text-red-800" style={HEADING}>Reset your AI calibration?</p>
                <p className="text-xs text-red-700 leading-relaxed">
                  The AI will stop using your past verdict patterns and return to its base
                  behaviour until it has collected 30+ new verdicts for the new product.
                  Your backlog and run history are not affected.
                </p>
                {resetCalibError && <p className="text-xs text-red-600 font-medium">{resetCalibError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={handleResetCalibration}
                    disabled={resetCalibLoading}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 text-xs font-semibold hover:bg-red-700 transition-colors duration-150 disabled:opacity-50"
                  >
                    {resetCalibLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    {resetCalibLoading ? 'Resetting…' : 'Yes, reset calibration'}
                  </button>
                  <button
                    onClick={() => { setResetCalibStep('idle'); setResetCalibError('') }}
                    disabled={resetCalibLoading}
                    className="px-4 py-2 text-xs border border-gray-200 hover:border-black transition-colors duration-150 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {resetCalibStep === 'done' && (
              <div className="border border-gray-200 bg-gray-50 px-4 py-3 flex items-start gap-3">
                <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                <div>
                  <p className="text-sm font-semibold" style={HEADING}>Calibration reset.</p>
                  <p className="text-xs text-black/55 mt-0.5" style={MONO}>The AI will use its base model until 30+ new verdicts are recorded.</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

    </div>
  )
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountContent />
    </Suspense>
  )
}

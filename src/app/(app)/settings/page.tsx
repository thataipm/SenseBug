'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { KBDocument, TriageRun } from '@/types'
import { Loader2, FileText, Trash2, Upload, Clock, Check, Sparkles } from 'lucide-react'

const EXAMPLE_CONTENT = {
  productOverview: `Acme is a B2B project management platform used by engineering teams at 200+ software companies. Our core value is automating sprint planning and surfacing hidden blockers across team dependencies in real time. Primary users are engineering managers, product managers, and developers.`,
  criticalFlows: `1. User authentication — login, signup, SSO, and password reset
2. Sprint creation and task assignment to team members
3. Cross-team dependency linking and blocker alert notifications
4. Reporting dashboard — burndown charts, velocity tracking, cycle time
5. Third-party integrations — Jira, GitHub, and Slack sync`,
  productAreas: `Sprint Planning, Task Board, Dependency Map, Team Settings, Integrations (Jira/GitHub/Slack), Reports & Analytics, Notifications, Billing & Subscription`,
}

function SettingsContent() {
  const [productOverview, setProductOverview] = useState('')
  const [criticalFlows, setCriticalFlows]     = useState('')
  const [productAreas, setProductAreas]       = useState('')
  const [docs, setDocs]   = useState<KBDocument[]>([])
  const [runs, setRuns]   = useState<TriageRun[]>([])
  const [plan, setPlan]   = useState<any>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [loading, setLoading]         = useState(true)
  const [kbSaving, setKbSaving]       = useState(false)
  const [kbSaved, setKbSaved]         = useState(false)
  const [kbError, setKbError]         = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router  = useRouter()
  const searchParams = useSearchParams()
  const justUpgraded = searchParams.get('upgraded') === '1'
  const alreadySubscribed = searchParams.get('already_subscribed') === '1'

  const fetchAll = useCallback(async () => {
    const [kbRes, docsRes, runsRes, planRes] = await Promise.all([
      fetch('/api/kb'), fetch('/api/kb/documents'), fetch('/api/triage/runs'), fetch('/api/plan'),
    ])
    if (kbRes.ok) {
      const kb = await kbRes.json()
      if (kb) {
        setProductOverview(kb.product_overview || '')
        setCriticalFlows(kb.critical_flows || '')
        setProductAreas(kb.product_areas || '')
      }
    }
    if (docsRes.ok) setDocs(await docsRes.json())
    if (runsRes.ok) setRuns(await runsRes.json())
    if (planRes.ok) setPlan(await planRes.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email ?? '')
      await fetchAll()
    }
    init()
  }, [router, fetchAll])

  // When redirected back from Dodo checkout (?upgraded=1), the webhook fires
  // asynchronously — poll /api/plan until the plan upgrades or we time out.
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

  const handleKBSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setKbError('')
    setKbSaving(true)
    const res = await fetch('/api/kb/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_overview: productOverview, critical_flows: criticalFlows, product_areas: productAreas }),
    })
    setKbSaving(false)
    if (res.ok) { setKbSaved(true); setTimeout(() => setKbSaved(false), 2000) }
    else setKbError('Failed to save. Please try again.')
  }

  const handleDeleteDoc = async (id: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return
    const res = await fetch(`/api/kb/document/${id}`, { method: 'DELETE' })
    if (res.ok) setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  const handleDocUpload = async (file: File) => {
    if (!['pro', 'team', 'max'].includes(plan?.plan ?? '')) {
      setKbError('Document uploads are available on Pro and Max plans. Upgrade to unlock this feature.')
      return
    }
    const allowedExts = ['.pdf', '.docx', '.txt', '.md']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!allowedExts.includes(ext)) {
      setKbError('Supported file types: PDF, Word (.docx), plain text (.txt), and Markdown (.md).')
      return
    }
    if (file.size > 10 * 1024 * 1024) { setKbError('File must be under 10MB.'); return }
    setDocUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/kb/upload', { method: 'POST', body: fd })
    setDocUploading(false)
    if (res.ok) {
      void fetchAll()
    } else {
      let msg = 'Upload failed.'
      try { const j = await res.json(); msg = j.error || msg } catch {}
      setKbError(msg)
    }
  }

  const handleUpgrade = async (targetPlan: string) => {
    setCheckoutLoading(targetPlan)
    const res = await fetch('/api/dodo/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: targetPlan }),
    })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      setCheckoutLoading(null)
    }
  }

  const planLabels: Record<string, string> = { starter: 'Starter', pro: 'Pro', team: 'Max', max: 'Max' }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-black/30" />
    </div>
  )

  return (
    <div className="px-6 md:px-10 py-10 max-w-2xl mx-auto space-y-12" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <h1 className="text-2xl font-black tracking-tighter" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Settings</h1>

      {/* Knowledge Base */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Knowledge Base</p>
        <form onSubmit={handleKBSave} className="space-y-4">
          {kbError && <div className="border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3">{kbError}</div>}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Product overview</label>
            <textarea data-testid="settings-product-overview" value={productOverview} onChange={(e) => setProductOverview(e.target.value)} rows={3} className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Critical user flows</label>
            <textarea data-testid="settings-critical-flows" value={criticalFlows} onChange={(e) => setCriticalFlows(e.target.value)} rows={3} className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Product areas / modules</label>
            <textarea data-testid="settings-product-areas" value={productAreas} onChange={(e) => setProductAreas(e.target.value)} rows={2} className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150 resize-none" />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <button data-testid="settings-save-kb-button" type="submit" disabled={kbSaving} className="bg-black text-white px-6 py-2.5 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50 flex items-center gap-2">
              {kbSaving && <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>}
              {!kbSaving && kbSaved && <><Check className="w-4 h-4" />Saved</>}
              {!kbSaving && !kbSaved && 'Save knowledge base'}
            </button>
            <button
              type="button"
              onClick={() => {
                setProductOverview(EXAMPLE_CONTENT.productOverview)
                setCriticalFlows(EXAMPLE_CONTENT.criticalFlows)
                setProductAreas(EXAMPLE_CONTENT.productAreas)
              }}
              className="flex items-center gap-1.5 text-xs font-mono text-black/35 hover:text-black/70 transition-colors duration-150"
              style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
            >
              <Sparkles className="w-3 h-3" strokeWidth={1.5} />
              View example
            </button>
          </div>
        </form>
      </section>

      {/* Uploaded Docs */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Uploaded documents</p>
        {docs.length === 0 ? (
          <p className="text-sm text-black/40 mb-4">No documents uploaded yet.</p>
        ) : (
          <div className="border border-gray-200 divide-y divide-gray-100 mb-4">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="w-4 h-4 text-black/30 flex-shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.filename}</p>
                  <p className="text-xs text-black/35">{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <button data-testid={`delete-doc-${doc.id}`} onClick={() => handleDeleteDoc(doc.id, doc.filename)} className="text-black/30 hover:text-red-500 transition-colors duration-150 p-1">
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            data-testid="upload-doc-button"
            onClick={() => fileRef.current?.click()}
            disabled={docUploading}
            className="flex items-center gap-2 border border-gray-200 hover:border-black px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-50"
          >
            {docUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" strokeWidth={1.5} />}
            Upload document
          </button>
          <span className="text-xs text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            PDF, Word (.docx), .txt, .md · 10MB max · Pro &amp; Max only
          </span>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && handleDocUpload(e.target.files[0])} />
      </section>

      {/* Account */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Account</p>

        {/* Upgrade success banner */}
        {justUpgraded && (
          <div className="mb-5 border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" strokeWidth={2.5} />
            <div>
              <p className="text-sm font-semibold text-green-800" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>You&apos;re all set!</p>
              <p className="text-xs text-green-700">Your plan has been upgraded. New limits apply immediately.</p>
            </div>
          </div>
        )}

        {/* Already subscribed banner */}
        {alreadySubscribed && (
          <div className="mb-5 border border-blue-200 bg-blue-50 px-5 py-4 flex items-center gap-3">
            <Check className="w-5 h-5 text-blue-600 flex-shrink-0" strokeWidth={2.5} />
            <div>
              <p className="text-sm font-semibold text-blue-800" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>You&apos;re already on this plan.</p>
              <p className="text-xs text-blue-700">To make changes to your subscription, use Manage billing below.</p>
            </div>
          </div>
        )}

        <div className="border border-gray-200 divide-y divide-gray-100">
          {/* Email row */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-black/40 mb-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Email</p>
              <p className="text-sm">{userEmail || '—'}</p>
            </div>
          </div>

          {/* Plan + usage row */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-mono text-black/40 mb-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Plan</p>
                <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                  {plan ? planLabels[plan.plan] : '—'}
                </p>
              </div>
              {plan && (
                <div className="text-right">
                  <p className="text-xs font-mono text-black/40 mb-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Bugs this month</p>
                  <p className="text-sm font-mono" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                    {plan.bugs_analyzed_this_month ?? 0}
                    {plan.monthly_bug_limit > 0 ? ` / ${plan.monthly_bug_limit}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Upgrade options — shown only for starter */}
            {plan?.plan === 'starter' && (
              <div className="mt-2 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pro */}
                <div className="border border-gray-200 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Pro</p>
                    <p className="text-xs font-mono text-black/50" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>$19 / mo</p>
                  </div>
                  <ul className="space-y-1.5">
                    {['250 bugs / month', '100 bugs / run', 'Document uploads'].map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-black/60">
                        <Check className="w-3 h-3 text-green-500 flex-shrink-0" strokeWidth={2.5} />{f}
                      </li>
                    ))}
                  </ul>
                  <button
                    data-testid="upgrade-button"
                    onClick={() => handleUpgrade('pro')}
                    disabled={!!checkoutLoading}
                    className="w-full bg-black text-white py-2 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {checkoutLoading === 'pro' ? <><Loader2 className="w-4 h-4 animate-spin" />Redirecting…</> : <><Sparkles className="w-4 h-4" strokeWidth={1.5} />Upgrade to Pro</>}
                  </button>
                </div>
                {/* Max */}
                <div className="border border-gray-200 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Max</p>
                    <p className="text-xs font-mono text-black/50" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>$49 / mo</p>
                  </div>
                  <ul className="space-y-1.5">
                    {['500 bugs / month', '250 bugs / run', 'Document uploads'].map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-black/60">
                        <Check className="w-3 h-3 text-green-500 flex-shrink-0" strokeWidth={2.5} />{f}
                      </li>
                    ))}
                    <li className="flex items-center gap-2 text-xs text-black/40">
                      <Check className="w-3 h-3 text-black/20 flex-shrink-0" strokeWidth={2.5} />Jira integration <span className="text-black/30">(coming soon)</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => handleUpgrade('max')}
                    disabled={!!checkoutLoading}
                    className="w-full border border-black text-black py-2 text-sm font-semibold hover:bg-black hover:text-white transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {checkoutLoading === 'max' ? <><Loader2 className="w-4 h-4 animate-spin" />Redirecting…</> : 'Upgrade to Max'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Billing managed in Account tab */}
          {(plan?.plan === 'pro' || plan?.plan === 'max') && (
            <div className="px-6 py-4">
              <p className="text-xs text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                Manage billing, invoices, and cancellation from the{' '}
                <a href="/account" className="underline hover:text-black transition-colors">Account</a> tab.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Run history */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Run history</p>
        {runs.length === 0 ? (
          <p className="text-sm text-black/40">No runs yet.</p>
        ) : (
          <table className="w-full text-sm border-y border-gray-200">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 text-left font-mono text-xs uppercase tracking-widest text-black/40 pr-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>File</th>
                <th className="py-3 text-left font-mono text-xs uppercase tracking-widest text-black/40 pr-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Date</th>
                <th className="py-3 text-right font-mono text-xs uppercase tracking-widest text-black/40" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Bugs</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-100">
                  <td className="py-3 pr-4">
                    <Link href={`/results/${run.id}`} className="hover:underline">{run.filename}</Link>
                  </td>
                  <td className="py-3 pr-4 text-black/45 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />{new Date(run.run_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right font-mono text-xs text-black/45" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{run.bug_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}

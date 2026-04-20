'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { KBDocument, TriageRun } from '@/types'
import { Loader2, FileText, Trash2, Upload, Clock, Check, ExternalLink, Sparkles } from 'lucide-react'

function SettingsContent() {
  const [productOverview, setProductOverview] = useState('')
  const [criticalFlows, setCriticalFlows]     = useState('')
  const [productAreas, setProductAreas]       = useState('')
  const [docs, setDocs]   = useState<KBDocument[]>([])
  const [runs, setRuns]   = useState<TriageRun[]>([])
  const [plan, setPlan]   = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [kbSaving, setKbSaving]       = useState(false)
  const [kbSaved, setKbSaved]         = useState(false)
  const [kbError, setKbError]         = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router  = useRouter()
  const searchParams = useSearchParams()
  const justUpgraded = searchParams.get('upgraded') === '1'

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
      await fetchAll()
    }
    init()
  }, [router, fetchAll])

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
    if (!['pro', 'team'].includes(plan?.plan ?? '')) {
      setKbError('Document uploads are available on Pro and Team plans. Upgrade to unlock this feature.')
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
    const res = await fetch('/api/stripe/checkout', {
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

  const handleManageBilling = async () => {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      setPortalLoading(false)
    }
  }

  const planLabels: Record<string, string> = { starter: 'Starter', pro: 'Pro', team: 'Team' }

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
          <button data-testid="settings-save-kb-button" type="submit" disabled={kbSaving} className="bg-black text-white px-6 py-2.5 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50 flex items-center gap-2">
            {kbSaving && <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>}
            {!kbSaving && kbSaved && <><Check className="w-4 h-4" />Saved</>}
            {!kbSaving && !kbSaved && 'Save knowledge base'}
          </button>
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
            PDF, Word (.docx), .txt, .md · 10MB max · Pro &amp; Team only
          </span>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && handleDocUpload(e.target.files[0])} />
      </section>

      {/* Plan summary */}
      <section>
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Plan</p>

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

        <div className="border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-xs font-mono text-black/40 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Current plan</p>
              <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{plan ? planLabels[plan.plan] : '—'}</p>
            </div>
            {(plan?.plan === 'pro' || plan?.plan === 'team') && (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="flex items-center gap-2 border border-gray-200 hover:border-black px-4 py-2 text-sm transition-colors duration-150 disabled:opacity-50"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" strokeWidth={1.5} />}
                Manage billing
              </button>
            )}
          </div>

          {/* Upgrade options for starter */}
          {plan?.plan === 'starter' && (
            <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              {/* Team */}
              <div className="border border-gray-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Team</p>
                  <p className="text-xs font-mono text-black/50" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>$49 / mo</p>
                </div>
                <ul className="space-y-1.5">
                  {['500 bugs / month', '250 bugs / run', 'Document uploads'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-black/60">
                      <Check className="w-3 h-3 text-green-500 flex-shrink-0" strokeWidth={2.5} />{f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade('team')}
                  disabled={!!checkoutLoading}
                  className="w-full border border-black text-black py-2 text-sm font-semibold hover:bg-black hover:text-white transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {checkoutLoading === 'team' ? <><Loader2 className="w-4 h-4 animate-spin" />Redirecting…</> : 'Upgrade to Team'}
                </button>
              </div>
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

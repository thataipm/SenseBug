'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { KBDocument } from '@/types'
import { Loader2, FileText, Trash2, Upload, Check, Sparkles } from 'lucide-react'

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
  const [plan, setPlan]   = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [kbSaving, setKbSaving]       = useState(false)
  const [kbSaved, setKbSaved]         = useState(false)
  const [kbError, setKbError]         = useState('')
  const [docUploading, setDocUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router  = useRouter()

  const fetchAll = useCallback(async () => {
    const [kbRes, docsRes, planRes] = await Promise.all([
      fetch('/api/kb'), fetch('/api/kb/documents'), fetch('/api/plan'),
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
            <textarea data-testid="settings-product-overview" value={productOverview} onChange={(e) => setProductOverview(e.target.value)} rows={7} className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150 resize-y" />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Critical user flows</label>
            <textarea data-testid="settings-critical-flows" value={criticalFlows} onChange={(e) => setCriticalFlows(e.target.value)} rows={7} className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150 resize-y" />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Product areas / modules</label>
            <textarea data-testid="settings-product-areas" value={productAreas} onChange={(e) => setProductAreas(e.target.value)} rows={4} className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150 resize-y" />
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

'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Upload, X, FileText, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const EXAMPLE_CONTENT = {
  productOverview: `Acme is a B2B project management platform used by engineering teams at 200+ software companies. Our core value is automating sprint planning and surfacing hidden blockers across team dependencies in real time. Primary users are engineering managers, product managers, and developers.`,
  criticalFlows: `1. User authentication — login, signup, SSO, and password reset
2. Sprint creation and task assignment to team members
3. Cross-team dependency linking and blocker alert notifications
4. Reporting dashboard — burndown charts, velocity tracking, cycle time
5. Third-party integrations — Jira, GitHub, and Slack sync`,
  productAreas: `Sprint Planning, Task Board, Dependency Map, Team Settings, Integrations (Jira/GitHub/Slack), Reports & Analytics, Notifications, Billing & Subscription`,
}

interface UploadedFile { name: string; status: 'uploading' | 'done' | 'error'; error?: string }

function OnboardingContent() {
  const [productOverview, setProductOverview] = useState('')
  const [criticalFlows, setCriticalFlows] = useState('')
  const [productAreas, setProductAreas] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [saving, setSaving] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') // preserved from signup flow

  // Auth + KB guard: redirect if unauthenticated or KB already exists
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const res = await fetch('/api/kb')
      if (res.ok) {
        const kb = await res.json()
        // KB already set up — skip onboarding, but preserve plan param so checkout still happens
        if (kb) {
          router.push(plan ? `/checkout?plan=${plan}` : '/dashboard')
          return
        }
      }
      setChecking(false)
    }
    init()
  }, [router, plan])

  const handleFileUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const nameOk = file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.pdf') || file.name.endsWith('.docx')
      if (!nameOk) {
        setUploadedFiles((prev) => {
          const idx = prev.findIndex((f) => f.name === file.name)
          const entry: UploadedFile = { name: file.name, status: 'error', error: 'Only PDF, .txt, and .md files are supported.' }
          if (idx !== -1) { const n = [...prev]; n[idx] = entry; return n }
          return [...prev, entry]
        })
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadedFiles((prev) => {
          const idx = prev.findIndex((f) => f.name === file.name)
          const entry: UploadedFile = { name: file.name, status: 'error', error: 'File must be under 10MB.' }
          if (idx !== -1) { const n = [...prev]; n[idx] = entry; return n }
          return [...prev, entry]
        })
        continue
      }
      setUploadedFiles((prev) => {
        const idx = prev.findIndex((f) => f.name === file.name)
        const entry: UploadedFile = { name: file.name, status: 'uploading' }
        if (idx !== -1) { const n = [...prev]; n[idx] = entry; return n }
        return [...prev, entry]
      })
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/kb/upload', { method: 'POST', body: fd })
      let errMsg = 'Upload failed'
      if (!res.ok) {
        try { const j = await res.json(); errMsg = j.error || errMsg } catch {}
      }
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? res.ok ? { ...f, status: 'done' } : { ...f, status: 'error', error: errMsg }
            : f
        )
      )
    }
  }

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!productOverview.trim() || !criticalFlows.trim() || !productAreas.trim()) {
      setError('All three fields are required to get accurate results.')
      return
    }
    setSaving(true)
    const res = await fetch('/api/kb/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_overview: productOverview, critical_flows: criticalFlows, product_areas: productAreas }),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save. Please try again.'); return }
    // If user came from a paid plan signup, send them to checkout next
    router.push(plan ? `/checkout?plan=${plan}` : '/dashboard')
  }

  // Skip: save an empty KB so the guard doesn't redirect back here,
  // then go to dashboard where a soft banner nudges them to set it up.
  const handleSkip = async () => {
    setSkipping(true)
    await fetch('/api/kb/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_overview: '', critical_flows: '', product_areas: '' }),
    })
    router.push('/dashboard?kb_skipped=1')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      {/* Header */}
      <header className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-lg tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG</Link>
        <span className="text-xs font-mono text-black/30 uppercase tracking-widest" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Setup</span>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-16">

        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Knowledge Base Setup</p>
        <h1 className="text-4xl font-black tracking-tighter mb-2" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Tell Sensebug about your product</h1>
        <p className="text-sm text-black/55 mb-10 leading-relaxed">
          The AI uses this context to rank bugs by business impact — not just ticket text.
          The more specific you are, the more accurate the results.
        </p>

        <form onSubmit={handleSave} className="space-y-6">
          {error && <div data-testid="onboarding-error" className="border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3">{error}</div>}

          {/* Product overview */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/50 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
              Product overview <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-black/40 mb-2">What does your product do and who uses it? 2–3 sentences.</p>
            <textarea
              data-testid="onboarding-product-overview"
              value={productOverview}
              onChange={(e) => setProductOverview(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150 resize-none"
              placeholder="e.g. Acme is a B2B SaaS platform for supply chain management used by 500+ logistics companies. Our core value is real-time shipment tracking and automated exception handling."
            />
          </div>

          {/* Critical flows */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/50 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
              Critical user flows <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-black/40 mb-2">List 3–5 flows that if broken would be a business emergency. These get the highest weight in ranking.</p>
            <textarea
              data-testid="onboarding-critical-flows"
              value={criticalFlows}
              onChange={(e) => setCriticalFlows(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150 resize-none"
              placeholder="1. User login and authentication&#10;2. Order creation and checkout&#10;3. Payment processing&#10;4. Shipment tracking updates"
            />
          </div>

          {/* Product areas */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/50 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
              Product areas / modules <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-black/40 mb-2">List your main features or modules. Used to map bugs to business areas.</p>
            <textarea
              data-testid="onboarding-product-areas"
              value={productAreas}
              onChange={(e) => setProductAreas(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150 resize-none"
              placeholder="Dashboard, Billing, API, Onboarding, Notifications, Reports"
            />
          </div>

          {/* Doc upload — with clear payoff explanation */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/50 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
              Upload product docs — optional but recommended
            </label>
            {/* Payoff callout */}
            <div className="flex items-start gap-2.5 bg-gray-50 border border-gray-200 px-4 py-3 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-black/40 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
              <p className="text-xs text-black/55 leading-relaxed">
                Uploading your PRD, spec docs, or release notes gives the AI product-specific context it can&apos;t get from ticket text alone.
                Results are <strong className="text-black/75">noticeably more accurate</strong> when docs are present — especially for ranking bugs by business impact.
              </p>
            </div>
            <div
              data-testid="onboarding-doc-upload-area"
              className="border border-dashed border-gray-300 hover:border-black transition-colors duration-150 p-6 text-center cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files) }}
            >
              <Upload className="w-5 h-5 mx-auto mb-2 text-black/30" strokeWidth={1.5} />
              <p className="text-sm text-black/45">Drag & drop or click to upload</p>
              <p className="text-xs text-black/30 mt-1">PDF, .txt, .md — up to 10MB each</p>
              <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
            </div>
            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {uploadedFiles.map((f) => (
                  <div key={f.name} className="flex items-center gap-3 border border-gray-200 px-3 py-2">
                    <FileText className="w-4 h-4 text-black/40 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-sm flex-1 truncate">{f.name}</span>
                    {f.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-black/40" />}
                    {f.status === 'done' && <span className="text-xs text-green-600 font-mono">✓ Saved</span>}
                    {f.status === 'error' && <span className="text-xs text-red-500 mr-1">{f.error}</span>}
                    {f.status !== 'uploading' && (
                      <button type="button" data-testid={`remove-file-${f.name}`} onClick={() => removeFile(f.name)} className="text-black/30 hover:text-black transition-colors duration-150 flex-shrink-0">
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {uploadedFiles.some((f) => f.status === 'done') && (
              <p className="text-xs text-black/35 mt-2">Docs can be managed later in Settings.</p>
            )}
          </div>

          {/* Fill with example */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <button
              type="button"
              onClick={() => {
                setProductOverview(EXAMPLE_CONTENT.productOverview)
                setCriticalFlows(EXAMPLE_CONTENT.criticalFlows)
                setProductAreas(EXAMPLE_CONTENT.productAreas)
              }}
              className="flex items-center gap-1.5 text-xs font-mono text-black/35 hover:text-black/70 transition-colors duration-150 flex-shrink-0"
              style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
            >
              <Sparkles className="w-3 h-3" strokeWidth={1.5} />
              Fill with example
            </button>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button
            data-testid="onboarding-save-button"
            type="submit"
            disabled={saving || skipping}
            className="w-full bg-black text-white py-3.5 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save and continue →'}
          </button>

          {/* Skip option */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving || skipping}
              className="text-xs text-black/35 hover:text-black/60 transition-colors duration-150 disabled:opacity-50"
            >
              {skipping ? 'Skipping…' : 'Skip for now — I\'ll set this up later in Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}

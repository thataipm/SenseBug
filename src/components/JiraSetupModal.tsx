'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Loader2, Copy, CheckCheck, ExternalLink, AlertCircle, CheckCircle2,
  Trash2, X, Download, ChevronDown,
} from 'lucide-react'
import type { Integration } from '@/types'

const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.sensebug.com'

interface JiraSetupModalProps {
  open:                 boolean
  onClose:              () => void
  /** Called whenever the integration is created or removed — parent should refetch status */
  onIntegrationChange?: () => void
}

interface SyncResult {
  synced:                  number
  skipped:                 number
  total_in_jira:           number
  capped:                  boolean
  capped_reason:           'time' | 'quota' | null
  monthly_quota_remaining: number   // -1 = unlimited (admin)
  errors:                  Array<{ bug_id: string; error: string }>
  message?:                string
}

export function JiraSetupModal({ open, onClose, onIntegrationChange }: JiraSetupModalProps) {
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [plan, setPlan]               = useState<string | null>(null)
  const [isFreeOrTrial, setIsFreeOrTrial] = useState(false)
  const [loading, setLoading]         = useState(true)

  // Form
  const [siteUrl,  setSiteUrl]  = useState('')
  const [email,    setEmail]    = useState('')
  const [apiToken, setApiToken] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied,   setCopied]   = useState(false)

  // First-connect prompt — shown when integration is newly created during this modal session
  const [showFirstConnectPrompt, setShowFirstConnectPrompt] = useState(false)

  // Sync All
  const [syncing,    setSyncing]    = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError,  setSyncError]  = useState<string | null>(null)
  const [syncElapsed, setSyncElapsed] = useState(0)
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Setup guide collapse state
  const [guideOpen, setGuideOpen] = useState(false)

  // Load integration + plan when the modal opens
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [iRes, pRes] = await Promise.all([
        fetch('/api/integrations/jira').then(r => r.ok ? r.json() : null),
        fetch('/api/plan').then(r => r.ok ? r.json() : null),
      ])
      setIntegration(iRes)
      setPlan(pRes?.plan ?? null)
      // Trial users get Jira on Pro trial — treat trial-expired as "free" gate
      setIsFreeOrTrial(Boolean(pRes?.is_trial_expired) && !pRes?.is_paid)
      if (iRes) {
        setSiteUrl(iRes.site_url ?? '')
        setEmail(iRes.email ?? '')
      } else {
        setSiteUrl('')
        setEmail('')
      }
    } catch {
      // network error — show empty state
      setIntegration(null)
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadData()
  }, [open, loadData])

  // Reset transient state when the modal closes
  useEffect(() => {
    if (!open) {
      setApiToken('')
      setSaveError(null)
      setSaveSuccess(false)
      setShowFirstConnectPrompt(false)
      setSyncResult(null)
      setSyncError(null)
      setSyncElapsed(0)
      setGuideOpen(false)
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current)
        syncTimerRef.current = null
      }
    }
  }, [open])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const webhookUrl = integration
    ? `${APP_URL}/api/webhooks/jira?secret=${integration.webhook_secret}`
    : null

  const handleCopy = async () => {
    if (!webhookUrl) return
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const wasConnected = !!integration
    const res = await fetch('/api/integrations/jira', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ site_url: siteUrl, email, api_token: apiToken }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setSaveError(data.error ?? 'Failed to save integration')
      return
    }
    setIntegration(data)
    setSaveSuccess(true)
    setApiToken('') // don't keep the token in state after save
    onIntegrationChange?.()
    setTimeout(() => setSaveSuccess(false), 4000)

    // Trigger the first-connect prompt when we just transitioned from "not connected" → "connected"
    if (!wasConnected) setShowFirstConnectPrompt(true)
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Jira? Existing bugs in your backlog will remain, but new bugs will no longer be ingested automatically.')) return
    setDeleting(true)
    const res = await fetch('/api/integrations/jira', { method: 'DELETE' })
    if (res.ok) {
      setIntegration(null)
      setSiteUrl('')
      setEmail('')
      setApiToken('')
      onIntegrationChange?.()
    }
    setDeleting(false)
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    setSyncElapsed(0)
    setShowFirstConnectPrompt(false)
    syncTimerRef.current = setInterval(() => setSyncElapsed(e => e + 1), 1000)

    try {
      const res  = await fetch('/api/integrations/jira/sync-all', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncError(data.error ?? 'Failed to import bugs from Jira')
        return
      }
      setSyncResult(data as SyncResult)
    } catch {
      setSyncError('Network error — please try again.')
    } finally {
      setSyncing(false)
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current)
        syncTimerRef.current = null
      }
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (!open) return null

  const isConnected = !!integration

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 md:p-8"
      onClick={onClose}
      style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}
    >
      <div
        className="relative bg-white w-full max-w-2xl shadow-xl mt-4 md:mt-8 mb-12"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jira-setup-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-black/30" style={MONO}>Integration</p>
            <h2 id="jira-setup-modal-title" className="text-xl font-black tracking-tight" style={HEADING}>Jira</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-black/60" />
          </button>
        </div>

        <div className="px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-black/30" />
            </div>
          ) : isFreeOrTrial ? (
            // Trial expired
            <div className="border border-gray-200 bg-gray-50 px-5 py-5">
              <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-2" style={MONO}>Subscription required</p>
              <p className="text-sm text-black/70 mb-4 leading-relaxed">
                Your free trial has ended. Subscribe to Pro or Max to reconnect Jira and resume automatic bug analysis.
              </p>
              <a
                href="/pricing"
                className="inline-flex items-center gap-2 bg-black text-white text-sm font-semibold px-5 py-2.5 hover:bg-black/80 transition-colors"
              >
                See plans →
              </a>
            </div>
          ) : (
            <>
              {/* Connected status */}
              {isConnected && (
                <div className="flex items-start gap-3 border border-green-200 bg-green-50 px-4 py-3 mb-6">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-green-800">Connected to {integration.site_url}</p>
                    <p className="text-xs text-green-700 mt-0.5">{integration.email}</p>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={deleting}
                    className="flex items-center gap-1.5 text-xs text-black/40 hover:text-red-600 transition-colors flex-shrink-0"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Disconnect
                  </button>
                </div>
              )}

              {/* First-connect prompt — appears right after a fresh connection */}
              {isConnected && showFirstConnectPrompt && !syncing && !syncResult && (
                <div className="border border-black bg-black text-white px-5 py-5 mb-6">
                  <p className="text-xs font-mono uppercase tracking-widest text-white/40 mb-1.5" style={MONO}>Recommended next step</p>
                  <p className="text-base font-bold mb-1.5" style={HEADING}>Import existing Jira bugs?</p>
                  <p className="text-sm text-white/70 leading-relaxed mb-4">
                    Pull your existing bugs from Jira{integration?.project_key ? ` (project ${integration.project_key})` : ''} into your SenseBug backlog so you have a complete picture, not just bugs filed from now on.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSyncAll}
                      className="bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />Import now
                    </button>
                    <button
                      onClick={() => setShowFirstConnectPrompt(false)}
                      className="text-sm text-white/55 hover:text-white transition-colors"
                    >
                      Skip — only sync new bugs
                    </button>
                  </div>
                </div>
              )}

              {/* Webhook URL */}
              {isConnected && webhookUrl && (
                <div className="mb-6">
                  <p className="text-xs font-medium text-black/70 mb-2">Webhook URL</p>
                  <p className="text-xs text-black/50 mb-3 leading-relaxed">
                    Add this URL to a Jira Automation rule with <strong>two triggers</strong>: <strong>Work item created</strong> AND <strong>Work item updated</strong>. Both are required — updated catches new comments and edits, so the backlog reflects real-time changes. Action: <strong>Send web request</strong>, method POST.
                  </p>
                  <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <code className="text-xs text-black/70 flex-1 truncate" style={MONO}>{webhookUrl}</code>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs text-black/40 hover:text-black transition-colors flex-shrink-0"
                    >
                      {copied
                        ? <><CheckCheck className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Copied</span></>
                        : <><Copy className="w-3.5 h-3.5" />Copy</>
                      }
                    </button>
                  </div>
                  <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Use this <strong>exact URL</strong> in every Jira Automation rule. A mismatched or truncated URL causes a <code className="font-mono bg-amber-100 px-1">401 Invalid secret</code> error.
                    </p>
                  </div>
                </div>
              )}

              {/* Sync All — visible when connected, not in first-connect-prompt mode, and not currently syncing */}
              {isConnected && !showFirstConnectPrompt && !syncing && !syncResult && !syncError && (
                <div className="mb-6 border border-gray-200 px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-black mb-0.5">Sync existing Jira bugs</p>
                    <p className="text-xs text-black/55 leading-relaxed">
                      Imports your existing Jira bugs{integration?.project_key ? ` from ${integration.project_key}` : ''} up to your remaining monthly quota. Already-imported bugs are skipped, so re-running is safe.
                    </p>
                  </div>
                  <button
                    onClick={handleSyncAll}
                    className="bg-black text-white px-4 py-2 text-sm font-semibold hover:bg-black/80 transition-colors flex items-center gap-2 flex-shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />Sync now
                  </button>
                </div>
              )}

              {/* Sync in progress */}
              {syncing && (
                <div className="mb-6 border border-gray-200 bg-gray-50 px-5 py-5 flex items-center gap-4">
                  <Loader2 className="w-5 h-5 animate-spin text-black/60 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black mb-0.5">Importing bugs from Jira…</p>
                    <p className="text-xs text-black/55">
                      Fetching, analysing, and ranking each bug. Can take a few minutes for larger backlogs.{' '}
                      <span style={MONO}>{syncElapsed}s elapsed</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Sync result */}
              {syncResult && (
                <div className="mb-6 border border-green-200 bg-green-50 px-5 py-4">
                  <p className="text-sm font-medium text-green-800 mb-1">
                    {syncResult.synced > 0
                      ? `Imported ${syncResult.synced} bug${syncResult.synced === 1 ? '' : 's'}`
                      : 'No new bugs to import'}
                  </p>
                  <p className="text-xs text-green-700 leading-relaxed">
                    {syncResult.message ?? (
                      <>
                        {syncResult.skipped > 0 && `${syncResult.skipped} already in your backlog. `}
                        {syncResult.total_in_jira > syncResult.synced + syncResult.skipped &&
                          `${syncResult.total_in_jira} bugs match in Jira total. `}
                        {syncResult.capped && syncResult.capped_reason === 'quota' && (
                          <strong>Hit your monthly quota — upgrade or wait until next month for the rest.</strong>
                        )}
                        {syncResult.capped && syncResult.capped_reason === 'time' && (
                          <strong>Re-run to import the rest — already-synced bugs are skipped.</strong>
                        )}
                      </>
                    )}
                  </p>
                  {syncResult.errors.length > 0 && (
                    <p className="text-xs text-amber-700 mt-2">
                      {syncResult.errors.length} bug{syncResult.errors.length === 1 ? '' : 's'} couldn&apos;t be analysed (will retry automatically via the background sync).
                    </p>
                  )}
                  <button
                    onClick={() => { setSyncResult(null); setSyncError(null) }}
                    className="mt-3 text-xs text-green-700 underline underline-offset-2 hover:text-green-900"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Sync error */}
              {syncError && !syncing && (
                <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700">{syncError}</p>
                    <button
                      onClick={() => setSyncError(null)}
                      className="mt-1 text-xs text-red-700 underline underline-offset-2 hover:text-red-900"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Connect / Update credentials form */}
              <form onSubmit={handleSave} className="space-y-4">
                <p className="text-xs font-medium text-black/50 uppercase tracking-widest" style={MONO}>
                  {isConnected ? 'Update credentials' : 'Connect Jira'}
                </p>

                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1.5">Jira site URL</label>
                  <input
                    type="url"
                    placeholder="https://yourcompany.atlassian.net"
                    value={siteUrl}
                    onChange={e => setSiteUrl(e.target.value)}
                    required
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1.5">Jira account email</label>
                  <input
                    type="email"
                    placeholder="you@yourcompany.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1.5">API token</label>
                  <input
                    type="password"
                    placeholder={isConnected ? 'Re-enter your API token to update credentials' : 'Your Jira API token'}
                    value={apiToken}
                    onChange={e => setApiToken(e.target.value)}
                    required={!isConnected}
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-black/40 hover:text-black mt-1.5 transition-colors"
                  >
                    Create an API token at id.atlassian.com <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {saveError && (
                  <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{saveError}</p>
                  </div>
                )}

                {saveSuccess && (
                  <div className="flex items-center gap-2 border border-green-200 bg-green-50 px-3 py-2.5">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-700">Connection verified and saved.</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || (isConnected && !apiToken)}
                  className="flex items-center gap-2 bg-black text-white text-sm font-medium px-5 py-2.5 hover:bg-black/80 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Verifying connection…' : isConnected ? 'Update credentials' : 'Connect Jira'}
                </button>
              </form>

              {/* Setup guide — collapsed by default to keep the modal short */}
              <div className="mt-8 border-t border-gray-100 pt-6">
                <button
                  onClick={() => setGuideOpen(o => !o)}
                  className="w-full flex items-center justify-between text-left group"
                >
                  <p className="text-xs font-medium text-black/50 uppercase tracking-widest group-hover:text-black transition-colors" style={MONO}>
                    Setup guide
                  </p>
                  <ChevronDown
                    className={`w-4 h-4 text-black/40 transition-transform duration-150 ${guideOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {guideOpen && (
                  <ol className="mt-5 space-y-5">
                    <li className="flex items-start gap-3">
                      <span className="text-[10px] font-mono text-black/30 mt-0.5 w-4 flex-shrink-0" style={MONO}>1</span>
                      <div>
                        <p className="text-sm font-medium text-black/80 mb-0.5">Get a Jira API token</p>
                        <p className="text-sm text-black/50 leading-relaxed">
                          Go to{' '}
                          <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="underline hover:text-black transition-colors">
                            id.atlassian.com
                          </a>{' '}→ Security → API tokens → Create API token. Copy it and paste it above.
                        </p>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <span className="text-[10px] font-mono text-black/30 mt-0.5 w-4 flex-shrink-0" style={MONO}>2</span>
                      <div>
                        <p className="text-sm font-medium text-black/80 mb-0.5">Connect SenseBug</p>
                        <p className="text-sm text-black/50 leading-relaxed">
                          Fill in your Jira site URL, account email, and API token above. Your unique webhook URL appears here once connected.
                        </p>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <span className="text-[10px] font-mono text-black/30 mt-0.5 w-4 flex-shrink-0" style={MONO}>3</span>
                      <div>
                        <p className="text-sm font-medium text-black/80 mb-1">Create a Jira Automation rule with BOTH triggers</p>
                        <p className="text-sm text-black/50 mb-2 leading-relaxed">
                          In Jira: <span className="font-medium text-black/70">Project settings → Automation → Create rule</span>
                        </p>
                        <ul className="space-y-1.5">
                          {[
                            { label: 'Add trigger:', value: 'Work item created' },
                            { label: 'Add trigger:', value: 'Work item updated  (required — catches new comments and edits)' },
                            { label: 'Add action:',  value: 'Send web request → Method: POST → paste the webhook URL above' },
                          ].map((row, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-black/30 flex-shrink-0 font-mono text-xs mt-0.5" style={MONO}>—</span>
                              <span className="text-black/50">
                                <span className="font-medium text-black/65">{row.label}</span>{' '}{row.value}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-xs text-black/40 bg-gray-50 border border-gray-200 px-3 py-2 leading-relaxed">
                          <span className="font-medium text-black/60">Note —</span> SenseBug only analyses <strong>Bug</strong> issue types. Tasks, stories, epics, and other types are automatically ignored.
                        </p>
                      </div>
                    </li>

                    <li className="flex items-start gap-3">
                      <span className="text-[10px] font-mono text-black/30 mt-0.5 w-4 flex-shrink-0" style={MONO}>4</span>
                      <div>
                        <p className="text-sm font-medium text-black/80 mb-0.5">Test it</p>
                        <p className="text-sm text-black/50 leading-relaxed">
                          Create a test bug in Jira. It should appear in your{' '}
                          <a href="/backlog" className="underline hover:text-black transition-colors">Backlog</a>
                          {' '}within a few seconds with an AI-assigned priority.
                        </p>
                      </div>
                    </li>
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

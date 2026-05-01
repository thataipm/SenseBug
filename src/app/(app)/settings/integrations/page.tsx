'use client'
import { useState, useEffect } from 'react'
import { Integration } from '@/types'
import { Loader2, Copy, CheckCheck, ExternalLink, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'

const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.sensebug.com'

export default function IntegrationsPage() {
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [loading, setLoading]         = useState(true)

  // Form state
  const [siteUrl,    setSiteUrl]    = useState('')
  const [email,      setEmail]      = useState('')
  const [apiToken,   setApiToken]   = useState('')
  const [projectKey, setProjectKey] = useState('')

  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState(false)
  const [copied,     setCopied]     = useState(false)

  useEffect(() => {
    fetch('/api/integrations/jira')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setIntegration(d)
        // Pre-populate non-sensitive fields so the user only needs to re-enter the API token
        if (d) {
          setSiteUrl(d.site_url ?? '')
          setEmail(d.email ?? '')
          setProjectKey(d.project_key ?? '')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

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
    setError(null)
    setSuccess(false)

    const res = await fetch('/api/integrations/jira', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ site_url: siteUrl, email, api_token: apiToken, project_key: projectKey }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to save integration')
      return
    }
    setIntegration(data)
    setSuccess(true)
    setApiToken('') // don't keep the token in state after save
    setTimeout(() => setSuccess(false), 4000)
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
      setProjectKey('')
    }
    setDeleting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-5 h-5 animate-spin text-black/30" />
    </div>
  )

  const isConnected = !!integration

  return (
    <div className="px-6 md:px-10 py-8 max-w-2xl" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <div className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-1" style={MONO}>Integrations</p>
        <h1 className="text-2xl font-black tracking-tight" style={HEADING}>Jira</h1>
        <p className="text-sm text-black/50 mt-1">
          Connect Jira to automatically analyse and prioritise bugs as they&apos;re filed — no CSV upload needed.
        </p>
      </div>

      {/* Connected status banner */}
      {isConnected && (
        <div className="flex items-start gap-3 border border-green-200 bg-green-50 px-4 py-3 mb-8">
          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-green-800">Connected to {integration.site_url}</p>
            <p className="text-xs text-green-700 mt-0.5">{integration.email}</p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={deleting}
            className="ml-auto flex items-center gap-1.5 text-xs text-black/40 hover:text-red-600 transition-colors flex-shrink-0"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Disconnect
          </button>
        </div>
      )}

      {/* Webhook URL — only shown once connected */}
      {isConnected && webhookUrl && (
        <div className="mb-8">
          <p className="text-xs font-medium text-black/70 mb-2">Webhook URL</p>
          <p className="text-xs text-black/50 mb-3">
            Add this URL to a Jira Automation rule triggered on <strong>Issue Created</strong> (and optionally <strong>Issue Updated</strong>).
            Use the <strong>Send web request</strong> action with method POST.
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
          <a
            href="https://support.atlassian.com/jira-software-cloud/docs/create-a-rule-in-jira-automation/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-black/40 hover:text-black mt-2 transition-colors"
          >
            Jira Automation docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Connection form */}
      <form onSubmit={handleSave} className="space-y-5">
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
          <p className="text-xs text-black/35 mt-1">Your Atlassian domain, e.g. https://acme.atlassian.net</p>
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
            placeholder={isConnected ? '••••••••  (leave blank to keep existing)' : 'Your Jira API token'}
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

        <div>
          <label className="block text-xs font-medium text-black/70 mb-1.5">
            Project key <span className="text-black/30 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="BUG"
            value={projectKey}
            onChange={e => setProjectKey(e.target.value.toUpperCase())}
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-black transition-colors"
          />
          <p className="text-xs text-black/35 mt-1">Filters Jira write-back to this project only.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 border border-green-200 bg-green-50 px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">Connection verified and saved.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-black text-white text-sm font-medium px-5 py-2.5 hover:bg-black/80 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Verifying connection…' : isConnected ? 'Update credentials' : 'Connect Jira'}
        </button>
      </form>

      {/* How it works */}
      <div className="mt-12 border-t border-gray-100 pt-8">
        <p className="text-xs font-medium text-black/50 uppercase tracking-widest mb-4" style={MONO}>How it works</p>
        <ol className="space-y-3">
          {[
            'A bug is created (or updated) in Jira.',
            'Your Jira Automation rule fires and POSTs the issue payload to the webhook URL above.',
            'SenseBug analyses and prioritises the bug with AI, then adds it to your Backlog.',
            'P1 bugs trigger an immediate email alert.',
            'When you approve a bug, SenseBug writes the AI-assigned priority back to Jira.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="text-[10px] font-mono text-black/30 mt-0.5 w-4 flex-shrink-0" style={MONO}>{i + 1}</span>
              <span className="text-sm text-black/60">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

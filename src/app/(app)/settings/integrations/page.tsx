'use client'
import { useState, useEffect, useCallback } from 'react'
import { IntegrationCard } from '@/components/IntegrationCard'
import { JiraSetupModal } from '@/components/JiraSetupModal'

const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

// ── Letter-tile icons ────────────────────────────────────────────────────────
// Brand-neutral colored square placeholders. When we ship real integrations
// for Linear / GitHub / Slack, swap in their actual SVG logos here.

interface TileProps { letter: string; bg: string }
function LetterTile({ letter, bg }: TileProps) {
  return (
    <div
      className="w-10 h-10 flex items-center justify-center text-white text-base font-black"
      style={{ background: bg, fontFamily: 'var(--font-space-grotesk), sans-serif', letterSpacing: '-0.02em' }}
      aria-hidden="true"
    >
      {letter}
    </div>
  )
}

const JiraIcon   = () => <LetterTile letter="J" bg="#0052CC" />
const LinearIcon = () => <LetterTile letter="L" bg="#5E6AD2" />
const GithubIcon = () => <LetterTile letter="G" bg="#24292E" />
const SlackIcon  = () => <LetterTile letter="S" bg="#4A154B" />

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [jiraConnected, setJiraConnected] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [showJiraModal, setShowJiraModal] = useState(false)

  const refreshJiraStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/jira')
      if (res.ok) {
        const data = await res.json()
        setJiraConnected(!!data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshJiraStatus() }, [refreshJiraStatus])

  return (
    <div className="px-6 md:px-10 py-8 max-w-3xl" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-1" style={MONO}>Settings</p>
        <h1 className="text-2xl font-black tracking-tight" style={HEADING}>Integrations</h1>
        <p className="text-sm text-black/50 mt-1 leading-relaxed">
          Connect SenseBug to where your bugs live. New bugs flow in automatically; existing bugs can be bulk-imported.
        </p>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="border border-gray-100 bg-gray-50 h-[88px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IntegrationCard
            name="Jira"
            description="Webhook + REST API. New bugs auto-analysed on file."
            icon={<JiraIcon />}
            status={jiraConnected ? 'connected' : 'not_connected'}
            onClick={() => setShowJiraModal(true)}
          />
          <IntegrationCard
            name="Linear"
            description="Continuous scoring as bugs are created in Linear."
            icon={<LinearIcon />}
            status="coming_soon"
          />
          <IntegrationCard
            name="GitHub Issues"
            description="For engineering-led teams that triage in GitHub."
            icon={<GithubIcon />}
            status="coming_soon"
          />
          <IntegrationCard
            name="Slack"
            description="Push P1 alerts and the weekly summary to a channel."
            icon={<SlackIcon />}
            status="coming_soon"
          />
        </div>
      )}

      <p className="text-xs text-black/40 mt-6 leading-relaxed">
        Want a tracker we don&apos;t list? Drop us a line —{' '}
        <a href="mailto:contact@sensebug.com" className="underline hover:text-black transition-colors">contact@sensebug.com</a>.
        CSV upload from anywhere is supported today via the <a href="/dashboard" className="underline hover:text-black transition-colors">dashboard</a>.
      </p>

      {/* Modals */}
      <JiraSetupModal
        open={showJiraModal}
        onClose={() => setShowJiraModal(false)}
        onIntegrationChange={refreshJiraStatus}
      />
    </div>
  )
}

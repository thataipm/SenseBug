'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { TriageResult, TriageRun } from '@/types'
import {
  Check, X, Edit2, Download, ChevronLeft, ChevronDown, ChevronRight,
  Flag, Loader2, Copy, CheckCheck, Search,
  LayoutDashboard, Clock, BookOpen, User,
} from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────
const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

const REJECT_REASONS = ['Wrong priority', 'Wrong severity', 'Missing context', 'Duplicate', 'Other'] as const

type BulkFilter = 'all_unreviewed' | 'p1_unreviewed' | 'p2_unreviewed' | 'p3_unreviewed' | 'p4_unreviewed'

const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/historyRun', icon: Clock,           label: 'History'   },
  { href: '/settings',   icon: BookOpen,        label: 'KB'        },
  { href: '/account',    icon: User,            label: 'Account'   },
]

// ── Utility functions ──────────────────────────────────────────────────────

function getConfidence(flags: string[]): { label: 'High' | 'Medium' | 'Low'; color: string } {
  const quality = flags.filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
  if (quality.includes('Missing description') || quality.length >= 2)
    return { label: 'Low',    color: 'text-red-600 bg-red-50 border-red-200' }
  if (quality.length === 1)
    return { label: 'Medium', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' }
  return   { label: 'High',   color: 'text-green-600 bg-green-50 border-green-200' }
}

function getBugRowClass(r: TriageResult, isSelected: boolean): string {
  const base = 'border-b border-gray-100 px-4 py-3 cursor-pointer transition-colors duration-100'
  if (isSelected)                 return `${base} bg-gray-50 border-l-2 border-l-black`
  if (r.pm_action === 'approved') return `${base} hover:bg-gray-50 border-l-2 border-l-green-500`
  if (r.pm_action === 'rejected') return `${base} hover:bg-gray-50 opacity-50`
  return `${base} hover:bg-gray-50`
}

function getActionBadgeClass(action: string): string {
  if (action === 'approved') return 'border-green-200 bg-green-50 text-green-600'
  if (action === 'rejected') return 'border-gray-200 bg-gray-50 text-black/40'
  return 'border-blue-200 bg-blue-50 text-blue-600'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PriorityBadge({ p }: { p: string }) {
  const cls: Record<string, string> = {
    P1: 'bg-red-50 text-red-600 border-red-200',
    P2: 'bg-orange-50 text-orange-600 border-orange-200',
    P3: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    P4: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <span className={`border px-2 py-0.5 text-xs font-mono uppercase ${cls[p] || 'bg-gray-50 text-black/50 border-gray-200'}`} style={MONO}>{p}</span>
  )
}

function SeverityBadge({ s }: { s: string }) {
  const cls: Record<string, string> = {
    Critical: 'bg-red-50 text-red-600 border-red-200',
    High:     'bg-orange-50 text-orange-600 border-orange-200',
    Medium:   'bg-yellow-50 text-yellow-700 border-yellow-200',
    Low:      'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <span className={`border px-2 py-0.5 text-xs font-mono uppercase ${cls[s] || 'bg-gray-50 text-black/50 border-gray-200'}`} style={MONO}>{s}</span>
  )
}

/** Three-dot confidence meter: filled dots = High/Medium/Low */
function ConfidenceDots({ flags }: { flags: string[] }) {
  const { label } = getConfidence(flags)
  const filled    = label === 'High' ? 3 : label === 'Medium' ? 2 : 1
  const dotColor  = label === 'High' ? 'bg-green-500' : label === 'Medium' ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <span className="inline-flex items-center gap-0.5" title={`${label} confidence`}>
      {[0, 1, 2].map(i => (
        <span key={i} className={`w-2 h-2 rounded-full flex-shrink-0 ${i < filled ? dotColor : 'bg-gray-200'}`} />
      ))}
    </span>
  )
}

/** Horizontal track showing where this bug sits in the overall priority order */
function RankTrack({ rank, total }: { rank: number; total: number }) {
  const pct    = total > 1 ? ((rank - 1) / (total - 1)) * 100 : 0
  const topPct = total > 0 ? Math.round((rank / total) * 100) : 100
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <span className="text-xs font-mono text-black/55 tabular-nums flex-shrink-0" style={MONO}>
        <span className="font-semibold">#{rank}</span>
        <span className="text-black/30"> of {total}</span>
      </span>
      <div className="relative flex-1 h-0.5 bg-gray-200 overflow-visible" style={{ minWidth: 48 }}>
        <div
          className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-black border-2 border-white shadow-sm"
          style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <span className="text-xs font-mono text-black/30 flex-shrink-0" style={MONO}>top {topPct}%</span>
    </div>
  )
}

/** Proportional stacked bar showing P1/P2/P3/P4 distribution */
function PriorityBar({ results }: { results: TriageResult[] }) {
  const total = results.length
  if (total === 0) return null
  const c = { P1: 0, P2: 0, P3: 0, P4: 0 }
  results.forEach(r => { const p = r.priority as keyof typeof c; if (p in c) c[p]++ })
  const segs = [
    { key: 'P1', cls: 'bg-red-400',    count: c.P1 },
    { key: 'P2', cls: 'bg-orange-400', count: c.P2 },
    { key: 'P3', cls: 'bg-yellow-400', count: c.P3 },
    { key: 'P4', cls: 'bg-green-400',  count: c.P4 },
  ].filter(s => s.count > 0)
  return (
    <div className="flex h-1.5 w-full gap-px overflow-hidden" style={{ borderRadius: 2 }}>
      {segs.map(s => (
        <div
          key={s.key}
          className={s.cls}
          style={{ width: `${(s.count / total) * 100}%` }}
          title={`${s.key}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
        />
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { run_id }  = useParams() as { run_id: string }
  const searchParams = useSearchParams()
  const note         = searchParams.get('note')
  const totalParam   = searchParams.get('total')
  const analyzedParam = searchParams.get('analyzed')
  const trimmedCount = totalParam && analyzedParam
    ? Number(totalParam) - Number(analyzedParam)
    : 0

  const [run, setRun]           = useState<TriageRun | null>(null)
  const [results, setResults]   = useState<TriageResult[]>([])
  const [selected, setSelected] = useState<TriageResult | null>(null)
  const [loading, setLoading]   = useState(true)
  const [trimmedRows, setTrimmedRows] = useState<Record<string, string>[] | null>(null)

  // Detail-pane state
  const [editMode, setEditMode]         = useState(false)
  const [editPriority, setEditPriority] = useState('')
  const [editSeverity, setEditSeverity] = useState('')
  const [rejectMode, setRejectMode]     = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [showRewrite, setShowRewrite]   = useState(true)

  // List state
  const [bulkLoading, setBulkLoading]             = useState(false)
  const [mobileShowDetail, setMobileShowDetail]   = useState(false)
  const [search, setSearch]                       = useState('')
  const [filterPriority, setFilterPriority]       = useState<string | null>(null)
  const [filterStatus, setFilterStatus]           = useState<string | null>(null)

  const fetchRun = useCallback(async () => {
    const res = await fetch(`/api/triage/runs/${run_id}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setRun(data.run)
    const sorted = [...(data.results || [])].sort((a: { rank: number }, b: { rank: number }) => a.rank - b.rank)
    setResults(sorted)
    if (sorted.length > 0) setSelected(sorted[0])
    setLoading(false)
  }, [run_id])

  useEffect(() => { fetchRun() }, [fetchRun])

  // Load trimmed rows from sessionStorage (stored by processing page after upload)
  useEffect(() => {
    if (!run_id || trimmedCount <= 0) return
    try {
      const stored = sessionStorage.getItem(`trimmed:${run_id}`)
      if (stored) setTrimmedRows(JSON.parse(stored))
    } catch {
      // sessionStorage unavailable or parse error — non-fatal
    }
  }, [run_id, trimmedCount])

  // Reset per-ticket UI when a different bug is selected
  useEffect(() => {
    setCopied(false)
    setRejectMode(false)
    setRejectReason('')
    setEditMode(false)
    setShowOriginal(false)
    setShowRewrite(true)
  }, [selected?.id])

  const handleVerdict = async (action: 'approved' | 'edited' | 'rejected', resultId: string, ep?: string, es?: string, reason?: string) => {
    if (!selected) return
    setActionLoading(true)
    const res = await fetch('/api/triage/verdict', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result_id: resultId, action, edited_priority: ep, edited_severity: es, rejection_reason: reason }),
    })
    if (res.ok) {
      setResults(prev => prev.map(r =>
        r.id === resultId ? { ...r, pm_action: action, edited_priority: ep || null, edited_severity: es || null, rejection_reason: reason || null } : r
      ))
      if (selected.id === resultId) {
        setSelected(prev => prev ? { ...prev, pm_action: action, edited_priority: ep || null, edited_severity: es || null, rejection_reason: reason || null } : prev)
      }
      setEditMode(false)
      setRejectMode(false)
      setRejectReason('')
    }
    setActionLoading(false)
  }

  const handleDownload = () => { window.open(`/api/triage/export/${run_id}`, '_blank') }

  const handleDownloadTrimmed = () => {
    if (!trimmedRows?.length) return
    const headers = Object.keys(trimmedRows[0])
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csvLines = [
      headers.map(escape).join(','),
      ...trimmedRows.map(row => headers.map(h => escape(row[h] ?? '')).join(','))
    ]
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `remaining-bugs-${run_id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      if (search) {
        const q = search.toLowerCase()
        if (!r.title.toLowerCase().includes(q) && !r.bug_id.toLowerCase().includes(q)) return false
      }
      if (filterPriority) {
        const p = r.pm_action === 'edited' && r.edited_priority ? r.edited_priority : r.priority
        if (p !== filterPriority) return false
      }
      if (filterStatus === 'unreviewed' && r.pm_action)               return false
      if (filterStatus === 'approved'   && r.pm_action !== 'approved') return false
      if (filterStatus === 'rejected'   && r.pm_action !== 'rejected') return false
      return true
    })
  }, [results, search, filterPriority, filterStatus])

  const hasFilters  = !!(search || filterPriority || filterStatus)
  const clearFilters = () => { setSearch(''); setFilterPriority(null); setFilterStatus(null) }

  const handleBulkApprove = async (filter: BulkFilter) => {
    const priorityMap: Record<BulkFilter, string | null> = {
      all_unreviewed: null, p1_unreviewed: 'P1', p2_unreviewed: 'P2', p3_unreviewed: 'P3', p4_unreviewed: 'P4',
    }
    const pri     = priorityMap[filter]
    const targets = pri ? results.filter(r => !r.pm_action && r.priority === pri) : results.filter(r => !r.pm_action)
    if (targets.length === 0) return
    if (!window.confirm(`Approve ${targets.length} bug${targets.length === 1 ? '' : 's'}?`)) return
    setBulkLoading(true)
    const res = await fetch('/api/triage/verdict/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id, action: 'approved', filter }),
    })
    if (res.ok) {
      const { ids } = await res.json()
      setResults(prev => prev.map(r =>
        ids.includes(r.id) ? { ...r, pm_action: 'approved' as const, edited_priority: null, edited_severity: null, rejection_reason: null } : r
      ))
      if (selected && ids.includes(selected.id)) {
        setSelected(prev => prev ? { ...prev, pm_action: 'approved' as const } : prev)
      }
    }
    setBulkLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-black/30" />
    </div>
  )

  if (!run) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-black/50">
      Run not found. <Link href="/dashboard" className="ml-2 underline">Back to dashboard</Link>
    </div>
  )

  // ── Health strip data (computed once per render, outside JSX) ──────────
  const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 }
  results.forEach(r => {
    const s = (r.pm_action === 'edited' && r.edited_severity ? r.edited_severity : r.severity) as keyof typeof sevCounts
    if (s in sevCounts) sevCounts[s]++
  })
  const sevTotal   = sevCounts.Critical + sevCounts.High + sevCounts.Medium + sevCounts.Low
  const sevSegs    = [
    { cls: 'bg-red-400',    count: sevCounts.Critical, label: 'Crit' },
    { cls: 'bg-orange-400', count: sevCounts.High,     label: 'High' },
    { cls: 'bg-yellow-400', count: sevCounts.Medium,   label: 'Med'  },
    { cls: 'bg-green-400',  count: sevCounts.Low,      label: 'Low'  },
  ].filter(s => s.count > 0)
  const wellWritten    = results.filter(r => {
    const q = (r.gap_flags ?? []).filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
    return q.length === 0
  }).length
  const missingRepro   = results.filter(r => r.gap_flags?.includes('No reproduction steps')).length
  const overPri        = results.filter(r => r.gap_flags?.includes('Likely over-prioritised')).length
  const possibleDupes  = results.filter(r => r.gap_flags?.includes('Possible duplicate')).length
  const reviewed       = results.filter(r => r.pm_action).length
  const reviewPct      = results.length > 0 ? Math.round((reviewed / results.length) * 100) : 0
  const wellWrittenPct = results.length > 0 ? Math.round((wellWritten / results.length) * 100) : 0

  return (
    <div className="h-screen bg-white flex flex-col" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* ── Top bar ── */}
      <header className="border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        {/* Left: back · logo · run info */}
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/dashboard" className="text-black/40 hover:text-black transition-colors flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <Link href="/dashboard" className="font-black text-lg tracking-tight flex-shrink-0" style={HEADING}>
            SENSEBUG AI
          </Link>
          <span className="text-black/25 flex-shrink-0 hidden sm:block">|</span>
          <div className="min-w-0 hidden sm:block">
            <span className="text-sm font-medium">{run.filename}</span>
            <span className="text-xs text-black/40 ml-3">
              {new Date(run.run_at).toLocaleDateString()} · {results.length} bugs
            </span>
          </div>
        </div>

        {/* Right: nav shortcuts + download */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <nav className="hidden md:flex items-center border-r border-gray-200 pr-3 mr-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-black/40 hover:text-black hover:bg-gray-100 transition-colors duration-100"
                style={MONO}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="hidden xl:inline">{label}</span>
              </Link>
            ))}
          </nav>
          <button
            data-testid="download-csv-button"
            onClick={handleDownload}
            className="flex items-center gap-2 border border-black px-4 py-2 text-sm font-semibold hover:bg-black hover:text-white transition-colors duration-150"
          >
            <Download className="w-4 h-4" strokeWidth={2} />
            Download CSV
          </button>
        </div>
      </header>

      {/* ── Trimmed-file banner (rich variant when counts are available) ── */}
      {trimmedCount > 0 && totalParam && analyzedParam ? (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0 flex-wrap" data-testid="analysis-note-banner">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-amber-700 flex-shrink-0" style={MONO}>Partial</span>
            <span className="text-xs text-amber-800">
              <strong>{Number(analyzedParam).toLocaleString()}</strong> of <strong>{Number(totalParam).toLocaleString()}</strong> bugs analysed —{' '}
              <strong>{trimmedCount.toLocaleString()}</strong> remaining{note && note.toLowerCase().includes('quota') ? ' (monthly quota reached)' : ' (per-run limit)'}
            </span>
          </div>
          {trimmedRows && trimmedRows.length > 0 && (
            <button
              onClick={handleDownloadTrimmed}
              className="flex items-center gap-1.5 text-xs font-mono font-medium text-amber-700 border border-amber-300 bg-white hover:bg-amber-50 px-3 py-1.5 transition-colors duration-100 flex-shrink-0"
              style={MONO}
            >
              <Download className="w-3.5 h-3.5" strokeWidth={2} />
              Download remaining {trimmedCount} bugs
            </button>
          )}
        </div>
      ) : note ? (
        <div className="border-b border-amber-200 bg-amber-50 text-amber-800 text-xs px-6 py-2.5 flex items-center gap-2 flex-shrink-0" data-testid="analysis-note-banner">
          <span className="font-mono font-semibold uppercase tracking-widest" style={MONO}>Note</span>
          <span>{note}</span>
        </div>
      ) : null}

      {/* ── Backlog health strip ── */}
      {results.length > 0 && (
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-2.5 flex items-center justify-between gap-6 flex-shrink-0 flex-wrap" data-testid="health-strip">

          {/* Severity stacked bar + legend */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono uppercase tracking-widest text-black/35 flex-shrink-0" style={MONO}>Severity</span>
            <div className="flex h-2 gap-px overflow-hidden flex-shrink-0" style={{ width: 72, borderRadius: 2 }}>
              {sevSegs.map(s => (
                <div
                  key={s.label}
                  className={s.cls}
                  style={{ width: `${(s.count / sevTotal) * 100}%` }}
                  title={`${s.label}: ${s.count}`}
                />
              ))}
            </div>
            {sevSegs.map(s => (
              <span key={s.label} className="text-xs font-mono text-black/50 flex-shrink-0 tabular-nums" style={MONO}>
                {s.count} <span className="text-black/30">{s.label}</span>
              </span>
            ))}
          </div>

          {/* Backlog health stats */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs font-mono text-green-700 flex-shrink-0 tabular-nums" style={MONO}>{wellWrittenPct}% well-written</span>
            {missingRepro  > 0 && <span className="text-xs font-mono text-orange-600 flex-shrink-0 tabular-nums" style={MONO}>{missingRepro} no repro</span>}
            {overPri       > 0 && <span className="text-xs font-mono text-purple-600 flex-shrink-0 tabular-nums" style={MONO}>{overPri} over-pri</span>}
            {possibleDupes > 0 && <span className="text-xs font-mono text-blue-600 flex-shrink-0 tabular-nums"  style={MONO}>{possibleDupes} dupes</span>}
          </div>

          {/* Review progress */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-mono text-black/35" style={MONO}>Reviewed</span>
            <div className="w-20 h-1.5 bg-gray-200 overflow-hidden" style={{ borderRadius: 1 }}>
              <div className="h-full bg-black transition-all duration-300" style={{ width: `${reviewPct}%` }} />
            </div>
            <span className="text-xs font-mono text-black/50 tabular-nums" style={MONO}>{reviewed}/{results.length}</span>
          </div>
        </div>
      )}

      {/* ── Main layout: bug list + detail ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Panel 1: Bug list ── */}
        <div
          className={`${mobileShowDetail ? 'hidden md:flex md:flex-col' : 'flex flex-col'} w-full md:w-80 xl:w-96 border-r border-gray-200 overflow-y-auto flex-shrink-0`}
          data-testid="bug-list-panel"
        >
          {/* Stats + bulk actions */}
          <div className="border-b border-gray-100 px-4 py-3 space-y-2.5">
            <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>
              {hasFilters ? `${filteredResults.length} of ${results.length} bugs` : `${results.length} bugs ranked`}
            </p>

            {/* Priority distribution bar */}
            <PriorityBar results={results} />

            {/* Stat chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'P1',         count: results.filter(r => r.priority === 'P1').length,                                 color: 'text-red-600 bg-red-50 border-red-200'         },
                { label: 'P2',         count: results.filter(r => r.priority === 'P2').length,                                 color: 'text-orange-600 bg-orange-50 border-orange-200' },
                { label: '⚑ Over-pri', count: results.filter(r => r.gap_flags?.includes('Likely over-prioritised')).length,   color: 'text-purple-600 bg-purple-50 border-purple-200' },
                { label: '⇄ Dupes',    count: results.filter(r => r.gap_flags?.includes('Possible duplicate')).length,        color: 'text-blue-600 bg-blue-50 border-blue-200'       },
                { label: 'Reviewed',   count: results.filter(r => r.pm_action).length,                                         color: 'text-green-700 bg-green-50 border-green-200'   },
              ].filter(s => s.count > 0).map(s => (
                <span key={s.label} className={`text-xs font-mono px-1.5 py-0.5 border ${s.color}`} style={MONO}>
                  {s.count} {s.label}
                </span>
              ))}
            </div>

            {/* Bulk approve */}
            {results.filter(r => !r.pm_action).length > 0 && (
              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                <span className="text-xs font-mono text-black/30 flex-shrink-0" style={MONO}>Bulk approve:</span>
                <button
                  onClick={() => handleBulkApprove('all_unreviewed')}
                  disabled={bulkLoading}
                  className="text-xs font-mono border border-gray-200 px-2 py-0.5 hover:border-black hover:bg-black hover:text-white transition-colors disabled:opacity-30"
                  style={MONO}
                >
                  All ({results.filter(r => !r.pm_action).length})
                </button>
                {(['P1','P2','P3','P4'] as const).map(p => {
                  const count = results.filter(r => !r.pm_action && r.priority === p).length
                  if (count === 0) return null
                  const filter = `${p.toLowerCase()}_unreviewed` as BulkFilter
                  return (
                    <button
                      key={p}
                      onClick={() => handleBulkApprove(filter)}
                      disabled={bulkLoading}
                      className="text-xs font-mono border border-gray-200 px-2 py-0.5 hover:border-black hover:bg-black hover:text-white transition-colors disabled:opacity-30"
                      style={MONO}
                    >
                      {p} ({count})
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Filter + search */}
          <div className="border-b border-gray-100 px-4 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-black/30 flex-shrink-0" strokeWidth={2} />
              <input
                type="text"
                placeholder="Search by ID or title…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 text-xs bg-transparent border-0 focus:outline-none placeholder:text-black/30"
                style={MONO}
              />
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs font-mono text-black/35 hover:text-black transition-colors flex-shrink-0" style={MONO}>
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['P1','P2','P3','P4'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(filterPriority === p ? null : p)}
                  className={`text-xs font-mono px-1.5 py-0.5 border transition-colors ${filterPriority === p ? 'bg-black text-white border-black' : 'border-gray-200 text-black/40 hover:border-black hover:text-black'}`}
                  style={MONO}
                >
                  {p}
                </button>
              ))}
              <span className="w-px h-3 bg-gray-200 mx-0.5 flex-shrink-0" />
              {(['unreviewed','approved','rejected'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                  className={`text-xs font-mono px-1.5 py-0.5 border transition-colors capitalize ${filterStatus === s ? 'bg-black text-white border-black' : 'border-gray-200 text-black/40 hover:border-black hover:text-black'}`}
                  style={MONO}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Bug rows */}
          {filteredResults.length === 0 && results.length > 0 && (
            <div className="px-4 py-10 text-center space-y-2">
              <p className="text-xs font-mono text-black/30" style={MONO}>No bugs match your filters</p>
              <button onClick={clearFilters} className="text-xs font-mono text-black/40 hover:text-black underline transition-colors" style={MONO}>Clear filters</button>
            </div>
          )}
          {filteredResults.map((r, i) => {
            const qualFlags   = (r.gap_flags ?? []).filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
            const flagTooltip = qualFlags.length > 0 ? qualFlags.join(', ') : ''
            return (
              <div
                key={r.id}
                data-testid={`bug-row-${r.id}`}
                onClick={() => { setSelected(r); setEditMode(false); setMobileShowDetail(true) }}
                className={getBugRowClass(r, selected?.id === r.id)}
                style={{ animation: `fade-in 0.3s ease-out ${Math.min(i * 0.03, 0.4)}s both` }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-black/30 w-6 flex-shrink-0 mt-0.5 tabular-nums" style={MONO}>{r.rank}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-black/50 font-medium" style={MONO}>{r.bug_id}</span>
                      <PriorityBadge p={r.pm_action === 'edited' && r.edited_priority ? r.edited_priority : r.priority} />
                      <SeverityBadge s={r.pm_action === 'edited' && r.edited_severity ? r.edited_severity : r.severity} />
                      <ConfidenceDots flags={r.gap_flags ?? []} />
                      {r.gap_flags?.includes('Likely over-prioritised') && <span title="Likely over-prioritised"><Flag className="w-3 h-3 text-purple-500" strokeWidth={2} /></span>}
                      {r.gap_flags?.includes('Possible duplicate')      && <span className="text-blue-500 text-xs font-bold leading-none" title="Possible duplicate">⇄</span>}
                      {qualFlags.length > 0                             && <span title={flagTooltip}><Flag className="w-3 h-3 text-orange-400" strokeWidth={2} /></span>}
                      {r.pm_action === 'approved' && <Check className="w-3 h-3 text-green-500" strokeWidth={2.5} />}
                      {r.pm_action === 'rejected' && <X    className="w-3 h-3 text-black/30"  strokeWidth={2.5} />}
                    </div>
                    <p className={`text-sm leading-tight ${r.pm_action === 'rejected' ? 'line-through text-black/30' : ''}`}>
                      {r.title}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Panel 2: Detail (single column) ── */}
        {selected ? (() => {
          const qualityFlags  = (selected.gap_flags ?? []).filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
          const isWellWritten = qualityFlags.length === 0
          const confidence    = getConfidence(selected.gap_flags ?? [])
          const hasOriginalDesc   = selected.original_description != null
          const isMissingDescFlag = selected.gap_flags?.includes('Missing description')
          const displayPriority   = selected.pm_action === 'edited' && selected.edited_priority ? selected.edited_priority : selected.priority
          const displaySeverity   = selected.pm_action === 'edited' && selected.edited_severity ? selected.edited_severity : selected.severity

          return (
            <div
              className={`${!mobileShowDetail ? 'hidden md:flex md:flex-col' : 'flex flex-col'} flex-1 overflow-hidden`}
              data-testid="rationale-panel"
            >
              <div className="flex-1 overflow-y-auto animate-fade-in" key={selected.id}>

                {/* Mobile back */}
                <button
                  className="md:hidden flex items-center gap-1 text-sm text-black/50 hover:text-black px-4 py-3 border-b border-gray-100 w-full transition-colors"
                  onClick={() => setMobileShowDetail(false)}
                >
                  <ChevronLeft className="w-4 h-4" /> Back to list
                </button>

                {/* ── Header: rank · id · badges · title · rank track ── */}
                <div className="px-6 md:px-8 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-mono text-black/30 border border-gray-200 px-1.5 py-0.5 tabular-nums" style={MONO}>#{selected.rank}</span>
                    <span className="text-xs font-mono text-black/50 font-medium" style={MONO}>{selected.bug_id}</span>
                    <PriorityBadge p={displayPriority} />
                    <SeverityBadge s={displaySeverity} />
                    <span className={`text-xs font-mono px-2 py-0.5 border ${confidence.color}`} style={MONO} title="AI confidence based on ticket quality">
                      {confidence.label} confidence
                    </span>
                    <ConfidenceDots flags={selected.gap_flags ?? []} />
                    {selected.pm_action && (
                      <span className={`text-xs font-mono uppercase px-2 py-0.5 border ${getActionBadgeClass(selected.pm_action)}`} style={MONO}>
                        {selected.pm_action}{selected.pm_action === 'rejected' && selected.rejection_reason ? ` · ${selected.rejection_reason}` : ''}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold tracking-tight leading-snug mb-4" style={HEADING}>
                    {selected.title}
                  </h2>
                  {/* Rank track */}
                  <RankTrack rank={selected.rank} total={results.length} />
                </div>

                {/* ── Analysis body ── */}
                <div className="px-6 md:px-8 py-6 space-y-5">

                  {/* Possible duplicate callout */}
                  {selected.gap_flags?.includes('Possible duplicate') && (
                    <div className="border-l-4 border-blue-400 bg-blue-50 pl-4 pr-4 py-3.5">
                      <p className="text-xs font-mono uppercase tracking-widest text-blue-500 mb-1" style={MONO}>⇄ Possible duplicate</p>
                      <p className="text-sm text-blue-800">This ticket may overlap with another in this run. Check the rationale below for the related ticket key.</p>
                    </div>
                  )}

                  {/* Over-prioritised callout */}
                  {selected.gap_flags?.includes('Likely over-prioritised') && (
                    <div className="border-l-4 border-purple-400 bg-purple-50 pl-4 pr-4 py-3.5">
                      <p className="text-xs font-mono uppercase tracking-widest text-purple-500 mb-1" style={MONO}>⚑ Over-prioritised</p>
                      <p className="text-sm text-purple-900 leading-relaxed">The original priority doesn&apos;t match the actual business impact — worth a closer look before committing resources.</p>
                    </div>
                  )}

                  {/* Business Impact */}
                  <div className="border border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-2" style={MONO}>Business Impact</p>
                    <p className="text-sm text-black/90 leading-relaxed font-medium">{selected.business_impact}</p>
                  </div>

                  {/* SenseBug AI Analysis */}
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-2" style={MONO}>SenseBug AI Analysis</p>
                    <p className="text-sm text-black/65 leading-relaxed">{selected.rationale}</p>
                  </div>

                  {/* Quality flags */}
                  {qualityFlags.length > 0 && (
                    <div className="border border-orange-200 bg-orange-50 px-4 py-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-orange-500 mb-3" style={MONO}>What&apos;s missing</p>
                      <ul className="space-y-2">
                        {qualityFlags.map(f => (
                          <li key={f} className="flex items-center gap-2 text-sm text-orange-800">
                            <Flag className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" strokeWidth={2} />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Well-written badge */}
                  {isWellWritten && (
                    <div className="flex items-start gap-3 border border-green-200 bg-green-50 px-4 py-3.5">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                      <div>
                        <p className="text-sm font-semibold text-green-800 mb-0.5" style={HEADING}>Well written ticket</p>
                        <p className="text-xs text-green-700 leading-relaxed">Clear description, sufficient context, and no missing information — the AI could rank this with full confidence.</p>
                      </div>
                    </div>
                  )}

                  {/* ── Suggested Rewrite (collapsible, expanded by default) ── */}
                  {!isWellWritten && selected.improved_description && (
                    <div className="border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setShowRewrite(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Suggested Rewrite</p>
                        {showRewrite
                          ? <ChevronDown  className="w-3.5 h-3.5 text-black/30" strokeWidth={2} />
                          : <ChevronRight className="w-3.5 h-3.5 text-black/30" strokeWidth={2} />
                        }
                      </button>
                      {showRewrite && (
                        <div>
                          <div className="px-4 pt-3 pb-1 flex justify-end">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(selected.improved_description!)
                                setCopied(true)
                                setTimeout(() => setCopied(false), 2000)
                              }}
                              className="flex items-center gap-1.5 text-xs text-black/40 hover:text-black transition-colors"
                            >
                              {copied
                                ? <><CheckCheck className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Copied!</span></>
                                : <><Copy className="w-3.5 h-3.5" />Copy</>
                              }
                            </button>
                          </div>
                          <p className="px-4 pb-4 text-sm text-black/70 leading-relaxed whitespace-pre-line">{selected.improved_description}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Original Ticket (collapsible, collapsed by default) ── */}
                  <div className="border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setShowOriginal(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Original Ticket</p>
                      <div className="flex items-center gap-2">
                        {selected.reporter_priority && (
                          <span className="text-xs font-mono border border-gray-200 bg-white px-1.5 py-0.5 text-black/40" style={MONO}>
                            Reporter: {selected.reporter_priority}
                          </span>
                        )}
                        {showOriginal
                          ? <ChevronDown  className="w-3.5 h-3.5 text-black/30" strokeWidth={2} />
                          : <ChevronRight className="w-3.5 h-3.5 text-black/30" strokeWidth={2} />
                        }
                      </div>
                    </button>
                    {showOriginal && (
                      <div className="px-4 py-4 border-t border-gray-100">
                        {hasOriginalDesc ? (
                          <p className="text-sm text-black/70 leading-relaxed whitespace-pre-line">{selected.original_description}</p>
                        ) : isMissingDescFlag ? (
                          <p className="text-sm text-black/35 italic">No description was provided in this ticket.</p>
                        ) : (
                          <p className="text-sm text-black/30 italic">Original descriptions are captured from new runs onwards.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Edit mode ── */}
                  {editMode && (
                    <div className="border border-gray-200 p-5 space-y-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Adjust priority &amp; severity</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono text-black/50 mb-1.5" style={MONO}>Priority</label>
                          <select
                            data-testid="edit-priority-select"
                            value={editPriority}
                            onChange={e => setEditPriority(e.target.value)}
                            className="w-full border border-gray-200 focus:border-black focus:outline-none px-3 py-2 text-sm bg-white"
                          >
                            {['P1','P2','P3','P4'].map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-black/50 mb-1.5" style={MONO}>Severity</label>
                          <select
                            data-testid="edit-severity-select"
                            value={editSeverity}
                            onChange={e => setEditSeverity(e.target.value)}
                            className="w-full border border-gray-200 focus:border-black focus:outline-none px-3 py-2 text-sm bg-white"
                          >
                            {['Critical','High','Medium','Low'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          data-testid="save-edit-button"
                          onClick={() => handleVerdict('edited', selected.id, editPriority, editSeverity)}
                          disabled={actionLoading}
                          className="bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/90 transition-colors disabled:opacity-50"
                        >
                          Save changes
                        </button>
                        <button onClick={() => setEditMode(false)} className="border border-gray-200 px-4 py-2.5 text-sm hover:border-black transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Reject reason form ── */}
                  {rejectMode && (
                    <div className="border border-gray-200 p-5 space-y-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Why are you rejecting this verdict?</p>
                      <select
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        className="w-full border border-gray-200 focus:border-black focus:outline-none px-3 py-2.5 text-sm bg-white"
                      >
                        <option value="">Select a reason…</option>
                        {REJECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button
                          data-testid="confirm-reject-button"
                          onClick={() => handleVerdict('rejected', selected.id, undefined, undefined, rejectReason)}
                          disabled={actionLoading || !rejectReason}
                          className="bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/90 transition-colors disabled:opacity-40"
                        >
                          Confirm rejection
                        </button>
                        <button onClick={() => { setRejectMode(false); setRejectReason('') }} className="border border-gray-200 px-4 py-2.5 text-sm hover:border-black transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Action buttons ── */}
                  {!editMode && !rejectMode && (
                    <div data-testid="action-buttons" className="pt-5 border-t border-gray-100">
                      <p className="text-xs text-black/35 mb-4">Your call — approve it, adjust the priority, or dismiss it entirely.</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          data-testid="approve-button"
                          onClick={() => handleVerdict('approved', selected.id)}
                          disabled={actionLoading || selected.pm_action === 'approved'}
                          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                            selected.pm_action === 'approved'
                              ? 'bg-green-600 text-white border border-green-600'
                              : 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-600 hover:text-white hover:border-green-600'
                          }`}
                        >
                          <Check className="w-4 h-4" strokeWidth={2} />Approve
                        </button>
                        <button
                          data-testid="edit-button"
                          onClick={() => { setEditMode(true); setEditPriority(selected.priority); setEditSeverity(selected.severity) }}
                          disabled={actionLoading}
                          className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 hover:text-white hover:border-blue-700 transition-colors disabled:opacity-50"
                        >
                          <Edit2 className="w-4 h-4" strokeWidth={2} />Adjust
                        </button>
                        <button
                          data-testid="reject-button"
                          onClick={() => selected.pm_action === 'rejected' ? null : setRejectMode(true)}
                          disabled={actionLoading || selected.pm_action === 'rejected'}
                          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                            selected.pm_action === 'rejected'
                              ? 'bg-gray-200 text-black/40 border border-gray-200'
                              : 'border border-gray-300 text-black/60 hover:bg-gray-100 hover:border-gray-400'
                          }`}
                        >
                          <X className="w-4 h-4" strokeWidth={2} />Reject
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )
        })() : (
          <div className="hidden md:flex flex-1 items-center justify-center text-sm text-black/35">
            ← Select a bug to see its full analysis
          </div>
        )}

      </div>
    </div>
  )
}

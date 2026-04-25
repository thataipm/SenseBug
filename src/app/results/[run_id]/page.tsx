'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { TriageResult, TriageRun } from '@/types'
import {
  Check, X, Edit2, Download, ChevronLeft, ChevronDown, ChevronRight,
  Flag, Loader2, Copy, CheckCheck, Search, AlertCircle,
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
    <div className="flex h-1 w-full gap-px overflow-hidden" style={{ borderRadius: 1 }}>
      {segs.map(s => (
        <div key={s.key} className={s.cls} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.key}: ${s.count}`} />
      ))}
    </div>
  )
}

// ── Right pane components ──────────────────────────────────────────────────

/** Circular arc gauge — fills based on rank urgency */
function RankGauge({ rank, total }: { rank: number; total: number }) {
  const urgency = total > 1 ? (total - rank) / (total - 1) : 1
  const radius  = 34
  const circ    = 2 * Math.PI * radius
  const offset  = circ * (1 - urgency)
  const color   = urgency > 0.66 ? '#ef4444' : urgency > 0.33 ? '#f97316' : '#22c55e'
  const topPct  = total > 0 ? Math.round((rank / total) * 100) : 100

  return (
    <div className="flex flex-col items-center py-5 px-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-4 self-start" style={MONO}>Rank</p>
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="7" />
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black leading-none" style={HEADING}>#{rank}</span>
          <span className="text-[10px] text-black/35 mt-0.5" style={MONO}>of {total}</span>
        </div>
      </div>
      <p className="text-[10px] font-mono text-black/30 mt-2" style={MONO}>top {topPct}%</p>
    </div>
  )
}

/** Reporter-filed priority vs AI-assigned priority */
function ReporterVsAI({ reporterPriority, aiPriority, pmAction, editedPriority }: {
  reporterPriority?: string | null
  aiPriority: string
  pmAction?: string | null
  editedPriority?: string | null
}) {
  const displayPriority = pmAction === 'edited' && editedPriority ? editedPriority : aiPriority
  const changed = reporterPriority && reporterPriority !== displayPriority

  return (
    <div className="py-4 border-t border-gray-100 px-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-3" style={MONO}>Reporter vs AI</p>
      {reporterPriority ? (
        <>
          <div className="flex items-center justify-center gap-2">
            <div className="flex-1 text-center">
              <p className="text-[10px] text-black/35 mb-2" style={MONO}>Reporter</p>
              <PriorityBadge p={reporterPriority} />
            </div>
            <ChevronRight
              className={`w-3.5 h-3.5 flex-shrink-0 ${changed ? 'text-amber-400' : 'text-black/20'}`}
              strokeWidth={2.5}
            />
            <div className="flex-1 text-center">
              <p className="text-[10px] text-black/35 mb-2" style={MONO}>AI</p>
              <PriorityBadge p={displayPriority} />
            </div>
          </div>
          {changed && (
            <p className="text-[10px] font-mono text-amber-600 text-center mt-2.5" style={MONO}>
              Priority adjusted
            </p>
          )}
        </>
      ) : (
        <div className="text-center">
          <p className="text-[10px] text-black/30 mb-2" style={MONO}>No reporter priority</p>
          <PriorityBadge p={displayPriority} />
        </div>
      )}
    </div>
  )
}

/** Signal quality indicators derived from gap flags */
function SignalMeters({ flags }: { flags: string[] }) {
  const qualityFlags  = flags.filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
  const hasMissingDesc = flags.includes('Missing description')
  const hasNoRepro    = flags.includes('No reproduction steps')
  const isOverPri     = flags.includes('Likely over-prioritised')
  const { label: confLabel } = getConfidence(flags)

  const clarity = hasMissingDesc ? 'Low' : qualityFlags.length > 1 ? 'Medium' : 'High'
  const repro   = hasNoRepro ? 'Missing' : 'Present'

  const signals = [
    {
      label: 'Clarity',
      value: clarity,
      dot: clarity === 'High' ? 'bg-green-500' : clarity === 'Medium' ? 'bg-yellow-400' : 'bg-red-500',
      text: clarity === 'High' ? 'text-green-600' : clarity === 'Medium' ? 'text-yellow-600' : 'text-red-500',
    },
    {
      label: 'Repro steps',
      value: repro,
      dot:  repro === 'Present' ? 'bg-green-500' : 'bg-red-500',
      text: repro === 'Present' ? 'text-green-600' : 'text-red-500',
    },
    {
      label: 'Confidence',
      value: confLabel,
      dot:  confLabel === 'High' ? 'bg-green-500' : confLabel === 'Medium' ? 'bg-yellow-400' : 'bg-red-500',
      text: confLabel === 'High' ? 'text-green-600' : confLabel === 'Medium' ? 'text-yellow-600' : 'text-red-500',
    },
    {
      label: 'Over-pri risk',
      value: isOverPri ? 'Flagged' : 'Clean',
      dot:  isOverPri ? 'bg-purple-500' : 'bg-green-500',
      text: isOverPri ? 'text-purple-600' : 'text-green-600',
    },
  ]

  return (
    <div className="py-4 border-t border-gray-100 px-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-3" style={MONO}>Signals</p>
      <div className="space-y-2.5">
        {signals.map(s => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-black/60">{s.label}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
              <span className={`text-xs font-mono font-medium ${s.text}`} style={MONO}>{s.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Quality flags as color-coded icon chips */
function FlagChips({ flags }: { flags: string[] }) {
  const FLAG_MAP: Record<string, { color: string; short: string; useFlag?: boolean }> = {
    'Missing description':        { color: 'text-red-600 bg-red-50 border-red-200',          short: 'No description'  },
    'No reproduction steps':      { color: 'text-orange-600 bg-orange-50 border-orange-200', short: 'No repro steps'  },
    'Missing expected behavior':  { color: 'text-orange-600 bg-orange-50 border-orange-200', short: 'No expected'     },
    'Vague description':          { color: 'text-yellow-700 bg-yellow-50 border-yellow-200', short: 'Vague desc'      },
    'Likely over-prioritised':    { color: 'text-purple-600 bg-purple-50 border-purple-200', short: 'Over-pri', useFlag: true },
    'Possible duplicate':         { color: 'text-blue-600 bg-blue-50 border-blue-200',       short: 'Possible dupe'   },
  }

  return (
    <div className="py-4 border-t border-gray-100 px-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-3" style={MONO}>Quality flags</p>
      {flags.length === 0 ? (
        <div className="flex items-center gap-1.5 text-green-600">
          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span className="text-xs font-mono" style={MONO}>Well-written ticket</span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {flags.map(f => {
            const cfg = FLAG_MAP[f]
            if (!cfg) return (
              <span key={f} className="flex items-center gap-1 text-xs border border-gray-200 bg-gray-50 text-black/50 px-2 py-0.5">
                <AlertCircle className="w-3 h-3" strokeWidth={2} />{f}
              </span>
            )
            return (
              <span key={f} title={f} className={`flex items-center gap-1 text-xs border px-2 py-0.5 ${cfg.color}`}>
                {cfg.useFlag
                  ? <Flag className="w-3 h-3" strokeWidth={2} />
                  : <AlertCircle className="w-3 h-3" strokeWidth={2} />
                }
                {cfg.short}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Session progress — always visible at bottom of right pane */
function SessionSnapshot({ results }: { results: TriageResult[] }) {
  const total    = results.length
  const approved = results.filter(r => r.pm_action === 'approved').length
  const rejected = results.filter(r => r.pm_action === 'rejected').length
  const edited   = results.filter(r => r.pm_action === 'edited').length
  const reviewed = approved + rejected + edited
  const pending  = total - reviewed
  const pct      = total > 0 ? Math.round((reviewed / total) * 100) : 0

  return (
    <div className="py-4 border-t border-gray-100 px-4 mt-auto">
      <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-3" style={MONO}>Session</p>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-black/60">Reviewed</span>
            <span className="text-xs font-mono font-semibold tabular-nums" style={MONO}>{reviewed}/{total}</span>
          </div>
          <div className="w-full h-1 bg-gray-100 overflow-hidden">
            <div className="h-full bg-black transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 pt-0.5 text-center">
          <div>
            <p className="text-base font-black text-green-600" style={HEADING}>{approved}</p>
            <p className="text-[10px] font-mono text-black/30 mt-0.5" style={MONO}>Approved</p>
          </div>
          <div>
            <p className="text-base font-black text-black/65" style={HEADING}>{pending}</p>
            <p className="text-[10px] font-mono text-black/30 mt-0.5" style={MONO}>Pending</p>
          </div>
          <div>
            <p className="text-base font-black text-black/30" style={HEADING}>{rejected}</p>
            <p className="text-[10px] font-mono text-black/30 mt-0.5" style={MONO}>Rejected</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Bulk-approve dropdown — replaces the old inline button row */
function BulkApproveMenu({ results, bulkLoading, onBulkApprove }: {
  results: TriageResult[]
  bulkLoading: boolean
  onBulkApprove: (filter: BulkFilter) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unreviewed = results.filter(r => !r.pm_action)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (unreviewed.length === 0) return null

  const options: { label: string; filter: BulkFilter }[] = [
    { label: `All (${unreviewed.length})`, filter: 'all_unreviewed' },
    ...(['P1', 'P2', 'P3', 'P4'] as const).flatMap(p => {
      const count = unreviewed.filter(r => r.priority === p).length
      return count > 0 ? [{ label: `${p} (${count})`, filter: `${p.toLowerCase()}_unreviewed` as BulkFilter }] : []
    }),
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={bulkLoading}
        className="flex items-center gap-1 text-xs font-mono border border-gray-200 px-2 py-1 hover:border-black transition-colors disabled:opacity-30"
        style={MONO}
      >
        Bulk approve <ChevronDown className="w-3 h-3" strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 shadow-sm z-20 min-w-[130px]">
          {options.map(o => (
            <button
              key={o.filter}
              onClick={() => { onBulkApprove(o.filter); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
              style={MONO}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { run_id }    = useParams() as { run_id: string }
  const searchParams  = useSearchParams()
  const note          = searchParams.get('note')
  const totalParam    = searchParams.get('total')
  const analyzedParam = searchParams.get('analyzed')
  const trimmedCount  = totalParam && analyzedParam ? Number(totalParam) - Number(analyzedParam) : 0

  const [run, setRun]           = useState<TriageRun | null>(null)
  const [results, setResults]   = useState<TriageResult[]>([])
  const [selected, setSelected] = useState<TriageResult | null>(null)
  const [loading, setLoading]   = useState(true)
  const [trimmedRows, setTrimmedRows] = useState<Record<string, string>[] | null>(null)

  // Detail-pane state
  const [editMode, setEditMode]           = useState(false)
  const [editPriority, setEditPriority]   = useState('')
  const [editSeverity, setEditSeverity]   = useState('')
  const [rejectMode, setRejectMode]       = useState(false)
  const [rejectReason, setRejectReason]   = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [copied, setCopied]               = useState(false)
  const [showOriginal, setShowOriginal]   = useState(true)
  const [showComments, setShowComments]   = useState(true)
  const [showRewrite, setShowRewrite]     = useState(true)

  // List state
  const [bulkLoading, setBulkLoading]           = useState(false)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [search, setSearch]                     = useState('')
  const [filterPriority, setFilterPriority]     = useState<string | null>(null)
  const [filterStatus, setFilterStatus]         = useState<string | null>(null)

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

  useEffect(() => {
    if (!run_id || trimmedCount <= 0) return
    try {
      const stored = sessionStorage.getItem(`trimmed:${run_id}`)
      if (stored) setTrimmedRows(JSON.parse(stored))
    } catch {
      // sessionStorage unavailable — non-fatal
    }
  }, [run_id, trimmedCount])

  // Reset per-ticket UI when a different bug is selected
  useEffect(() => {
    setCopied(false)
    setRejectMode(false)
    setRejectReason('')
    setEditMode(false)
    setShowOriginal(true)
    setShowComments(true)
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
    const escape  = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csvLines = [
      headers.map(escape).join(','),
      ...trimmedRows.map(row => headers.map(h => escape(row[h] ?? '')).join(','))
    ]
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
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
      if (filterStatus === 'unreviewed' && r.pm_action)                return false
      if (filterStatus === 'approved'   && r.pm_action !== 'approved') return false
      if (filterStatus === 'rejected'   && r.pm_action !== 'rejected') return false
      return true
    })
  }, [results, search, filterPriority, filterStatus])

  const hasFilters   = !!(search || filterPriority || filterStatus)
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

  // ── Health strip data ──────────────────────────────────────────────────────
  const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 }
  results.forEach(r => {
    const s = (r.pm_action === 'edited' && r.edited_severity ? r.edited_severity : r.severity) as keyof typeof sevCounts
    if (s in sevCounts) sevCounts[s]++
  })
  const sevTotal  = sevCounts.Critical + sevCounts.High + sevCounts.Medium + sevCounts.Low
  const sevSegs   = [
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

      {/* ── Trimmed-file banner ── */}
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
              className="flex items-center gap-1.5 text-xs font-mono font-medium text-amber-700 border border-amber-300 bg-white hover:bg-amber-50 px-3 py-1.5 transition-colors flex-shrink-0"
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
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono uppercase tracking-widest text-black/35 flex-shrink-0" style={MONO}>Severity</span>
            <div className="flex h-2 gap-px overflow-hidden flex-shrink-0" style={{ width: 72, borderRadius: 2 }}>
              {sevSegs.map(s => (
                <div key={s.label} className={s.cls} style={{ width: `${(s.count / sevTotal) * 100}%` }} title={`${s.label}: ${s.count}`} />
              ))}
            </div>
            {sevSegs.map(s => (
              <span key={s.label} className="text-xs font-mono text-black/65 flex-shrink-0 tabular-nums" style={MONO}>
                {s.count} <span className="text-black/45">{s.label}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs font-mono text-green-700 flex-shrink-0 tabular-nums" style={MONO}>{wellWrittenPct}% well-written</span>
            {missingRepro  > 0 && <span className="text-xs font-mono text-orange-600 flex-shrink-0 tabular-nums" style={MONO}>{missingRepro} no repro</span>}
            {overPri       > 0 && <span className="text-xs font-mono text-purple-600 flex-shrink-0 tabular-nums" style={MONO}>{overPri} over-pri</span>}
            {possibleDupes > 0 && <span className="text-xs font-mono text-blue-600 flex-shrink-0 tabular-nums"  style={MONO}>{possibleDupes} dupes</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-mono text-black/35" style={MONO}>Reviewed</span>
            <div className="w-20 h-1.5 bg-gray-200 overflow-hidden" style={{ borderRadius: 1 }}>
              <div className="h-full bg-black transition-all duration-300" style={{ width: `${reviewPct}%` }} />
            </div>
            <span className="text-xs font-mono text-black/65 tabular-nums" style={MONO}>{reviewed}/{results.length}</span>
          </div>
        </div>
      )}

      {/* ── Main layout: list · detail · metrics ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Panel 1: Bug list ── */}
        <div
          className={`${mobileShowDetail ? 'hidden md:flex md:flex-col' : 'flex flex-col'} w-full md:w-72 xl:w-80 border-r border-gray-200 flex-shrink-0 overflow-hidden`}
          data-testid="bug-list-panel"
        >
          {/* List header: count + priority bar + bulk dropdown */}
          <div className="border-b border-gray-100 px-4 py-3 space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>
                {hasFilters ? `${filteredResults.length} of ${results.length} bugs` : `${results.length} bugs`}
              </p>
              <BulkApproveMenu results={results} bulkLoading={bulkLoading} onBulkApprove={handleBulkApprove} />
            </div>
            <PriorityBar results={results} />
          </div>

          {/* Filter + search */}
          <div className="border-b border-gray-100 px-4 py-2.5 space-y-2 flex-shrink-0">
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

          {/* Bug rows — scrollable */}
          <div className="overflow-y-auto flex-1">
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
                        <span className="text-xs font-mono text-black/65 font-medium" style={MONO}>{r.bug_id}</span>
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
        </div>

        {/* ── Panel 2: Detail ── */}
        {selected ? (() => {
          const qualityFlags      = (selected.gap_flags ?? []).filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
          const isWellWritten     = qualityFlags.length === 0
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

                {/* Header: bug ID · badges · title */}
                <div className="px-6 md:px-8 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-mono text-black/30 border border-gray-200 px-1.5 py-0.5 tabular-nums" style={MONO}>#{selected.rank}</span>
                    <span className="text-xs font-mono text-black/65 font-medium" style={MONO}>{selected.bug_id}</span>
                    <PriorityBadge p={displayPriority} />
                    <SeverityBadge s={displaySeverity} />
                    {selected.pm_action && (
                      <span className={`text-xs font-mono uppercase px-2 py-0.5 border ${getActionBadgeClass(selected.pm_action)}`} style={MONO}>
                        {selected.pm_action}{selected.pm_action === 'rejected' && selected.rejection_reason ? ` · ${selected.rejection_reason}` : ''}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold tracking-tight leading-snug" style={HEADING}>
                    {selected.title}
                  </h2>
                </div>

                {/* Analysis body */}
                <div className="px-6 md:px-8 py-6 space-y-5">

                  {/* Over-prioritised callout */}
                  {selected.gap_flags?.includes('Likely over-prioritised') && (
                    <div className="border-l-4 border-purple-400 bg-purple-50 pl-4 pr-4 py-3.5">
                      <p className="text-xs font-mono uppercase tracking-widest text-purple-500 mb-1" style={MONO}>⚑ Over-prioritised</p>
                      <p className="text-sm text-purple-900 leading-relaxed">The original priority doesn&apos;t match the actual business impact — worth a closer look before committing resources.</p>
                    </div>
                  )}

                  {/* Possible duplicate callout */}
                  {selected.gap_flags?.includes('Possible duplicate') && (
                    <div className="border-l-4 border-blue-400 bg-blue-50 pl-4 pr-4 py-3.5">
                      <p className="text-xs font-mono uppercase tracking-widest text-blue-500 mb-1" style={MONO}>⇄ Possible duplicate</p>
                      <p className="text-sm text-blue-800">This ticket may overlap with another in this run. Check the rationale below for the related ticket key.</p>
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
                    <p className="text-sm text-black/80 leading-relaxed">{selected.rationale}</p>
                  </div>

                  {/* Suggested Rewrite (only for tickets with quality issues) */}
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
                          <p className="px-4 pb-4 text-sm text-black/80 leading-relaxed whitespace-pre-line">{selected.improved_description}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Original Ticket — description */}
                  <div className="border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setShowOriginal(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Original Description</p>
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
                      <div className="px-4 py-4 border-t border-gray-100 max-h-64 overflow-y-auto">
                        {hasOriginalDesc ? (
                          <p className="text-sm text-black/80 leading-relaxed whitespace-pre-line">{selected.original_description}</p>
                        ) : isMissingDescFlag ? (
                          <p className="text-sm text-black/35 italic">No description was provided in this ticket.</p>
                        ) : (
                          <p className="text-sm text-black/30 italic">Original descriptions are captured from new runs onwards.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Original Ticket — comments */}
                  {selected.original_comments && (
                    <div className="border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setShowComments(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Comments</p>
                        {showComments
                          ? <ChevronDown  className="w-3.5 h-3.5 text-black/30" strokeWidth={2} />
                          : <ChevronRight className="w-3.5 h-3.5 text-black/30" strokeWidth={2} />
                        }
                      </button>
                      {showComments && (
                        <div className="px-4 py-4 border-t border-gray-100 max-h-56 overflow-y-auto">
                          <p className="text-sm text-black/80 leading-relaxed whitespace-pre-line">{selected.original_comments}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Edit mode */}
                  {editMode && (
                    <div className="border border-gray-200 p-5 space-y-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Adjust priority &amp; severity</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-mono text-black/65 mb-1.5" style={MONO}>Priority</label>
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
                          <label className="block text-xs font-mono text-black/65 mb-1.5" style={MONO}>Severity</label>
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

                  {/* Reject reason form */}
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

                  {/* Action buttons */}
                  {!editMode && !rejectMode && (
                    <div data-testid="action-buttons" className="pt-5 border-t border-gray-100">
                      <p className="text-xs text-black/55 mb-4">Your call — approve it, adjust the priority, or dismiss it entirely.</p>
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

        {/* ── Panel 3: Visual metrics (right) — lg+ only ── */}
        <div className="hidden lg:flex flex-col w-56 xl:w-64 border-l border-gray-200 flex-shrink-0 overflow-y-auto">
          {selected ? (
            <>
              <RankGauge rank={selected.rank} total={results.length} />
              <ReporterVsAI
                reporterPriority={selected.reporter_priority}
                aiPriority={selected.priority}
                pmAction={selected.pm_action}
                editedPriority={selected.edited_priority}
              />
              <SignalMeters flags={selected.gap_flags ?? []} />
              <FlagChips flags={selected.gap_flags ?? []} />
              <div className="flex-1" />
              <SessionSnapshot results={results} />
            </>
          ) : (
            <>
              <div className="flex-1" />
              <SessionSnapshot results={results} />
            </>
          )}
        </div>

      </div>
    </div>
  )
}

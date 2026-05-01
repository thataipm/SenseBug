'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { BacklogEntry } from '@/types'
import { stripJiraMarkup } from '@/lib/jira'
import { createClient } from '@/lib/supabase/client'
import {
  Check, X, Edit2, ChevronLeft, ChevronDown, ChevronRight,
  Flag, Loader2, Copy, CheckCheck, Search, AlertCircle, Inbox, Zap, Download, AlertTriangle, Trash2,
} from 'lucide-react'

const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

const REJECT_REASONS = ['Wrong priority', 'Wrong severity', 'Missing context', 'Duplicate', 'Other'] as const

// ── Shared badge components ────────────────────────────────────────────────────

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
  const quality = flags.filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
  const filled  = quality.includes('Missing description') || quality.length >= 2 ? 1 : quality.length === 1 ? 2 : 3
  const color   = filled === 3 ? 'bg-green-500' : filled === 2 ? 'bg-yellow-400' : 'bg-red-500'
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0,1,2].map(i => <span key={i} className={`w-2 h-2 rounded-full ${i < filled ? color : 'bg-gray-200'}`} />)}
    </span>
  )
}

function getActionBadgeClass(action: string): string {
  if (action === 'approved') return 'border-green-200 bg-green-50 text-green-600'
  if (action === 'rejected') return 'border-gray-200 bg-gray-50 text-black/40'
  return 'border-blue-200 bg-blue-50 text-blue-600'
}

function getBugRowClass(e: BacklogEntry, selected: boolean): string {
  const base = 'border-b border-gray-100 px-4 py-3 cursor-pointer transition-colors duration-100'
  if (selected)                  return `${base} bg-gray-50 border-l-2 border-l-black`
  if (e.pm_action === 'approved') return `${base} hover:bg-gray-50 border-l-2 border-l-green-500`
  if (e.pm_action === 'rejected') return `${base} hover:bg-gray-50 opacity-50`
  return `${base} hover:bg-gray-50`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Backlog stats sidebar ──────────────────────────────────────────────────────

function BacklogStats({ entries }: { entries: BacklogEntry[] }) {
  const total      = entries.length
  const approved   = entries.filter(e => e.pm_action === 'approved').length
  const rejected   = entries.filter(e => e.pm_action === 'rejected').length
  const edited     = entries.filter(e => e.pm_action === 'edited').length
  const unreviewed = total - approved - rejected - edited
  const p1         = entries.filter(e => e.priority === 'P1').length
  const p2         = entries.filter(e => e.priority === 'P2').length

  return (
    <div className="hidden lg:flex flex-col w-56 xl:w-64 border-l border-gray-200 flex-shrink-0 overflow-y-auto">
      <div className="py-5 px-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-4" style={MONO}>Backlog</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-black/60">Total bugs</span>
            <span className="text-sm font-black tabular-nums" style={HEADING}>{total}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-black/60">Unreviewed</span>
            <span className={`text-sm font-black tabular-nums ${unreviewed > 0 ? 'text-black' : 'text-black/30'}`} style={HEADING}>{unreviewed}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-black/60">P1 bugs</span>
            <span className={`text-sm font-black tabular-nums ${p1 > 0 ? 'text-red-600' : 'text-black/30'}`} style={HEADING}>{p1}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-black/60">P2 bugs</span>
            <span className={`text-sm font-black tabular-nums ${p2 > 0 ? 'text-orange-600' : 'text-black/30'}`} style={HEADING}>{p2}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 py-4 px-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-3" style={MONO}>Review progress</p>
        <div className="space-y-2.5">
          {[
            { label: 'Approved', count: approved, color: 'text-green-600' },
            { label: 'Adjusted', count: edited,   color: 'text-blue-600'  },
            { label: 'Rejected', count: rejected,  color: 'text-black/30'  },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-black/60">{s.label}</span>
              <span className={`text-sm font-black tabular-nums ${s.color}`} style={HEADING}>{s.count}</span>
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="mt-3">
            <div className="w-full h-1 bg-gray-100 overflow-hidden">
              <div className="h-full bg-black transition-all duration-300" style={{ width: `${Math.round(((total - unreviewed) / total) * 100)}%` }} />
            </div>
            <p className="text-[10px] font-mono text-black/30 mt-1 text-right" style={MONO}>{Math.round(((total - unreviewed) / total) * 100)}% reviewed</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 py-4 px-4 mt-auto">
        <Link href="/insights" className="text-xs font-mono text-black/40 hover:text-black transition-colors" style={MONO}>
          View insights →
        </Link>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function BacklogPage() {
  const [entries, setEntries]   = useState<BacklogEntry[]>([])
  const [selected, setSelected] = useState<BacklogEntry | null>(null)
  const [loading, setLoading]   = useState(true)
  const [newBugToast, setNewBugToast] = useState<BacklogEntry | null>(null)
  const [hasRuns, setHasRuns] = useState(false)

  // Detail loading — same pattern as results page
  const [detailLoading, setDetailLoading] = useState<Set<string>>(new Set())
  const detailRequestedRef = useRef<Set<string>>(new Set())

  // Detail pane state
  const [editMode, setEditMode]           = useState(false)
  const [editPriority, setEditPriority]   = useState('')
  const [editSeverity, setEditSeverity]   = useState('')
  const [rejectMode, setRejectMode]       = useState(false)
  const [rejectReason, setRejectReason]   = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [copied, setCopied]               = useState(false)
  const [showOriginal, setShowOriginal]   = useState(true)
  const [showComments, setShowComments]   = useState(true)
  const [showRewrite, setShowRewrite]     = useState(true)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)

  // List state
  const [search, setSearch]               = useState('')
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [filterStatus, setFilterStatus]   = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    const res = await fetch('/api/backlog')
    if (!res.ok) { setLoading(false); return }
    const data: BacklogEntry[] = await res.json()
    setEntries(data)
    if (data.length === 0) {
      // For the smarter empty state, check if there are any triage runs at all
      fetch('/api/triage/runs')
        .then(r => r.ok ? r.json() : [])
        .then((runs: unknown[]) => setHasRuns(runs.length > 0))
    }
    if (data.length > 0 && !selected) setSelected(data[0])
    setLoading(false)
  }, [selected])

  const handleExportBacklog = () => {
    if (entries.length === 0) return
    const headers = ['Bug ID', 'Title', 'Priority', 'Severity', 'Status', 'Rejection Reason', 'First Seen', 'Last Seen']
    const rows = entries.map(e => [
      e.bug_id,
      e.title,
      e.pm_action === 'edited' && e.edited_priority ? e.edited_priority : (e.priority ?? ''),
      e.pm_action === 'edited' && e.edited_severity ? e.edited_severity : (e.severity ?? ''),
      e.pm_action ?? 'unreviewed',
      e.rejection_reason ?? '',
      new Date(e.first_seen_at).toLocaleDateString(),
      new Date(e.last_seen_at).toLocaleDateString(),
    ])
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(v => escape(String(v))).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `sensebug-backlog-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => { fetchEntries() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase Realtime — prepend bugs arriving via Jira webhook ─────────────
  useEffect(() => {
    const supabase = createClient()
    // Keep a ref to the channel so the cleanup function (which runs synchronously
    // on unmount) can remove it even though the channel is created asynchronously.
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id
      if (!userId) return

      channel = supabase
        .channel('backlog-inserts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'backlog', filter: `user_id=eq.${userId}` },
          (payload) => {
            const newEntry = payload.new as BacklogEntry
            setEntries(prev => {
              // Deduplicate — the initial fetch may have already included this row
              if (prev.some(e => e.id === newEntry.id)) return prev
              // Insert at the position matching its priority (keep list sorted)
              const PRIO: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 }
              const np = PRIO[newEntry.priority ?? ''] ?? 9
              const idx = prev.findIndex(e => (PRIO[e.priority ?? ''] ?? 9) > np)
              const next = [...prev]
              next.splice(idx === -1 ? next.length : idx, 0, newEntry)
              return next
            })
            setNewBugToast(newEntry)
          }
        )
        .subscribe()
    })

    // Cleanup runs on unmount — if the channel was created before unmount, remove it.
    // If the component unmounts before getUser() resolves, channel is still null — safe.
    return () => { if (channel) supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!newBugToast) return
    const t = setTimeout(() => setNewBugToast(null), 6000)
    return () => clearTimeout(t)
  }, [newBugToast])

  // ── Lazy detail fetching — identical to results page logic ─────────────────
  const fetchDetail = useCallback(async (entry: BacklogEntry) => {
    const key = entry.bug_id
    if (detailRequestedRef.current.has(key)) return
    detailRequestedRef.current.add(key)
    setDetailLoading(prev => { const n = new Set(prev); n.add(key); return n })
    try {
      // Webhook bugs have no source_run_id — use the backlog-specific detail
      // endpoint which reads directly from the backlog table.
      const endpoint = entry.source_run_id
        ? `/api/triage/detail/${encodeURIComponent(key)}`
        : `/api/backlog/detail/${encodeURIComponent(key)}`
      const body = entry.source_run_id
        ? JSON.stringify({ run_id: entry.source_run_id })
        : '{}'
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) { detailRequestedRef.current.delete(key); return }
      const detail = await res.json()
      const patch = {
        business_impact:      detail.business_impact,
        rationale:            detail.rationale,
        improved_description: detail.improved_description,
        detail_generated_at:  new Date().toISOString(),
      }
      setEntries(prev => prev.map(e => e.bug_id === key ? { ...e, ...patch } : e))
      setSelected(prev => prev && prev.bug_id === key ? { ...prev, ...patch } : prev)
    } catch {
      detailRequestedRef.current.delete(key)
    } finally {
      setDetailLoading(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }, [])

  useEffect(() => {
    if (!selected || selected.business_impact != null) return
    fetchDetail(selected)
  }, [selected, fetchDetail])

  // Prefetch detail for top 5 unreviewed P1s on load
  useEffect(() => {
    if (entries.length === 0) return
    entries
      .filter(e => e.priority === 'P1' && e.business_impact == null)
      .slice(0, 5)
      .forEach(e => fetchDetail(e))
  }, [entries.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset per-bug UI when selection changes
  useEffect(() => {
    setCopied(false); setRejectMode(false); setRejectReason('')
    setEditMode(false); setShowOriginal(true); setShowComments(true); setShowRewrite(true)
  }, [selected?.id])

  const handleVerdict = async (
    action: 'approved' | 'edited' | 'rejected',
    entryId: string,
    ep?: string, es?: string, reason?: string
  ) => {
    if (!selected) return
    setActionLoading(true)
    const res = await fetch('/api/backlog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entryId, action, edited_priority: ep, edited_severity: es, rejection_reason: reason }),
    })
    if (res.ok) {
      const patch = { pm_action: action, edited_priority: ep || null, edited_severity: es || null, rejection_reason: reason || null }
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, ...patch } : e))
      if (selected.id === entryId) setSelected(prev => prev ? { ...prev, ...patch } : prev)
      setEditMode(false); setRejectMode(false); setRejectReason('')
    }
    setActionLoading(false)
  }

  const handleDelete = async (entryId: string) => {
    if (!window.confirm('Remove this bug from your backlog? This cannot be undone.')) return
    setDeleteLoading(true)
    const res = await fetch(`/api/backlog?id=${encodeURIComponent(entryId)}`, { method: 'DELETE' })
    if (res.ok) {
      const next = entries.find(e => e.id !== entryId) ?? null
      setEntries(prev => prev.filter(e => e.id !== entryId))
      setSelected(next)
      if (next) setMobileShowDetail(true)
      else setMobileShowDetail(false)
    }
    setDeleteLoading(false)
  }

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (search) {
        const q = search.toLowerCase()
        if (!e.title.toLowerCase().includes(q) && !e.bug_id.toLowerCase().includes(q)) return false
      }
      if (filterPriority) {
        const p = e.pm_action === 'edited' && e.edited_priority ? e.edited_priority : (e.priority ?? '')
        if (p !== filterPriority) return false
      }
      if (filterStatus === 'unreviewed' && e.pm_action)                return false
      if (filterStatus === 'approved'   && e.pm_action !== 'approved') return false
      if (filterStatus === 'rejected'   && e.pm_action !== 'rejected') return false
      return true
    })
  }, [entries, search, filterPriority, filterStatus])

  const unreviewedCount  = useMemo(() => entries.filter(e => !e.pm_action).length, [entries])
  const unreviewedP1s    = useMemo(() => entries.filter(e => e.priority === 'P1' && !e.pm_action).length, [entries])
  const hasFilters   = !!(search || filterPriority || filterStatus)
  const clearFilters = () => { setSearch(''); setFilterPriority(null); setFilterStatus(null) }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-black/30" />
    </div>
  )

  if (entries.length === 0) return (
    <div className="px-6 md:px-10 py-10 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <h1 className="text-2xl font-black tracking-tighter mb-2" style={HEADING}>Backlog</h1>
      <p className="text-sm text-black/50 mb-10">Your persistent bug inbox — deduplicates bugs across all CSV runs.</p>
      <div className="border border-dashed border-gray-300 px-8 py-20 text-center">
        <Inbox className="w-8 h-8 text-black/20 mx-auto mb-3" strokeWidth={1.5} />
        {hasRuns ? (
          <>
            <p className="text-sm text-black/50 mb-1">No bugs approved yet.</p>
            <p className="text-xs text-black/35 mb-6">You&apos;ve run analyses but haven&apos;t approved any bugs yet. Head to your most recent run to review them.</p>
            <Link href="/historyRun" className="bg-black text-white px-5 py-2.5 text-sm font-semibold inline-block hover:bg-black/90 transition-colors">
              View recent runs →
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-black/50 mb-1">No bugs in your backlog yet.</p>
            <p className="text-xs text-black/35 mb-6">Upload a CSV from the dashboard to populate it.</p>
            <Link href="/dashboard" className="bg-black text-white px-5 py-2.5 text-sm font-semibold inline-block hover:bg-black/90 transition-colors">
              Go to dashboard →
            </Link>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="h-screen bg-white flex flex-col" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* ── Realtime new-bug toast ── */}
      {newBugToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 bg-black text-white px-4 py-3 shadow-lg max-w-sm animate-in slide-in-from-bottom-4 duration-300">
          <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono uppercase tracking-widest text-white/50 mb-0.5" style={MONO}>New bug — {newBugToast.priority}</p>
            <p className="text-sm font-medium truncate">{newBugToast.title}</p>
          </div>
          <button onClick={() => setNewBugToast(null)} className="text-white/40 hover:text-white flex-shrink-0 ml-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-black/40 hover:text-black transition-colors flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-black text-lg tracking-tight flex-shrink-0" style={HEADING}>Backlog</h1>
          {unreviewedCount > 0 && (
            <span className="text-xs font-mono bg-black text-white px-2 py-0.5 flex-shrink-0" style={MONO}>
              {unreviewedCount} unreviewed
            </span>
          )}
        </div>
        <button
          onClick={handleExportBacklog}
          className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-black/40 hover:text-black border border-gray-200 hover:border-black px-3 py-1.5 transition-colors flex-shrink-0"
          style={MONO}
          title="Export backlog as CSV"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
          Export CSV
        </button>
      </header>

      {/* ── P1 urgency banner ── */}
      {unreviewedP1s > 0 && (
        <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-6 py-2.5 flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={2} />
          <p className="text-sm text-red-700 flex-1 min-w-0">
            <span className="font-semibold">{unreviewedP1s} unreviewed P1{unreviewedP1s > 1 ? 's' : ''}</span> — these need your attention first.
          </p>
          <button
            onClick={() => { setFilterPriority('P1'); setFilterStatus('unreviewed') }}
            className="text-xs font-mono text-red-600 hover:text-red-800 border border-red-300 hover:border-red-500 px-2.5 py-1 transition-colors flex-shrink-0"
            style={MONO}
          >
            Show P1s only →
          </button>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Panel 1: Bug list ── */}
        <div className={`${mobileShowDetail ? 'hidden md:flex md:flex-col' : 'flex flex-col'} w-full md:w-72 xl:w-80 border-r border-gray-200 flex-shrink-0 overflow-hidden`}>

          {/* List header */}
          <div className="border-b border-gray-100 px-4 py-3 flex-shrink-0">
            <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>
              {hasFilters ? `${filteredEntries.length} of ${entries.length} bugs` : `${entries.length} bugs`}
            </p>
          </div>

          {/* Filters */}
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
                <button onClick={clearFilters} className="text-xs font-mono text-black/35 hover:text-black transition-colors flex-shrink-0" style={MONO}>Clear</button>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['P1','P2','P3','P4'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(filterPriority === p ? null : p)}
                  className={`text-xs font-mono px-1.5 py-0.5 border transition-colors ${filterPriority === p ? 'bg-black text-white border-black' : 'border-gray-200 text-black/40 hover:border-black hover:text-black'}`}
                  style={MONO}
                >{p}</button>
              ))}
              <span className="w-px h-3 bg-gray-200 mx-0.5 flex-shrink-0" />
              {(['unreviewed','approved','rejected'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                  className={`text-xs font-mono px-1.5 py-0.5 border transition-colors capitalize ${filterStatus === s ? 'bg-black text-white border-black' : 'border-gray-200 text-black/40 hover:border-black hover:text-black'}`}
                  style={MONO}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Bug rows */}
          <div className="overflow-y-auto flex-1">
            {filteredEntries.length === 0 && (
              <div className="px-4 py-10 text-center space-y-2">
                <p className="text-xs font-mono text-black/30" style={MONO}>No bugs match your filters</p>
                <button onClick={clearFilters} className="text-xs font-mono text-black/40 hover:text-black underline transition-colors" style={MONO}>Clear filters</button>
              </div>
            )}
            {filteredEntries.map(e => {
              const qualFlags = (e.gap_flags ?? []).filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
              const displayP  = e.pm_action === 'edited' && e.edited_priority ? e.edited_priority : (e.priority ?? '')
              const displayS  = e.pm_action === 'edited' && e.edited_severity ? e.edited_severity : (e.severity ?? '')
              return (
                <div
                  key={e.id}
                  onClick={() => { setSelected(e); setEditMode(false); setMobileShowDetail(true) }}
                  className={getBugRowClass(e, selected?.id === e.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-black/65 font-medium" style={MONO}>{e.bug_id}</span>
                        {displayP && <PriorityBadge p={displayP} />}
                        {displayS && <SeverityBadge s={displayS} />}
                        <ConfidenceDots flags={e.gap_flags ?? []} />
                        {e.gap_flags?.includes('Likely over-prioritised') && <Flag className="w-3 h-3 text-purple-500" strokeWidth={2} />}
                        {e.gap_flags?.includes('Possible duplicate')      && <span className="text-blue-500 text-xs font-bold leading-none">⇄</span>}
                        {qualFlags.length > 0                             && <AlertCircle className="w-3 h-3 text-orange-400" strokeWidth={2} />}
                        {e.pm_action === 'approved' && <Check className="w-3 h-3 text-green-500" strokeWidth={2.5} />}
                        {e.pm_action === 'rejected' && <X    className="w-3 h-3 text-black/30"  strokeWidth={2.5} />}
                      </div>
                      <p className={`text-sm leading-tight ${e.pm_action === 'rejected' ? 'line-through text-black/30' : ''}`}>{e.title}</p>
                      {e.quick_reason && (
                        <p className="text-xs text-black/50 leading-snug mt-1 truncate">{e.quick_reason}</p>
                      )}
                      <p className="text-[10px] font-mono text-black/25 mt-1.5" style={MONO}>Last seen {formatDate(e.last_seen_at)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Panel 2: Detail ── */}
        {selected ? (() => {
          const qualityFlags    = (selected.gap_flags ?? []).filter(f => f !== 'Likely over-prioritised' && f !== 'Possible duplicate')
          const isWellWritten   = qualityFlags.length === 0
          const displayPriority = selected.pm_action === 'edited' && selected.edited_priority ? selected.edited_priority : (selected.priority ?? '')
          const displaySeverity = selected.pm_action === 'edited' && selected.edited_severity ? selected.edited_severity : (selected.severity ?? '')
          const isLoadingDetail = detailLoading.has(selected.bug_id)

          return (
            <div className={`${!mobileShowDetail ? 'hidden md:flex md:flex-col' : 'flex flex-col'} flex-1 overflow-hidden`}>
              <div className="flex-1 overflow-y-auto" key={selected.id}>

                {/* Mobile back */}
                <button
                  className="md:hidden flex items-center gap-1 text-sm text-black/50 hover:text-black px-4 py-3 border-b border-gray-100 w-full transition-colors"
                  onClick={() => setMobileShowDetail(false)}
                >
                  <ChevronLeft className="w-4 h-4" /> Back to list
                </button>

                {/* Bug header */}
                <div className="px-6 md:px-8 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-mono text-black/65 font-medium" style={MONO}>{selected.bug_id}</span>
                    {displayPriority && <PriorityBadge p={displayPriority} />}
                    {displaySeverity && <SeverityBadge s={displaySeverity} />}
                    {selected.pm_action && (
                      <span className={`text-xs font-mono uppercase px-2 py-0.5 border ${getActionBadgeClass(selected.pm_action)}`} style={MONO}>
                        {selected.pm_action}{selected.pm_action === 'rejected' && selected.rejection_reason ? ` · ${selected.rejection_reason}` : ''}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold tracking-tight leading-snug" style={HEADING}>{selected.title}</h2>
                  <p className="text-xs text-black/35 font-mono mt-2" style={MONO}>
                    First seen {formatDate(selected.first_seen_at)} · Last seen {formatDate(selected.last_seen_at)}
                  </p>
                </div>

                {/* Analysis body */}
                <div className="px-6 md:px-8 py-6 space-y-5">

                  {selected.gap_flags?.includes('Likely over-prioritised') && (
                    <div className="border-l-4 border-purple-400 bg-purple-50 pl-4 pr-4 py-3.5">
                      <p className="text-xs font-mono uppercase tracking-widest text-purple-500 mb-1" style={MONO}>⚑ Over-prioritised</p>
                      <p className="text-sm text-purple-900 leading-relaxed">The original priority doesn&apos;t match the actual business impact — worth a closer look before committing resources.</p>
                    </div>
                  )}

                  {selected.gap_flags?.includes('Possible duplicate') && (
                    <div className="border-l-4 border-blue-400 bg-blue-50 pl-4 pr-4 py-3.5">
                      <p className="text-xs font-mono uppercase tracking-widest text-blue-500 mb-1" style={MONO}>⇄ Possible duplicate</p>
                      <p className="text-sm text-blue-800">This ticket may overlap with another. Check the rationale below for the related ticket key.</p>
                    </div>
                  )}

                  {/* Business Impact */}
                  <div className="border border-gray-100 bg-gray-50 px-4 py-4">
                    <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-2" style={MONO}>Business Impact</p>
                    {selected.business_impact != null ? (
                      <p className="text-sm text-black/90 leading-relaxed font-medium">{selected.business_impact}</p>
                    ) : isLoadingDetail ? (
                      <div className="flex items-center gap-2 py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-black/30" />
                        <span className="text-sm text-black/40">Generating detail{selected.quick_reason ? `… (${selected.quick_reason})` : '…'}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-black/60 leading-relaxed italic">{selected.quick_reason ?? 'Click to generate full analysis.'}</p>
                    )}
                  </div>

                  {/* Rationale */}
                  <div>
                    <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-2" style={MONO}>SenseBug AI Analysis</p>
                    {selected.rationale != null ? (
                      <p className="text-sm text-black/80 leading-relaxed">{selected.rationale}</p>
                    ) : isLoadingDetail ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-3 bg-gray-100 w-full" /><div className="h-3 bg-gray-100 w-11/12" /><div className="h-3 bg-gray-100 w-3/4" />
                      </div>
                    ) : (
                      <p className="text-sm text-black/40 italic">Generating analysis…</p>
                    )}
                  </div>

                  {/* Suggested rewrite */}
                  {!isWellWritten && selected.improved_description && (
                    <div className="border border-gray-200 overflow-hidden">
                      <button onClick={() => setShowRewrite(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors">
                        <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Suggested Rewrite</p>
                        {showRewrite ? <ChevronDown className="w-3.5 h-3.5 text-black/30" strokeWidth={2} /> : <ChevronRight className="w-3.5 h-3.5 text-black/30" strokeWidth={2} />}
                      </button>
                      {showRewrite && (
                        <div>
                          <div className="px-4 pt-3 pb-1 flex justify-end">
                            <button
                              onClick={() => { navigator.clipboard.writeText(selected.improved_description!); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                              className="flex items-center gap-1.5 text-xs text-black/40 hover:text-black transition-colors"
                            >
                              {copied ? <><CheckCheck className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Copied!</span></> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                            </button>
                          </div>
                          <p className="px-4 pb-4 text-sm text-black/80 leading-relaxed whitespace-pre-line">{selected.improved_description}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Original description */}
                  <div className="border border-gray-200 overflow-hidden">
                    <button onClick={() => setShowOriginal(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Original Description</p>
                      <div className="flex items-center gap-2">
                        {selected.reporter_priority && (
                          <span className="text-xs font-mono border border-gray-200 bg-white px-1.5 py-0.5 text-black/40" style={MONO}>Reporter: {selected.reporter_priority}</span>
                        )}
                        {showOriginal ? <ChevronDown className="w-3.5 h-3.5 text-black/30" strokeWidth={2} /> : <ChevronRight className="w-3.5 h-3.5 text-black/30" strokeWidth={2} />}
                      </div>
                    </button>
                    {showOriginal && (
                      <div className="px-4 py-4 border-t border-gray-100 max-h-64 overflow-y-auto">
                        {selected.original_description
                          ? <p className="text-sm text-black/80 leading-relaxed whitespace-pre-line">{stripJiraMarkup(selected.original_description)}</p>
                          : <p className="text-sm text-black/35 italic">No description provided.</p>
                        }
                      </div>
                    )}
                  </div>

                  {/* Comments */}
                  {selected.original_comments && (
                    <div className="border border-gray-200 overflow-hidden">
                      <button onClick={() => setShowComments(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                        <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Comments</p>
                        {showComments ? <ChevronDown className="w-3.5 h-3.5 text-black/30" strokeWidth={2} /> : <ChevronRight className="w-3.5 h-3.5 text-black/30" strokeWidth={2} />}
                      </button>
                      {showComments && (
                        <div className="px-4 py-4 border-t border-gray-100 max-h-56 overflow-y-auto">
                          <p className="text-sm text-black/80 leading-relaxed whitespace-pre-line">{stripJiraMarkup(selected.original_comments)}</p>
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
                          <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full border border-gray-200 focus:border-black focus:outline-none px-3 py-2 text-sm bg-white">
                            {['P1','P2','P3','P4'].map(p => <option key={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-black/65 mb-1.5" style={MONO}>Severity</label>
                          <select value={editSeverity} onChange={e => setEditSeverity(e.target.value)} className="w-full border border-gray-200 focus:border-black focus:outline-none px-3 py-2 text-sm bg-white">
                            {['Critical','High','Medium','Low'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleVerdict('edited', selected.id, editPriority, editSeverity)} disabled={actionLoading} className="bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/90 transition-colors disabled:opacity-50">Save changes</button>
                        <button onClick={() => setEditMode(false)} className="border border-gray-200 px-4 py-2.5 text-sm hover:border-black transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Reject form */}
                  {rejectMode && (
                    <div className="border border-gray-200 p-5 space-y-4">
                      <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Why are you rejecting this verdict?</p>
                      <select value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full border border-gray-200 focus:border-black focus:outline-none px-3 py-2.5 text-sm bg-white">
                        <option value="">Select a reason…</option>
                        {REJECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => handleVerdict('rejected', selected.id, undefined, undefined, rejectReason)} disabled={actionLoading || !rejectReason} className="bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/90 transition-colors disabled:opacity-40">Confirm rejection</button>
                        <button onClick={() => { setRejectMode(false); setRejectReason('') }} className="border border-gray-200 px-4 py-2.5 text-sm hover:border-black transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {!editMode && !rejectMode && (
                    <div className="pt-5 border-t border-gray-100">
                      <p className="text-xs text-black/55 mb-4">Your call — approve it, adjust the priority, or dismiss it entirely.</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleVerdict('approved', selected.id)}
                          disabled={actionLoading || selected.pm_action === 'approved'}
                          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${selected.pm_action === 'approved' ? 'bg-green-600 text-white border border-green-600' : 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-600 hover:text-white hover:border-green-600'}`}
                        ><Check className="w-4 h-4" strokeWidth={2} />Approve</button>
                        <button
                          onClick={() => { setEditMode(true); setEditPriority(selected.priority ?? 'P3'); setEditSeverity(selected.severity ?? 'Medium') }}
                          disabled={actionLoading}
                          className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 hover:text-white hover:border-blue-700 transition-colors disabled:opacity-50"
                        ><Edit2 className="w-4 h-4" strokeWidth={2} />Adjust</button>
                        <button
                          onClick={() => selected.pm_action !== 'rejected' && setRejectMode(true)}
                          disabled={actionLoading || selected.pm_action === 'rejected'}
                          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${selected.pm_action === 'rejected' ? 'bg-gray-200 text-black/40 border border-gray-200' : 'border border-gray-300 text-black/60 hover:bg-gray-100 hover:border-gray-400'}`}
                        ><X className="w-4 h-4" strokeWidth={2} />Reject</button>
                      </div>
                      {/* Remove from backlog — destructive, kept visually separate */}
                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => handleDelete(selected.id)}
                          disabled={deleteLoading || actionLoading}
                          className="flex items-center gap-1.5 text-xs text-black/35 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                          Remove from backlog
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

        {/* ── Panel 3: Backlog stats ── */}
        <BacklogStats entries={entries} />

      </div>
    </div>
  )
}

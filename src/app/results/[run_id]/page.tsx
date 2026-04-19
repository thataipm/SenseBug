'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { TriageResult, TriageRun } from '@/types'
import { Check, X, Edit2, Download, ChevronLeft, Flag, Loader2, Copy, CheckCheck } from 'lucide-react'

function PriorityBadge({ p }: { p: string }) {
  const colors: Record<string, string> = {
    P1: 'bg-red-50 text-red-600 border-red-200',
    P2: 'bg-orange-50 text-orange-600 border-orange-200',
    P3: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    P4: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <span className={`border px-2 py-0.5 text-xs font-mono uppercase ${colors[p] || 'bg-gray-50 text-black/50 border-gray-200'}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
      {p}
    </span>
  )
}

function SeverityBadge({ s }: { s: string }) {
  const colors: Record<string, string> = {
    Critical: 'bg-red-50 text-red-600 border-red-200',
    High: 'bg-orange-50 text-orange-600 border-orange-200',
    Medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    Low: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <span className={`border px-2 py-0.5 text-xs font-mono uppercase ${colors[s] || 'bg-gray-50 text-black/50 border-gray-200'}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
      {s}
    </span>
  )
}

function getBugRowClass(r: TriageResult, isSelected: boolean): string {
  const base = 'border-b border-gray-100 px-4 py-3 cursor-pointer transition-colors duration-100'
  if (isSelected) return `${base} bg-gray-50 border-l-2 border-l-black`
  if (r.pm_action === 'approved') return `${base} hover:bg-gray-50 border-l-2 border-l-green-500`
  if (r.pm_action === 'rejected') return `${base} hover:bg-gray-50 opacity-50`
  return `${base} hover:bg-gray-50`
}

function getActionBadgeClass(action: string): string {
  if (action === 'approved') return 'border-green-200 bg-green-50 text-green-600'
  if (action === 'rejected') return 'border-gray-200 bg-gray-50 text-black/40'
  return 'border-blue-200 bg-blue-50 text-blue-600'
}

const MONO = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }
const COL_LABEL = 'text-xs font-mono uppercase tracking-widest text-black/35 mb-3'

export default function ResultsPage() {
  const { run_id } = useParams() as { run_id: string }
  const searchParams = useSearchParams()
  const note = searchParams.get('note')
  const [run, setRun] = useState<TriageRun | null>(null)
  const [results, setResults] = useState<TriageResult[]>([])
  const [selected, setSelected] = useState<TriageResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editPriority, setEditPriority] = useState('')
  const [editSeverity, setEditSeverity] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

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

  // Reset copy state whenever a different bug is selected
  useEffect(() => { setCopied(false) }, [selected?.id])

  const handleVerdict = async (action: 'approved' | 'edited' | 'rejected', resultId: string, ep?: string, es?: string) => {
    if (!selected) return
    setActionLoading(true)
    const res = await fetch('/api/triage/verdict', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result_id: resultId, action, edited_priority: ep, edited_severity: es }),
    })
    if (res.ok) {
      setResults((prev) =>
        prev.map((r) =>
          r.id === resultId ? { ...r, pm_action: action, edited_priority: ep || null, edited_severity: es || null } : r
        )
      )
      if (selected.id === resultId) {
        setSelected((prev) => prev ? { ...prev, pm_action: action, edited_priority: ep || null, edited_severity: es || null } : prev)
      }
      setEditMode(false)
    }
    setActionLoading(false)
  }

  const handleDownload = () => { window.open(`/api/triage/export/${run_id}`, '_blank') }

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

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* ── Top bar ── */}
      <header className="border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-black/40 hover:text-black transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <Link href="/dashboard" className="font-black text-lg tracking-tight" style={HEADING}>SENSEBUG</Link>
          <span className="text-black/25">|</span>
          <div>
            <span className="text-sm font-medium">{run.filename}</span>
            <span className="text-xs text-black/40 ml-3">{new Date(run.run_at).toLocaleDateString()} · {results.length} bugs</span>
          </div>
        </div>
        <button
          data-testid="download-csv-button"
          onClick={handleDownload}
          className="flex items-center gap-2 border border-black px-4 py-2 text-sm font-semibold hover:bg-black hover:text-white transition-colors duration-150"
        >
          <Download className="w-4 h-4" strokeWidth={2} />
          Download CSV
        </button>
      </header>

      {/* ── Analysis note banner ── */}
      {note && (
        <div className="border-b border-amber-200 bg-amber-50 text-amber-800 text-xs px-6 py-2.5 flex items-center gap-2" data-testid="analysis-note-banner">
          <span className="font-mono font-semibold uppercase tracking-widest" style={MONO}>Note</span>
          <span>{note}</span>
        </div>
      )}

      {/* ── Main layout: bug list + detail ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Panel 1 — Bug list */}
        <div
          className={`${mobileShowDetail ? 'hidden md:flex md:flex-col' : 'flex flex-col'} w-full md:w-80 xl:w-96 border-r border-gray-200 overflow-y-auto flex-shrink-0`}
          data-testid="bug-list-panel"
        >
          {/* Stats bar */}
          <div className="border-b border-gray-100 px-4 py-3 space-y-2">
            <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>
              {results.length} bugs ranked
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: 'P1', count: results.filter(r => r.priority === 'P1').length, color: 'text-red-600 bg-red-50 border-red-200' },
                { label: 'P2', count: results.filter(r => r.priority === 'P2').length, color: 'text-orange-600 bg-orange-50 border-orange-200' },
                { label: '⚑ Over-prioritised', count: results.filter(r => r.gap_flags?.includes('Likely over-prioritised')).length, color: 'text-purple-600 bg-purple-50 border-purple-200' },
                { label: 'Reviewed', count: results.filter(r => r.pm_action).length, color: 'text-green-700 bg-green-50 border-green-200' },
              ].filter(s => s.count > 0).map(s => (
                <span key={s.label} className={`text-xs font-mono px-1.5 py-0.5 border ${s.color}`} style={MONO}>
                  {s.count} {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Bug rows */}
          {results.map((r, i) => (
            <div
              key={r.id}
              data-testid={`bug-row-${r.id}`}
              onClick={() => { setSelected(r); setEditMode(false); setMobileShowDetail(true) }}
              className={getBugRowClass(r, selected?.id === r.id)}
              style={{ animation: `fade-in 0.3s ease-out ${Math.min(i * 0.03, 0.4)}s both` }}
            >
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono text-black/30 w-6 flex-shrink-0 mt-0.5" style={MONO}>{r.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-mono text-black/50 font-medium" style={MONO}>{r.bug_id}</span>
                    <PriorityBadge p={r.pm_action === 'edited' && r.edited_priority ? r.edited_priority : r.priority} />
                    <SeverityBadge s={r.pm_action === 'edited' && r.edited_severity ? r.edited_severity : r.severity} />
                    {r.gap_flags?.includes('Likely over-prioritised') && <Flag className="w-3 h-3 text-purple-500" strokeWidth={2} title="Likely over-prioritised" />}
                    {r.gap_flags?.filter(f => f !== 'Likely over-prioritised').length > 0 && <Flag className="w-3 h-3 text-orange-400" strokeWidth={2} title="Has quality flags" />}
                    {r.pm_action === 'approved' && <Check className="w-3 h-3 text-green-500" strokeWidth={2.5} />}
                    {r.pm_action === 'rejected' && <X className="w-3 h-3 text-black/30" strokeWidth={2.5} />}
                  </div>
                  <p className={`text-sm leading-tight ${r.pm_action === 'rejected' ? 'line-through text-black/30' : ''}`}>
                    {r.title}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Panels 2 + 3 — Ticket detail + Analysis */}
        {selected ? (() => {
          const qualityFlags = (selected.gap_flags ?? []).filter(f => f !== 'Likely over-prioritised')
          const isWellWritten = qualityFlags.length === 0
          const hasOriginalDesc = selected.original_description != null
          const isMissingDescFlag = selected.gap_flags?.includes('Missing description')
          const displayPriority = selected.pm_action === 'edited' && selected.edited_priority ? selected.edited_priority : selected.priority
          const displaySeverity = selected.pm_action === 'edited' && selected.edited_severity ? selected.edited_severity : selected.severity

          return (
            <div
              className={`${!mobileShowDetail ? 'hidden md:flex md:flex-col' : 'flex flex-col'} flex-1 overflow-hidden`}
              data-testid="rationale-panel"
            >
              {/* Scrollable area (key triggers fade-in animation on bug switch) */}
              <div className="flex-1 overflow-y-auto animate-fade-in" key={selected.id}>

                {/* Mobile back */}
                <button
                  className="md:hidden flex items-center gap-1 text-sm text-black/50 hover:text-black px-4 py-3 border-b border-gray-100 w-full transition-colors duration-150"
                  onClick={() => setMobileShowDetail(false)}
                >
                  <ChevronLeft className="w-4 h-4" /> Back to list
                </button>

                {/* Shared header — rank, IDs, badges, title */}
                <div className="px-6 md:px-8 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-mono text-black/30 border border-gray-200 px-1.5 py-0.5 tabular-nums" style={MONO}>#{selected.rank}</span>
                    <span className="text-xs font-mono text-black/50 font-medium" style={MONO}>{selected.bug_id}</span>
                    <PriorityBadge p={displayPriority} />
                    <SeverityBadge s={displaySeverity} />
                    {selected.pm_action && (
                      <span className={`text-xs font-mono uppercase px-2 py-0.5 border ${getActionBadgeClass(selected.pm_action)}`} style={MONO}>
                        {selected.pm_action}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold tracking-tight leading-snug" style={HEADING}>{selected.title}</h2>
                </div>

                {/* Two-column body */}
                <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-gray-100">

                  {/* ── Left column: Original Ticket ── */}
                  <div className="p-6 md:p-8 border-b lg:border-b-0 border-gray-100">
                    <p className={COL_LABEL} style={MONO}>Original Ticket</p>

                    {/* Reporter's priority */}
                    {selected.reporter_priority && (
                      <div className="flex items-center gap-2 mb-5">
                        <span className="text-xs text-black/40">Reporter labelled:</span>
                        <span className="text-xs font-mono border border-gray-200 bg-gray-50 px-2 py-0.5 text-black/55" style={MONO}>
                          {selected.reporter_priority}
                        </span>
                      </div>
                    )}

                    {/* Description */}
                    <div className="mb-6">
                      <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-2" style={MONO}>Description</p>
                      {hasOriginalDesc ? (
                        <p className="text-sm text-black/70 leading-relaxed whitespace-pre-line">{selected.original_description}</p>
                      ) : isMissingDescFlag ? (
                        <p className="text-sm text-black/35 italic">No description was provided in this ticket.</p>
                      ) : (
                        <p className="text-sm text-black/30 italic">Original descriptions are captured from new runs onwards.</p>
                      )}
                    </div>

                    {/* Quality flags — what's missing */}
                    {qualityFlags.length > 0 && (
                      <div className="border border-orange-200 bg-orange-50 px-4 py-4">
                        <p className="text-xs font-mono uppercase tracking-widest text-orange-500 mb-3" style={MONO}>What&apos;s missing</p>
                        <ul className="space-y-2">
                          {qualityFlags.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-orange-800">
                              <Flag className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" strokeWidth={2} />{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Well-written appreciation */}
                    {isWellWritten && (
                      <div className="flex items-start gap-3 border border-green-200 bg-green-50 px-4 py-3.5">
                        <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                        <div>
                          <p className="text-sm font-semibold text-green-800 mb-0.5" style={HEADING}>Well written ticket</p>
                          <p className="text-xs text-green-700 leading-relaxed">Clear description, sufficient context, and no missing information — the AI could rank this with full confidence.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Right column: SenseBug Analysis ── */}
                  <div className="p-6 md:p-8">
                    <p className={COL_LABEL} style={MONO}>SenseBug Analysis</p>

                    {/* Over-prioritised callout */}
                    {selected.gap_flags?.includes('Likely over-prioritised') && (
                      <div className="mb-5 border-l-4 border-purple-400 bg-purple-50 pl-4 pr-4 py-3.5">
                        <p className="text-xs font-mono uppercase tracking-widest text-purple-500 mb-1" style={MONO}>⚑ Over-prioritised</p>
                        <p className="text-sm text-purple-900 leading-relaxed">The original priority doesn&apos;t match the actual business impact — worth a closer look before committing resources.</p>
                      </div>
                    )}

                    {/* Business Impact */}
                    <div className="mb-5">
                      <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-2" style={MONO}>Business Impact</p>
                      <p className="text-sm text-black/90 leading-relaxed font-medium">{selected.business_impact}</p>
                    </div>

                    {/* SenseBug Analysis */}
                    <div className="mb-5">
                      <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-2" style={MONO}>SenseBug Analysis</p>
                      <p className="text-sm text-black/65 leading-relaxed">{selected.rationale}</p>
                    </div>

                    {/* Suggested rewrite — only when quality flags exist and Claude produced one */}
                    {!isWellWritten && selected.improved_description && (
                      <div className="mb-5 border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                          <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Suggested Rewrite</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selected.improved_description!)
                              setCopied(true)
                              setTimeout(() => setCopied(false), 2000)
                            }}
                            className="flex items-center gap-1.5 text-xs text-black/40 hover:text-black transition-colors duration-150"
                          >
                            {copied
                              ? <><CheckCheck className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Copied!</span></>
                              : <><Copy className="w-3.5 h-3.5" />Copy</>
                            }
                          </button>
                        </div>
                        <p className="px-4 py-4 text-sm text-black/70 leading-relaxed">{selected.improved_description}</p>
                      </div>
                    )}

                    {/* Edit mode */}
                    {editMode && (
                      <div className="mb-5 border border-gray-200 p-5 space-y-4">
                        <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Adjust priority & severity</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-mono text-black/50 mb-1.5" style={MONO}>Priority</label>
                            <select data-testid="edit-priority-select" value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="w-full border border-gray-200 focus:border-black focus:outline-none px-3 py-2 text-sm bg-white">
                              {['P1', 'P2', 'P3', 'P4'].map((p) => <option key={p}>{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-mono text-black/50 mb-1.5" style={MONO}>Severity</label>
                            <select data-testid="edit-severity-select" value={editSeverity} onChange={(e) => setEditSeverity(e.target.value)} className="w-full border border-gray-200 focus:border-black focus:outline-none px-3 py-2 text-sm bg-white">
                              {['Critical', 'High', 'Medium', 'Low'].map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button data-testid="save-edit-button" onClick={() => handleVerdict('edited', selected.id, editPriority, editSeverity)} disabled={actionLoading} className="bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50">
                            Save changes
                          </button>
                          <button onClick={() => setEditMode(false)} className="border border-gray-200 px-4 py-2.5 text-sm hover:border-black transition-colors duration-150">Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!editMode && (
                      <div data-testid="action-buttons" className="pt-5 border-t border-gray-100">
                        <p className="text-xs text-black/35 mb-4">Your call — approve it, adjust the priority, or dismiss it entirely.</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            data-testid="approve-button"
                            onClick={() => handleVerdict('approved', selected.id)}
                            disabled={actionLoading || selected.pm_action === 'approved'}
                            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors duration-150 disabled:opacity-50 ${
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
                            className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 hover:text-white hover:border-blue-700 transition-colors duration-150 disabled:opacity-50"
                          >
                            <Edit2 className="w-4 h-4" strokeWidth={2} />Adjust
                          </button>
                          <button
                            data-testid="reject-button"
                            onClick={() => handleVerdict('rejected', selected.id)}
                            disabled={actionLoading || selected.pm_action === 'rejected'}
                            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors duration-150 disabled:opacity-50 ${
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

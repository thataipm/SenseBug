'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { TriageRun } from '@/types'
import { Loader2, Trash2, ChevronRight, Clock } from 'lucide-react'

export default function HistoryRunPage() {
  const [runs, setRuns]           = useState<TriageRun[]>([])
  const [loading, setLoading]     = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting]   = useState<Set<string>>(new Set())
  const [search, setSearch]       = useState('')
  const router = useRouter()

  const fetchRuns = useCallback(async () => {
    const res = await fetch('/api/triage/runs')
    if (res.ok) setRuns(await res.json())
  }, [])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/login'); return }
      await fetchRuns()
      setLoading(false)
    }
    init()
  }, [router, fetchRuns])

  const filteredRuns = runs.filter((r) => r.filename.toLowerCase().includes(search.toLowerCase()))
  const allSelected  = filteredRuns.length > 0 && filteredRuns.every((r) => selectedIds.has(r.id))

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredRuns.map((r) => r.id)))
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const deleteRun = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id))
    const res = await fetch(`/api/triage/runs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRuns((prev) => prev.filter((r) => r.id !== id))
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
    }
    setDeleting((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds)
    if (!window.confirm(`Delete ${ids.length} run${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return
    await Promise.all(ids.map(deleteRun))
  }

  const handleDeleteOne = (id: string, filename: string) => {
    if (!window.confirm(`Delete "${filename}"? This cannot be undone.`)) return
    deleteRun(id)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-black/30" />
    </div>
  )

  return (
    <div className="px-6 md:px-10 py-10 max-w-5xl mx-auto" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Run History</h1>
          <p className="text-xs text-black/60 mt-1 font-mono" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{runs.length} total run{runs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              data-testid="bulk-delete-btn"
              onClick={deleteSelected}
              className="flex items-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 text-sm font-medium transition-colors duration-150"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              Delete {selectedIds.size} selected
            </button>
          )}
          <input
            data-testid="history-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename…"
            className="border border-gray-200 focus:border-black focus:outline-none px-3 py-2 text-sm w-56 transition-colors duration-150"
          />
        </div>
      </div>

      {filteredRuns.length === 0 ? (
        <div className="border border-dashed border-gray-200 py-16 text-center">
          <p className="text-sm text-black/55">{search ? 'No runs match your search.' : 'No analysis runs yet.'}</p>
          {!search && (
            <Link href="/dashboard" className="mt-3 inline-block text-sm text-black underline hover:no-underline">Upload your first CSV</Link>
          )}
        </div>
      ) : (
        <table data-testid="history-table" className="w-full text-sm border-y border-gray-200">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 pr-3 w-8">
                <input data-testid="select-all-checkbox" type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" />
              </th>
              <th className="py-3 text-left font-mono text-xs uppercase tracking-widest text-black/40 pr-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>File</th>
              <th className="py-3 text-left font-mono text-xs uppercase tracking-widest text-black/40 pr-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Date</th>
              <th className="py-3 text-center font-mono text-xs uppercase tracking-widest text-black/40 pr-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Bugs</th>
              <th className="py-3 text-left font-mono text-xs uppercase tracking-widest text-black/40 pr-4 hidden sm:table-cell" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Reviewed</th>
              <th className="py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run) => (
              <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-100">
                <td className="py-3 pr-3">
                  <input data-testid={`select-run-${run.id}`} type="checkbox" checked={selectedIds.has(run.id)} onChange={() => toggleOne(run.id)} className="cursor-pointer" />
                </td>
                <td className="py-3 pr-4">
                  <Link href={`/results/${run.id}`} className="font-medium hover:underline flex items-center gap-1">
                    {run.filename}<ChevronRight className="w-3 h-3 text-black/30" />
                  </Link>
                </td>
                <td className="py-3 pr-4 text-black/65">
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{new Date(run.run_at).toLocaleDateString()}</span>
                </td>
                <td className="py-3 pr-4 text-center font-mono text-xs text-black/65" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{run.bug_count}</td>
                <td className="py-3 pr-4 hidden sm:table-cell">
                  {run.bug_count > 0 ? (() => {
                    const reviewed = run.reviewed_count ?? 0
                    const total = run.bug_count
                    const pct = Math.round((reviewed / total) * 100)
                    const done = reviewed === total
                    return (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-200 overflow-hidden flex-shrink-0">
                          <div
                            className={`h-full transition-all duration-300 ${done ? 'bg-green-500' : 'bg-black'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono tabular-nums ${done ? 'text-green-600' : 'text-black/60'}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                          {reviewed}/{total}
                        </span>
                      </div>
                    )
                  })() : (
                    <span className="text-xs text-black/25 font-mono" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>—</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  {deleting.has(run.id) ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black/30 ml-auto" />
                  ) : (
                    <button data-testid={`delete-run-${run.id}`} onClick={() => handleDeleteOne(run.id, run.filename)} className="text-black/25 hover:text-red-500 transition-colors duration-150 p-1">
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

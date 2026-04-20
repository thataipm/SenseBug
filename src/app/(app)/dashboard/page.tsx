'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setPendingFile } from '@/lib/pending-upload'
import { TriageRun } from '@/types'
import { Upload, Loader2, Clock, ChevronRight, AlertTriangle, Trash2, Sparkles } from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

function PriorityBar({ counts }: { counts: { P1: number; P2: number; P3: number; P4: number } }) {
  const total = counts.P1 + counts.P2 + counts.P3 + counts.P4
  if (!total) return null
  const segs = [
    { key: 'P1', count: counts.P1, hex: '#f87171', label: 'text-red-500' },
    { key: 'P2', count: counts.P2, hex: '#fb923c', label: 'text-orange-500' },
    { key: 'P3', count: counts.P3, hex: '#facc15', label: 'text-yellow-500' },
    { key: 'P4', count: counts.P4, hex: '#4ade80', label: 'text-green-500' },
  ].filter(s => s.count > 0)
  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Priority breakdown</p>
      <div className="flex h-1.5 w-full gap-px mb-3 overflow-hidden">
        {segs.map(s => <div key={s.key} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.hex }} />)}
      </div>
      <div className="flex items-center gap-5 flex-wrap">
        {segs.map(s => (
          <div key={s.key} className="flex items-baseline gap-1.5">
            <span className={`text-xs font-mono font-semibold ${s.label}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{s.key}</span>
            <span className="text-xl font-black leading-none" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RunChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
      <p className="text-black/45 mb-0.5 max-w-[180px] truncate">{payload[0]?.payload?.label}</p>
      <p className="font-semibold text-black">{payload[0]?.payload?.bugs} bugs</p>
    </div>
  )
}

interface PlanInfo {
  plan: string
  monthly_runs_count: number
  monthly_bug_limit: number
  bugs_per_run_limit: number
  bugs_analyzed_this_month: number
}

function DashboardContent() {
  const [runs, setRuns] = useState<TriageRun[]>([])
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  const [kbEmpty, setKbEmpty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const kbSkipped = searchParams.get('kb_skipped') === '1'

  const fetchData = useCallback(async () => {
    const [runsRes, planRes, kbRes] = await Promise.all([
      fetch('/api/triage/runs'),
      fetch('/api/plan'),
      fetch('/api/kb'),
    ])
    if (kbRes.ok) {
      const kb = await kbRes.json()
      if (!kb) { router.push('/onboarding'); return }
      if (!kb.product_overview?.trim()) setKbEmpty(true)
    }
    if (runsRes.ok) setRuns(await runsRes.json())
    if (planRes.ok) setPlan(await planRes.json())
    setLoading(false)
  }, [router])

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/login'); return }
      await fetchData()
    }
    init()
  }, [router, fetchData])

  useEffect(() => {
    const onFocus = () => { fetchData() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchData])

  const handleUpload = (file: File) => {
    const allowed = ['.csv', '.tsv', '.xlsx', '.xls', '.txt']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!allowed.includes(ext)) { setUploadError('Supported formats: CSV, Excel (.xlsx / .xls), TSV, or TXT.'); return }
    setUploadError('')
    setUploading(true)
    setPendingFile(file)
    router.push('/processing')
  }

  const handleDeleteRun = async (id: string, filename: string) => {
    if (!window.confirm(`Delete "${filename}"? This cannot be undone.`)) return
    setDeletingId(id)
    const res = await fetch(`/api/triage/runs/${id}`, { method: 'DELETE' })
    if (res.ok) setRuns((prev) => prev.filter((r) => r.id !== id))
    setDeletingId(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-black/30" />
    </div>
  )

  const bugsAnalyzed    = plan?.bugs_analyzed_this_month ?? 0
  const monthlyBugLimit = plan?.monthly_bug_limit ?? 0
  const hasMonthlyLimit = monthlyBugLimit !== -1
  const atLimit         = hasMonthlyLimit && bugsAnalyzed >= monthlyBugLimit
  const usagePct        = hasMonthlyLimit && monthlyBugLimit > 0 ? Math.min(100, (bugsAnalyzed / monthlyBugLimit) * 100) : 0

  return (
    <>
      {/* Banners */}
      {atLimit && (
        <div data-testid="limit-banner" className="border-b border-orange-200 bg-orange-50 text-orange-800 text-sm px-6 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          You&apos;ve used all {monthlyBugLimit} bugs in your monthly quota.{' '}
          <Link href="/#pricing" className="font-medium underline">Upgrade for more</Link>
        </div>
      )}
      {(kbSkipped || kbEmpty) && (
        <div className="border-b border-blue-100 bg-blue-50 text-blue-800 text-sm px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            <span>Your Knowledge Base is empty — results will be less accurate without product context.</span>
          </div>
          <Link href="/settings" className="text-blue-700 font-medium underline whitespace-nowrap text-xs hover:text-blue-900">Set it up →</Link>
        </div>
      )}
      {/* Resume banner — most recent run has unreviewed bugs */}
      {runs.length > 0 && (runs[0].reviewed_count ?? 0) > 0 && (runs[0].reviewed_count ?? 0) < runs[0].bug_count && (
        <div className="border-b border-gray-200 bg-gray-50 text-sm px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-black/40 flex-shrink-0" />
            <span className="text-black/60 truncate">
              Pick up where you left off —{' '}
              <span className="font-medium text-black">{runs[0].filename}</span>
              <span className="text-black/40 ml-1.5 font-mono text-xs" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                {runs[0].reviewed_count}/{runs[0].bug_count} reviewed
              </span>
            </span>
          </div>
          <Link
            href={`/results/${runs[0].id}`}
            className="text-xs font-mono text-black hover:underline whitespace-nowrap flex-shrink-0"
            style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
          >
            Continue reviewing →
          </Link>
        </div>
      )}

      <div className="px-6 md:px-10 py-10 max-w-5xl mx-auto" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black tracking-tighter" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Dashboard</h1>
          <button
            data-testid="upload-csv-button"
            onClick={() => !atLimit && fileRef.current?.click()}
            disabled={uploading || atLimit}
            className="bg-black text-white px-5 py-2.5 text-sm font-semibold flex items-center gap-2 hover:bg-black/90 transition-colors duration-150 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" strokeWidth={2} />
            Upload CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        </div>

        {/* Usage meter */}
        {plan && (
          <div className="border border-gray-200 px-5 py-5 mb-8">
            {hasMonthlyLimit ? (
              <div className="flex items-center gap-6 flex-wrap sm:flex-nowrap">
                <div className="relative flex-shrink-0" style={{ width: 100, height: 100 }}>
                  <PieChart width={100} height={100}>
                    <Pie
                      data={[
                        { name: 'Used', value: bugsAnalyzed },
                        { name: 'Remaining', value: Math.max(0, monthlyBugLimit - bugsAnalyzed) },
                      ]}
                      cx={50} cy={50} innerRadius={33} outerRadius={47}
                      dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}
                    >
                      <Cell fill={atLimit ? '#ef4444' : usagePct > 80 ? '#f97316' : '#000000'} />
                      <Cell fill="#f3f4f6" />
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-black leading-none" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                      {Math.round(usagePct)}%
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-1.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Monthly bug quota</p>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{bugsAnalyzed}</span>
                    <span className="text-sm text-black/40">analysed of {monthlyBugLimit}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5 text-xs text-black/55">
                      <span className={`w-2 h-2 inline-block flex-shrink-0 ${atLimit ? 'bg-red-400' : usagePct > 80 ? 'bg-orange-400' : 'bg-black'}`} />
                      {bugsAnalyzed} used
                    </span>
                    <span className="text-black/20 text-xs">·</span>
                    <span className="flex items-center gap-1.5 text-xs text-black/55">
                      <span className="w-2 h-2 inline-block flex-shrink-0 bg-gray-200" />
                      {Math.max(0, monthlyBugLimit - bugsAnalyzed)} remaining
                    </span>
                    <span className="text-black/20 text-xs hidden sm:inline">·</span>
                    <span className="text-xs font-mono text-black/35 hidden sm:inline" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                      up to {plan.bugs_per_run_limit}/run
                    </span>
                  </div>
                </div>
                <Link
                  href="/#pricing"
                  className="text-xs font-mono text-black/50 hover:text-black border border-gray-300 hover:border-black px-3 py-1.5 transition-colors duration-150 whitespace-nowrap flex-shrink-0"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  Upgrade →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-1" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Bugs analysed this month</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{bugsAnalyzed}</span>
                    <span className="text-sm text-black/40">bugs · up to {plan.bugs_per_run_limit} per run · unlimited</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <div data-testid="upload-error" className="mb-6 border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {uploadError}
          </div>
        )}

        {runs.length === 0 ? (
          <div
            data-testid="dashboard-empty-state"
            className="border border-dashed border-gray-300 px-8 py-20 text-center cursor-pointer hover:border-black transition-colors duration-300 group animate-fade-in"
            onClick={() => !atLimit && fileRef.current?.click()}
          >
            <div className="animate-float-slow inline-block mb-4">
              <Upload className="w-8 h-8 text-black/20 group-hover:text-black/40 transition-colors duration-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Upload your first bug backlog</h2>
            <p className="text-sm text-black/40 mb-1">Export a CSV from Jira, Linear, or any tracker and drop it here.</p>
            <p className="text-xs text-black/30 mb-8">Needs id, title, and priority columns. Add description and comments for sharper rankings.</p>
            <span className="bg-black text-white px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2 group-hover:bg-black/80 transition-colors duration-150">
              <Upload className="w-4 h-4" />Choose CSV file
            </span>
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* Most recent run */}
            <div data-testid="last-run-card" className="border border-black p-6 mb-6">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Most recent</p>
                <Link href={`/results/${runs[0].id}`} className="text-xs text-black/50 hover:text-black transition-colors flex items-center gap-1">
                  View results <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{runs[0].filename}</h2>
              <div className="flex items-center gap-6 text-sm mb-5">
                <span className="flex items-center gap-1.5 text-black/50"><Clock className="w-3.5 h-3.5" />{new Date(runs[0].run_at).toLocaleDateString()}</span>
                <span className="font-mono text-xs font-semibold bg-gray-100 px-2 py-0.5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{runs[0].bug_count} bugs</span>
              </div>
              {runs[0].priority_counts && (
                <div className="border-t border-gray-100 pt-5">
                  <PriorityBar counts={runs[0].priority_counts} />
                </div>
              )}
            </div>

            {/* Previous runs */}
            {runs.length > 1 && (
              <div>
                <h2 className="text-xs font-mono uppercase tracking-widest text-black/40 mb-3" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Run history</h2>
                {runs.length >= 3 && (
                  <div className="border border-gray-200 px-5 pt-4 pb-3 mb-4">
                    <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-3" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Bugs analysed per run</p>
                    <ResponsiveContainer width="100%" height={72}>
                      <BarChart
                        data={[...runs].reverse().slice(-12).map(r => ({
                          date: new Date(r.run_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          bugs: r.bug_count,
                          label: r.filename,
                        }))}
                        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                      >
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.3)', fontFamily: 'IBM Plex Mono, monospace' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<RunChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                        <Bar dataKey="bugs" fill="black" radius={[2, 2, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <table data-testid="run-history-table" className="w-full text-sm border-t border-gray-200">
                  <tbody>
                    {runs.slice(1).map((run) => (
                      <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-100">
                        <td className="py-3 pr-4">
                          <Link href={`/results/${run.id}`} className="hover:underline font-medium">{run.filename}</Link>
                        </td>
                        <td className="py-3 pr-4 text-black/40 text-xs">{new Date(run.run_at).toLocaleDateString()}</td>
                        <td className="py-3 pr-4">
                          {run.priority_counts && (() => {
                            const pc = run.priority_counts!
                            const total = pc.P1 + pc.P2 + pc.P3 + pc.P4
                            if (!total) return null
                            return (
                              <div className="flex h-1 gap-px w-20 overflow-hidden" title={`P1:${pc.P1} P2:${pc.P2} P3:${pc.P3} P4:${pc.P4}`}>
                                {pc.P1 > 0 && <div className="h-full bg-red-400" style={{ width: `${(pc.P1/total)*100}%` }} />}
                                {pc.P2 > 0 && <div className="h-full bg-orange-400" style={{ width: `${(pc.P2/total)*100}%` }} />}
                                {pc.P3 > 0 && <div className="h-full bg-yellow-400" style={{ width: `${(pc.P3/total)*100}%` }} />}
                                {pc.P4 > 0 && <div className="h-full bg-green-400" style={{ width: `${(pc.P4/total)*100}%` }} />}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className="font-mono text-xs text-black/40" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{run.bug_count} bugs</span>
                        </td>
                        <td className="py-3 text-right w-10">
                          {deletingId === run.id
                            ? <Loader2 className="w-4 h-4 animate-spin text-black/30 ml-auto" />
                            : (
                              <button
                                data-testid={`dashboard-delete-run-${run.id}`}
                                onClick={() => handleDeleteRun(run.id, run.filename)}
                                className="text-black/20 hover:text-red-500 transition-colors duration-150 p-1"
                              >
                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            )
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  )
}

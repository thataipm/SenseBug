'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, Users, TrendingUp, CreditCard, DollarSign, ArrowUpRight, MessageSquare,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

const PLAN_BADGE: Record<string, string> = {
  starter: 'text-black/50 border-gray-200 bg-gray-50',
  pro:     'text-blue-700 border-blue-200 bg-blue-50',
  max:     'text-purple-700 border-purple-200 bg-purple-50',
  team:    'text-purple-700 border-purple-200 bg-purple-50',
}
const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter', pro: 'Pro', max: 'Max', team: 'Max',
}

interface AdminStats {
  totalUsers:        number
  newThisMonth:      number
  proCount:          number
  maxCount:          number
  starterCount:      number
  adminCount:        number
  estimatedMRR:      number
  totalRuns:         number
  totalBugsAnalyzed: number
  conversionRate:    string
  chartData:         { date: string; signups: number; runs: number }[]
  recentSignups:     { email: string; created_at: string; plan: string }[]
  recentRuns:        { email: string; filename: string; bug_count: number; run_at: string }[]
  recentFeedback:    { email: string; type: string; subject: string; message: string; created_at: string }[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon,
}: {
  label: string; value: string | number; sub?: string; icon: React.ElementType
}) {
  return (
    <div className="border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>{label}</p>
        <Icon className="w-4 h-4 text-black/20 flex-shrink-0" strokeWidth={1.5} />
      </div>
      <p className="text-3xl font-black tracking-tight leading-none mb-2" style={HEADING}>{value}</p>
      {sub && <p className="text-xs text-black/50" style={MONO}>{sub}</p>}
    </div>
  )
}

// ── Chart tooltip ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm" style={MONO}>
      <p className="text-black/50 mb-1.5">{fmtDate(label)}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.value} {p.dataKey}
        </p>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats]   = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (!data.user) { router.push('/login'); return }

      const res = await fetch('/api/admin/stats')
      if (res.status === 403) { router.push('/dashboard'); return }
      if (!res.ok) { setError('Failed to load stats.'); setLoading(false); return }
      setStats(await res.json())
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="w-6 h-6 animate-spin text-black/30" />
    </div>
  )

  if (error || !stats) return (
    <div className="min-h-screen flex items-center justify-center bg-white text-sm text-black/50">
      {error || 'Something went wrong.'}
    </div>
  )

  const avgBugsPerRun   = stats.totalRuns > 0 ? Math.round(stats.totalBugsAnalyzed / stats.totalRuns) : 0
  const runsThisMonth   = stats.chartData.reduce((s, d) => s + d.runs, 0)
  const signupsThisMonth = stats.chartData.slice(-30).reduce((s, d) => s + d.signups, 0)

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* ── Top bar ── */}
      <header className="border-b border-gray-200 px-8 h-14 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-black text-lg tracking-tight" style={HEADING}>SENSEBUG AI</span>
          <span className="text-xs font-mono border border-gray-200 bg-gray-50 text-black/50 px-2 py-0.5" style={MONO}>
            Admin
          </span>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-xs font-mono text-black/50 hover:text-black transition-colors"
          style={MONO}
        >
          Dashboard <ArrowUpRight className="w-3 h-3" />
        </Link>
      </header>

      <div className="px-8 py-8 max-w-6xl mx-auto space-y-6">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats.totalUsers.toLocaleString()}
            sub={`+${signupsThisMonth} this month`}
            icon={Users}
          />
          <StatCard
            label="New This Month"
            value={stats.newThisMonth}
            sub="calendar month"
            icon={TrendingUp}
          />
          <StatCard
            label="Paid Users"
            value={stats.proCount + stats.maxCount}
            sub={`${stats.conversionRate}% conversion · ${stats.adminCount} admin`}
            icon={CreditCard}
          />
          <StatCard
            label="Est. MRR"
            value={`$${stats.estimatedMRR}`}
            sub={`Pro ×${stats.proCount}  ·  Max ×${stats.maxCount}`}
            icon={DollarSign}
          />
        </div>

        {/* ── Growth chart ── */}
        <div className="border border-gray-200 p-6">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-6" style={MONO}>
            Signups &amp; Runs — last 30 days
          </p>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={stats.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.35)', fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={false} tickLine={false} interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.35)', fontFamily: 'IBM Plex Mono, monospace' }}
                axisLine={false} tickLine={false} allowDecimals={false} width={28}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line dataKey="signups" stroke="#000000"   strokeWidth={2} dot={false} name="signups" />
              <Line dataKey="runs"    stroke="#6366f1"   strokeWidth={2} dot={false} name="runs" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-3">
            <span className="flex items-center gap-2 text-xs text-black/50" style={MONO}>
              <span className="w-4 h-0.5 bg-black inline-block rounded-full" />signups
            </span>
            <span className="flex items-center gap-2 text-xs text-black/50" style={MONO}>
              <span className="w-4 h-0.5 bg-indigo-500 inline-block rounded-full" />runs
            </span>
          </div>
        </div>

        {/* ── Plan breakdown + usage ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Plan breakdown */}
          <div className="border border-gray-200 p-6">
            <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={MONO}>Plan Breakdown</p>
            <div className="space-y-4">
              {[
                { label: 'Starter', count: stats.starterCount, bar: 'bg-gray-300'  },
                { label: 'Pro',     count: stats.proCount,     bar: 'bg-blue-500'  },
                { label: 'Max',     count: stats.maxCount,     bar: 'bg-purple-500'},
                { label: 'Admin',   count: stats.adminCount,   bar: 'bg-black'     },
              ].map(({ label, count, bar }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-black/60 w-14 flex-shrink-0" style={MONO}>{label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full ${bar}`}
                      style={{ width: stats.totalUsers > 0 ? `${(count / stats.totalUsers) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm font-black w-8 text-right tabular-nums" style={HEADING}>{count}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-black/50" style={MONO}>{stats.conversionRate}% paid conversion</p>
              <p className="text-xs text-black/50" style={MONO}>{stats.totalUsers} total</p>
            </div>
          </div>

          {/* Usage */}
          <div className="border border-gray-200 p-6">
            <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5" style={MONO}>Product Usage</p>
            <div className="space-y-4">
              {[
                { label: 'Total runs',      value: stats.totalRuns.toLocaleString()         },
                { label: 'Bugs analyzed',   value: stats.totalBugsAnalyzed.toLocaleString() },
                { label: 'Avg bugs / run',  value: avgBugsPerRun.toString()                 },
                { label: 'Runs this month', value: runsThisMonth.toString()                  },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                  <span className="text-xs text-black/60" style={MONO}>{label}</span>
                  <span className="text-sm font-black tabular-nums" style={HEADING}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Recent signups */}
          <div className="border border-gray-200">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Recent Signups</p>
            </div>
            <table className="w-full">
              <tbody>
                {stats.recentSignups.map((u, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-black/80 max-w-[180px]">
                      <span className="truncate block">{u.email}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-mono border px-1.5 py-0.5 ${PLAN_BADGE[u.plan] ?? PLAN_BADGE.starter}`} style={MONO}>
                        {PLAN_LABELS[u.plan] ?? u.plan}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-black/50 whitespace-nowrap" style={MONO}>
                      {fmtDate(u.created_at)}
                    </td>
                  </tr>
                ))}
                {stats.recentSignups.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-black/35">No signups yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Recent runs */}
          <div className="border border-gray-200">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Recent Runs</p>
            </div>
            <table className="w-full">
              <tbody>
                {stats.recentRuns.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-black/80 truncate max-w-[150px]">{r.email}</p>
                      <p className="text-xs text-black/50 truncate max-w-[150px]" style={MONO}>{r.filename}</p>
                    </td>
                    <td className="px-5 py-3 text-right text-xs font-mono font-semibold text-black/65 whitespace-nowrap" style={MONO}>
                      {r.bug_count} bugs
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-black/50 whitespace-nowrap" style={MONO}>
                      {fmtDate(r.run_at)}
                    </td>
                  </tr>
                ))}
                {stats.recentRuns.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-black/35">No runs yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent feedback ── */}
        <div className="border border-gray-200">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-black/30" strokeWidth={1.5} />
            <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>User Feedback</p>
          </div>
          {stats.recentFeedback.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-black/35">No feedback yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {stats.recentFeedback.map((f, i) => {
                const TYPE_BADGE: Record<string, string> = {
                  bug:     'text-red-700 border-red-200 bg-red-50',
                  feature: 'text-blue-700 border-blue-200 bg-blue-50',
                  general: 'text-gray-600 border-gray-200 bg-gray-50',
                }
                const TYPE_LABEL: Record<string, string> = {
                  bug: 'Bug', feature: 'Feature', general: 'Feedback',
                }
                return (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-xs font-mono border px-1.5 py-0.5 flex-shrink-0 ${TYPE_BADGE[f.type] ?? TYPE_BADGE.general}`}
                          style={MONO}
                        >
                          {TYPE_LABEL[f.type] ?? f.type}
                        </span>
                        <p className="text-sm font-medium text-black/80 truncate">{f.subject}</p>
                      </div>
                      <p className="text-xs text-black/40 whitespace-nowrap flex-shrink-0" style={MONO}>{fmtDate(f.created_at)}</p>
                    </div>
                    <p className="text-xs text-black/55 leading-relaxed line-clamp-2 mb-1" style={MONO}>{f.message}</p>
                    <p className="text-xs text-black/35" style={MONO}>{f.email}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Clock, Brain } from 'lucide-react'
import type { CalibrationSignal } from '@/lib/pm-calibration'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { scoreLabel, scoreColor } from '@/lib/health-score'

const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

interface HealthSnapshot {
  id: string
  score: number
  computed_at: string
  total_bugs: number
  p1_count: number
  p2_count: number
  critical_count: number
  flagged_count: number
  missing_repro_count: number
  duplicate_count: number
  over_pri_count: number
  p1_rate: number
  quality_flag_rate: number
  noise_rate: number
  run_id: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const score = payload[0]?.value as number
  const colors = scoreColor(score)
  return (
    <div className="border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm" style={MONO}>
      <p className="text-black/50 mb-0.5">{label}</p>
      <p className={`font-bold ${colors.text}`}>{score}/100 — {scoreLabel(score)}</p>
    </div>
  )
}

function MetricBar({ label, value, max = 100, warnThreshold }: {
  label: string
  value: number
  max?: number
  warnThreshold: number
}) {
  const pct  = Math.min(100, Math.round((value / max) * 100))
  const warn = value >= warnThreshold
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-black/60">{label}</span>
        <span className={`text-xs font-mono font-semibold tabular-nums ${warn ? 'text-red-600' : 'text-black/65'}`} style={MONO}>{value}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${warn ? 'bg-red-400' : 'bg-black/40'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ScoreGauge({ score }: { score: number }) {
  const colors  = scoreColor(score)
  const label   = scoreLabel(score)
  const radius  = 52
  const circ    = 2 * Math.PI * radius
  // Fill only the top 75% of the circle (a gauge arc, not a full ring)
  const arcFraction = 0.75
  const filled  = (score / 100) * arcFraction * circ
  const gap     = circ - arcFraction * circ
  const dash    = `${filled} ${circ - filled}`
  const rotation = 135   // start at bottom-left

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 140, height: 100 }}>
        <svg width={140} height={140} style={{ position: 'absolute', top: -20 }}>
          {/* Track */}
          <circle
            cx={70} cy={70} r={radius}
            fill="none" stroke="#f3f4f6" strokeWidth={10}
            strokeDasharray={`${arcFraction * circ} ${circ - arcFraction * circ}`}
            strokeDashoffset={-gap / 2}
            transform={`rotate(${rotation} 70 70)`}
            strokeLinecap="round"
          />
          {/* Fill */}
          <circle
            cx={70} cy={70} r={radius}
            fill="none"
            stroke={score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'}
            strokeWidth={10}
            strokeDasharray={dash}
            strokeDashoffset={-gap / 2}
            transform={`rotate(${rotation} 70 70)`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ top: 10 }}>
          <span className={`text-4xl font-black leading-none ${colors.text}`} style={HEADING}>{score}</span>
          <span className="text-xs text-black/40 mt-0.5" style={MONO}>/100</span>
        </div>
      </div>
      <span className={`text-sm font-mono font-semibold mt-2 ${colors.text}`} style={MONO}>{label}</span>
    </div>
  )
}

interface CalibrationData {
  verdict_count: number
  signal: CalibrationSignal
  prompt_injection: string
  prompt_block: string | null
  computed_at: string
}

export default function InsightsPage() {
  const [snapshots, setSnapshots]       = useState<HealthSnapshot[]>([])
  const [calibration, setCalibration]   = useState<CalibrationData | null>(null)
  const [loading, setLoading]           = useState(true)
  const [isGated, setIsGated]           = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/health-score').then(r => {
        if (r.status === 403) return { gated: true }
        return r.ok ? r.json() : []
      }),
      fetch('/api/calibration').then(r => r.ok ? r.json() : null),
    ]).then(([snaps, cal]) => {
      if ((snaps as { gated?: boolean })?.gated) {
        setIsGated(true)
        setLoading(false)
        return
      }
      setSnapshots(snaps ?? [])
      setCalibration(cal)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    )
  }

  if (isGated) {
    return (
      <div className="px-6 md:px-10 py-10 max-w-3xl mx-auto" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
        <h1 className="text-2xl font-black tracking-tighter mb-2" style={HEADING}>Insights</h1>
        <p className="text-sm text-black/50 mb-8">Backlog health score, ticket quality trends, and AI learning progress — all in one place.</p>
        <div className="border border-gray-200 px-8 py-16 text-center">
          <TrendingUp className="w-8 h-8 text-black/20 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-black/70 mb-1">Backlog health &amp; insights</p>
          <p className="text-xs text-black/40 mb-6 max-w-xs mx-auto leading-relaxed">
            Track your backlog health score over time, spot quality trends, and see how the AI is learning your priorities. Available on Pro and Max plans.
          </p>
          <a
            href="/pricing"
            className="bg-black text-white px-5 py-2.5 text-sm font-semibold inline-block hover:bg-black/90 transition-colors"
          >
            Upgrade to Pro →
          </a>
        </div>
      </div>
    )
  }

  if (snapshots.length === 0) {
    return (
      <div className="px-6 md:px-10 py-10 max-w-3xl mx-auto" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
        <h1 className="text-2xl font-black tracking-tighter mb-2" style={HEADING}>Insights</h1>
        <p className="text-sm text-black/50 mb-8">Backlog health score, ticket quality trends, and AI learning progress — all in one place.</p>
        <div className="border border-dashed border-gray-300 px-8 py-16 text-center">
          <Clock className="w-8 h-8 text-black/20 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-black/60 mb-1">No health data yet</p>
          <p className="text-xs text-black/40 mb-6 max-w-xs mx-auto leading-relaxed">
            Health scores are calculated automatically after each analysis run. Run your first analysis from the dashboard to populate this page.
          </p>
          <Link
            href="/dashboard"
            className="bg-black text-white px-5 py-2.5 text-sm font-semibold inline-block hover:bg-black/90 transition-colors"
          >
            Go to dashboard →
          </Link>
        </div>
      </div>
    )
  }

  const current  = snapshots[0]
  const previous = snapshots[1] ?? null
  const delta    = previous ? current.score - previous.score : null
  const colors   = scoreColor(current.score)

  // Reverse for chart (oldest → newest left to right)
  const chartData = [...snapshots].reverse().map(s => ({
    date:  new Date(s.computed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: s.score,
  }))

  const wellWrittenPct = current.total_bugs > 0
    ? Math.round(((current.total_bugs - current.flagged_count) / current.total_bugs) * 100)
    : 100

  const missingReproPct = current.total_bugs > 0
    ? Math.round((current.missing_repro_count / current.total_bugs) * 100)
    : 0

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl mx-auto" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tighter" style={HEADING}>Insights</h1>
          <p className="text-sm text-black/50 mt-0.5">
            Based on{' '}
            <span className="font-medium text-black">{current.total_bugs} bugs</span>
            {' '}· Last updated {new Date(current.computed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Link href="/dashboard" className="text-xs font-mono text-black/40 hover:text-black transition-colors" style={MONO}>← Dashboard</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Health score gauge */}
        <div className="border border-gray-200 p-6 flex flex-col items-center">
          <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-4 self-start w-full" style={MONO}>Backlog health</p>
          <ScoreGauge score={current.score} />
          {delta !== null && (
            <div className={`flex items-center gap-1 mt-3 text-xs font-mono font-semibold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-black/40'}`} style={MONO}>
              {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" strokeWidth={2.5} /> : delta < 0 ? <TrendingDown className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />}
              {delta > 0 ? '+' : ''}{delta} since last snapshot
            </div>
          )}
        </div>

        {/* Priority breakdown */}
        <div className="border border-gray-200 p-6">
          <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-4" style={MONO}>Priority breakdown</p>
          <div className="space-y-3">
            {[
              { label: 'P1 — Critical', count: current.p1_count,    color: 'bg-red-400',    warn: current.p1_rate > 15 },
              { label: 'P2 — High',     count: current.p2_count,    color: 'bg-orange-400', warn: false },
              { label: 'Critical sev.', count: current.critical_count, color: 'bg-red-300',  warn: false },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.color}`} />
                <span className="text-xs text-black/60 flex-1">{m.label}</span>
                <span className={`text-sm font-black tabular-nums ${m.warn ? 'text-red-600' : ''}`} style={HEADING}>{m.count}</span>
                {m.warn && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" strokeWidth={2} />}
              </div>
            ))}
          </div>
          {current.p1_rate > 15 && (
            <p className="text-xs text-red-600 mt-4 leading-relaxed border-t border-red-100 pt-3">
              P1 concentration is high ({current.p1_rate}%). Consider reviewing whether all P1 labels are warranted.
            </p>
          )}
        </div>

        {/* Ticket quality */}
        <div className="border border-gray-200 p-6">
          <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-4" style={MONO}>Ticket quality</p>
          <div className="space-y-4">
            <MetricBar label="Quality flag rate"  value={current.quality_flag_rate} warnThreshold={40} />
            <MetricBar label="Missing repro steps" value={missingReproPct}           warnThreshold={30} />
            <MetricBar label="Noise rate (dupes + over-pri)" value={current.noise_rate} warnThreshold={20} />
          </div>
          <div className={`flex items-center gap-2 mt-5 pt-4 border-t border-gray-100`}>
            {wellWrittenPct >= 60
              ? <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" strokeWidth={2} />
              : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" strokeWidth={2} />
            }
            <span className="text-xs text-black/60">
              <span className="font-semibold">{wellWrittenPct}%</span> of tickets are well-written
            </span>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      {chartData.length >= 2 && (
        <div className="border border-gray-200 px-6 pt-6 pb-4 mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-black/35 mb-5" style={MONO}>Health score over time</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.35)', fontFamily: 'IBM Plex Mono, monospace' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.35)', fontFamily: 'IBM Plex Mono, monospace' }} axisLine={false} tickLine={false} />
              <ReferenceLine y={70} stroke="#16a34a" strokeDasharray="4 4" strokeWidth={1} />
              <ReferenceLine y={40} stroke="#d97706" strokeDasharray="4 4" strokeWidth={1} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone" dataKey="score"
                stroke={current.score >= 70 ? '#15803d' : current.score >= 40 ? '#b45309' : '#b91c1c'}
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-xs text-black/40" style={MONO}>
              <div className="w-6 border-t-2 border-dashed border-green-500" />
              Healthy (70+)
            </div>
            <div className="flex items-center gap-1.5 text-xs text-black/40" style={MONO}>
              <div className="w-6 border-t-2 border-dashed border-amber-500" />
              Needs attention (40+)
            </div>
          </div>
        </div>
      )}

      {/* Learned patterns */}
      {calibration && calibration.verdict_count >= 30 ? (
        <div className="border border-gray-200">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <Brain className="w-4 h-4 text-black/40" strokeWidth={1.5} />
            <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={MONO}>Learned patterns</p>
            <span className="ml-auto text-xs font-mono text-black/30 tabular-nums" style={MONO}>{calibration.verdict_count} verdicts</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

            {/* Approval rates */}
            <div className="px-6 py-5">
              <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-3" style={MONO}>Acceptance by priority</p>
              <div className="space-y-2.5">
                {(['P1','P2','P3','P4'] as const).map(p => {
                  const r = calibration.signal.approval_rates[p]
                  if (!r || r.total === 0) return null
                  const barColor = r.approval_pct >= 70 ? 'bg-green-400' : r.approval_pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                  return (
                    <div key={p}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-black/60" style={MONO}>{p}</span>
                        <span className="text-xs font-mono tabular-nums text-black/60" style={MONO}>{r.approval_pct}% · {r.total} bugs</span>
                      </div>
                      <div className="w-full h-1 bg-gray-100">
                        <div className={`h-full ${barColor}`} style={{ width: `${r.approval_pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top rejection reasons + gap flags */}
            <div className="px-6 py-5">
              <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-3" style={MONO}>Top rejection reasons</p>
              {calibration.signal.top_rejection_reasons.length > 0 ? (
                <div className="space-y-1.5">
                  {calibration.signal.top_rejection_reasons.map(r => (
                    <div key={r.reason} className="flex items-center justify-between">
                      <span className="text-xs text-black/60 truncate mr-2">{r.reason}</span>
                      <span className="text-xs font-mono tabular-nums text-black/40 flex-shrink-0" style={MONO}>{r.count}×</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-black/30">No rejections yet.</p>
              )}

              {calibration.signal.gap_flag_rejection_rates.length > 0 && (
                <>
                  <p className="text-xs font-mono uppercase tracking-widest text-black/30 mt-5 mb-3" style={MONO}>Flag → rejection rate</p>
                  <div className="space-y-1.5">
                    {calibration.signal.gap_flag_rejection_rates.map(f => (
                      <div key={f.flag} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-black/60 truncate">{f.flag}</span>
                        <span className={`text-xs font-mono tabular-nums flex-shrink-0 ${f.rejection_pct >= 70 ? 'text-red-600' : 'text-black/40'}`} style={MONO}>{f.rejection_pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Generated plain-English summary */}
            <div className="px-6 py-5">
              <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-3" style={MONO}>Applied to future rankings</p>
              <p className="text-xs text-black/50 leading-relaxed whitespace-pre-line">{calibration.prompt_injection}</p>
              <p className="text-[10px] font-mono text-black/25 mt-4" style={MONO}>
                Last updated {new Date(calibration.computed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-gray-100 bg-gray-50 px-6 py-6">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-black/20" strokeWidth={1.5} />
            <p className="text-xs font-mono uppercase tracking-widest text-black/25" style={MONO}>Learned patterns</p>
          </div>
          <p className="text-sm text-black/35 mb-4">
            After 30 verdicts, SenseBug learns your prioritisation judgment and automatically adjusts future AI rankings to match — no configuration needed.
          </p>
          {calibration !== null && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-black/40" style={MONO}>Progress to AI learning</span>
                <span className="text-xs font-mono font-semibold text-black/60 tabular-nums" style={MONO}>
                  {calibration.verdict_count} / 30
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 overflow-hidden mb-1.5">
                <div
                  className="h-full bg-black transition-all duration-500"
                  style={{ width: `${Math.min(100, (calibration.verdict_count / 30) * 100)}%` }}
                />
              </div>
              <p className="text-xs font-mono text-black/30" style={MONO}>
                {30 - calibration.verdict_count} more verdict{30 - calibration.verdict_count !== 1 ? 's' : ''} until SenseBug learns your style
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2, TrendingUp, TrendingDown, AlertTriangle, Check, Edit2, X } from 'lucide-react'

const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

// ── Sample input bugs (as reporters filed them) ──────────────────────────────

const INPUT_BUGS = [
  { id: 'BUG-042', title: 'Checkout fails on mobile Safari',              rp: 'P3' },
  { id: 'BUG-038', title: 'Login loop on password reset',                 rp: 'P2' },
  { id: 'BUG-019', title: 'Dashboard charts take 8 seconds to load',      rp: 'P1' },
  { id: 'BUG-031', title: 'CSV export missing columns',                   rp: 'P3' },
  { id: 'BUG-027', title: 'Team invite link not working',                 rp: 'P2' },
  { id: 'BUG-007', title: 'Button colour slightly off-brand on settings', rp: 'P1' },
  { id: 'BUG-011', title: 'Notification emails show wrong sender name',   rp: 'P1' },
  { id: 'BUG-003', title: 'Update company logo on the login page',        rp: 'P2' },
]

// ── Pre-crafted triage results ───────────────────────────────────────────────

type DemoBug = {
  rank: number
  bug_id: string
  title: string
  priority: string
  severity: string
  reporter_priority: string
  gap_flags: string[]
  business_impact: string
  quick_reason: string
  rationale: string
  improved_description?: string
}

const RESULTS: DemoBug[] = [
  {
    rank: 1, bug_id: 'BUG-042',
    title: 'Checkout fails on mobile Safari — users cannot complete purchase',
    priority: 'P1', severity: 'Critical', reporter_priority: 'P3',
    gap_flags: [],
    business_impact: 'Mobile Safari drives ~38% of ecommerce traffic in your target market. Every hour this is unresolved, purchases fail with no recovery path — revenue is lost, not delayed. This is your highest-impact open bug.',
    quick_reason: 'Blocks revenue on the highest-traffic mobile browser. No workaround — users cannot complete purchase.',
    rationale: 'Reporter filed as P3, significantly under-prioritising a Critical issue. Checkout is a terminal revenue flow. Mobile Safari represents ~38% of mobile traffic — every hour this persists, orders are lost with no recovery path. Elevated to P1/Critical.',
  },
  {
    rank: 2, bug_id: 'BUG-038',
    title: 'Login loop on password reset — users locked out of accounts',
    priority: 'P1', severity: 'High', reporter_priority: 'P2',
    gap_flags: [],
    business_impact: 'Users who can\'t reset their password churn silently — they don\'t get a second chance to log in. Expect rising support ticket volume and cancellations until this is resolved.',
    quick_reason: 'Auth failure locking users out. Directly impacts retention and support load.',
    rationale: 'Authentication is a critical flow. A login loop permanently blocks users from the product until they contact support — driving churn and ticket volume simultaneously. Elevated from P2 to P1.',
  },
  {
    rank: 3, bug_id: 'BUG-031',
    title: 'CSV export missing columns — data incomplete on download',
    priority: 'P2', severity: 'Medium', reporter_priority: 'P3',
    gap_flags: ['Missing repro steps'],
    business_impact: 'Paying users relying on exports for reporting or downstream integrations receive incomplete records. Risk of business decisions being made on partial data — a data trust issue, not just a UX one.',
    quick_reason: 'Data integrity issue affecting downstream workflows. No workaround for users relying on exported data.',
    rationale: 'Export is part of a critical data flow for paying users. Missing columns means reporting and integration workflows that depend on this data are silently broken. Raised from P3 to P2.',
    improved_description: 'Steps to reproduce:\n1. Log in and navigate to the backlog.\n2. Click Export → CSV.\n3. Open the downloaded file in a spreadsheet tool.\n\nExpected: All columns present (id, title, priority, severity, status, assignee).\nActual: [SPECIFY WHICH COLUMNS ARE MISSING].\n\nImpact: Users relying on exports for reporting or automation receive incomplete records. Frequency: every export.',
  },
  {
    rank: 4, bug_id: 'BUG-019',
    title: 'Dashboard charts take 8 seconds to load on initial render',
    priority: 'P3', severity: 'Medium', reporter_priority: 'P1',
    gap_flags: ['Likely over-prioritised'],
    business_impact: 'Users are frustrated but not blocked — they can still access their data after the delay. Lower business impact than a functional failure. A performance improvement, not a revenue risk.',
    quick_reason: 'Performance issue — slow but functional. No user is blocked from their data.',
    rationale: 'Reporter filed as P1 but charts still render and users can access their data after the delay. This is a performance improvement, not a functional failure. Users have a workaround (waiting). De-prioritised from P1 to P3.',
  },
  {
    rank: 5, bug_id: 'BUG-027',
    title: 'Team invite link not working — onboarding new members fails',
    priority: 'P3', severity: 'Medium', reporter_priority: 'P2',
    gap_flags: ['Missing repro steps'],
    business_impact: 'New team member onboarding is blocked, but all existing users are unaffected. Impacts account expansion, not core functionality. Fix soon — but this is not an emergency.',
    quick_reason: 'Collaboration flow affected. Existing users are unaffected — only new member onboarding is blocked.',
    rationale: 'Invite link failure affects account expansion but not existing user functionality. No active users are blocked from the product. P3 is appropriate — should be fixed soon but is not an emergency.',
    improved_description: 'Steps to reproduce:\n1. Go to Settings → Team.\n2. Enter a new team member\'s email address.\n3. Click "Send Invite".\n\nExpected: Invitation email received within 2 minutes.\nActual: No email sent, no error message displayed.\n\nWorkaround: None. Affected users: any account attempting to add team members.',
  },
  {
    rank: 6, bug_id: 'BUG-011',
    title: 'Notification emails show wrong sender name',
    priority: 'P4', severity: 'Low', reporter_priority: 'P1',
    gap_flags: ['Likely over-prioritised'],
    business_impact: 'No user workflow is affected — emails arrive and are fully actionable. This is a brand inconsistency. Zero functional impact on product usage or revenue.',
    quick_reason: 'Cosmetic — emails still arrive and are fully actionable. Significantly over-prioritised.',
    rationale: 'Reporter filed as P1. No user workflow is broken — emails deliver correctly, content is accurate, and users can act on them. This is a branding inconsistency. Over-prioritisation likely reflects reporter frustration rather than actual severity. Ranked P4.',
  },
  {
    rank: 7, bug_id: 'BUG-007',
    title: 'Button colour slightly off-brand on settings page',
    priority: 'P4', severity: 'Low', reporter_priority: 'P1',
    gap_flags: ['Likely over-prioritised'],
    business_impact: 'Zero functional impact. Users complete all settings tasks as normal. Pure visual inconsistency — no user is confused or blocked by this.',
    quick_reason: 'Visual inconsistency only. All settings page functions work correctly.',
    rationale: 'Classic reporter bias — cosmetic issues are easy to spot and often filed as urgent because they\'re visible. Users can complete all tasks on the settings page. Ranked P4. Should be batched with other UI polish work.',
  },
  {
    rank: 8, bug_id: 'BUG-003',
    title: 'Update company logo on the login page',
    priority: 'P4', severity: 'Low', reporter_priority: 'P2',
    gap_flags: ['Likely over-prioritised', 'Missing description'],
    business_impact: 'No user is impacted. This is a cosmetic update — no workflow is broken and no user is confused. Better tracked as a design task than a bug.',
    quick_reason: 'This is a cosmetic task, not a bug. No user is impacted and no flow is broken.',
    rationale: 'Incorrectly filed as a bug — no workflow is broken, no user is blocked. Ticket also lacks a description, making it unclear what specifically needs to change. P4 at best; better tracked as a task.',
  },
]

// ── Badge components (match the real app) ────────────────────────────────────

function PriorityBadge({ p }: { p: string }) {
  const cls: Record<string, string> = {
    P1: 'bg-red-50 text-red-600 border-red-200',
    P2: 'bg-orange-50 text-orange-600 border-orange-200',
    P3: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    P4: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <span className={`border px-1.5 py-0.5 text-[10px] font-mono uppercase flex-shrink-0 ${cls[p] ?? 'bg-gray-50 text-black/50 border-gray-200'}`} style={MONO}>
      {p}
    </span>
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
    <span className={`border px-1.5 py-0.5 text-[10px] font-mono flex-shrink-0 ${cls[s] ?? 'bg-gray-50 text-black/50 border-gray-200'}`} style={MONO}>
      {s}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'results'

function pRank(p: string) { return parseInt(p[1]) }

export function LandingDemo() {
  const [phase, setPhase]       = useState<Phase>('idle')
  const [selected, setSelected] = useState<DemoBug>(RESULTS[0])
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  function runTriage() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('loading')
    timerRef.current = setTimeout(() => {
      setPhase('results')
      setSelected(RESULTS[0])
    }, 1800)
  }

  return (
    <section className="px-6 md:px-12 lg:px-24 py-20 border-b border-gray-200 bg-gray-50">
      <div className="max-w-5xl mx-auto">

        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={MONO}>
          Try it — no sign-up needed
        </p>
        <h2 className="text-4xl font-black tracking-tighter mb-3" style={HEADING}>
          See it on a real backlog.
        </h2>
        <p className="text-base text-black/45 mb-10">
          8 bugs, reporter priorities. One click to see how the AI re-ranks them — with business impact analysis, rationale, and gap flags for every ticket.
        </p>

        {/* ── Input / Loading view ─────────────────────────────────────────── */}
        {phase !== 'results' && (
          <div className="border border-gray-200 bg-white">
            <div className="flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <span className="text-[10px] font-mono uppercase tracking-widest text-black/30 w-[72px] flex-shrink-0" style={MONO}>Bug ID</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-black/30 flex-1" style={MONO}>Title</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-black/30 flex-shrink-0" style={MONO}>Reporter priority</span>
            </div>

            {INPUT_BUGS.map((bug) => (
              <div
                key={bug.id}
                className={`flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0 ${phase === 'loading' ? 'animate-pulse' : ''}`}
              >
                <span className="text-xs font-mono text-black/30 w-[72px] flex-shrink-0" style={MONO}>{bug.id}</span>
                <span className="text-sm text-black/65 flex-1 truncate">{bug.title}</span>
                <PriorityBadge p={bug.rp} />
              </div>
            ))}

            <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
              {phase === 'idle' ? (
                <>
                  <p className="text-xs text-black/30" style={MONO}>8 bugs · reporter priorities only</p>
                  <button
                    onClick={runTriage}
                    className="bg-black text-white px-6 py-2.5 text-sm font-semibold flex items-center gap-2 hover:bg-black/90 transition-colors duration-150"
                    style={HEADING}
                  >
                    Run triage <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-black/40 flex items-center gap-2" style={MONO}>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analysing 8 bugs against product context…
                  </p>
                  <div className="bg-black/[0.06] text-black/25 px-6 py-2.5 text-sm font-semibold flex items-center gap-2 cursor-not-allowed" style={HEADING}>
                    Run triage <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Results view ─────────────────────────────────────────────────── */}
        {phase === 'results' && (
          <>
            {/* Stats bar */}
            <div className="flex items-center gap-x-5 gap-y-2 flex-wrap mb-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/35" style={MONO}>2 P1s</span>
                <span className="font-semibold text-red-500 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />1 escalated from P3</span>
              </div>
              <span className="text-black/15 hidden sm:block">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/35" style={MONO}>4 over-prioritised</span>
                <span className="font-semibold text-green-700 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />caught</span>
              </div>
              <span className="text-black/15 hidden sm:block">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/35" style={MONO}>2 rewrites ready</span>
                <span className="text-black/40">tickets improved by AI</span>
              </div>
              <span className="text-black/15 hidden sm:block">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-black/35" style={MONO}>Business impact</span>
                <span className="text-black/40">on every ticket</span>
              </div>
            </div>

            <div className="border border-gray-200 bg-white flex flex-col md:flex-row">

              {/* Bug list */}
              <div className="md:w-[48%] flex-shrink-0 md:border-r border-b md:border-b-0 border-gray-200 max-h-[500px] overflow-y-auto">
                {RESULTS.map((bug) => {
                  const isSelected  = selected.bug_id === bug.bug_id
                  const escalated   = pRank(bug.priority) < pRank(bug.reporter_priority)
                  const deescalated = pRank(bug.priority) > pRank(bug.reporter_priority)
                  const overPri     = bug.gap_flags.includes('Likely over-prioritised')
                  const hasRewrite  = !!bug.improved_description

                  return (
                    <div
                      key={bug.bug_id}
                      onClick={() => setSelected(bug)}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer transition-colors duration-100 ${
                        isSelected ? 'bg-gray-50 border-l-2 border-l-black' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-black/25 w-4 flex-shrink-0 tabular-nums" style={MONO}>{bug.rank}</span>
                      <PriorityBadge p={bug.priority} />
                      <span className="text-sm text-black/70 flex-1 min-w-0 truncate">{bug.title}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {escalated   && <TrendingUp   className="w-3 h-3 text-red-400"    />}
                        {deescalated && <TrendingDown  className="w-3 h-3 text-green-600"  />}
                        {overPri     && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
                        {hasRewrite  && <span className="text-[8px] font-mono border border-purple-200 bg-purple-50 text-purple-600 px-1" style={MONO}>AI rewrite</span>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Detail panel */}
              <div className="flex-1 flex flex-col overflow-y-auto max-h-[500px]">
                <div className="p-5 flex flex-col gap-4 flex-1">

                  {/* Title */}
                  <div>
                    <p className="text-[10px] font-mono text-black/30 mb-1" style={MONO}>{selected.bug_id}</p>
                    <p className="text-sm font-semibold text-black leading-snug" style={HEADING}>{selected.title}</p>
                  </div>

                  {/* AI vs Reporter */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-black/30" style={MONO}>AI</span>
                      <PriorityBadge p={selected.priority} />
                      <SeverityBadge s={selected.severity} />
                    </div>
                    <span className="text-black/20 text-xs">vs</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-black/30" style={MONO}>Reporter</span>
                      <PriorityBadge p={selected.reporter_priority} />
                    </div>
                  </div>

                  {/* Business impact */}
                  <div className="bg-gray-50 border border-gray-100 px-3 py-2.5">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-1" style={MONO}>Business impact</p>
                    <p className="text-xs text-black/65 leading-relaxed">{selected.business_impact}</p>
                  </div>

                  {/* Why this rank */}
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-1.5" style={MONO}>Why this rank</p>
                    <p className="text-xs text-black/55 leading-relaxed">{selected.quick_reason}</p>
                  </div>

                  {/* Full rationale */}
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-1.5" style={MONO}>Full rationale</p>
                    <p className="text-xs text-black/45 leading-relaxed">{selected.rationale}</p>
                  </div>

                  {/* Gap flags */}
                  {selected.gap_flags.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-black/30 mb-1.5" style={MONO}>Gap flags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.gap_flags.map((f) => (
                          <span key={f} className="text-[10px] font-mono border border-yellow-200 bg-yellow-50 text-yellow-700 px-2 py-0.5" style={MONO}>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI ticket rewrite */}
                  {selected.improved_description && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-purple-400 mb-1.5" style={MONO}>AI-improved description</p>
                      <pre className="text-[10px] text-black/50 leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 border border-gray-100 px-3 py-2.5" style={MONO}>
                        {selected.improved_description}
                      </pre>
                    </div>
                  )}
                </div>

                {/* PM verdict — sticky at bottom */}
                <div className="border-t border-gray-100 px-5 py-3.5 flex-shrink-0 bg-white">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-black/25 mb-2" style={MONO}>PM verdict</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href="/signup"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-green-200 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      <Check className="w-3 h-3" strokeWidth={2.5} /> Approve
                    </Link>
                    <Link
                      href="/signup"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" strokeWidth={2} /> Adjust priority
                    </Link>
                    <Link
                      href="/signup"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-gray-50 text-black/40 text-xs font-medium hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-3 h-3" strokeWidth={2} /> Reject
                    </Link>
                    <span className="text-[10px] text-black/25 ml-1" style={MONO}>sign up to review →</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA row */}
            <div className="mt-6 flex items-center gap-4 flex-wrap">
              <Link
                href="/signup"
                className="bg-black text-white px-8 py-3.5 font-semibold text-sm flex items-center gap-2 hover:bg-black/90 transition-colors duration-150"
                style={HEADING}
              >
                Analyse my real backlog — free <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setPhase('idle')}
                className="text-sm text-black/35 hover:text-black transition-colors duration-150"
                style={MONO}
              >
                ↺ Run again
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

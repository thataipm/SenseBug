export const metadata = {
  title: 'Changelog — SenseBug',
  robots: {
    index: false,
    follow: false,
  },
}

const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

const ENTRIES = [
  {
    date: 'May 2026',
    tag: 'New feature',
    tagColor: 'bg-black text-white',
    title: 'Backlog re-ranking — Jira and CSV bugs now share one ordered list',
    body: [
      'If you use both the Jira integration and CSV uploads, bugs from each source previously had no way to rank against each other. Jira bugs landed at the bottom of their priority bucket regardless of severity or quality — making it impossible to tell which of your 15 P1s was the real top priority.',
      'Re-ranking fixes that. Every triaged bug — regardless of how it arrived — is now scored on four signals: priority tier, severity, ticket quality (gap flags), and whether you\'ve already approved the AI\'s verdict. Bugs are then assigned a global rank 1-N so your backlog list produces a single, defensible order within each priority bucket.',
    ],
    details: [
      'Automatic: the Jira sync cron re-ranks your backlog whenever new tickets are triaged — no action needed.',
      'Manual: use the Re-rank button in the backlog header to force an immediate re-score at any time.',
      'PM edits respected: if you\'ve overridden a priority, the re-ranker uses your call, not the AI\'s original verdict.',
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <header className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between">
        <a href="/" className="font-black text-lg tracking-tight" style={HEADING}>SENSEBUG</a>
        <a href="/dashboard" className="text-sm text-black/50 hover:text-black transition-colors duration-150">Dashboard →</a>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-20">
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={MONO}>Changelog</p>
        <h1 className="text-4xl font-black tracking-tighter mb-3" style={HEADING}>What&apos;s new</h1>
        <p className="text-sm text-black/50 mb-16">Product updates, fixes, and improvements.</p>

        <div className="space-y-16">
          {ENTRIES.map((entry, i) => (
            <div key={i} className="border-t border-gray-200 pt-10">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-xs font-mono text-black/35 tabular-nums" style={MONO}>{entry.date}</span>
                <span className={`text-xs font-mono px-2 py-0.5 ${entry.tagColor}`} style={MONO}>{entry.tag}</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight mb-5 leading-snug" style={HEADING}>{entry.title}</h2>
              <div className="space-y-3 mb-6">
                {entry.body.map((p, j) => (
                  <p key={j} className="text-sm text-black/60 leading-relaxed">{p}</p>
                ))}
              </div>
              <ul className="space-y-2">
                {entry.details.map((d, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <span className="text-black/25 mt-0.5 flex-shrink-0">—</span>
                    <span className="text-sm text-black/55 leading-relaxed">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

// Shared left-panel shown on the login and signup pages.
// Both pages are identical except for the footer tagline.

interface AuthPreviewPanelProps {
  /** One-liner shown at the very bottom of the panel */
  footerTagline?: string
}

export default function AuthPreviewPanel({ footerTagline = 'Make sense of your bugs.' }: AuthPreviewPanelProps) {
  return (
    <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-black flex-col justify-between p-12">
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 40% 60%, rgba(255,255,255,0.04) 0%, transparent 70%)' }}
      />

      {/* Wordmark */}
      <div className="relative z-10">
        <div
          className="font-black text-xl text-white tracking-tight"
          style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
        >
          SENSEBUG AI
        </div>
      </div>

      {/* Product mockup */}
      <div className="relative z-10">
        <p
          className="text-xs font-mono uppercase tracking-widest text-white/30 mb-5"
          style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
        >
          AI-ranked results
        </p>

        <div className="space-y-2 mb-8">
          {/* Bug 1 — promoted P3→P1 */}
          <div
            className="border border-white/10 bg-white/[0.05] px-4 py-3 animate-slide-up"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="text-xs text-white/30 font-mono mb-0.5"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  BUG-091
                </div>
                <div className="text-sm text-white/90">Checkout fails on iOS 17+</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                <span
                  className="text-xs text-white/20 line-through font-mono"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  P3
                </span>
                <span
                  className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 font-mono"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  P1
                </span>
              </div>
            </div>
          </div>

          {/* Bug 2 — stays P2 */}
          <div
            className="border border-white/10 bg-white/[0.05] px-4 py-3 animate-slide-up"
            style={{ animationDelay: '0.25s' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="text-xs text-white/30 font-mono mb-0.5"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  BUG-047
                </div>
                <div className="text-sm text-white/90">Payment webhook timeout</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                <span
                  className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 font-mono"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  P2
                </span>
              </div>
            </div>
          </div>

          {/* Bug 3 — over-prioritised P1→P4 */}
          <div
            className="border border-white/[0.07] bg-white/[0.03] px-4 py-3 opacity-70 animate-slide-up"
            style={{ animationDelay: '0.4s' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="text-xs text-white/30 font-mono mb-0.5"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  BUG-023
                </div>
                <div className="text-sm text-white/70 flex items-center gap-1.5">
                  <span className="text-purple-400 text-xs">⚑</span>
                  Dashboard widget alignment
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                <span
                  className="text-xs text-white/20 line-through font-mono"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  P1
                </span>
                <span
                  className="text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 font-mono"
                  style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}
                >
                  P4
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6">
          <p
            className="text-xl font-black text-white tracking-tight mb-2"
            style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
          >
            Fix what actually matters.
          </p>
          <p className="text-sm text-white/40 leading-relaxed">
            AI strips reporter bias and re-ranks your backlog by real business impact.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10">
        <p className="text-xs text-white/25">{footerTagline}</p>
      </div>
    </div>
  )
}

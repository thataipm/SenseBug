import Link from 'next/link'
import { Check } from 'lucide-react'
import PricingNav from './PricingNav'

export const metadata = {
  title: 'Pricing — SenseBug',
  description: 'One plan, everything included. $29/mo with a 14-day free trial — no credit card required. Live Jira integration, continuous re-ranking, AI calibration, and a written rationale for every bug.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'Pricing — SenseBug',
    description: 'One plan, everything included. $29/mo, 14-day free trial, no credit card. Live Jira integration, continuous re-ranking, AI calibration.',
    url: 'https://www.sensebug.com/pricing',
    siteName: 'SenseBug',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing — SenseBug',
    description: 'One plan, everything included. $29/mo, 14-day free trial, no credit card.',
  },
}

// The complete feature set, grouped. With a single plan there's nothing to
// compare — this showcase IS the value story, shown once and proudly.
const FEATURE_GROUPS: { heading: string; items: string[] }[] = [
  {
    heading: 'Analysis',
    items: [
      'AI priority & severity on every bug',
      'Business-impact scoring',
      'Written rationale for every call',
      'Reporter-bias removal',
      'Duplicate detection',
      'Over-prioritised bug flagging',
      'AI-suggested ticket rewrites',
    ],
  },
  {
    heading: 'Workflow',
    items: [
      'Persistent bug backlog',
      'Automatic re-ranking on every new bug',
      'Approve, adjust & reject verdicts',
      'Instant P1 & Critical alerts',
      'Weekly backlog summary email',
      'Backlog health score & trends',
      'CSV export of results',
    ],
  },
  {
    heading: 'Integration & intelligence',
    items: [
      'Live Jira integration (webhook-driven)',
      'Priority write-back to Jira on approval',
      'AI summary comment posted to tickets',
      'Knowledge Base + document uploads (RAG)',
      'AI calibration — learns your team',
      'CSV upload from any tracker',
    ],
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* Nav — auth-aware client component */}
      <PricingNav />

      {/* Hero */}
      <section className="px-6 md:px-12 lg:px-24 pt-20 pb-10 text-center">
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
          Pricing
        </p>
        <h1 className="text-5xl font-black tracking-tighter mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
          One plan.<br />Everything included.
        </h1>
        <p className="text-base text-black/45">No tiers to decode, no feature gates. Start free for 14 days.</p>
      </section>

      <section className="px-6 md:px-12 lg:px-24 pb-24">
        <div className="max-w-3xl mx-auto">

          {/* ── The single plan card ── */}
          <div className="border border-black bg-black text-white p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-3" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                SenseBug Pro
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-black" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>$29</span>
                <span className="text-lg font-normal text-white/50">/month</span>
              </div>
              <p className="text-sm text-white/55 leading-relaxed max-w-sm">
                The complete product — live Jira integration, continuous re-ranking, AI calibration, and a written rationale for every bug.
              </p>
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-2 flex-shrink-0">
              <Link
                href="/signup?plan=pro"
                data-testid="pricing-pro-btn"
                className="block text-center bg-white text-black px-8 py-3.5 text-sm font-semibold hover:bg-white/90 transition-colors duration-150 whitespace-nowrap"
              >
                Start 14-day free trial
              </Link>
              <p className="text-xs text-white/35 text-center md:text-right">No credit card required</p>
            </div>
          </div>

          {/* ── Everything included ── */}
          <div className="border border-gray-200 bg-white">
            <div className="px-6 md:px-8 py-5 border-b border-gray-100">
              <p className="text-xs font-mono uppercase tracking-widest text-black/40" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                Everything included
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {FEATURE_GROUPS.map((group) => (
                <div key={group.heading} className="p-6 md:p-8">
                  <p className="text-sm font-bold text-black mb-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                    {group.heading}
                  </p>
                  <ul className="space-y-2.5">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-black/60 leading-snug">
                        <Check className="w-3.5 h-3.5 text-black/40 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Fair-use note */}
          <p className="text-center text-xs text-black/35 mt-6 leading-relaxed">
            Fair-use cap on monthly analysis volume — set high enough you&apos;ll rarely notice it.
            Running a larger operation or multiple teams?{' '}
            <a href="mailto:contact@sensebug.com" className="text-black/55 underline hover:text-black transition-colors">Talk to us</a>.
          </p>

          {/* Secondary CTA */}
          <div className="text-center mt-10">
            <Link
              href="/signup?plan=pro"
              className="inline-block bg-black text-white px-8 py-3.5 text-sm font-semibold hover:bg-black/85 transition-colors duration-150"
            >
              Start your free trial
            </Link>
            <p className="text-xs text-black/35 mt-2.5">14 days free · no credit card · cancel anytime</p>
          </div>

          {/* FAQ teaser */}
          <p className="text-center text-sm text-black/40 mt-12">
            Questions?{' '}
            <Link href="/#faq" className="text-black underline hover:no-underline">See the FAQ</Link>
            {' '}or{' '}
            <Link href="/support" className="text-black underline hover:no-underline">contact support</Link>.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-black/35">
        <Link href="/" className="font-black text-sm tracking-tight text-black" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG</Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <Link href="/support" className="hover:text-black transition-colors">Support</Link>
          <Link href="/privacy" className="hover:text-black transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-black transition-colors">Terms</Link>
        </div>
        <span>© 2026 SenseBug</span>
      </footer>
    </div>
  )
}

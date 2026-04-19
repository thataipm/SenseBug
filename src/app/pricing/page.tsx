import Link from 'next/link'
import { Check } from 'lucide-react'

const tiers = [
  {
    key: 'starter',
    name: 'Starter',
    price: 'Free',
    sub: 'Forever',
    cta: 'Get started free',
    ctaHref: '/signup',
    highlight: false,
    features: [
      '3 triage runs per month',
      'Up to 20 bugs per run',
      'AI-powered priority ranking',
      'Approve / reject / edit verdicts',
      'Download ranked CSV',
      'Basic Knowledge Base',
    ],
    missing: ['Doc uploads', 'Priority support'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$49',
    sub: 'per month',
    cta: 'Get started',
    ctaHref: '/signup',
    highlight: true,
    badge: 'Most popular',
    features: [
      'Unlimited triage runs',
      'Up to 100 bugs per run',
      'AI-powered priority ranking',
      'Approve / reject / edit verdicts',
      'Download ranked CSV',
      'Full Knowledge Base (text + docs)',
      'PDF / .txt / .md doc uploads',
      'Vector-search KB context',
    ],
    missing: [],
  },
  {
    key: 'team',
    name: 'Team',
    price: '$199',
    sub: 'per month',
    cta: 'Contact sales',
    ctaHref: 'mailto:contact@sensebug.com',
    highlight: false,
    features: [
      'Everything in Pro',
      'Up to 250 bugs per run',
      'Shared team Knowledge Base',
      'Multi-seat access',
      'Priority support',
      'Custom integrations',
    ],
    missing: [],
  },
]

const comparisonRows = [
  { label: 'Runs per month', starter: '3', pro: 'Unlimited', team: 'Unlimited' },
  { label: 'Bugs per run', starter: '20', pro: '100', team: '250' },
  { label: 'AI ranking', starter: true, pro: true, team: true },
  { label: 'KB text fields', starter: true, pro: true, team: true },
  { label: 'Doc uploads (PDF, .md)', starter: false, pro: true, team: true },
  { label: 'Vector search context', starter: false, pro: true, team: true },
  { label: 'Shared team KB', starter: false, pro: false, team: true },
  { label: 'Priority support', starter: false, pro: false, team: true },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      {/* Header */}
      <header className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between">
        <Link href="/" className="font-black text-lg tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG</Link>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm text-black/55 hover:text-black transition-colors duration-150">Sign in</Link>
          <Link href="/signup" className="bg-black text-white text-sm font-semibold px-4 py-2 hover:bg-black/85 transition-colors duration-150">Start free</Link>
        </div>
      </header>

      <main className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Pricing</p>
          <h1 className="text-5xl font-black tracking-tighter mb-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Simple, transparent pricing</h1>
          <p className="text-base text-black/55 max-w-xl mx-auto">Start free. Upgrade when you need more. No hidden fees, no per-seat surprises.</p>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {tiers.map((tier) => (
            <div
              key={tier.key}
              data-testid={`pricing-tier-${tier.key}`}
              className={`border p-8 flex flex-col relative ${tier.highlight ? 'border-black' : 'border-gray-200'}`}
            >
              {tier.badge && (
                <span className="absolute -top-3 left-6 bg-black text-white text-xs font-mono px-3 py-1 uppercase tracking-widest" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{tier.badge}</span>
              )}
              <div className="mb-6">
                <p className="text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{tier.name}</p>
                <div className="flex items-end gap-1.5">
                  <span className="text-4xl font-black tracking-tighter" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{tier.price}</span>
                  <span className="text-sm text-black/45 mb-1">{tier.sub}</span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-black/70">
                    <Check className="w-4 h-4 mt-0.5 text-black flex-shrink-0" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
                {tier.missing.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-black/30 line-through">
                    <span className="w-4 h-4 mt-0.5 flex-shrink-0 text-center leading-none">–</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                data-testid={`pricing-cta-${tier.key}`}
                className={`text-center py-3 text-sm font-semibold transition-colors duration-150 ${
                  tier.highlight
                    ? 'bg-black text-white hover:bg-black/85'
                    : 'border border-black text-black hover:bg-black hover:text-white'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-6" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Feature comparison</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-y border-gray-200">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 text-left font-mono text-xs uppercase tracking-widest text-black/40 pr-6" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Feature</th>
                  <th className="py-3 text-center font-mono text-xs uppercase tracking-widest text-black/40 px-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Starter</th>
                  <th className="py-3 text-center font-mono text-xs uppercase tracking-widest text-black px-4 bg-gray-50" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Pro</th>
                  <th className="py-3 text-center font-mono text-xs uppercase tracking-widest text-black/40 px-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Team</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-gray-100">
                    <td className="py-3 pr-6 text-black/70">{row.label}</td>
                    {(['starter', 'pro', 'team'] as const).map((tier) => (
                      <td key={tier} className={`py-3 text-center px-4 ${tier === 'pro' ? 'bg-gray-50' : ''}`}>
                        {typeof row[tier] === 'boolean'
                          ? row[tier] ? <Check className="w-4 h-4 mx-auto text-black" strokeWidth={2.5} /> : <span className="text-black/25">—</span>
                          : <span className="font-mono text-xs text-black/70" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{row[tier]}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ strip */}
        <div className="mt-20 border-t border-gray-100 pt-12 text-center">
          <p className="text-black/40 text-sm">Questions? <Link href="/help" className="text-black underline hover:no-underline">Read the FAQ</Link> or email <a href="mailto:contact@sensebug.com" className="text-black underline hover:no-underline">contact@sensebug.com</a></p>
        </div>
      </main>
    </div>
  )
}

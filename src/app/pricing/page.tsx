import Link from 'next/link'
import { Check } from 'lucide-react'
import PricingNav from './PricingNav'

export const metadata = {
  title: 'Pricing — SenseBug AI',
  description: 'Start free. Upgrade when the value is obvious. Pro at $19/mo, Max at $49/mo.',
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* Nav — auth-aware client component */}
      <PricingNav />

      {/* Hero */}
      <section className="px-6 md:px-12 lg:px-24 pt-20 pb-12 text-center">
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
          Pricing
        </p>
        <h1 className="text-5xl font-black tracking-tighter mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
          Pay for what you use.
        </h1>
        <p className="text-base text-black/45 mb-0">Start free. Upgrade when the value is obvious.</p>
      </section>

      {/* Plan cards + comparison table */}
      <section className="px-6 md:px-12 lg:px-24 pb-24">
        <div className="max-w-5xl mx-auto">

          {/* ── Plan cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 border border-gray-200 mb-0">

            {/* Starter */}
            <div className="p-8 bg-white md:border-r border-gray-200 border-b md:border-b-0 flex flex-col">
              <div className="text-xs font-mono uppercase tracking-widest text-black/40 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Starter</div>
              <div className="text-4xl font-black mb-1" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Free</div>
              <div className="text-sm text-black/45 mb-4">No credit card required</div>
              <ul className="text-xs text-black/50 space-y-2 flex-1 mb-6">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-black/40 flex-shrink-0" strokeWidth={2.5} />50 bugs / month</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-black/40 flex-shrink-0" strokeWidth={2.5} />50 bugs per run</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-black/40 flex-shrink-0" strokeWidth={2.5} />Unlimited triage runs</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-black/40 flex-shrink-0" strokeWidth={2.5} />AI ranking + business impact</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-black/40 flex-shrink-0" strokeWidth={2.5} />PM verdicts + CSV export</li>
              </ul>
              <Link href="/signup" data-testid="pricing-starter-btn" className="block text-center border border-black py-3 text-sm font-semibold hover:bg-black hover:text-white transition-colors duration-150">
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="p-8 bg-black text-white md:border-r border-gray-200 border-b md:border-b-0 flex flex-col">
              <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                Pro <span className="text-white/25 normal-case font-normal tracking-normal ml-1">— most popular</span>
              </div>
              <div className="text-4xl font-black mb-1" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                $19<span className="text-xl font-normal text-white/50">/mo</span>
              </div>
              <div className="text-sm text-white/40 mb-4">Billed monthly, cancel any time</div>
              <ul className="text-xs text-white/55 space-y-2 flex-1 mb-6">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white/50 flex-shrink-0" strokeWidth={2.5} />250 bugs / month</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white/50 flex-shrink-0" strokeWidth={2.5} />100 bugs per run</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white/50 flex-shrink-0" strokeWidth={2.5} />Everything in Starter</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white/50 flex-shrink-0" strokeWidth={2.5} />Document uploads (PDF, MD, DOCX)</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white/50 flex-shrink-0" strokeWidth={2.5} />Noticeably more accurate results</li>
                <li className="flex items-center gap-2 text-white/30"><Check className="w-3.5 h-3.5 text-white/20 flex-shrink-0" strokeWidth={2.5} />Jira integration <span className="ml-1 text-white/20">(coming soon)</span></li>
              </ul>
              <Link href="/checkout?plan=pro" data-testid="pricing-pro-btn" className="block text-center bg-white text-black py-3 text-sm font-semibold hover:bg-white/90 transition-colors duration-150">
                Get started
              </Link>
            </div>

            {/* Max */}
            <div className="p-8 bg-white flex flex-col">
              <div className="text-xs font-mono uppercase tracking-widest text-black/40 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Max</div>
              <div className="text-4xl font-black mb-1" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                $49<span className="text-xl font-normal text-black/40">/mo</span>
              </div>
              <div className="text-sm text-black/45 mb-4">Maximum capacity + integrations</div>
              <ul className="text-xs text-black/50 space-y-2 flex-1 mb-6">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-black/40 flex-shrink-0" strokeWidth={2.5} />500 bugs / month</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-black/40 flex-shrink-0" strokeWidth={2.5} />250 bugs per run</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-black/40 flex-shrink-0" strokeWidth={2.5} />Everything in Pro</li>
                <li className="flex items-center gap-2 text-black/35"><Check className="w-3.5 h-3.5 text-black/20 flex-shrink-0" strokeWidth={2.5} />Jira integration <span className="ml-1 text-black/30">(coming soon)</span></li>
              </ul>
              <Link href="/checkout?plan=max" data-testid="pricing-max-btn" className="block text-center border border-black py-3 text-sm font-semibold hover:bg-black hover:text-white transition-colors duration-150">
                Get started
              </Link>
            </div>
          </div>

          {/* ── Feature comparison table ── */}
          <div className="border border-t-0 border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-mono uppercase tracking-widest text-black/30 w-1/2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Feature</th>
                  {[
                    { name: 'Starter', sub: 'Free' },
                    { name: 'Pro', sub: '$19/mo', bold: true },
                    { name: 'Max', sub: '$49/mo' },
                  ].map(({ name, sub, bold }) => (
                    <th key={name} className={`px-6 py-4 text-center ${bold ? 'bg-black text-white' : ''}`}>
                      <div className={`text-xs font-mono uppercase tracking-widest mb-0.5 ${bold ? 'text-white/50' : 'text-black/40'}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{name}</div>
                      <div className={`text-sm font-bold ${bold ? 'text-white' : 'text-black'}`} style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{sub}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Usage */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <td colSpan={4} className="px-6 py-2 text-xs font-mono uppercase tracking-widest text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Usage</td>
                </tr>
                {[
                  { label: 'Monthly bug quota', vals: ['50 bugs', '250 bugs', '500 bugs'] },
                  { label: 'Per-run cap',        vals: ['50 / run', '100 / run', '250 / run'] },
                  { label: 'Triage runs',        vals: ['Unlimited', 'Unlimited', 'Unlimited'] },
                ].map(({ label, vals }) => (
                  <tr key={label} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 text-black/70">{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`px-6 py-3.5 text-center text-xs font-mono font-medium ${i === 1 ? 'bg-black/[0.03]' : ''}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{v}</td>
                    ))}
                  </tr>
                ))}

                {/* Analysis */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <td colSpan={4} className="px-6 py-2 text-xs font-mono uppercase tracking-widest text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Analysis</td>
                </tr>
                {[
                  { label: 'AI ranking by business impact',       vals: [true, true, true] },
                  { label: 'Reporter bias removal',               vals: [true, true, true] },
                  { label: 'Over-prioritised flags',              vals: [true, true, true] },
                  { label: 'SenseBug AI Analysis',                vals: [true, true, true] },
                  { label: 'PM verdicts (approve / edit / reject)', vals: [true, true, true] },
                  { label: 'CSV export',                          vals: [true, true, true] },
                  { label: 'Run history',                         vals: [true, true, true] },
                ].map(({ label, vals }) => (
                  <tr key={label} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 text-black/70">{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`px-6 py-3.5 text-center ${i === 1 ? 'bg-black/[0.03]' : ''}`}>
                        {v ? <Check className="w-4 h-4 text-black/50 mx-auto" strokeWidth={2.5} /> : <span className="text-black/20 text-lg leading-none">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Knowledge Base */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <td colSpan={4} className="px-6 py-2 text-xs font-mono uppercase tracking-widest text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Knowledge Base</td>
                </tr>
                {[
                  { label: 'Knowledge Base (product context)', vals: [true,  true,  true]  },
                  { label: 'Document uploads (PDF, MD)',       vals: [false, true,  true]  },
                ].map(({ label, vals }) => (
                  <tr key={label} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 text-black/70">{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`px-6 py-3.5 text-center ${i === 1 ? 'bg-black/[0.03]' : ''}`}>
                        {v ? <Check className="w-4 h-4 text-black/50 mx-auto" strokeWidth={2.5} /> : <span className="text-black/20 text-lg leading-none">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Integrations */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <td colSpan={4} className="px-6 py-2 text-xs font-mono uppercase tracking-widest text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Integrations</td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-6 py-3.5 text-black/70">Jira integration</td>
                  <td className="px-6 py-3.5 text-center"><span className="text-black/20 text-lg leading-none">—</span></td>
                  <td className="px-6 py-3.5 text-center bg-black/[0.03] text-xs font-mono text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Coming soon</td>
                  <td className="px-6 py-3.5 text-center text-xs font-mono text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Coming soon</td>
                </tr>

                {/* CTA row */}
                <tr>
                  <td className="px-6 py-5" />
                  <td className="px-6 py-5 text-center">
                    <Link href="/signup" className="inline-block border border-black px-5 py-2 text-xs font-semibold hover:bg-black hover:text-white transition-colors duration-150">
                      Get started free
                    </Link>
                  </td>
                  <td className="px-6 py-5 text-center bg-black/[0.03]">
                    <Link href="/checkout?plan=pro" className="inline-block bg-black text-white px-5 py-2 text-xs font-semibold hover:bg-black/80 transition-colors duration-150">
                      Get started
                    </Link>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <Link href="/checkout?plan=max" className="inline-block border border-black px-5 py-2 text-xs font-semibold hover:bg-black hover:text-white transition-colors duration-150">
                      Get started
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* FAQ teaser */}
          <p className="text-center text-sm text-black/40 mt-10">
            Questions?{' '}
            <Link href="/#faq" className="text-black underline hover:no-underline">See the FAQ</Link>
            {' '}or{' '}
            <Link href="/support" className="text-black underline hover:no-underline">contact support</Link>.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-black/35">
        <Link href="/" className="font-black text-sm tracking-tight text-black" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG AI</Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <Link href="/support" className="hover:text-black transition-colors">Support</Link>
          <Link href="/privacy" className="hover:text-black transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-black transition-colors">Terms</Link>
        </div>
        <span>© 2026 SenseBug AI</span>
      </footer>
    </div>
  )
}

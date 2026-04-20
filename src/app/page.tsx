'use client'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 bg-white z-50">
        <div style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }} className="font-black text-xl tracking-tight">
          SENSEBUG
        </div>
        <div className="flex items-center gap-6">
          <a href="#pricing" className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150 hidden md:block">
            Pricing
          </a>
          <a href="#faq" className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150 hidden md:block">
            FAQ
          </a>
          <Link href="/login" className="text-sm font-medium text-black/60 hover:text-black transition-colors duration-150">
            Log in
          </Link>
          <Link
            href="/signup"
            data-testid="nav-signup-btn"
            className="bg-black text-white text-sm font-semibold px-5 py-2.5 hover:bg-black/90 transition-colors duration-150"
          >
            Try free
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-24 md:py-36 border-b border-gray-200 relative overflow-hidden">
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <p className="text-sm font-mono uppercase tracking-widest text-black/55 mb-8" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            AI Bug Triage for Product Managers
          </p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mb-8" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Your bug backlog<br />is full of opinions.
          </h1>
          <p className="text-xl text-black/60 max-w-2xl mb-4 leading-relaxed">
            Every ticket was filed by someone who thinks their bug is the most important one.
            Sensebug ignores the noise and ranks by what actually matters — business impact.
          </p>
          <p className="text-base text-black/40 max-w-xl mb-12 leading-relaxed">
            Drop a CSV from Jira, Linear, or any tracker. In under a minute you&apos;ll have a ranked list with the reasoning behind every call — ready to defend in the next sprint planning.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/signup"
              data-testid="hero-signup-btn"
              className="bg-black text-white px-8 py-4 font-semibold text-sm flex items-center gap-2 hover:bg-black/90 transition-colors duration-150"
            >
              Triage my backlog — it&apos;s free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="text-sm font-medium text-black/40 hover:text-black transition-colors duration-150">
              Already have an account →
            </Link>
          </div>
        </div>
      </section>

      {/* ── The Problem ──────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-24 border-b border-gray-200 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-8" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            The problem
          </p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-10 leading-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            P1 means "I really want<br />this fixed," not "this is<br />blocking revenue."
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-gray-200">
            {[
              {
                label: '01',
                heading: 'Reporter bias is real',
                body: 'Engineers file critical. Sales escalate everything. Every reporter thinks their bug is the exception. By the time it reaches you, the priority label is political, not factual.',
              },
              {
                label: '02',
                heading: 'You re-rank manually',
                body: "So you spend an hour before every sprint rereading tickets, second-guessing labels, and negotiating with stakeholders — doing work that should take minutes.",
              },
              {
                label: '03',
                heading: 'You still get it wrong',
                body: "And when the wrong bug ships first, you find out three weeks later. By then the cost is already paid — in engineering time, in customer trust, in credibility.",
              },
            ].map((item, i) => (
              <div key={item.label} className={`p-8 bg-white ${i < 2 ? 'md:border-r border-b md:border-b-0 border-gray-200' : ''}`}>
                <div className="text-xs font-mono text-black/25 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{item.label}</div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{item.heading}</h3>
                <p className="text-sm text-black/55 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Before / After ───────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-24 border-b border-gray-200">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-8" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            Before &amp; after
          </p>
          <h2 className="text-4xl font-black tracking-tighter mb-12" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Same backlog. Different truth.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Before */}
            <div className="border border-gray-200 p-6">
              <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                Before — Reporter priorities
              </p>
              <div className="space-y-2.5">
                {[
                  { rank: '1', label: 'P1', title: 'Update our logo on login page', note: '' },
                  { rank: '2', label: 'P1', title: 'Button colour is slightly wrong', note: '' },
                  { rank: '3', label: 'P1', title: 'Dashboard loads slowly', note: '' },
                  { rank: '4', label: 'P2', title: 'Login loop on password reset', note: '' },
                  { rank: '5', label: 'P3', title: 'Checkout fails on mobile Safari', note: '' },
                ].map((item) => (
                  <div key={item.rank} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-xs font-mono text-black/25 w-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{item.rank}</span>
                    <span className="text-xs font-mono px-1.5 py-0.5 border border-red-200 text-red-600 bg-red-50" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{item.label}</span>
                    <span className="text-sm text-black/60">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* After */}
            <div className="border border-black p-6">
              <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-5" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                After — Sensebug AI ranking
              </p>
              <div className="space-y-2.5">
                {[
                  { rank: '1', label: 'P1', title: 'Checkout fails on mobile Safari', note: '', color: 'border-red-500 text-red-600 bg-red-50' },
                  { rank: '2', label: 'P1', title: 'Login loop on password reset', note: '', color: 'border-red-500 text-red-600 bg-red-50' },
                  { rank: '3', label: 'P3', title: 'Dashboard loads slowly', note: 'Workaround exists', color: 'border-yellow-400 text-yellow-700 bg-yellow-50' },
                  { rank: '4', label: 'P4', title: 'Button colour is slightly wrong', note: '⚑ Over-prioritised', color: 'border-gray-300 text-black/40 bg-gray-50' },
                  { rank: '5', label: 'P4', title: 'Update our logo on login page', note: '⚑ Over-prioritised', color: 'border-gray-300 text-black/40 bg-gray-50' },
                ].map((item) => (
                  <div key={item.rank} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-xs font-mono text-black/25 w-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{item.rank}</span>
                    <span className={`text-xs font-mono px-1.5 py-0.5 border ${item.color}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{item.label}</span>
                    <span className={`text-sm flex-1 ${item.rank === '4' || item.rank === '5' ? 'text-black/35' : ''}`}>{item.title}</span>
                    {item.note && <span className="text-xs font-mono text-purple-500 whitespace-nowrap" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{item.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-base text-black/40 mt-6 text-center">
            Same five tickets. Completely different picture. The checkout bug was always the emergency — it just wasn&apos;t the loudest voice in the room.
          </p>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-24 border-b border-gray-200 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-12" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            How it works
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 border border-gray-200">
            {[
              {
                step: '01',
                title: 'Connect your backlog',
                desc: 'Export from Jira, Linear, or any tracker as a CSV. No integrations, no IT tickets, no waiting. If it has bug IDs and titles, it works.',
              },
              {
                step: '02',
                title: 'AI strips the bias',
                desc: 'The AI reads every ticket and scores priority independently — ignoring reporter labels, scanning for escalation signals, and ranking against your product\'s critical flows.',
              },
              {
                step: '03',
                title: 'Walk in ready',
                desc: 'Ranked list, SenseBug\'s full analysis per bug, and explicit flags for over-prioritised tickets. Approve, adjust, or dismiss each verdict. Export when done.',
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className={`p-8 bg-white ${i < 2 ? 'md:border-r border-b md:border-b-0 border-gray-200' : ''}`}
              >
                <div className="text-xs font-mono text-black/25 mb-6" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{item.step}</div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{item.title}</h3>
                <p className="text-sm text-black/55 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote ────────────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-24 border-b border-gray-200">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-black tracking-tight leading-snug mb-6" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            &ldquo;The most politically useful thing it does is tell me which bugs are over-prioritised. It gives me cover to say no.&rdquo;
          </p>
          <p className="text-sm text-black/40 font-mono uppercase tracking-widest" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            — Product Manager, B2B SaaS
          </p>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 md:px-12 lg:px-24 py-24 border-b border-gray-200 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            Pricing
          </p>
          <h2 className="text-4xl font-black tracking-tighter mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Pay for what you use.
          </h2>
          <p className="text-base text-black/45 mb-12">Start free. Upgrade when the value is obvious.</p>

          {/* ── Plan cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 border border-gray-200 mb-0">
            {/* Starter */}
            <div className="p-8 bg-white md:border-r border-gray-200 border-b md:border-b-0 flex flex-col">
              <div className="text-xs font-mono uppercase tracking-widest text-black/40 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Starter</div>
              <div className="text-4xl font-black mb-1" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Free</div>
              <div className="text-sm text-black/45 mb-4">No credit card required</div>
              <p className="text-xs text-black/40 leading-relaxed flex-1">
                Enough to run triage on a real backlog and see the difference before you commit to anything.
              </p>
              <Link href="/signup" data-testid="pricing-starter-btn" className="block text-center border border-black py-3 text-sm font-semibold hover:bg-black hover:text-white transition-colors duration-150 mt-6">
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="p-8 bg-black text-white md:border-r border-gray-200 border-b md:border-b-0 flex flex-col">
              <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                Pro <span className="text-white/25 normal-case font-normal tracking-normal ml-1">— most popular</span>
              </div>
              <div className="text-4xl font-black mb-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                $19<span className="text-xl font-normal text-white/50">/mo</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed flex-1">
                Upload your product docs and specs — the AI understands your product, not just ticket text. Meaningfully more accurate results.
              </p>
              <Link href="/checkout?plan=pro" data-testid="pricing-pro-btn" className="block text-center bg-white text-black py-3 text-sm font-semibold hover:bg-white/90 transition-colors duration-150 mt-6">
                Get started
              </Link>
            </div>

            {/* Team */}
            <div className="p-8 bg-white flex flex-col">
              <div className="text-xs font-mono uppercase tracking-widest text-black/40 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Team</div>
              <div className="text-4xl font-black mb-1" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
                $49<span className="text-xl font-normal text-black/40">/mo</span>
              </div>
              <div className="text-sm text-black/45 mb-4">For PM teams</div>
              <p className="text-xs text-black/40 leading-relaxed flex-1">
                One shared Knowledge Base keeps every PM on the team working from the same product context — no more inconsistent rankings.
              </p>
              <Link href="/checkout?plan=team" data-testid="pricing-team-btn" className="block text-center border border-black py-3 text-sm font-semibold hover:bg-black hover:text-white transition-colors duration-150 mt-6">
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
                    { name: 'Team', sub: '$49/mo' },
                  ].map(({ name, sub, bold }) => (
                    <th key={name} className={`px-6 py-4 text-center ${bold ? 'bg-black text-white' : ''}`}>
                      <div className={`text-xs font-mono uppercase tracking-widest mb-0.5 ${bold ? 'text-white/50' : 'text-black/40'}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{name}</div>
                      <div className={`text-sm font-bold ${bold ? 'text-white' : 'text-black'}`} style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{sub}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ── Usage ── */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <td colSpan={4} className="px-6 py-2 text-xs font-mono uppercase tracking-widest text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Usage</td>
                </tr>
                {[
                  { label: 'Monthly bug quota',  vals: ['50 bugs', '250 bugs', '500 bugs'] },
                  { label: 'Per-run cap',         vals: ['50 / run', '100 / run', '250 / run'] },
                  { label: 'Triage runs',         vals: ['Unlimited', 'Unlimited', 'Unlimited'] },
                ].map(({ label, vals }) => (
                  <tr key={label} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 text-black/70">{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`px-6 py-3.5 text-center text-xs font-mono font-medium ${i === 1 ? 'bg-black/[0.03]' : ''}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{v}</td>
                    ))}
                  </tr>
                ))}

                {/* ── Analysis ── */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <td colSpan={4} className="px-6 py-2 text-xs font-mono uppercase tracking-widest text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Analysis</td>
                </tr>
                {[
                  { label: 'AI ranking by business impact',  vals: [true, true, true] },
                  { label: 'Reporter bias removal',          vals: [true, true, true] },
                  { label: 'Over-prioritised flags',         vals: [true, true, true] },
                  { label: 'SenseBug AI Analysis',           vals: [true, true, true] },
                  { label: 'PM verdicts (approve / edit / reject)', vals: [true, true, true] },
                  { label: 'CSV export',                     vals: [true, true, true] },
                  { label: 'Run history',                    vals: [true, true, true] },
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

                {/* ── Knowledge Base ── */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <td colSpan={4} className="px-6 py-2 text-xs font-mono uppercase tracking-widest text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Knowledge Base</td>
                </tr>
                {[
                  { label: 'Knowledge Base (product context)',  vals: [true,  true,  true]  },
                  { label: 'Document uploads (PDF, MD)',        vals: [false, true,  true]  },
                  { label: 'Shared team Knowledge Base',        vals: [false, false, true]  },
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

                {/* ── Team ── */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <td colSpan={4} className="px-6 py-2 text-xs font-mono uppercase tracking-widest text-black/35" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Team</td>
                </tr>
                {[
                  { label: 'Team members', vals: ['1', '1', 'Up to 5'] },
                ].map(({ label, vals }) => (
                  <tr key={label} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-6 py-3.5 text-black/70">{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className={`px-6 py-3.5 text-center text-xs font-mono font-medium ${i === 1 ? 'bg-black/[0.03]' : ''}`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{v}</td>
                    ))}
                  </tr>
                ))}

                {/* ── CTA row ── */}
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
                    <Link href="/checkout?plan=team" className="inline-block border border-black px-5 py-2 text-xs font-semibold hover:bg-black hover:text-white transition-colors duration-150">
                      Get started
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="px-6 md:px-12 lg:px-24 py-24 border-b border-gray-200">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            Help & FAQ
          </p>
          <h2 className="text-4xl font-black tracking-tighter mb-14" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Questions we hear a lot
          </h2>

          <div className="space-y-0 divide-y divide-gray-100">
            {[
              {
                q: 'What CSV format does Sensebug need?',
                a: 'Required columns: id (or key / issue_key), title (or summary), and priority. Optional but recommended: description, comments, reporter, labels. More context = more accurate rankings. Jira and Linear exports work out of the box.',
              },
              {
                q: 'How does the AI rank bugs without knowing my product?',
                a: 'It uses your Knowledge Base — a short description of your product, your critical user flows, and your modules. Set it up once in onboarding and every future run gets ranked against what actually matters for your business.',
              },
              {
                q: 'What does "Likely over-prioritised" mean?',
                a: "It means the AI found no business-critical evidence to justify the original priority label. Common causes: the reporter used P1 for visibility, the bug affects a non-critical flow, or a workaround exists. You can approve, override, or reject the verdict.",
              },
              {
                q: 'Is there a limit on how many bugs I can analyse?',
                a: 'Starter: 50 bugs/month (up to 50 per run). Pro: 250 bugs/month (up to 100 per run). Team: 500 bugs/month (up to 250 per run). If your CSV exceeds the per-run cap, Sensebug sorts by original priority first so your most critical bugs are always included.',
              },
              {
                q: 'What happens to my data?',
                a: 'Your CSV data and Knowledge Base are stored securely in your account and never used to train AI models. Results are private to your account. You can delete any run or your entire account at any time.',
              },
              {
                q: 'Is there a free plan?',
                a: 'Yes. The Starter plan is free forever — 3 runs per month, up to 20 bugs per run, no credit card required. Upgrade to Pro when you need more runs, larger CSVs, or Knowledge Base doc uploads.',
              },
            ].map((item, i) => (
              <div key={i} className="py-6">
                <h3 className="text-base font-bold mb-2.5" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{item.q}</h3>
                <p className="text-sm text-black/55 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 border border-gray-200 px-6 py-5 flex items-center justify-between gap-4">
            <p className="text-sm text-black/55">Still have questions?</p>
            <a
              href="mailto:contact@sensebug.com"
              className="text-sm font-semibold text-black hover:text-black/60 transition-colors duration-150 whitespace-nowrap"
            >
              Email us →
            </a>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-28 border-b border-gray-200">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-6" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            Get started
          </p>
          <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-none mb-6" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Stop guessing.<br />Start knowing.
          </h2>
          <p className="text-lg text-black/50 mb-10 leading-relaxed max-w-xl mx-auto">
            50 bugs, completely free. No credit card. Upload your backlog and see what your priorities actually look like once the opinions are stripped away.
          </p>
          <Link
            href="/signup"
            className="bg-black text-white px-10 py-4 font-semibold text-sm inline-flex items-center gap-2 hover:bg-black/90 transition-colors duration-150"
          >
            Triage my backlog — it&apos;s free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="px-6 md:px-12 lg:px-24 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="font-black text-lg tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
          SENSEBUG
        </div>
        <div className="flex items-center gap-6 text-sm text-black/35">
          <Link href="/privacy" className="hover:text-black transition-colors duration-150">Privacy</Link>
          <Link href="/terms" className="hover:text-black transition-colors duration-150">Terms</Link>
          <a href="mailto:contact@sensebug.com" className="hover:text-black transition-colors duration-150">Contact</a>
          <span>© 2026 Sensebug</span>
        </div>
        </div>
      </footer>

    </div>
  )
}

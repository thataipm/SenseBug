import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'SenseBug AI — AI Bug Backlog Intelligence for Product Managers',
  description: 'The AI layer that sits on top of Jira and makes sense of your bug backlog. Ranks every bug by business impact, learns your judgment over time, and keeps your backlog healthy. Free for up to 50 bugs.',
  openGraph: {
    title: 'SenseBug AI — AI Bug Backlog Intelligence for Product Managers',
    description: 'The AI layer that sits on top of Jira and makes sense of your bug backlog. Ranks by business impact, learns your judgment over time.',
    url: 'https://www.sensebug.com',
    siteName: 'SenseBug AI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SenseBug AI — AI Bug Backlog Intelligence for Product Managers',
    description: 'The AI layer that sits on top of Jira and makes sense of your bug backlog. Ranks by business impact, learns your judgment. Free for up to 50 bugs.',
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 bg-white z-50">
        <div style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }} className="font-black text-xl tracking-tight">
          SENSEBUG AI
        </div>
        <div className="flex items-center gap-6">
          <Link href="/blog" className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150 hidden md:block">
            Blog
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150 hidden md:block">
            Pricing
          </Link>
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
            AI Backlog Intelligence for Product Managers
          </p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mb-8" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Your bug backlog<br />is full of opinions.
          </h1>
          <p className="text-xl text-black/60 max-w-2xl mb-4 leading-relaxed">
            Every ticket was filed by someone who thinks their bug is the most important one.
            SenseBug AI ignores the noise and ranks by what actually matters — business impact.
          </p>
          <p className="text-base text-black/40 max-w-xl mb-12 leading-relaxed">
            Connect Jira and every bug is automatically analysed and prioritised the moment it&apos;s filed — no CSV exports, no manual work. The AI ranks against your product&apos;s critical flows, removes reporter bias, and gets more accurate with every verdict you make.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/signup"
              data-testid="hero-signup-btn"
              className="bg-black text-white px-8 py-4 font-semibold text-sm flex items-center gap-2 hover:bg-black/90 transition-colors duration-150"
            >
              Analyse my backlog — it&apos;s free <ArrowRight className="w-4 h-4" />
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
                After — SenseBug AI ranking
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
          <div className="grid grid-cols-1 md:grid-cols-2 border border-gray-200">
            {[
              {
                step: '01',
                title: 'Connect Jira — or upload a CSV',
                desc: 'Link your Jira workspace in 60 seconds. From that point, every new bug is automatically analysed and prioritised as it\'s filed. Or drop a CSV from any tracker if you prefer — no integrations required.',
              },
              {
                step: '02',
                title: 'AI ranks by business impact',
                desc: 'The AI reads every ticket against your product\'s critical flows and scores priority independently — ignoring reporter labels, detecting escalation signals, and flagging vague or over-prioritised bugs.',
              },
              {
                step: '03',
                title: 'Review in your inbox',
                desc: 'Your persistent backlog surfaces the bugs that matter most. Approve the AI\'s call, adjust priority, or reject with a reason. P1s trigger an immediate email alert.',
              },
              {
                step: '04',
                title: 'It gets smarter over time',
                desc: 'After 30 verdicts, SenseBug learns your judgment — which P2s you always escalate, which gap flags you always reject — and injects that pattern into every future ranking. No configuration needed.',
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className={`p-8 bg-white ${
                  i === 0 ? 'md:border-r border-b border-gray-200' :
                  i === 1 ? 'border-b border-gray-200' :
                  i === 2 ? 'md:border-r border-gray-200' : ''
                }`}
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

      {/* ── Outcomes ─────────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-24 border-b border-gray-200 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-8" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            What you actually get
          </p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Bug backlog clarity in 5 minutes.<br />Not 5 hours.
          </h2>
          <p className="text-base text-black/45 mb-14 max-w-xl">
            SenseBug AI doesn&apos;t just rank bugs — it gives you the reasoning to defend every call in the room.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-gray-200 mb-12">
            {[
              {
                n: '01',
                heading: 'A ranked list that defends itself',
                body: 'Every bug comes with a 3-sentence rationale written to be read aloud. Paste it into Slack, put it in the sprint doc, or read it in standup. Stop explaining — start deciding.',
              },
              {
                n: '02',
                heading: 'Cover to say no',
                body: "When the AI flags a P1 as actually P4, you have documented evidence. Not your opinion — the system's verdict. No more uncomfortable conversations about whose bug matters more.",
              },
              {
                n: '03',
                heading: 'Gaps before they block your sprint',
                body: 'Vague tickets missing repro steps are flagged before they hit development. Engineers stop asking for context two days in. Reporters learn what a good ticket looks like.',
              },
              {
                n: '04',
                heading: 'An AI that learns how you think',
                body: 'After 30 verdicts, SenseBug calibrates to your judgment — which priority tiers you trust, which gap flags you always reject, how you weight customer escalations. Future rankings reflect that, automatically.',
              },
            ].map((item, i) => (
              <div
                key={item.n}
                className={`p-8 bg-white ${
                  i === 0 ? 'md:border-r border-b border-gray-200' :
                  i === 1 ? 'border-b border-gray-200' :
                  i === 2 ? 'md:border-r border-b md:border-b-0 border-gray-200' : ''
                }`}
              >
                <div className="text-xs font-mono text-black/25 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>{item.n}</div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{item.heading}</h3>
                <p className="text-sm text-black/55 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            <Link
              href="/signup"
              className="bg-black text-white px-8 py-3.5 font-semibold text-sm flex items-center gap-2 hover:bg-black/90 transition-colors duration-150"
            >
              Try free — no card needed <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-black/45 hover:text-black transition-colors duration-150">
              See pricing →
            </Link>
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
                q: 'Does SenseBug connect directly to Jira?',
                a: 'Yes. Connect your Jira workspace under Settings → Integrations. SenseBug gives you a webhook URL to paste into a Jira Automation rule — once set up, every new bug is automatically analysed and prioritised as it\'s filed, no exports needed. P1 bugs trigger an immediate email alert. When you approve a verdict, SenseBug writes the AI-assigned priority back to Jira.',
              },
              {
                q: 'What CSV format does SenseBug AI need?',
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
                a: 'Starter: 50 bugs/month (up to 50 per run). Pro: 250 bugs/month (up to 100 per run). Max: 500 bugs/month (up to 250 per run). If your CSV exceeds the per-run cap, SenseBug AI sorts by original priority first so your most critical bugs are always included.',
              },
              {
                q: 'What happens to my data?',
                a: 'Your CSV data and Knowledge Base are stored securely in your account and never used to train AI models. Results are private to your account. You can delete any run or your entire account at any time.',
              },
              {
                q: 'Is there a free plan?',
                a: 'Yes. The Starter plan is free forever — 50 bugs per month, no credit card required. Upgrade to Pro or Max when you need larger backlogs or Knowledge Base document uploads.',
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
          SENSEBUG AI
        </div>
        <div className="flex items-center gap-6 text-sm text-black/35">
          <Link href="/blog" className="hover:text-black transition-colors duration-150">Blog</Link>
          <Link href="/privacy" className="hover:text-black transition-colors duration-150">Privacy</Link>
          <Link href="/terms" className="hover:text-black transition-colors duration-150">Terms</Link>
          <a href="mailto:contact@sensebug.com" className="hover:text-black transition-colors duration-150">Contact</a>
          <span>© 2026 SenseBug AI</span>
        </div>
        </div>
      </footer>

    </div>
  )
}

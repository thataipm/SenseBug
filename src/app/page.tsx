import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LandingDemo } from '@/components/LandingDemo'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'SenseBug | The Monday morning bug ritual for engineering leaders.',
  description: 'Connect Jira once. Every Monday, your team gets a written brief on what changed, what\'s stuck, and what to fix this week. No exports. No manual triage. Live integration, continuous priority scoring, weekly intelligence brief.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'SenseBug | The Monday morning bug ritual for engineering leaders.',
    description: 'Connect Jira once. Get a written intelligence brief every Monday — what changed, what\'s stuck, what to fix this week. Forward it to your VPE.',
    url: 'https://www.sensebug.com',
    siteName: 'SenseBug',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SenseBug | The Monday morning bug ritual for engineering leaders.',
    description: 'Live Jira integration. Continuous priority scoring. Weekly written brief, delivered to your inbox. Try free.',
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 bg-white z-50">
        <Logo markHeight={18} />
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
            For engineering leaders who own a bug backlog
          </p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mb-8" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            The Monday morning<br />bug ritual.
          </h1>
          <p className="text-xl text-black/60 max-w-2xl mb-12 leading-relaxed">
            Connect Jira once. Every Monday, your team gets a written brief on what changed, what&apos;s stuck, and what to fix this week.
            No CSV exports. No manual triage. No walking into standup blind.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/signup"
              data-testid="hero-signup-btn"
              className="bg-black text-white px-8 py-4 font-semibold text-sm flex items-center gap-2 hover:bg-black/90 transition-colors duration-150"
            >
              Start the ritual — it&apos;s free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="text-sm font-medium text-black/40 hover:text-black transition-colors duration-150">
              Already have an account →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Live Demo ────────────────────────────────────────────────────── */}
      <LandingDemo />

      {/* ── Enemy Statement ──────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-16 border-b border-gray-200">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-black tracking-tight leading-snug mb-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            Most teams triage reactively.<br />The best ones walk in with a point of view.
          </p>
          <p className="text-base text-black/40 max-w-xl mx-auto">
            SenseBug gives you that point of view — automatically, every Monday morning, in a written brief built to be forwarded.
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
                title: 'Connect Jira in 60 seconds',
                desc: 'One webhook URL into a Jira Automation rule. From that moment on, every new bug is automatically scored against your team\'s priorities — no exports, ever. Don\'t use Jira yet? Drop a CSV.',
              },
              {
                step: '02',
                title: 'A written brief lands every Monday',
                desc: 'Backlog health score, what changed this week, what\'s stuck, what to fix. The Monday standup pre-read. The forwardable artifact your VPE actually wants.',
              },
              {
                step: '03',
                title: 'It learns your team\'s judgment',
                desc: 'Approve, adjust, or reject any call. After 30 verdicts, the analysis is calibrated to your team specifically — what you treat as P1 stays P1, what you downgrade gets flagged earlier next time.',
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
          <div className="mt-8 flex items-center gap-6 flex-wrap">
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

      {/* ── Quote ────────────────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-24 py-24 border-b border-gray-200">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-black tracking-tight leading-snug mb-6" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
            &ldquo;The Monday brief is the only Jira-adjacent thing I forward to my VPE without rewriting it first.&rdquo;
          </p>
          <p className="text-sm text-black/40 font-mono uppercase tracking-widest" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
            — Engineering Manager, B2B SaaS
          </p>
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
                q: 'How is this different from Jira\'s built-in AI?',
                a: 'Jira\'s AI ranks tickets inside Jira. SenseBug gives you a written brief outside it — built to be forwarded to leadership, not lived inside a ticket queue. We also track patterns across time (priority inflation per reporter, aging P1s, recurring escalation) that a single-ticket AI inside Jira can\'t see.',
              },
              {
                q: 'Couldn\'t I just paste my CSV into ChatGPT or Claude?',
                a: 'You could — once. The value isn\'t the analysis itself. It\'s that it happens automatically every week, integrates with Jira live (no exports), learns your team\'s specific judgment over 30+ verdicts, and produces a forwardable artifact you can hand to leadership. ChatGPT won\'t show up in your inbox at 7am Monday on its own.',
              },
              {
                q: 'How does the Jira integration actually work?',
                a: 'Connect under Settings → Integrations. SenseBug gives you a webhook URL to paste into a Jira Automation rule. From that moment on, every new bug is automatically analysed and prioritised as it\'s filed. P1s trigger an immediate alert. When you approve a verdict, the AI-assigned priority is written back to Jira automatically. Setup takes ~60 seconds.',
              },
              {
                q: 'Don\'t use Jira yet? CSV upload still works.',
                a: 'Drop a CSV from any tracker — Linear, GitHub Issues, Shortcut, Asana. Required columns: id, title, priority. Optional but recommended: description, comments, reporter, labels. The first weekly brief gets generated from your most recent CSV.',
              },
              {
                q: 'What\'s in the weekly brief?',
                a: 'Backlog health score with trend vs last week. New bugs filed in the last 7 days with recommended priority + one-line rationale. Aging tickets (P1s open >14 days, P2s >30 days). Priority inflation patterns (anonymized). One specific recommendation for the week. Methodology — what was analysed and how.',
              },
              {
                q: 'How does the AI rank bugs without knowing my product?',
                a: 'It uses your Knowledge Base — a short description of your product, your critical user flows, and your modules. Set it up once during onboarding. Every future analysis is ranked against what actually matters for your business, not generic "all bugs are equal" defaults.',
              },
              {
                q: 'What does "Likely over-prioritised" mean?',
                a: "It means SenseBug found no business-critical evidence to justify the original priority label. Common causes: the reporter used P1 for visibility, the bug affects a non-critical flow, or a workaround exists. You can approve, override, or reject the verdict — and after 30 verdicts the calibration starts catching these patterns earlier.",
              },
              {
                q: 'What happens to my data?',
                a: 'Stored encrypted in your account. Never used to train AI models. Never shared with third parties. You can delete any run, the weekly brief history, or your entire account at any time.',
              },
              {
                q: 'Is there a free plan?',
                a: 'Yes. Starter is free — 50 bugs per month, no credit card required. Upgrade to Pro ($19/mo) when you want live Jira integration, the weekly brief, AI calibration, and a larger monthly cap.',
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
            Stop triaging.<br />Start owning the ritual.
          </h2>
          <p className="text-lg text-black/50 mb-10 leading-relaxed max-w-xl mx-auto">
            Free to start. No credit card. Connect Jira in 60 seconds — or upload a CSV — and have your first written brief in your inbox before Monday.
          </p>
          <Link
            href="/signup"
            className="bg-black text-white px-10 py-4 font-semibold text-sm inline-flex items-center gap-2 hover:bg-black/90 transition-colors duration-150"
          >
            Start free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── JSON-LD ──────────────────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'How is this different from Jira\'s built-in AI?',
              acceptedAnswer: { '@type': 'Answer', text: 'Jira\'s AI ranks tickets inside Jira. SenseBug gives you a written brief outside it — built to be forwarded to leadership, not lived inside a ticket queue. We also track patterns across time (priority inflation per reporter, aging P1s, recurring escalation) that a single-ticket AI inside Jira can\'t see.' },
            },
            {
              '@type': 'Question',
              name: 'How does the Jira integration actually work?',
              acceptedAnswer: { '@type': 'Answer', text: 'Connect under Settings → Integrations. SenseBug gives you a webhook URL to paste into a Jira Automation rule. From that moment on, every new bug is automatically analysed and prioritised as it\'s filed. P1s trigger an immediate alert. When you approve a verdict, the AI-assigned priority is written back to Jira automatically.' },
            },
            {
              '@type': 'Question',
              name: 'What\'s in the weekly brief?',
              acceptedAnswer: { '@type': 'Answer', text: 'Backlog health score with trend vs last week. New bugs filed in the last 7 days with recommended priority + one-line rationale. Aging tickets (P1s open >14 days, P2s >30 days). Priority inflation patterns (anonymized). One specific recommendation for the week.' },
            },
            {
              '@type': 'Question',
              name: 'Don\'t use Jira yet? CSV upload still works.',
              acceptedAnswer: { '@type': 'Answer', text: 'Drop a CSV from any tracker — Linear, GitHub Issues, Shortcut, Asana. Required columns: id, title, priority. Optional but recommended: description, comments, reporter, labels.' },
            },
            {
              '@type': 'Question',
              name: 'What happens to my data?',
              acceptedAnswer: { '@type': 'Answer', text: 'Stored encrypted in your account. Never used to train AI models. Never shared with third parties. You can delete any run, the weekly brief history, or your entire account at any time.' },
            },
            {
              '@type': 'Question',
              name: 'Is there a free plan?',
              acceptedAnswer: { '@type': 'Answer', text: 'Yes. Starter is free — 50 bugs per month, no credit card required. Upgrade to Pro ($19/mo) when you want live Jira integration, the weekly brief, AI calibration, and a larger monthly cap.' },
            },
          ],
        }) }}
      />

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="px-6 md:px-12 lg:px-24 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <Logo markHeight={16} />
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

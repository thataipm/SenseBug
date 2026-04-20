import Link from 'next/link'

export const metadata = {
  title: 'Support — Sensebug',
  description: 'Get help with Sensebug. Contact our support team or browse common questions.',
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-lg font-bold text-black mb-3 pb-2 border-b border-gray-100"
      style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
    >
      {children}
    </h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-black/60 mb-3">
      {children}
    </p>
  )
}

function Q({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border-b border-gray-100 py-5 last:border-0">
      <p className="text-sm font-semibold text-black mb-1.5" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{question}</p>
      <p className="text-sm leading-relaxed text-black/60">{answer}</p>
    </div>
  )
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* Nav */}
      <nav className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 bg-white z-50">
        <Link href="/" className="font-black text-xl tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
          SENSEBUG
        </Link>
        <Link href="/login" className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150">
          Log in
        </Link>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
          Help &amp; Support
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
          How can we help?
        </h1>
        <p className="text-base text-black/50 mb-16 leading-relaxed">
          We&apos;re a small team and respond to every message personally. Typical response time is within 24 hours on business days.
        </p>

        <div className="space-y-12">

          {/* Contact */}
          <section>
            <H2>Contact us</H2>
            <P>For any questions, issues, or feedback — email us directly:</P>
            <a
              href="mailto:contact@sensebug.com"
              className="inline-flex items-center gap-3 border border-black px-6 py-4 text-sm font-semibold hover:bg-black hover:text-white transition-colors duration-150 group"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              contact@sensebug.com
            </a>
            <p className="text-sm leading-relaxed text-black/60 mb-3 mt-4">We aim to respond within 1 business day. For billing questions, please include your account email in the subject line.</p>
          </section>

          {/* Billing & cancellation */}
          <section>
            <H2>Billing &amp; cancellations</H2>
            <P>
              You can upgrade, downgrade, or cancel your subscription at any time from your{' '}
              <Link href="/settings" className="text-black underline underline-offset-2 hover:text-black/60">account settings</Link>.
              Cancellations take effect at the end of your current billing period — you keep full access until then.
            </P>
            <P>
              We do not offer refunds for partial months, except where required by applicable law. If you believe you were charged in error, email us at{' '}
              <a href="mailto:contact@sensebug.com" className="text-black underline underline-offset-2 hover:text-black/60">contact@sensebug.com</a>{' '}
              and we will review your case promptly.
            </P>
            <P>
              For full details, see our{' '}
              <Link href="/terms" className="text-black underline underline-offset-2 hover:text-black/60">Terms of Service</Link>.
            </P>
          </section>

          {/* FAQ */}
          <section>
            <H2>Frequently asked questions</H2>
            <div>
              <Q
                question="What file formats can I upload?"
                answer="Sensebug supports CSV, Excel (.xlsx / .xls), TSV, and plain text files. Your file needs at minimum an ID column, a title column, and a priority column. Adding a description column significantly improves ranking accuracy."
              />
              <Q
                question="How does Sensebug rank bugs?"
                answer="Sensebug uses Claude AI (by Anthropic) combined with your Knowledge Base context to assess each bug's business impact, severity, and urgency. It then ranks them using an explicit priority hierarchy, with tiebreakers based on user impact, recency, and escalation signals."
              />
              <Q
                question="Is my data used to train AI models?"
                answer="No. Your bug data and Knowledge Base content are never used to train AI models — ours or Anthropic's. Data is processed only to generate your triage results and is stored privately in your account."
              />
              <Q
                question="What happens when I hit my monthly bug limit?"
                answer="You'll see a warning banner on the dashboard when you're close to your limit. Once reached, new uploads are paused until the next billing cycle or until you upgrade your plan."
              />
              <Q
                question="Can I export my results?"
                answer="Yes. Every triage run has a Download CSV button that exports all results including AI rankings, confidence scores, your PM verdicts, and the final priority. The export is available at any time from the results page."
              />
              <Q
                question="How do I delete my account?"
                answer="Email us at contact@sensebug.com with the subject 'Account deletion request' and we'll permanently delete your account and all associated data within 5 business days."
              />
            </div>
          </section>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 mt-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-black/35">
          <span className="font-black tracking-tight text-black text-base" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG</span>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-black transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-black transition-colors">Privacy</Link>
            <a href="mailto:contact@sensebug.com" className="hover:text-black transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

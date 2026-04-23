import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — SenseBug AI',
  description: 'How SenseBug AI collects, uses, and protects your data.',
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

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-sm font-semibold text-black/80 mt-5 mb-1.5"
      style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
    >
      {children}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-black/60 mb-3">
      {children}
    </p>
  )
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-3 space-y-1.5">{children}</ul>
}

function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm leading-relaxed text-black/60 pl-4 relative before:content-['—'] before:absolute before:left-0 before:text-black/20 before:text-xs before:top-0.5">
      {children}
    </li>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>

      {/* Nav */}
      <nav className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 bg-white z-50">
        <Link href="/" className="font-black text-xl tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
          SENSEBUG AI
        </Link>
        <Link href="/login" className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150">
          Log in
        </Link>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
          Legal
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
          Privacy Policy
        </h1>
        <p className="text-sm text-black/40 mb-16" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
          Last updated: April 2026
        </p>

        <div className="space-y-12">

          <section>
            <H2>Overview</H2>
            <P>SenseBug AI (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the SenseBug AI service at sensebug.com. This Privacy Policy explains what information we collect, how we use it, and your rights in relation to it.</P>
            <P>By using SenseBug AI, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use our service.</P>
          </section>

          <section>
            <H2>Information we collect</H2>
            <H3>Account information</H3>
            <P>When you create an account, we collect your email address and a hashed password. We do not store passwords in plain text.</P>
            <H3>CSV uploads and bug data</H3>
            <P>When you upload a CSV file for triage, we store the content of that file in your account to generate results and allow you to revisit past runs. This data is private to your account and is never shared with other users.</P>
            <H3>Knowledge Base content</H3>
            <P>Any product context, critical flows, or documents you add to your Knowledge Base are stored in your account and used solely to improve the accuracy of your triage results.</P>
            <H3>Usage data</H3>
            <P>We collect standard usage data including pages visited, features used, and error logs. This is used to improve the product and diagnose issues. It does not include the content of your bug data.</P>
            <H3>Cookies</H3>
            <P>We use essential cookies to maintain your authenticated session. We do not use advertising or tracking cookies.</P>
          </section>

          <section>
            <H2>How we use your information</H2>
            <UL>
              <LI>To provide, operate, and improve the SenseBug AI service</LI>
              <LI>To process your CSV uploads and generate AI triage results</LI>
              <LI>To send essential service emails (account confirmations, password resets)</LI>
              <LI>To enforce our Terms of Service and prevent abuse</LI>
              <LI>To respond to support requests</LI>
            </UL>
            <P>We do not sell your personal information. We do not use your bug data or Knowledge Base content to train AI models.</P>
          </section>

          <section>
            <H2>AI processing</H2>
            <P>SenseBug AI uses third-party AI providers (including Anthropic) to analyse your bug data. When you submit a CSV for triage, the ticket content is sent to these providers to generate rankings and analysis. This data is processed under their respective data processing agreements and is not used to train their models.</P>
            <P>We recommend avoiding uploading CSV files that contain personally identifiable information about your end users (e.g., customer names, emails, or IDs in ticket descriptions).</P>
          </section>

          <section>
            <H2>Data storage and security</H2>
            <P>Your data is stored securely using Supabase, hosted on infrastructure compliant with SOC 2 standards. All data in transit is encrypted via TLS. All data at rest is encrypted.</P>
            <P>
              We retain your data for as long as your account is active. You can delete individual triage runs at any time from your dashboard. You can request full account deletion by emailing us at{' '}
              <a href="mailto:contact@sensebug.com" className="text-black underline underline-offset-2 hover:text-black/60">contact@sensebug.com</a>.
            </P>
          </section>

          <section>
            <H2>Third-party services</H2>
            <P>We use the following third-party services to operate SenseBug AI:</P>
            <UL>
              <LI><strong className="text-black/80 font-semibold">Supabase</strong> — database, authentication, and file storage</LI>
              <LI><strong className="text-black/80 font-semibold">Anthropic</strong> — AI language model for bug analysis</LI>
              <LI><strong className="text-black/80 font-semibold">Vercel</strong> — hosting and edge delivery</LI>
              <LI><strong className="text-black/80 font-semibold">Stripe</strong> — payment processing (we never see or store your full card details)</LI>
            </UL>
            <P>Each of these providers has their own privacy policies and data processing agreements in place.</P>
          </section>

          <section>
            <H2>Your rights</H2>
            <P>Depending on your location, you may have the following rights:</P>
            <UL>
              <LI><strong className="text-black/80 font-semibold">Access</strong> — request a copy of the personal data we hold about you</LI>
              <LI><strong className="text-black/80 font-semibold">Correction</strong> — request we correct inaccurate data</LI>
              <LI><strong className="text-black/80 font-semibold">Deletion</strong> — request we delete your account and associated data</LI>
              <LI><strong className="text-black/80 font-semibold">Portability</strong> — request an export of your triage results in CSV format</LI>
              <LI><strong className="text-black/80 font-semibold">Objection</strong> — object to certain types of processing</LI>
            </UL>
            <P>
              To exercise any of these rights, email us at{' '}
              <a href="mailto:contact@sensebug.com" className="text-black underline underline-offset-2 hover:text-black/60">contact@sensebug.com</a>. We will respond within 30 days.
            </P>
          </section>

          <section>
            <H2>Children</H2>
            <P>SenseBug AI is not directed at children under the age of 16. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.</P>
          </section>

          <section>
            <H2>Changes to this policy</H2>
            <P>We may update this Privacy Policy from time to time. When we make significant changes, we will notify you by email or by displaying a prominent notice in the product. The &quot;last updated&quot; date at the top of this page will always reflect the most recent revision.</P>
          </section>

          <section>
            <H2>Contact</H2>
            <P>
              Questions or concerns about this Privacy Policy? Email us at{' '}
              <a href="mailto:contact@sensebug.com" className="text-black underline underline-offset-2 hover:text-black/60">contact@sensebug.com</a>.
            </P>
          </section>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 mt-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-black/35">
          <span className="font-black tracking-tight text-black text-base" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG AI</span>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-black transition-colors">Terms</Link>
            <a href="mailto:contact@sensebug.com" className="hover:text-black transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

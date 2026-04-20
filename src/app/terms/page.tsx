import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Sensebug',
  description: 'The terms that govern your use of Sensebug.',
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

export default function TermsPage() {
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
          Legal
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
          Terms of Service
        </h1>
        <p className="text-sm text-black/40 mb-16" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
          Last updated: April 2026
        </p>

        <div className="space-y-12">

          <section>
            <H2>Agreement to terms</H2>
            <P>These Terms of Service (&quot;Terms&quot;) govern your access to and use of Sensebug (&quot;the Service&quot;), operated by Sensebug (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) at sensebug.com. By creating an account or using the Service, you agree to be bound by these Terms.</P>
            <P>If you are using the Service on behalf of an organisation, you represent that you have the authority to bind that organisation to these Terms, and references to &quot;you&quot; include that organisation.</P>
          </section>

          <section>
            <H2>Description of service</H2>
            <P>Sensebug is an AI-assisted bug triage tool for product managers. It allows you to upload bug backlogs in CSV format, receive AI-generated priority rankings based on business impact, and record your verdicts on each bug. Results can be exported as CSV for use in sprint planning tools.</P>
            <P>The Service is provided &quot;as is&quot; and we may modify or discontinue features at any time. We will provide reasonable notice of significant changes.</P>
          </section>

          <section>
            <H2>Accounts</H2>
            <P>You must provide a valid email address to create an account. You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.</P>
            <P>You must be at least 16 years old to use Sensebug. By creating an account, you confirm that you meet this requirement.</P>
            <P>You may not share your account with others or create accounts for third parties without their consent. Each account is for a single individual unless you are on the Team plan, which permits up to 5 members.</P>
          </section>

          <section>
            <H2>Acceptable use</H2>
            <P>You agree not to:</P>
            <UL>
              <LI>Upload CSV files containing sensitive personal information about third parties (e.g., customer names, emails, financial data) unless you have lawful grounds to do so</LI>
              <LI>Attempt to reverse-engineer, scrape, or extract the AI models or ranking logic</LI>
              <LI>Use the Service to generate output for resale as a standalone AI product without our written permission</LI>
              <LI>Attempt to circumvent usage limits or billing controls through technical means</LI>
              <LI>Use the Service in any way that violates applicable law or regulation</LI>
              <LI>Introduce malware, viruses, or malicious code via file uploads</LI>
            </UL>
            <P>We reserve the right to suspend or terminate accounts that violate these terms without prior notice.</P>
          </section>

          <section>
            <H2>Plans and billing</H2>
            <H3>Free Starter plan</H3>
            <P>The Starter plan is free forever and includes 3 triage runs per month with a per-run cap of 20 bugs. No credit card is required.</P>
            <H3>Paid plans</H3>
            <P>Pro ($19/month) and Team ($49/month) plans are billed monthly in advance via Stripe. All prices are in USD. Subscriptions renew automatically each month until cancelled.</P>
            <H3>Cancellation and refunds</H3>
            <P>You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period — you retain access until then. We do not offer refunds for partial months, except where required by law.</P>
            <H3>Changes to pricing</H3>
            <P>We reserve the right to change our pricing. We will provide at least 30 days&apos; notice before any price increase takes effect, giving you time to cancel if you do not wish to continue.</P>
          </section>

          <section>
            <H2>Your data</H2>
            <P>You retain ownership of all data you upload to Sensebug — including CSV files, bug content, and Knowledge Base entries. By uploading data, you grant us a limited licence to process it for the sole purpose of providing the Service to you.</P>
            <P>
              We do not use your data to train AI models. See our{' '}
              <Link href="/privacy" className="text-black underline underline-offset-2 hover:text-black/60">Privacy Policy</Link>
              {' '}for full details on how we handle your data.
            </P>
            <P>
              You can delete individual triage runs at any time from the dashboard. Deleted runs are permanently removed and cannot be recovered. You can request full account deletion by emailing{' '}
              <a href="mailto:contact@sensebug.com" className="text-black underline underline-offset-2 hover:text-black/60">contact@sensebug.com</a>.
            </P>
          </section>

          <section>
            <H2>AI output and accuracy</H2>
            <P>Sensebug uses AI to generate bug rankings and analysis. While we work hard to make these results accurate and useful, AI output is probabilistic and may contain errors, omissions, or inconsistencies.</P>
            <P>The rankings and analysis produced by Sensebug are intended to assist your decision-making — not replace it. You remain responsible for the final triage decisions you make and for the consequences of those decisions on your product and team.</P>
            <P>We make no warranty that the Service will produce correct rankings for any specific bug or backlog.</P>
          </section>

          <section>
            <H2>Intellectual property</H2>
            <P>The Sensebug name, logo, product design, and underlying software are our intellectual property. You may not copy, modify, or distribute them without our written permission.</P>
            <P>The AI-generated analysis and rankings produced for your specific bug data belong to you. You are free to use, share, and export them as you see fit.</P>
          </section>

          <section>
            <H2>Limitation of liability</H2>
            <P>To the maximum extent permitted by applicable law, Sensebug shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service — including but not limited to lost revenue, lost data, or decisions made based on AI output.</P>
            <P>Our total liability to you for any claim arising from these Terms or your use of the Service shall not exceed the amount you paid us in the 12 months preceding the claim, or $100 if you are on a free plan.</P>
          </section>

          <section>
            <H2>Disclaimer of warranties</H2>
            <P>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranty of any kind. We do not warrant that the Service will be uninterrupted, error-free, or that any particular result will be achieved from using it.</P>
          </section>

          <section>
            <H2>Termination</H2>
            <P>You may stop using the Service and delete your account at any time. We may suspend or terminate your account if you breach these Terms, with or without notice depending on the severity of the breach.</P>
            <P>On termination, your right to use the Service ceases immediately. We will retain your data for 30 days after account deletion before permanently removing it, unless you request immediate deletion.</P>
          </section>

          <section>
            <H2>Governing law</H2>
            <P>These Terms are governed by the laws of England and Wales. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.</P>
          </section>

          <section>
            <H2>Changes to these terms</H2>
            <P>We may update these Terms from time to time. We will notify you of significant changes by email or via a notice in the product at least 14 days before they take effect. Continued use of the Service after that date constitutes acceptance of the revised Terms.</P>
          </section>

          <section>
            <H2>Contact</H2>
            <P>
              Questions about these Terms? Email us at{' '}
              <a href="mailto:contact@sensebug.com" className="text-black underline underline-offset-2 hover:text-black/60">contact@sensebug.com</a>.
            </P>
          </section>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 mt-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-black/35">
          <span className="font-black tracking-tight text-black text-base" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-black transition-colors">Privacy</Link>
            <a href="mailto:contact@sensebug.com" className="hover:text-black transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

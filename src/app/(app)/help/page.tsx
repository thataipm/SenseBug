const faqs = [
  {
    section: 'Getting Started',
    items: [
      { q: 'What is SenseBug AI?', a: "SenseBug AI is an AI-powered bug triage tool for Product Managers. You upload a CSV of bug tickets, and the AI ranks them by business impact using your product's Knowledge Base as context." },
      { q: 'How do I get started?', a: 'Sign up, complete the onboarding to set up your Knowledge Base (describe your product, critical flows, and modules), then upload a CSV from your bug tracker.' },
      { q: 'What happens during a triage run?', a: "SenseBug AI parses your CSV, retrieves relevant context from your Knowledge Base, and sends the bugs to Claude (Anthropic's AI) for prioritization. Results appear in under a minute." },
    ],
  },
  {
    section: 'CSV Format',
    items: [
      { q: 'What columns does my CSV need?', a: 'Required: id (or key/issue_key), title (or summary), and priority. Optional but recommended: description, comments, reporter, labels. More context = better AI rankings.' },
      { q: 'Does SenseBug AI work with Jira exports?', a: "Yes. Jira exports are fully supported. SenseBug AI automatically deduplicates Jira's multi-row format (where each comment/attachment creates a separate row for the same issue)." },
      { q: 'What priority values does the AI understand?', a: 'Both Jira-style (P1, P2, P3, P4) and plain English (Critical, High, Medium, Low) are understood. The AI re-ranks based on business impact, so the original priority is just one input.' },
      { q: 'Is there a bug limit per run?', a: 'Starter: 50 bugs/month (up to 50 per run). Pro: 250 bugs/month (up to 100 per run). Max: 500 bugs/month (up to 250 per run). If your CSV exceeds the per-run cap, SenseBug AI sorts by original priority first so your most critical bugs are always included.' },
    ],
  },
  {
    section: 'Knowledge Base',
    items: [
      { q: 'What should I put in the Knowledge Base?', a: 'The three text fields are key: (1) Product overview — what your product does and who uses it. (2) Critical flows — the 3–5 flows that if broken would be a business emergency. (3) Product areas — your main modules or features.' },
      { q: 'How do uploaded documents help?', a: 'On Pro plans, you can upload PDF, .txt, or .md files (e.g. product specs, runbooks). These are chunked and embedded with vector search, giving the AI richer context when ranking bugs.' },
      { q: 'Can I update my Knowledge Base after onboarding?', a: 'Yes. Go to Settings → Knowledge Base to edit the text fields or manage uploaded documents at any time.' },
    ],
  },
  {
    section: 'Billing',
    items: [
      { q: 'Is there a free plan?', a: 'Yes. The Starter plan is free forever — 3 runs per month, up to 20 bugs per run. No credit card required. Upgrade to Pro whenever you need more.' },
      { q: 'Can I cancel at any time?', a: "Yes. There are no lock-in contracts. Cancel any time from your Account page and you'll retain access until the end of your billing period." },
    ],
  },
]

export default function HelpPage() {
  return (
    <div className="px-6 md:px-10 py-10 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-3" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Help & FAQ</p>
      <h1 className="text-2xl font-black tracking-tighter mb-2" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>How can we help?</h1>
      <p className="text-sm text-black/50 mb-12">Everything you need to know about using SenseBug AI.</p>

      <div className="space-y-12">
        {faqs.map((section) => (
          <div key={section.section} data-testid={`faq-section-${section.section.toLowerCase().replace(/\s/g, '-')}`}>
            <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5 border-b border-gray-100 pb-3" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
              {section.section}
            </p>
            <div className="space-y-5">
              {section.items.map((item) => (
                <div key={item.q} className="border-b border-gray-50 pb-5 last:border-0 last:pb-0">
                  <h3 className="text-sm font-semibold mb-1.5" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>{item.q}</h3>
                  <p className="text-sm text-black/60 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 border border-gray-200 p-6">
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-3" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Still stuck?</p>
        <h3 className="text-base font-bold mb-2" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Reach out directly</h3>
        <p className="text-sm text-black/55 mb-4">We reply to every email within one business day.</p>
        <a
          href="mailto:contact@sensebug.com"
          data-testid="help-contact-email"
          className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/85 transition-colors duration-150"
        >
          Email support
        </a>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'

const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }
const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }

const faqs = [
  {
    section: 'Getting Started',
    items: [
      { q: 'What is SenseBug AI?', a: "SenseBug AI is the AI intelligence layer for your bug backlog. It automatically ranks bugs by business impact, learns your prioritisation judgment over time, and keeps your backlog healthy — all connected to Jira. Upload a CSV or connect Jira to get started." },
      { q: 'How do I get started?', a: 'Sign up, complete the onboarding to set up your Knowledge Base (describe your product, critical flows, and modules), then upload a CSV from your bug tracker.' },
      { q: 'What happens when I analyse bugs?', a: "SenseBug AI parses your CSV, retrieves relevant context from your Knowledge Base, and sends the bugs to Claude (Anthropic's AI) for ranking. Results appear in under a minute and are added to your persistent Backlog." },
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
      { q: 'Is there a free plan?', a: 'Yes. The Starter plan is free forever — 50 bugs/month, up to 50 per run. No credit card required. Upgrade to Pro or Max whenever you need more.' },
      { q: 'Can I cancel at any time?', a: "Yes. There are no lock-in contracts. Cancel any time from your Account page and you'll retain access until the end of your billing period." },
    ],
  },
]

const TYPES = [
  { value: 'bug',     label: '🐛 Bug report' },
  { value: 'feature', label: '💡 Feature request' },
  { value: 'general', label: '💬 General feedback' },
]

function FeedbackForm() {
  const [type,    setType]    = useState('bug')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errMsg,  setErrMsg]  = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrMsg('')
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type, subject: subject.trim(), message: message.trim() }),
      })
      if (res.ok) {
        setStatus('success')
        setSubject('')
        setMessage('')
        setType('bug')
      } else {
        const data = await res.json().catch(() => ({}))
        setErrMsg(data.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
      }
    } catch {
      setErrMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="border border-green-200 bg-green-50 px-6 py-5 flex items-start gap-4">
        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
        <div>
          <p className="text-sm font-semibold text-green-800" style={HEADING}>Message received!</p>
          <p className="text-xs text-green-700 mt-0.5">We&apos;ll review it and get back to you shortly.</p>
          <button
            onClick={() => setStatus('idle')}
            className="mt-3 text-xs text-green-700 underline underline-offset-2 hover:text-green-900"
          >
            Send another message
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status === 'error' && (
        <div className="border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3">
          {errMsg}
        </div>
      )}

      {/* Type */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={MONO}>
          Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          required
          className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-2.5 text-sm bg-white transition-colors duration-150"
        >
          {TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={MONO}>
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          maxLength={120}
          placeholder="Brief summary of your feedback"
          className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-2.5 text-sm transition-colors duration-150"
        />
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={MONO}>
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="Describe what you found, what you&apos;d like to see, or anything on your mind…"
          className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-2.5 text-sm resize-none transition-colors duration-150"
        />
        <p className="text-xs text-black/35 mt-1 text-right" style={MONO}>{message.length} / 2000</p>
      </div>

      <button
        type="submit"
        disabled={status === 'loading'}
        className="flex items-center gap-2 bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50"
      >
        {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === 'loading' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}

export default function HelpPage() {
  return (
    <div className="px-6 md:px-10 py-10 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-3" style={MONO}>Help & FAQ</p>
      <h1 className="text-2xl font-black tracking-tighter mb-2" style={HEADING}>How can we help?</h1>
      <p className="text-sm text-black/55 mb-12">Everything you need to know about using SenseBug AI.</p>

      {/* FAQ sections */}
      <div className="space-y-12">
        {faqs.map((section) => (
          <div key={section.section} data-testid={`faq-section-${section.section.toLowerCase().replace(/\s/g, '-')}`}>
            <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-5 border-b border-gray-100 pb-3" style={MONO}>
              {section.section}
            </p>
            <div className="space-y-5">
              {section.items.map((item) => (
                <div key={item.q} className="border-b border-gray-50 pb-5 last:border-0 last:pb-0">
                  <h3 className="text-sm font-semibold mb-1.5" style={HEADING}>{item.q}</h3>
                  <p className="text-sm text-black/60 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Contact / Feedback form */}
      <div className="mt-14 border border-gray-200 p-6">
        <p className="text-xs font-mono uppercase tracking-widest text-black/40 mb-3" style={MONO}>Contact & Feedback</p>
        <h3 className="text-base font-bold mb-1.5" style={HEADING}>Send us a message</h3>
        <p className="text-sm text-black/55 mb-6">
          Found a bug? Have a feature idea? We read every message and reply within one business day.
        </p>
        <FeedbackForm />
      </div>
    </div>
  )
}

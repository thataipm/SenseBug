'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { takePendingFile } from '@/lib/pending-upload'

const STEPS = [
  'Parsing your file…',
  'Loading your Knowledge Base…',
  'Ranking bugs by business impact…',
  'Finalising results…',
]

const STEP_DELAYS = [0, 2500, 7000]

const TIPS = [
  {
    label: 'How we rank',
    text: "Bugs that break critical user flows rank above everything else. Not personal — just revenue.",
  },
  {
    label: 'Reporter bias',
    text: "Reporters mark their own bugs P1. We strip out the badge and look at what the bug actually does to real users.",
  },
  {
    label: 'Fun fact',
    text: '"Bug" was coined in 1947 when Grace Hopper found an actual moth stuck inside a computer relay. Your backlog is (probably) less physical.',
  },
  {
    label: 'Sentiment signals',
    text: '"Blocking our entire launch" carries more weight than "minor inconvenience". We read the ticket so you can skim it later.',
  },
  {
    label: 'Knowledge Base tip',
    text: "The more detail in your Knowledge Base, the sharper the rankings. It's what turns generic AI guesses into product-aware decisions.",
  },
  {
    label: 'Quality flags',
    text: "We flag vague tickets missing repro steps — not to shame anyone, just to surface which ones need more info before they're worth your sprint.",
  },
  {
    label: 'Over-prioritised?',
    text: "A cosmetic CSS tweak filed as Critical by someone who really cares about border-radius is not a Critical. We'll flag it, politely.",
  },
  {
    label: 'Customer escalations',
    text: "Bugs escalated by paying customers rank higher. If someone is both angry and giving you money, that's a fire, not a ticket.",
  },
]

export default function ProcessingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [tipIndex, setTipIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  // Rotate tips every 5 s while processing
  useEffect(() => {
    if (error) return
    const interval = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 5000)
    return () => clearInterval(interval)
  }, [error])

  // Tick elapsed seconds for progress bar
  useEffect(() => {
    if (error) return
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [error])

  // Guard against React Strict Mode's double-invoke: effects run twice in dev,
  // which would consume the file on the first run and redirect on the second.
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    const file = takePendingFile()
    if (!file) {
      router.replace('/dashboard')
      return
    }

    // Advance step indicator while the upload runs.
    // No cleanup returned here — calling setStep on an unmounted component is
    // silently ignored in React 18, and registering a cleanup would cause
    // React Strict Mode's fake-unmount to cancel these timers before they fire
    // (hasStarted prevents the second effect run from creating new ones).
    STEP_DELAYS.forEach((delay, i) => {
      setTimeout(() => setStep(i), delay)
    })

    const run = async () => {
      const fd = new FormData()
      fd.append('file', file)

      try {
        const res = await fetch('/api/triage/upload', { method: 'POST', body: fd })
        const data = await res.json()
        setStep(3)
        if (!res.ok) {
          setError(data.error || 'Upload failed. Please try again.')
          return
        }
        // If some bugs were trimmed, store the raw rows in sessionStorage so the
        // results page can offer a "Download remaining bugs" CSV button.
        if (data.trimmed_rows?.length > 0) {
          try {
            sessionStorage.setItem(`trimmed:${data.run_id}`, JSON.stringify(data.trimmed_rows))
          } catch {
            // sessionStorage full or unavailable — non-fatal, download button just won't appear
          }
        }
        await new Promise((r) => setTimeout(r, 600))
        const params = new URLSearchParams()
        if (data.warning) params.set('note', data.warning)
        if (data.total_uploaded) params.set('total', String(data.total_uploaded))
        if (data.bugs_analyzed) params.set('analyzed', String(data.bugs_analyzed))
        const qs = params.toString()
        router.push(`/results/${data.run_id}${qs ? `?${qs}` : ''}`)
      } catch {
        setError('Something went wrong. Please try again.')
      }
    }

    run()
  }, [router])

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      {/* Slow radial pulse */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(255,255,255,0.05) 0%, transparent 70%)', animation: 'pulse-glow 5s ease-in-out infinite' }} />
      {/* Scan line (only while processing) */}
      {!error && (
        <div className="absolute left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.08) 70%, transparent 100%)', animation: 'scan-line 4s linear infinite' }} />
      )}

      <div className="relative z-10 max-w-sm w-full px-6 text-center">
        {/* Wordmark */}
        <p className="text-xs font-mono uppercase tracking-widest text-white/30 mb-12" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>SENSEBUG AI</p>

        {!error ? (
          <>
            {/* Animated step dots */}
            <div className="flex items-center justify-center gap-2 mb-10">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-500 ${
                    i < step ? 'w-2 h-2 bg-white' : i === step ? 'w-3 h-3 bg-white animate-pulse' : 'w-2 h-2 bg-white/20'
                  }`}
                />
              ))}
            </div>

            <h1 className="text-xl font-semibold mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
              {STEPS[Math.min(step, STEPS.length - 1)]}
            </h1>
            <p className="text-sm text-white/40 mb-4">This usually takes 60–90 seconds</p>

            {/* Progress bar */}
            {(() => {
              const progress = step === 3 ? 100 : Math.min(88, (elapsed / 75) * 100)
              return (
                <div className="mb-10">
                  <div className="w-full h-0.5 bg-white/10 overflow-hidden mb-2">
                    <div
                      className="h-full bg-white transition-all duration-1000 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs font-mono text-white/20 text-right tabular-nums" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                    {Math.round(progress)}%
                  </p>
                </div>
              )
            })()}

            {/* Step list */}
            <div className="text-left space-y-3">
              {STEPS.map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-5 h-5 flex items-center justify-center text-xs font-mono flex-shrink-0 border transition-colors duration-300 ${
                    i < step ? 'border-white bg-white text-black' : i === step ? 'border-white/60 text-white/60 animate-pulse' : 'border-white/15 text-white/20'
                  }`} style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm transition-colors duration-300 ${i <= step ? 'text-white' : 'text-white/30'}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Rotating tips */}
            <div className="mt-10 pt-6 border-t border-white/[0.07] text-left">
              <p className="text-xs font-mono uppercase tracking-widest text-white/20 mb-4" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                While you wait
              </p>
              <div key={tipIndex} className="animate-fade-in">
                <p className="text-xs font-mono uppercase tracking-widest text-white/35 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>
                  {TIPS[tipIndex].label}
                </p>
                <p className="text-sm text-white/45 leading-relaxed">{TIPS[tipIndex].text}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border border-red-500/40 flex items-center justify-center mx-auto mb-6">
              <span className="text-red-400 text-lg">✕</span>
            </div>
            <h1 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Analysis failed</h1>
            <p className="text-sm text-white/50 mb-8">{error}</p>
            <a
              href="/dashboard"
              data-testid="processing-back-btn"
              className="border border-white/30 text-white/70 hover:border-white hover:text-white px-6 py-2.5 text-sm font-medium transition-colors duration-150 inline-block"
            >
              Back to Dashboard
            </a>
          </>
        )}

        {!error && (
          <div className="mt-8">
            <a
              href="/dashboard"
              data-testid="processing-cancel-btn"
              className="text-xs text-white/25 hover:text-white/50 transition-colors duration-150"
            >
              Leave this page — analysis continues in the background
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

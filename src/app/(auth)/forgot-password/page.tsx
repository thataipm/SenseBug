'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
        <div className="max-w-sm w-full">
          <Link href="/" className="font-black text-xl tracking-tight block mb-10" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG AI</Link>
          <h1 className="text-3xl font-black tracking-tighter mb-3" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Check your email</h1>
          <p className="text-sm text-black/55 mb-6">If an account with that email exists, we've sent a reset link. Check your inbox.</p>
          <Link href="/login" className="text-sm text-black font-medium hover:underline" data-testid="back-to-login-link">← Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <div className="max-w-sm w-full">
        <Link href="/" className="font-black text-xl tracking-tight block mb-10" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG AI</Link>
        <h1 className="text-3xl font-black tracking-tighter mb-1" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Reset password</h1>
        <p className="text-sm text-black/45 mb-8">Enter your email and we'll send a reset link.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Email</label>
            <input
              data-testid="forgot-password-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150"
              placeholder="you@example.com"
            />
          </div>
          <button
            data-testid="forgot-password-submit-button"
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-black/45">
          <Link href="/login" className="text-black font-medium hover:underline">← Back to login</Link>
        </p>
      </div>
    </div>
  )
}

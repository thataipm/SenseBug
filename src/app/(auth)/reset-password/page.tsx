'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const [password, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    // Valid if PKCE token_hash is in query params OR implicit access_token is in the URL hash
    const hasImplicitToken = hash.includes('access_token=')
    if (!tokenHash && !hasImplicitToken) {
      setInvalidLink(true)
    }
  }, [searchParams, setInvalidLink])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)

    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type') || 'recovery'

    // Extract implicit-flow tokens from URL hash if PKCE token_hash is absent
    let accessToken: string | null = null
    let refreshToken: string | null = null
    if (!tokenHash && typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      accessToken = hashParams.get('access_token')
      refreshToken = hashParams.get('refresh_token')
    }

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        token_hash: tokenHash,
        type,
        ...(accessToken && { access_token: accessToken, refresh_token: refreshToken }),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to reset password')
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }

  if (invalidLink) {
    return (
      <div className="text-center">
        <p className="text-sm text-black/55 mb-4">This reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-sm text-black font-medium hover:underline">Request a new link</Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-black flex items-center justify-center mx-auto mb-4">
          <span className="text-lg font-black">✓</span>
        </div>
        <h2 className="text-xl font-black mb-2" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Password updated</h2>
        <p className="text-sm text-black/55 mb-6">You can now log in with your new password.</p>
        <Link href="/login" data-testid="back-to-login-after-reset" className="bg-black text-white px-6 py-3 text-sm font-semibold hover:bg-black/90 transition-colors duration-150">
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div data-testid="reset-password-error" className="border border-red-200 bg-red-50 text-red-600 text-sm px-4 py-3">{error}</div>
      )}
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>New password</label>
        <input data-testid="reset-new-password-input" type="password" value={password} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150" placeholder="Min. 8 characters" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-widest text-black/45 mb-2" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>Confirm password</label>
        <input data-testid="reset-confirm-password-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full border border-gray-200 focus:border-black focus:outline-none px-4 py-3 text-sm transition-colors duration-150" placeholder="Re-enter password" />
      </div>
      <button data-testid="reset-password-submit-button" type="submit" disabled={loading} className="w-full bg-black text-white py-3 text-sm font-semibold hover:bg-black/90 transition-colors duration-150 disabled:opacity-50">
        {loading ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <div className="max-w-sm w-full">
        <Link href="/" className="font-black text-xl tracking-tight block mb-10" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>SENSEBUG AI</Link>
        <h1 className="text-3xl font-black tracking-tighter mb-1 " style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Set new password</h1>
        <p className="text-sm text-black/45 mb-8">Choose a new password for your account.</p>
        <Suspense fallback={<div className="text-sm text-black/45">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}

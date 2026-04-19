'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function ResultsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[results] Unhandled error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}>
      <div className="max-w-sm w-full text-center">
        <p className="text-xs font-mono uppercase tracking-widest text-black/30 mb-8" style={{ fontFamily: 'var(--font-ibm-plex-mono), monospace' }}>SENSEBUG</p>
        <h1 className="text-2xl font-black tracking-tighter mb-2" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>Could not load results</h1>
        <p className="text-sm text-black/50 mb-8">An unexpected error occurred while loading this run.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/90 transition-colors duration-150"
          >
            Try again
          </button>
          <Link href="/dashboard" className="border border-gray-200 px-5 py-2.5 text-sm hover:border-black transition-colors duration-150">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

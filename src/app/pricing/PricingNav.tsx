'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function PricingNav() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
    })
  }, [])

  return (
    <nav className="border-b border-gray-200 px-6 md:px-12 py-4 flex items-center justify-between sticky top-0 bg-white z-50">
      <Link href="/" className="font-black text-xl tracking-tight" style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}>
        SENSEBUG AI
      </Link>
      <div className="flex items-center gap-4">
        {isLoggedIn === null ? (
          /* Loading — reserve space to prevent layout shift */
          <div className="h-9 w-36" />
        ) : isLoggedIn ? (
          <Link
            href="/dashboard"
            className="bg-black text-white px-4 py-2 text-sm font-semibold hover:bg-black/85 transition-colors duration-150"
          >
            Go to Dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150">
              Sign in
            </Link>
            <Link href="/signup" className="bg-black text-white px-4 py-2 text-sm font-semibold hover:bg-black/85 transition-colors duration-150">
              Get started free
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

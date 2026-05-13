'use client'
import Script from 'next/script'
import { Play } from 'lucide-react'

// Extend window so TypeScript knows about the Supademo global injected by the script
declare global {
  interface Window {
    Supademo?: { open: (id: string) => void }
  }
}

// Interactive product tour ID — update this if you recreate the Supademo
const DEMO_ID = 'cmp4dakc80bvic0qmr8g0f1g1'

interface Props {
  /**
   * hero    — bordered button with play icon, sits next to the hero CTA
   * pricing — subtle underline link, sits above plan cards
   * nav     — plain text link style, sits in the top nav
   */
  variant?: 'hero' | 'pricing' | 'nav'
}

export function SupademoButton({ variant = 'hero' }: Props) {
  const handleOpen = () => window.Supademo?.open(DEMO_ID)

  return (
    <>
      {/* next/script deduplicates by src, so safe to render in multiple instances */}
      <Script
        src="https://script.supademo.com/supademo.js"
        strategy="lazyOnload"
      />

      {variant === 'hero' && (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 text-sm font-medium text-black/55 hover:text-black border border-black/25 hover:border-black px-6 py-4 transition-colors duration-150"
          style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}
        >
          <Play className="w-3.5 h-3.5 fill-current flex-shrink-0" />
          See a 2-min demo
        </button>
      )}

      {variant === 'pricing' && (
        <button
          onClick={handleOpen}
          className="text-sm text-black/45 hover:text-black transition-colors duration-150 underline underline-offset-2"
          style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}
        >
          See how it works first →
        </button>
      )}

      {variant === 'nav' && (
        <button
          onClick={handleOpen}
          className="text-sm font-medium text-black/50 hover:text-black transition-colors duration-150 hidden md:block"
          style={{ fontFamily: 'var(--font-ibm-plex-sans), sans-serif' }}
        >
          Product tour
        </button>
      )}
    </>
  )
}

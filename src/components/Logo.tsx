import Link from 'next/link'

/**
 * SenseBug logo — mark + wordmark.
 *
 * Props:
 *   href        — destination when clicked (default "/")
 *   markHeight  — SVG mark height in px; text scales to match (default 18)
 *   variant     — "dark" renders white mark+text, for dark backgrounds (default "light")
 *   className   — extra classes on the wrapping element
 */

interface LogoProps {
  href?: string
  markHeight?: number
  variant?: 'light' | 'dark'
  className?: string
}

export function Logo({
  href = '/',
  markHeight = 18,
  variant = 'light',
  className = '',
}: LogoProps) {
  const ink  = variant === 'dark' ? '#FFFFFF' : '#0D0D0D'
  // viewBox: 100 × 44.1 (bars + dot fully contained)
  const svgW = Math.round(markHeight * (100 / 44.1))

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 no-underline ${className}`}
      style={{ color: ink }}
    >
      {/* ── Mark ── */}
      <svg
        width={svgW}
        height={markHeight}
        viewBox="0 0 100 44.1"
        fill="currentColor"
        aria-hidden="true"
        style={{ display: 'block', flexShrink: 0 }}
      >
        {/* bars — longest at top, shortest at bottom, all left-aligned */}
        <rect x="0" y="0"  width="100" height="8.5" />
        <rect x="0" y="17" width="60"  height="8.5" />
        <rect x="0" y="34" width="26"  height="8.5" />
        {/* dot — right of the shortest bar, vertically centred on it */}
        <circle cx="35.5" cy="38.25" r="5.8" />
      </svg>

      {/* ── Wordmark ── */}
      <span
        className="tracking-tight leading-none"
        style={{
          fontFamily: 'var(--font-space-grotesk), sans-serif',
          fontSize: `${markHeight}px`,
          fontWeight: 800,
          color: ink,
        }}
      >
        SENSEBUG
      </span>
    </Link>
  )
}

'use client'
import { ReactNode } from 'react'

/**
 * Reusable card for an integration tile on /settings/integrations.
 *
 * Designed as a grid item — icon + name + one-line description + status badge.
 * Click handler opens the per-integration setup modal (handled by the parent).
 *
 * Status states:
 *   - 'connected'     → green dot, fully interactive
 *   - 'not_connected' → grey dot, fully interactive (opens setup)
 *   - 'coming_soon'   → amber dot, disabled (non-clickable, dimmed)
 */

const HEADING = { fontFamily: 'var(--font-space-grotesk), sans-serif' }
const MONO    = { fontFamily: 'var(--font-ibm-plex-mono), monospace' }

interface IntegrationCardProps {
  name:        string
  description: string
  icon:        ReactNode
  status:      'connected' | 'not_connected' | 'coming_soon'
  onClick?:    () => void
}

const STATUS_CONFIG = {
  connected:     { dot: 'bg-green-500', text: 'text-green-700', label: 'Connected'      },
  not_connected: { dot: 'bg-gray-300',  text: 'text-black/45',  label: 'Not connected'  },
  coming_soon:   { dot: 'bg-amber-400', text: 'text-amber-700', label: 'Coming soon'    },
} as const

export function IntegrationCard({ name, description, icon, status, onClick }: IntegrationCardProps) {
  const isClickable = status !== 'coming_soon' && typeof onClick === 'function'
  const config = STATUS_CONFIG[status]

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`
        text-left border border-gray-200 bg-white p-5 flex items-start gap-4 w-full
        transition-colors duration-150
        ${isClickable
          ? 'hover:border-black cursor-pointer'
          : 'opacity-50 cursor-not-allowed'}
      `}
      aria-label={`${name} integration — ${config.label}`}
    >
      {/* Icon slot — parent passes any ReactNode (logo SVG, lucide icon, etc.) */}
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
        {icon}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-black mb-0.5" style={HEADING}>{name}</p>
        <p className="text-xs text-black/55 leading-relaxed">{description}</p>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
        <span
          className={`text-[11px] uppercase tracking-widest ${config.text}`}
          style={MONO}
        >
          {config.label}
        </span>
      </div>
    </button>
  )
}

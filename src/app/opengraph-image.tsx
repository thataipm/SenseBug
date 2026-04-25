import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'SenseBug AI — AI Bug Prioritization for Product Managers'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#000',
          display: 'flex',
          flexDirection: 'column',
          padding: '72px 80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle grid texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            display: 'flex',
          }}
        />

        {/* Top row: logo mark + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 60 }}>
          {/* Logo square */}
          <div
            style={{
              width: 52,
              height: 52,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 18,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 30,
                fontWeight: 900,
                color: '#000',
                lineHeight: 1,
              }}
            >
              S
            </span>
          </div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            SENSEBUG AI
          </span>
        </div>

        {/* Main headline */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              maxWidth: 680,
            }}
          >
            Bug triage that thinks like your best PM.
          </span>

          <span
            style={{
              fontSize: 24,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.5)',
              marginTop: 24,
              maxWidth: 560,
              lineHeight: 1.5,
            }}
          >
            Upload your Jira or Linear backlog. Get a ranked, impact-scored list in under 60 seconds.
          </span>
        </div>

        {/* Mock priority list */}
        <div
          style={{
            position: 'absolute',
            right: 80,
            top: 160,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            width: 380,
          }}
        >
          {[
            { rank: 1, p: 'P1', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', title: 'Auth bypass on checkout' },
            { rank: 2, p: 'P2', color: '#f97316', bg: 'rgba(249,115,22,0.10)', title: 'Export fails > 500 rows' },
            { rank: 3, p: 'P3', color: '#eab308', bg: 'rgba(234,179,8,0.10)', title: 'Dashboard slow on mobile' },
            { rank: 4, p: 'P4', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', title: 'Tooltip misaligned in FF' },
          ].map((bug) => (
            <div
              key={bug.rank}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.04)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                padding: '14px 16px',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.25)',
                  width: 16,
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {bug.rank}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: bug.color,
                  background: bug.bg,
                  border: `1px solid ${bug.color}33`,
                  padding: '2px 7px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {bug.p}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.7)',
                  fontWeight: 500,
                  overflow: 'hidden',
                }}
              >
                {bug.title}
              </span>
            </div>
          ))}
          {/* Bottom border */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex' }} />
        </div>

        {/* Bottom row: domain */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            sensebug.ai
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '8px 18px',
            }}
          >
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
              Free to start →
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

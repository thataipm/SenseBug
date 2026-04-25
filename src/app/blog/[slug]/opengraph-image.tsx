import { ImageResponse } from 'next/og'
import { getPost } from '../lib/posts'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)

  const title  = post?.title       ?? 'SenseBug AI Blog'
  const cat    = post?.category    ?? 'Product Management'
  const rt     = post?.readTime    ?? ''

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0a0a0a',
          display: 'flex',
          flexDirection: 'column',
          padding: '72px 80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Grid texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            display: 'flex',
          }}
        />

        {/* Accent line top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308)',
            display: 'flex',
          }}
        />

        {/* Category pill */}
        <div style={{ display: 'flex', marginBottom: 36 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#ef4444',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              padding: '6px 14px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {cat}
          </span>
        </div>

        {/* Post title */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'flex-start' }}>
          <span
            style={{
              fontSize: title.length > 60 ? 52 : 62,
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              maxWidth: 920,
            }}
          >
            {title}
          </span>
        </div>

        {/* Bottom row: branding + read time */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: 28,
          }}
        >
          {/* Logo + wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 900, color: '#000', lineHeight: 1 }}>S</span>
            </div>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              SENSEBUG AI
            </span>
          </div>

          {/* Read time */}
          {rt && (
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.05em',
              }}
            >
              {rt}
            </span>
          )}
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

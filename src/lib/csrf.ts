import { NextRequest } from 'next/server'

/**
 * Validates that the request Origin matches the app's own URL.
 *
 * Protects state-mutating API routes (PATCH, DELETE, POST) against
 * cross-site request forgery. Requests with no Origin header (e.g. direct
 * API calls, server-to-server) are allowed through so development tooling
 * is not broken.
 */
export function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // non-browser request (Postman, server-to-server) — allow

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return true // env var not set — fail open in development

  try {
    const originHost = new URL(origin).host
    const appHost = new URL(appUrl).host
    // Normalise www — treat sensebug.com and www.sensebug.com as the same origin
    const strip = (h: string) => h.replace(/^www\./, '')
    return strip(originHost) === strip(appHost)
  } catch {
    return false
  }
}

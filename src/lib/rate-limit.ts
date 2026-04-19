/**
 * In-memory sliding window rate limiter.
 *
 * Suitable for single-process Node.js deployments (standard `next start`).
 * If you move to a multi-instance or serverless deployment (e.g. Vercel),
 * replace this with a Redis-backed solution such as @upstash/ratelimit.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Purge stale entries every 10 minutes to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [key, entry] of store) {
    if (entry.timestamps.every((t) => t < cutoff)) store.delete(key)
  }
}, 10 * 60 * 1000)

export interface RateLimitResult {
  allowed: boolean
  /** How many milliseconds until the oldest request leaves the window. */
  retryAfterMs: number
}

/**
 * @param key        Unique identifier for this limit bucket (e.g. `userId:route`)
 * @param maxRequests  Maximum number of requests allowed within the window
 * @param windowMs   Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const windowStart = now - windowMs

  const entry = store.get(key) ?? { timestamps: [] }
  // Drop timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  if (entry.timestamps.length >= maxRequests) {
    const retryAfterMs = entry.timestamps[0] + windowMs - now
    store.set(key, entry)
    return { allowed: false, retryAfterMs }
  }

  entry.timestamps.push(now)
  store.set(key, entry)
  return { allowed: true, retryAfterMs: 0 }
}

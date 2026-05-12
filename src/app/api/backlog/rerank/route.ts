import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { rerankBacklog } from '@/lib/backlog-rerank'

export const dynamic = 'force-dynamic'

// POST /api/backlog/rerank
// Re-scores and re-ranks all triaged bugs for the authenticated user.
// Rate-limited to 1 request per 60 seconds to avoid hammering the DB.
// Returns { reranked: N } — the number of bugs whose rank was updated.
export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1 re-rank per 60 seconds per user
  const rl = checkRateLimit(`rerank:${user.id}`, 1, 60_000)
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000)
    return NextResponse.json(
      { error: `Rate limited — try again in ${retryAfterSec}s` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    )
  }

  const reranked = await rerankBacklog(supabase, user.id)
  return NextResponse.json({ reranked })
}

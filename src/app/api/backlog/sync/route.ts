import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'
import { fetchJiraIssue } from '@/lib/jira-api'

export const dynamic = 'force-dynamic'

// POST /api/backlog/sync
// Re-fetches a Jira webhook bug from the live Jira API and updates its
// description and comments in the backlog. Called when the user clicks
// "Sync from Jira" in the backlog detail pane.
// Body: { bug_id: string }
export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { bug_id } = body
  if (!bug_id) return NextResponse.json({ error: 'bug_id is required' }, { status: 400 })

  // Verify the entry exists, is owned by the user, and came from a Jira webhook
  const { data: entry } = await supabase
    .from('backlog')
    .select('id, bug_id, source_run_id')
    .eq('user_id', user.id)
    .eq('bug_id', bug_id)
    .single()

  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (entry.source_run_id !== null) {
    return NextResponse.json({ error: 'Sync is only available for Jira webhook bugs' }, { status: 400 })
  }

  // Look up the user's Jira integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('site_url, email, api_token')
    .eq('user_id', user.id)
    .eq('provider', 'jira')
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'No Jira integration found' }, { status: 404 })
  }

  // Fetch the latest issue data from Jira
  let freshData
  try {
    freshData = await fetchJiraIssue(
      integration.site_url,
      integration.email,
      integration.api_token,
      bug_id
    )
  } catch (e) {
    console.error('[backlog/sync] Jira fetch failed for', bug_id, ':', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Failed to fetch from Jira' }, { status: 502 })
  }

  // Update the backlog entry with fresh description and comments.
  // Preserve all triage fields and PM verdicts — only content fields update.
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('backlog')
    .update({
      title:                freshData.title,
      original_description: freshData.description || null,
      original_comments:    freshData.comments    || null,
      reporter_priority:    freshData.reporter_priority,
      last_seen_at:         now,
    })
    .eq('id', entry.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    title:                freshData.title,
    original_description: freshData.description || null,
    original_comments:    freshData.comments    || null,
    reporter_priority:    freshData.reporter_priority,
    last_seen_at:         now,
  })
}

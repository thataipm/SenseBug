import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'
import { fetchJiraIssue } from '@/lib/jira-api'
import { triageSingleBug } from '@/lib/triage-single'
import { getCalibrationBlock } from '@/lib/pm-calibration'

export const dynamic = 'force-dynamic'

// POST /api/backlog/sync
// Re-fetches a Jira webhook bug from the live Jira API, updates its content,
// and re-runs triage if there is now meaningful content.
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
    .select('id, bug_id, source_run_id, pm_action')
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

  const now = new Date().toISOString()
  const hasContent =
    (freshData.description?.trim().length ?? 0) >= 30 ||
    (freshData.comments?.trim().length    ?? 0) >= 10

  // Base update — always refresh raw content fields
  const update: Record<string, unknown> = {
    title:                freshData.title,
    original_description: freshData.description || null,
    original_comments:    freshData.comments    || null,
    reporter_priority:    freshData.reporter_priority,
    last_seen_at:         now,
    // Clear stale AI analysis so it regenerates with the new content
    business_impact:      null,
    rationale:            null,
    improved_description: null,
  }

  // Re-triage if there is now enough content (works for both pending tickets
  // that were stored empty and already-triaged ones that got new info).
  let retriaged = false
  if (hasContent) {
    try {
      const { data: kb } = await supabase
        .from('knowledge_base')
        .select('product_overview, critical_flows, product_areas')
        .eq('user_id', user.id)
        .single()

      const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }
      const calibrationBlock = await getCalibrationBlock(supabase, user.id).catch(() => null)

      const triageResult = await triageSingleBug(
        {
          bug_id:      bug_id,
          title:       freshData.title,
          description: freshData.description,
          comments:    freshData.comments,
          priority:    freshData.reporter_priority,
          labels:      freshData.labels,
          components:  freshData.components,
          status:      freshData.status,
          created:     freshData.created,
          updated:     freshData.updated,
        },
        kbData,
        calibrationBlock
      )

      update.priority     = triageResult.priority
      update.severity     = triageResult.severity
      update.quick_reason = triageResult.quick_reason
      update.gap_flags    = triageResult.gap_flags
      update.rank         = triageResult.rank
      retriaged = true
    } catch (e) {
      // Non-fatal — still save the fresh content even if re-triage fails
      console.error('[backlog/sync] Re-triage failed for', bug_id, ':', e instanceof Error ? e.message : e)
    }
  }

  const { error } = await supabase
    .from('backlog')
    .update(update)
    .eq('id', entry.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    title:                freshData.title,
    original_description: freshData.description || null,
    original_comments:    freshData.comments    || null,
    reporter_priority:    freshData.reporter_priority,
    last_seen_at:         now,
    // Triage fields — included so the UI can update priority/severity badges immediately
    priority:     retriaged ? (update.priority     ?? null) : undefined,
    severity:     retriaged ? (update.severity     ?? null) : undefined,
    quick_reason: retriaged ? (update.quick_reason ?? null) : undefined,
    gap_flags:    retriaged ? (update.gap_flags    ?? [])   : undefined,
    retriaged,
  })
}

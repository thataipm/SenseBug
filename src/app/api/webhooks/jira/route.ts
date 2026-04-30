import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { triageSingleBug } from '@/lib/triage-single'
import { extractAdfText } from '@/lib/jira-api'
import { sendP1AlertEmail } from '@/lib/email'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!secret) {
    return NextResponse.json({ error: 'Missing webhook secret' }, { status: 401 })
  }

  // Identify the user by the secret embedded in their webhook URL.
  // Admin client bypasses RLS — this endpoint has no user session.
  const supabase = createAdminClient()

  const { data: integration } = await supabase
    .from('integrations')
    .select('user_id, site_url, email, api_token, project_key')
    .eq('provider', 'jira')
    .eq('webhook_secret', secret)
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })

  // Jira Automation webhooks nest issue data under body.issue
  const issue = body.issue ?? body
  const fields = issue.fields ?? {}
  const issueKey = String(issue.key ?? issue.id ?? '').trim()

  if (!issueKey) {
    return NextResponse.json({ error: 'No issue key in payload' }, { status: 400 })
  }

  const title            = String(fields.summary ?? 'Untitled')
  const description      = extractAdfText(fields.description)
  const reporterPriority = fields.priority?.name ?? null

  const comments = ((fields.comment?.comments ?? []) as Array<{ body: unknown }>)
    .map(c => extractAdfText(c.body))
    .filter(Boolean)
    .join('\n---\n')

  // Fetch the user's knowledge base so triage has product context
  const { data: kb } = await supabase
    .from('knowledge_base')
    .select('product_overview, critical_flows, product_areas')
    .eq('user_id', integration.user_id)
    .single()

  const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }

  // Triage the bug with Haiku (same model as Pass 1 batch upload)
  let triageResult
  try {
    triageResult = await triageSingleBug(
      { bug_id: issueKey, title, description, comments, priority: reporterPriority },
      kbData
    )
  } catch (e) {
    console.error('[webhook/jira] Triage error for', issueKey, ':', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Triage failed' }, { status: 500 })
  }

  const now = new Date().toISOString()

  // Upsert into backlog — same conflict-safe pattern as the upload route.
  // On re-delivery of the same issue, triage fields update but PM verdicts
  // and detail are preserved (excluded from this row object).
  const { error: upsertErr } = await supabase
    .from('backlog')
    .upsert({
      user_id:              integration.user_id,
      bug_id:               issueKey,
      title,
      rank:                 triageResult.rank,
      priority:             triageResult.priority,
      severity:             triageResult.severity,
      quick_reason:         triageResult.quick_reason,
      gap_flags:            triageResult.gap_flags,
      original_description: description || null,
      original_comments:    comments || null,
      reporter_priority:    reporterPriority,
      source_run_id:        null,
      last_seen_at:         now,
    }, { onConflict: 'user_id,bug_id', ignoreDuplicates: false })

  if (upsertErr) {
    console.error('[webhook/jira] Backlog upsert error:', upsertErr.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Fire-and-forget P1 alert email
  if (triageResult.priority === 'P1') {
    supabase.auth.admin.getUserById(integration.user_id).then(({ data }) => {
      const email = data?.user?.email
      if (email) {
        sendP1AlertEmail({
          to:          email,
          bugId:       issueKey,
          title,
          quickReason: triageResult.quick_reason,
          severity:    triageResult.severity,
        }).catch(e => console.error('[webhook/jira] P1 alert email failed:', e instanceof Error ? e.message : e))
      }
    })
  }

  console.log(`[webhook/jira] ${issueKey} → ${triageResult.priority}/${triageResult.severity} for user ${integration.user_id}`)
  return NextResponse.json({ success: true, priority: triageResult.priority, severity: triageResult.severity })
}

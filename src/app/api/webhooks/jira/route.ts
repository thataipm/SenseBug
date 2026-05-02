import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { triageSingleBug } from '@/lib/triage-single'
import { extractAdfText, normalizeJiraPriority } from '@/lib/jira-api'
import { sendP1AlertEmail } from '@/lib/email'
import { getCalibrationBlock } from '@/lib/pm-calibration'

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

  // Only process bug-type issues — tasks, stories, epics etc. are not relevant
  // for bug triage and should be silently ignored (200 so Jira doesn't retry).
  const BUG_ISSUE_TYPES = ['bug', 'defect', 'error', 'incident', 'problem']
  const issueTypeName   = fields.issuetype?.name
    ? String(fields.issuetype.name).toLowerCase().trim()
    : null
  // If the payload includes an issuetype and it's not bug-like, skip it
  if (issueTypeName && !BUG_ISSUE_TYPES.some(t => issueTypeName.includes(t))) {
    console.log(`[webhook/jira] Skipping ${issueKey} — issue type '${fields.issuetype?.name}' is not a bug type`)
    return NextResponse.json({ skipped: true, reason: `Issue type '${fields.issuetype?.name}' is not analysed by SenseBug` })
  }

  const title            = String(fields.summary ?? 'Untitled')
  const description      = extractAdfText(fields.description)
  const reporterPriority = normalizeJiraPriority(fields.priority?.name)

  const comments = ((fields.comment?.comments ?? []) as Array<{ body: unknown; author?: { displayName?: string }; created?: string }>)
    .map(c => {
      const text   = extractAdfText(c.body)
      if (!text.trim()) return null
      const author = c.author?.displayName ?? 'Unknown'
      const date   = c.created
        ? new Date(c.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null
      return date ? `[${author}, ${date}]: ${text.trim()}` : `[${author}]: ${text.trim()}`
    })
    .filter((s): s is string => s !== null)
    .join('\n---\n')

  const labels     = ((fields.labels     ?? []) as string[]).filter(Boolean)
  const components = ((fields.components ?? []) as Array<{ name?: string }>).map(c => c.name ?? '').filter(Boolean)
  const status     = fields.status?.name  ?? null
  const created    = fields.created       ?? null
  const updated    = fields.updated       ?? null

  const now = new Date().toISOString()

  // Content gate — if the ticket has no meaningful description yet (PM just
  // created it with a title), skip triage and store it as pending (priority=null).
  // The cron job will re-check it every 30 minutes and triage once content appears.
  const hasContent = (description?.trim().length ?? 0) >= 30 || (comments?.trim().length ?? 0) >= 10
  if (!hasContent) {
    const { error: upsertErr } = await supabase
      .from('backlog')
      .upsert({
        user_id:              integration.user_id,
        bug_id:               issueKey,
        title,
        rank:                 null,
        priority:             null,
        severity:             null,
        quick_reason:         null,
        gap_flags:            [],
        original_description: description || null,
        original_comments:    comments    || null,
        reporter_priority:    reporterPriority,
        source_run_id:        null,
        last_seen_at:         now,
        detail_generated_at:  null,
      }, { onConflict: 'user_id,bug_id', ignoreDuplicates: false })

    if (upsertErr) {
      console.error('[webhook/jira] Backlog upsert error (pending):', upsertErr.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    console.log(`[webhook/jira] ${issueKey} stored as pending triage — no content yet`)
    return NextResponse.json({ success: true, status: 'pending_triage' })
  }

  // Fetch the user's knowledge base so triage has product context
  const { data: kb } = await supabase
    .from('knowledge_base')
    .select('product_overview, critical_flows, product_areas')
    .eq('user_id', integration.user_id)
    .single()

  const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }

  // Fetch calibration block — non-fatal if absent or under threshold
  const calibrationBlock = await getCalibrationBlock(supabase, integration.user_id).catch(() => null)

  // Triage with Haiku — pass all available Jira context.
  // If triage fails for any reason (AI error, parse failure, rate limit),
  // fall back to storing the ticket as pending so the cron retries it.
  // Always return 200 to Jira — a non-2xx causes Jira to retry indefinitely
  // and logs an error in the Automation audit trail.
  let triageResult
  try {
    triageResult = await triageSingleBug(
      { bug_id: issueKey, title, description, comments, priority: reporterPriority,
        labels, components, status, created, updated },
      kbData,
      calibrationBlock
    )
  } catch (e) {
    console.error('[webhook/jira] Triage error for', issueKey, '— storing as pending:', e instanceof Error ? e.message : e)
    // Store with no triage fields — cron will retry within 30 minutes
    await supabase.from('backlog').upsert({
      user_id:              integration.user_id,
      bug_id:               issueKey,
      title,
      rank:                 null,
      priority:             null,
      severity:             null,
      quick_reason:         null,
      gap_flags:            [],
      original_description: description || null,
      original_comments:    comments    || null,
      reporter_priority:    reporterPriority,
      source_run_id:        null,
      last_seen_at:         now,
      detail_generated_at:  null,
    }, { onConflict: 'user_id,bug_id', ignoreDuplicates: false })
    return NextResponse.json({ success: true, status: 'pending_triage' })
  }

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
      original_comments:    comments    || null,
      reporter_priority:    reporterPriority,
      source_run_id:        null,
      last_seen_at:         now,
      detail_generated_at:  null,
    }, { onConflict: 'user_id,bug_id', ignoreDuplicates: false })

  if (upsertErr) {
    console.error('[webhook/jira] Backlog upsert error:', upsertErr.message)
    // Still return 200 — the upsert failing shouldn't cause Jira to retry
    return NextResponse.json({ success: true, status: 'db_error', detail: upsertErr.message })
  }

  // P1 alert email — awaited so Vercel doesn't kill the function before it sends
  if (triageResult.priority === 'P1') {
    const { data: userData } = await supabase.auth.admin.getUserById(integration.user_id)
    const alertEmail = userData?.user?.email
    if (alertEmail) {
      await sendP1AlertEmail({
        to:          alertEmail,
        bugId:       issueKey,
        title,
        quickReason: triageResult.quick_reason,
        severity:    triageResult.severity,
      }).catch(e => console.error('[webhook/jira] P1 alert email failed:', e instanceof Error ? e.message : e))
    }
  }

  // Increment monthly bug counter — fire-and-forget, non-fatal.
  // Webhook bugs are Pro-only so we don't need to gate; just track usage.
  ;(async () => {
    try {
      const { data: planRow } = await supabase
        .from('user_plans')
        .select('monthly_bugs_consumed')
        .eq('user_id', integration.user_id)
        .single()
      if (!planRow) return
      await supabase
        .from('user_plans')
        .update({ monthly_bugs_consumed: (planRow.monthly_bugs_consumed ?? 0) + 1 })
        .eq('user_id', integration.user_id)
    } catch (e) {
      console.error('[webhook/jira] Usage counter update failed:', e instanceof Error ? e.message : e)
    }
  })()

  console.log(`[webhook/jira] ${issueKey} → ${triageResult.priority}/${triageResult.severity} for user ${integration.user_id}`)
  return NextResponse.json({ success: true, priority: triageResult.priority, severity: triageResult.severity })
}

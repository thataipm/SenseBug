/**
 * Jira sync cron job — runs every 30 minutes (configured in vercel.json).
 *
 * Finds all unreviewed Jira webhook bugs that either:
 *   (a) have never been triaged (priority IS NULL — arrived with no content), or
 *   (b) haven't been checked in 2+ hours (content may have been updated in Jira)
 *
 * For each ticket it:
 *   1. Re-fetches the latest description + comments from the Jira API
 *   2. If content has changed OR priority is null, re-runs triage (Haiku Pass 1)
 *   3. Updates the backlog row with fresh content + triage results
 *   4. Fires a P1 alert email if a previously-pending ticket now triages as P1
 *
 * Stops polling tickets older than 7 days — if a PM hasn't looked at it by then,
 * it will surface when they manually sync.
 *
 * Authentication: Vercel sends Authorization: Bearer <CRON_SECRET> automatically.
 * Set CRON_SECRET in your Vercel environment variables.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchJiraIssue } from '@/lib/jira-api'
import { triageSingleBug } from '@/lib/triage-single'
import { getCalibrationBlock } from '@/lib/pm-calibration'
import { sendP1AlertEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Allow up to 5 minutes — processes many tickets concurrently across users
export const maxDuration = 300

const CONTENT_MIN_DESC    = 30   // chars — minimum description length to trigger triage
const CONTENT_MIN_COMMENT = 10   // chars — minimum comment length to trigger triage
const STALE_HOURS         = 2    // re-check tickets last seen more than N hours ago
const MAX_AGE_DAYS        = 7    // stop polling tickets older than N days
const MAX_TICKETS_PER_RUN = 100  // safety cap to avoid runaway Jira API usage
const CONCURRENCY         = 5    // max parallel Jira API + triage calls per user

/**
 * Run `fn` over `items` with at most `limit` concurrent promises at a time.
 * Resolves when all items have been processed (errors are caught inside fn).
 */
async function runConcurrent<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const executing = new Set<Promise<void>>()
  for (const item of items) {
    const p: Promise<void> = fn(item).finally(() => executing.delete(p))
    executing.add(p)
    if (executing.size >= limit) await Promise.race(executing)
  }
  await Promise.all(executing)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now      = new Date()

  const staleThreshold  = new Date(now.getTime() - STALE_HOURS * 60 * 60 * 1000).toISOString()
  const maxAgeThreshold = new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Fetch tickets that need attention:
  //   - Jira webhook bugs (source_run_id IS NULL)
  //   - Not yet reviewed by PM (pm_action IS NULL)
  //   - Not too old (first_seen_at within MAX_AGE_DAYS)
  //   - Either: never triaged (priority IS NULL) OR stale (last_seen_at old enough)
  const { data: pending, error: fetchErr } = await supabase
    .from('backlog')
    .select('id, user_id, bug_id, priority, original_description, original_comments')
    .is('source_run_id', null)
    .is('pm_action', null)
    .gte('first_seen_at', maxAgeThreshold)
    .or(`priority.is.null,last_seen_at.lte.${staleThreshold}`)
    .limit(MAX_TICKETS_PER_RUN)

  if (fetchErr) {
    console.error('[cron/jira-sync] DB fetch error:', fetchErr.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!pending || pending.length === 0) {
    console.log('[cron/jira-sync] Nothing to sync.')
    return NextResponse.json({ processed: 0, retriaged: 0, unchanged: 0 })
  }

  console.log(`[cron/jira-sync] Found ${pending.length} tickets to check`)

  // Group by user_id so we fetch each user's Jira integration once
  const byUser = pending.reduce<Record<string, typeof pending>>((acc, row) => {
    if (!acc[row.user_id]) acc[row.user_id] = []
    acc[row.user_id].push(row)
    return acc
  }, {})

  let processed = 0
  let retriaged = 0
  let unchanged = 0

  for (const [userId, tickets] of Object.entries(byUser)) {
    // Fetch this user's Jira integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('site_url, email, api_token')
      .eq('user_id', userId)
      .eq('provider', 'jira')
      .single()

    if (!integration) {
      console.warn(`[cron/jira-sync] No Jira integration for user ${userId} — skipping ${tickets.length} tickets`)
      continue
    }

    // Fetch KB + calibration + user email once per user (reused by all concurrent tasks)
    const { data: kb } = await supabase
      .from('knowledge_base')
      .select('product_overview, critical_flows, product_areas')
      .eq('user_id', userId)
      .single()

    const kbData           = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }
    const calibrationBlock = await getCalibrationBlock(supabase, userId).catch(() => null)

    // Fetch user email once — reused by P1 alert for any ticket in this batch
    const { data: userData } = await supabase.auth.admin.getUserById(userId)
    const alertEmail = userData?.user?.email ?? null

    // Process all tickets for this user with bounded concurrency.
    // JS is single-threaded so counter mutations (processed++, etc.) are safe.
    await runConcurrent(tickets, CONCURRENCY, async (ticket) => {
      processed++
      try {
        // Fetch fresh data from Jira
        const freshData = await fetchJiraIssue(
          integration.site_url,
          integration.email,
          integration.api_token,
          ticket.bug_id
        )

        const newDesc     = freshData.description || null
        const newComments = freshData.comments    || null

        const hasContent =
          (newDesc?.trim().length     ?? 0) >= CONTENT_MIN_DESC ||
          (newComments?.trim().length ?? 0) >= CONTENT_MIN_COMMENT

        const contentChanged =
          newDesc     !== ticket.original_description ||
          newComments !== ticket.original_comments

        const needsTriage = ticket.priority === null || contentChanged

        if (!hasContent && !contentChanged) {
          // Still empty and nothing changed — just touch last_seen_at and move on
          await supabase
            .from('backlog')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', ticket.id)
          unchanged++
          return
        }

        const update: Record<string, unknown> = {
          title:                freshData.title,
          original_description: newDesc,
          original_comments:    newComments,
          reporter_priority:    freshData.reporter_priority,
          last_seen_at:         new Date().toISOString(),
        }

        // Re-triage if there's new content or the ticket was previously pending
        let newPriority: string | null = null
        if (hasContent && needsTriage) {
          const triageResult = await triageSingleBug(
            {
              bug_id:      ticket.bug_id,
              title:       freshData.title,
              description: newDesc,
              comments:    newComments,
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
          // Clear cached AI detail so it regenerates with the new content.
          // detail_generated_at MUST be cleared — the detail route uses it
          // as a cache-hit guard and returns null fields forever if it remains set.
          update.business_impact      = null
          update.rationale            = null
          update.improved_description = null
          update.detail_generated_at  = null

          newPriority = triageResult.priority
          retriaged++

          console.log(`[cron/jira-sync] ${ticket.bug_id} → ${triageResult.priority}/${triageResult.severity} (was ${ticket.priority ?? 'pending'})`)
        } else {
          unchanged++
        }

        await supabase.from('backlog').update(update).eq('id', ticket.id)

        // Fire P1 alert if this ticket just got triaged as P1 for the first time
        if (newPriority === 'P1' && ticket.priority === null && alertEmail) {
          await sendP1AlertEmail({
            to:          alertEmail,
            bugId:       ticket.bug_id,
            title:       freshData.title,
            quickReason: String(update.quick_reason ?? ''),
            severity:    String(update.severity     ?? 'High'),
          }).catch(e => console.error('[cron/jira-sync] P1 alert email failed:', e instanceof Error ? e.message : e))
        }
      } catch (e) {
        console.error(`[cron/jira-sync] Error processing ${ticket.bug_id}:`, e instanceof Error ? e.message : e)
        // Continue with next ticket — one failure shouldn't stop the whole run
      }
    })
  }

  console.log(`[cron/jira-sync] Done — processed: ${processed}, retriaged: ${retriaged}, unchanged: ${unchanged}`)
  return NextResponse.json({ processed, retriaged, unchanged })
}

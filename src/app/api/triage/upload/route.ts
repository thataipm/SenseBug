import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { ensureUserPlan, getPlanLimits } from '@/lib/plan'
import { checkRateLimit } from '@/lib/rate-limit'
import Papa from 'papaparse'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are an expert Product Manager specialising in bug triage and prioritization. Your job is to analyse a list of bug tickets against a product knowledge base and produce a prioritized ranked list with plain-English reasoning.

CRITICAL RULE — REPORTER BIAS REMOVAL:
The priority or severity label already on a ticket was assigned by the reporter, who has a vested interest in their own bugs being fixed first. Treat those existing labels as unreliable signals. You must derive severity and priority independently from the actual ticket content — description, reproduction steps, environment, comments, and KB context — not from what the reporter labelled it. If a reporter marked something P1 but the content describes a minor cosmetic issue, your output should reflect the true impact, not the reporter's label.

You must respond with a valid JSON array only. No preamble, no explanation, no markdown fences. Just the raw JSON array. If a ticket has insufficient information to rank meaningfully, still include it but flag it in gap_flags and place it at the bottom of the ranking.`

// ─── Helper: column finder ───────────────────────────────────────────────────

function findCol(keys: string[], accepted: string[]): string | undefined {
  // Pass 1: exact match after normalizing whitespace to underscores
  const exact = keys.find((k) => accepted.includes(k.toLowerCase().replace(/\s+/g, '_')))
  if (exact) return exact
  // Pass 2: starts-with match — handles "Priority Level" → "priority", but avoids
  // false positives like "Top Priority" or "Comment Count" accidentally matching.
  return keys.find((k) => {
    const kn = k.toLowerCase()
    return accepted.some((a) => kn === a || kn.startsWith(a + '_') || kn.startsWith(a + ' '))
  })
}

// ─── Helper: column validation ───────────────────────────────────────────────

interface Columns {
  idCol: string
  titleCol: string
  descCol: string | undefined
  priorityCol: string | undefined
}

function validateColumns(keys: string[]): { cols: Columns | null; missing: string[] } {
  const idCol = findCol(keys, ['id', 'key', 'issue_key', 'issue id', 'issueid'])
  const titleCol = findCol(keys, ['title', 'summary', 'name'])
  const descCol = findCol(keys, ['description', 'body', 'details', 'desc', 'issue_description', 'ticket_description', 'bug_description', 'text', 'content', 'issue_body'])
  const priorityCol = findCol(keys, ['priority', 'severity'])

  const missing: string[] = []
  if (!idCol) missing.push('id / key / issue_key')
  if (!titleCol) missing.push('title / summary')
  if (!priorityCol) missing.push('priority / severity')

  if (missing.length > 0 || !idCol || !titleCol) return { cols: null, missing }
  return { cols: { idCol, titleCol, descCol, priorityCol }, missing: [] }
}

// ─── Helper: build LLM bug payload ───────────────────────────────────────────

type BugRow = Record<string, string>

// Column name patterns that are pure noise for bug triage — skip these even
// if they contain values (dates, attachment URLs, internal IDs, agile metadata).
const NOISY_COL_RE = /\b(created|updated|modified|resolved|due.?date|timestamp|attachment|image|icon|avatar|watcher|vote|account.?id|board|sprint|story.?point|\bsp\b)\b/i

// Value-level noise: ISO dates, plain numbers, URLs — no signal for triage.
function isNoisyValue(v: string): boolean {
  const t = v.trim()
  if (!t) return true
  if (/^\d+$/.test(t)) return true               // pure number
  if (/^https?:\/\//i.test(t)) return true        // URL
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return true  // ISO date
  return false
}

function buildBugsForLlm(bugs: BugRow[], cols: Columns, keys: string[]): BugRow[] {
  // ── Explicitly mapped fields ──────────────────────────────────────────────
  const commentCol   = findCol(keys, ['comments', 'comment', 'notes', 'note', 'additional_notes', 'user_notes', 'internal_notes', 'feedback', 'discussion'])
  const reporterCol  = findCol(keys, ['reporter', 'reporter_name', 'reported_by'])
  const assigneeCol  = findCol(keys, ['assignee', 'assigned_to'])
  const labelsCol    = findCol(keys, ['labels', 'tags'])
  const componentCol = findCol(keys, ['component', 'components', 'module', 'area', 'team'])
  const stepsCol     = findCol(keys, ['steps_to_reproduce', 'steps', 'repro_steps', 'reproduction_steps', 'how_to_reproduce'])
  const envCol       = findCol(keys, ['environment', 'env', 'platform', 'os', 'browser', 'device'])
  const actualCol    = findCol(keys, ['actual_result', 'actual_behavior', 'actual_outcome', 'actual'])
  const expectedCol  = findCol(keys, ['expected_result', 'expected_behavior', 'expected_outcome', 'expected'])
  const statusCol    = findCol(keys, ['status', 'state', 'resolution'])
  const versionCol   = findCol(keys, ['affects_version', 'affects_versions', 'version', 'found_in_version', 'fix_version'])
  const epicCol      = findCol(keys, ['epic', 'epic_name', 'epic_link', 'feature', 'initiative'])

  // Columns we've already handled — exclude from the extra-context sweep
  const handledCols = new Set<string>(
    [cols.idCol, cols.titleCol, cols.descCol, cols.priorityCol,
     commentCol, reporterCol, assigneeCol, labelsCol, componentCol,
     stepsCol, envCol, actualCol, expectedCol, statusCol, versionCol, epicCol,
    ].filter((c): c is string => !!c)
  )

  return bugs.map((row) => {
    const rawDesc = cols.descCol ? row[cols.descCol] || '' : ''
    const bug: BugRow = {
      bug_id:      row[cols.idCol] || '',
      title:       row[cols.titleCol] || '',
      description: rawDesc ? rawDesc.slice(0, 2000) : '[No description provided]',
      priority:    cols.priorityCol ? row[cols.priorityCol] || '' : '',
    }

    // Append explicitly-mapped optional fields when present
    if (stepsCol    && row[stepsCol])    bug.steps_to_reproduce = row[stepsCol].slice(0, 500)
    if (envCol      && row[envCol])      bug.environment        = row[envCol].slice(0, 200)
    if (actualCol   && row[actualCol])   bug.actual_result      = row[actualCol].slice(0, 300)
    if (expectedCol && row[expectedCol]) bug.expected_result    = row[expectedCol].slice(0, 300)
    if (statusCol   && row[statusCol])   bug.status             = row[statusCol]
    if (componentCol&& row[componentCol])bug.component          = row[componentCol]
    if (versionCol  && row[versionCol])  bug.version            = row[versionCol]
    if (epicCol     && row[epicCol])     bug.epic               = row[epicCol]
    if (commentCol  && row[commentCol])  bug.comments           = row[commentCol].slice(0, 1500)
    if (reporterCol && row[reporterCol]) bug.reporter           = row[reporterCol]
    if (assigneeCol && row[assigneeCol]) bug.assignee           = row[assigneeCol]
    if (labelsCol   && row[labelsCol])   bug.labels             = row[labelsCol]

    // ── Extra-context sweep ───────────────────────────────────────────────
    // Pick up any remaining columns we haven't explicitly mapped that look
    // like useful text (not dates, not URLs, not pure numbers, not noise headers).
    const extras: string[] = []
    for (const key of keys) {
      if (handledCols.has(key)) continue
      if (NOISY_COL_RE.test(key)) continue
      const val = row[key]?.trim()
      if (!val || isNoisyValue(val)) continue
      extras.push(`${key}: ${val.slice(0, 200)}`)
    }
    if (extras.length > 0) bug.extra_context = extras.join(' | ')

    return bug
  })
}

// ─── Helper: retrieve KB context via vector search ───────────────────────────

async function getKBContext(
  supabase: SupabaseClient,
  userId: string,
  bugsForLlm: BugRow[]
): Promise<string> {
  const combinedText = bugsForLlm
    .slice(0, 20)
    .map((b) => `${b.title} ${b.description}`)
    .join(' ')
    .slice(0, 8000)

  const embResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: combinedText,
  })
  const embedding = embResponse.data[0].embedding

  const { data: chunks } = await supabase.rpc('match_kb_documents', {
    query_embedding: embedding,
    match_count: 3,
    filter_user_id: userId,
  })

  if (!chunks || chunks.length === 0) return 'No relevant documentation context available.'
  return chunks
    .map((c: { filename: string; chunk_text: string }) => `[${c.filename}]: ${c.chunk_text}`)
    .join('\n\n')
}

// ─── Helper: build and call Claude via Python LLM endpoint ──────────────────

function buildUserPrompt(
  kb: Record<string, string>,
  retrievedChunks: string,
  bugsJson: string
): string {
  return `PRODUCT KNOWLEDGE BASE
Product overview: ${kb.product_overview}
Critical user flows: ${kb.critical_flows}
Product areas / modules: ${kb.product_areas}
Relevant documentation context: ${retrievedChunks}

BUGS TO PRIORITIZE
${bugsJson}

INSTRUCTIONS
For each bug, analyse it against the product knowledge base and return a JSON object with these exact fields:
bug_id: string — the issue key from the input
title: string — bug title from the input
rank: number — 1 = fix first, no ties allowed
priority: string — one of: P1, P2, P3, P4
severity: string — one of: Critical, High, Medium, Low
business_impact: string — 1 to 2 sentences. Why does this matter to the business or users?
rationale: string — 2 to 3 sentences. Explain your ranking, referencing KB context where relevant. If your severity differs from the reporter-assigned label, briefly explain why.
gap_flags: string[] — empty array if none. Use these exact values when applicable:
'Missing description', 'No reproduction steps', 'Missing environment info', 'Vague impact statement', 'Likely over-prioritised'
improved_description: string | null — When gap_flags contains at least one quality flag (Missing description, No reproduction steps, Missing environment info, or Vague impact statement): write a clear, actionable 2-3 sentence improved ticket description a developer could act on immediately — covering what is broken, the user or business impact, and reproduction steps if inferable from context or the KB. Return null if gap_flags has no quality flags (ticket is already well-written).

EXPLICIT SCORING OVERRIDES — apply these before general scoring priorities. They are not guidelines; they are hard rules:

Rule 1 — Security exploit hierarchy:
Actively exploitable security vulnerabilities (authentication bypass, unauthorized data access, permission escalation, session hijacking) must ALWAYS rank above configuration or access management issues — even when both carry Critical severity. A bug that lets an attacker bypass 2FA or access other users' data is categorically more urgent than an admin losing their own access. Within security bugs, rank by exploitability: externally triggerable > requires account > requires physical access.

Rule 2 — Financial data integrity:
Any bug that causes financial data corruption, incorrect calculations affecting audited statements, loss of billable hours records, or payroll errors must be treated as Critical severity regardless of how it was labelled by the reporter or in Jira. Silent data loss is worse than visible errors. If money figures or billing records are silently deleted or miscalculated, that is Critical.

Rule 3 — Recency and escalation velocity:
A bug reported weeks ago with zero escalation, no follow-up comments, and no customer mentions should rank lower than an otherwise identical bug reported recently with active customer impact. Recency alone is a weak signal, but recency combined with growing support volume, active escalation, or new customer mentions in comments is a strong signal. Check the created date and comments carefully.

Rule 4 — ARR and churn signals in comments:
When the comments field explicitly mentions: a customer name alongside an ARR value, a churn threat, a cancellation warning, a formal escalation from account management, or a specific dollar amount at risk — extract that signal and weight it explicitly in the business_impact field. Call it out by name (e.g. "Customer X ($Y ARR) has threatened cancellation"). Do not bury it in general phrasing.

Rule 5 — Billing history vs. current period:
Billing and invoicing bugs that affect only historical records (e.g. broken download of invoices older than 12 months, incorrect historical reporting) should rank Medium or lower. They cause friction but do not block current operations. Only elevate to High or above if the bug affects the current billing period, blocks payment processing, or prevents customers from paying or being paid today.

General scoring priorities (apply after overrides above, in order of weight):
1. Does this bug affect a critical user flow listed in the KB? If yes, rank higher.
2. How severely does it break functionality — crash or data loss outranks degraded outranks cosmetic.
3. Stakeholder urgency signals — a bug escalated by customer success from a paying customer carries more weight than an internal dev report.
4. Sentiment signals in descriptions and comments — phrases like "blocking", "losing customers", "client escalation", "can't use", "very annoyed", "revenue impact" indicate real urgency. Weight these into impact scoring.
5. How many users are affected — infer from description and comments.
6. Ticket quality — vague tickets with no description rank lower.

When to use 'Likely over-prioritised' in gap_flags:
Add this flag when a bug has a high reporter-assigned priority OR significant comment noise (many comments, strong language, escalations) BUT the actual content describes low real-world impact — cosmetic issues, edge cases affecting very few users, or problems with easy workarounds. This is the most politically useful signal you can give a PM.

Return only the JSON array. No other text.`
}

function cleanJsonResponse(text: string): string {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  return text.trim()
}

// Bugs are split into batches so each Claude response stays well within the
// 8 192-token output limit. Batches run in parallel so total latency is the
// same as a single call. Results are merged and globally re-ranked afterwards.
const BATCH_SIZE = 25

async function callClaudeBatch(
  anthropic: Anthropic,
  kbData: Record<string, string>,
  retrievedChunks: string,
  batch: BugRow[]
): Promise<Record<string, unknown>[]> {
  const userPrompt = buildUserPrompt(kbData, retrievedChunks, JSON.stringify(batch, null, 2))
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = cleanJsonResponse(raw)
  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Expected a JSON array from the LLM but got a different type')
    return parsed as Record<string, unknown>[]
  } catch (e) {
    console.error('[triage] Failed to parse batch LLM response:', cleaned)
    throw new Error(
      e instanceof SyntaxError
        ? 'The AI returned a malformed response. Please try again.'
        : e instanceof Error ? e.message : 'Unexpected response format from the AI.'
    )
  }
}

async function callClaude(
  kb: Record<string, string> | null,
  retrievedChunks: string,
  bugsForLlm: BugRow[]
): Promise<Record<string, unknown>[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in environment variables')

  const anthropic = new Anthropic({ apiKey })
  const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }

  // Split into batches and run all in parallel
  const batches: BugRow[][] = []
  for (let i = 0; i < bugsForLlm.length; i += BATCH_SIZE) {
    batches.push(bugsForLlm.slice(i, i + BATCH_SIZE))
  }

  const batchResults = await Promise.all(
    batches.map((batch) => callClaudeBatch(anthropic, kbData, retrievedChunks, batch))
  )
  const allResults = batchResults.flat()

  // Re-rank globally: sort by AI-assigned priority then severity, assign ranks 1..N
  const PRIORITY_SCORE: Record<string, number> = { p1: 0, critical: 0, p2: 1, high: 1, p3: 2, medium: 2, p4: 3, low: 3 }
  const SEVERITY_SCORE: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  allResults.sort((a, b) => {
    const pa = PRIORITY_SCORE[String(a.priority ?? '').toLowerCase()] ?? 5
    const pb = PRIORITY_SCORE[String(b.priority ?? '').toLowerCase()] ?? 5
    if (pa !== pb) return pa - pb
    const sa = SEVERITY_SCORE[String(a.severity ?? '').toLowerCase()] ?? 5
    const sb = SEVERITY_SCORE[String(b.severity ?? '').toLowerCase()] ?? 5
    return sa - sb
  })

  return allResults.map((r, i) => ({ ...r, rank: i + 1 }))
}

// ─── Helper: store triage run and results ─────────────────────────────────────

async function storeTriage(
  supabase: SupabaseClient,
  userId: string,
  filename: string,
  llmResults: Record<string, unknown>[],
  originalBugs: BugRow[]
) {
  // Filter out any LLM results with empty bug_id before storing
  const validResults = llmResults.filter((r) => r.bug_id && String(r.bug_id).trim() !== '')

  // Build a map of original bug data keyed by bug_id for O(1) lookup
  const bugMap = new Map(originalBugs.map((b) => [String(b.bug_id), b]))

  const { data: run } = await supabase
    .from('triage_runs')
    .insert({ user_id: userId, filename, bug_count: validResults.length })
    .select()
    .single()

  if (!run) throw new Error('Failed to create triage run')

  const toInsert = validResults.map((r) => {
    const orig = bugMap.get(String(r.bug_id || ''))
    const rawDesc = orig?.description
    return {
      run_id: run.id,
      bug_id: String(r.bug_id || ''),
      title: String(r.title || ''),
      rank: Number(r.rank) || 999,
      priority: String(r.priority || 'P4'),
      severity: String(r.severity || 'Low'),
      business_impact: String(r.business_impact || ''),
      rationale: String(r.rationale || ''),
      gap_flags: Array.isArray(r.gap_flags) ? r.gap_flags : [],
      original_description: rawDesc && rawDesc !== '[No description provided]' ? rawDesc : null,
      reporter_priority: orig?.priority || null,
      improved_description: r.improved_description ? String(r.improved_description) : null,
    }
  })

  const { data: results } = await supabase.from('triage_results').insert(toInsert).select()
  return { run, results: results || [] }
}

// ─── Main route handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 3 triage uploads per minute per user
  const { allowed, retryAfterMs } = checkRateLimit(`triage:${user.id}`, 3, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before uploading again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  // Plan limits — increment run count for tracking (no per-run gate anymore)
  const plan = await ensureUserPlan(supabase, user.id)
  const limits = getPlanLimits(plan.plan)
  await supabase
    .from('user_plans')
    .update({ monthly_runs_count: (plan.monthly_runs_count || 0) + 1 })
    .eq('user_id', user.id)

  // Alias for clarity — this counter never decreases when runs are deleted
  const bugsConsumedSoFar = plan.monthly_bugs_consumed || 0

  // Parse file
  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 10MB.' }, { status: 400 })
  }

  const fname = file.name.toLowerCase()
  const isExcel = fname.endsWith('.xlsx') || fname.endsWith('.xls')
  const isCsvOrTsv = fname.endsWith('.csv') || fname.endsWith('.tsv') || fname.endsWith('.txt')
  if (!isExcel && !isCsvOrTsv) {
    return NextResponse.json({ error: 'Supported formats: CSV, TSV, Excel (.xlsx/.xls).' }, { status: 400 })
  }

  let rows: BugRow[]
  if (isExcel) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx')
      const buffer = Buffer.from(await file.arrayBuffer())
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as BugRow[]
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: `Failed to parse Excel file: ${msg}` }, { status: 400 })
    }
  } else {
    const parsed = Papa.parse<BugRow>(await file.text(), { header: true, skipEmptyLines: true })
    rows = parsed.data
  }

  if (!rows?.length) return NextResponse.json({ error: 'No data rows found in this file.' }, { status: 400 })

  // Validate columns
  const { cols, missing } = validateColumns(Object.keys(rows[0]))
  if (!cols) {
    return NextResponse.json({ error: `Missing required columns: ${missing.join(', ')}`, missing_columns: missing }, { status: 400 })
  }

  // Deduplicate rows by bug ID — Jira exports create multiple rows per bug for
  // multi-value fields (Comments, Watchers, Attachments). Keep first occurrence.
  const seenIds = new Set<string>()
  const dedupedRows = rows.filter((row) => {
    const id = row[cols.idCol]?.trim()
    if (!id || seenIds.has(id)) return false
    seenIds.add(id)
    return true
  })

  if (!dedupedRows.length) {
    return NextResponse.json({ error: 'No valid bug IDs found in this file.' }, { status: 400 })
  }

  let trimmedWarning: string | null = null

  // Warn if any bug IDs in this upload were already triaged in a previous run
  const uploadedIds = Array.from(seenIds)
  const { data: previousRuns } = await supabase
    .from('triage_runs')
    .select('id')
    .eq('user_id', user.id)
  const previousRunIds = (previousRuns || []).map((r: { id: string }) => r.id)
  if (previousRunIds.length > 0) {
    const { data: existingResults } = await supabase
      .from('triage_results')
      .select('bug_id')
      .in('run_id', previousRunIds)
    const existingIds = new Set((existingResults || []).map((r: { bug_id: string }) => r.bug_id))
    const duplicates = uploadedIds.filter((id) => existingIds.has(id))
    if (duplicates.length > 0) {
      const dupMsg = `${duplicates.length} bug${duplicates.length > 1 ? 's' : ''} in this upload were already triaged in a previous run.`
      trimmedWarning = trimmedWarning ? `${trimmedWarning} ${dupMsg}` : dupMsg
    }
  }

  // ── Monthly bug quota check ──────────────────────────────────────────────────
  // Use the non-decreasing monthly_bugs_consumed counter so deleting a run
  // does not restore quota slots.
  let bugs = dedupedRows
  if (limits.monthlyBugLimit !== Infinity) {
    const remaining = limits.monthlyBugLimit - bugsConsumedSoFar

    if (remaining <= 0) {
      return NextResponse.json(
        { error: `Monthly limit of ${limits.monthlyBugLimit} bugs reached. Upgrade for more.`, plan: plan.plan, upgrade_url: '/settings' },
        { status: 403 }
      )
    }

    if (bugs.length > remaining) {
      const msg = `You have ${remaining} bug${remaining !== 1 ? 's' : ''} left in your monthly quota. Showing top ${remaining}.`
      trimmedWarning = trimmedWarning ? `${trimmedWarning} ${msg}` : msg
      bugs = bugs.slice(0, remaining)
    }
  }

  // ── Per-run cap ──────────────────────────────────────────────────────────────
  // Secondary cap: keeps each individual Claude request within a manageable size.
  if (bugs.length > limits.maxBugsPerRun) {
    const msg = `Showing top ${limits.maxBugsPerRun} bugs per run. Upgrade to analyse more at once.`
    trimmedWarning = trimmedWarning ? `${trimmedWarning} ${msg}` : msg
    bugs = bugs.slice(0, limits.maxBugsPerRun)
  }

  // Get knowledge base — proceed without it if not set up, but warn the user
  const { data: kb } = await supabase.from('knowledge_base').select('*').eq('user_id', user.id).single()
  if (!kb) {
    trimmedWarning = (trimmedWarning ? trimmedWarning + ' ' : '') +
      'No Knowledge Base found — results will be less accurate. Set up your KB in Settings.'
  }

  // Build bug payloads for LLM — filter out untitled bugs (no signal for ranking)
  const allBugsForLlm = buildBugsForLlm(bugs, cols, Object.keys(rows[0]))
  const bugsForLlm = allBugsForLlm.filter((b) => b.title.trim() !== '')
  const skippedTitleCount = allBugsForLlm.length - bugsForLlm.length
  if (skippedTitleCount > 0) {
    const skippedMsg = `${skippedTitleCount} bug${skippedTitleCount > 1 ? 's' : ''} skipped (missing title).`
    trimmedWarning = trimmedWarning ? `${trimmedWarning} ${skippedMsg}` : skippedMsg
  }

  if (bugsForLlm.length === 0) {
    return NextResponse.json({ error: 'No bugs with titles found. Add a title/summary column to your CSV.' }, { status: 400 })
  }

  // Retrieve relevant KB doc context via vector search
  let retrievedChunks = 'No relevant documentation context available.'
  try {
    retrievedChunks = await getKBContext(supabase, user.id, bugsForLlm)
  } catch {
    // Non-fatal — continue without vector context
  }

  // Call Claude
  let llmResults: Record<string, unknown>[] = []
  try {
    llmResults = await callClaude(kb, retrievedChunks, bugsForLlm)
  } catch (e) {
    console.error('[triage] callClaude failed:', e)
    const msg = e instanceof Error ? e.message : 'Analysis failed. Please try again.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Store results
  let run, results
  try {
    ;({ run, results } = await storeTriage(supabase, user.id, file.name, llmResults, bugsForLlm))
  } catch (e) {
    console.error('[triage] storeTriage failed:', e)
    const msg = e instanceof Error ? e.message : 'Failed to save results.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Increment the non-decreasing bug consumption counter using the actual stored count.
  // This is fire-and-forget — a failure here doesn't affect the user response.
  const actualBugsStored = (results || []).length
  if (actualBugsStored > 0) {
    supabase
      .from('user_plans')
      .update({ monthly_bugs_consumed: bugsConsumedSoFar + actualBugsStored })
      .eq('user_id', user.id)
      .then(({ error }) => {
        if (error) console.error('[triage] Failed to update monthly_bugs_consumed:', error)
      })
  }

  return NextResponse.json({ run_id: run.id, results, warning: trimmedWarning })
}

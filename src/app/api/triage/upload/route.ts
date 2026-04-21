import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { ensureUserPlan, getPlanLimits } from '@/lib/plan'
import { checkRateLimit } from '@/lib/rate-limit'
import Papa from 'papaparse'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

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
  // Skip expensive embedding call if user has no uploaded KB documents
  const { count } = await supabase
    .from('kb_documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (!count || count === 0) return 'No relevant documentation context available.'

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
business_impact: string — 1 sentence, max 25 words. State the precise operational failure: what breaks, for whom, and when. Be specific (e.g. "Blocks invoice generation during month-end close for finance teams" or "Prevents all SSO users from logging in on subscription renewal"). No vague phrases like "negatively affects users."
rationale: string — 2 sentences, max 50 words total. Sentence 1: name the specific KB field or document that influenced this rank (quote by name, or state "No KB context relevant"). Sentence 2: explain why the rank is correct and, if your severity differs from the reporter's label, why.
gap_flags: string[] — empty array if none. Use these exact string values when applicable:
'Missing description', 'No reproduction steps', 'Missing environment info', 'Vague impact statement', 'Likely over-prioritised', 'Possible duplicate', 'Unknown reporter context'
Note: 'Missing description', 'No reproduction steps', and 'Missing environment info' are quality flags that directly affect ticket actionability. Apply them strictly per the Gap Rules below — err on the side of flagging. Most real-world tickets are missing at least one of these.
improved_description: string | null — When gap_flags contains at least one quality flag (Missing description, No reproduction steps, Missing environment info, or Vague impact statement): write a 1-2 sentence improved description a developer can act on immediately — what is broken, the impact, and reproduction steps if inferable. Max 40 words. Return null ONLY if gap_flags has zero quality flags AND the ticket genuinely has explicit repro steps, environment info, and a clear description. Most tickets will NOT return null.

GAP IDENTIFICATION RULES — apply these precisely when populating gap_flags. These rules are STRICT. When in doubt, flag. A false-positive flag is far less harmful than missing a real quality gap.

Gap Rule 1 — Missing description:
If the description field is absent, empty, or fewer than 10 words in total, flag as 'Missing description'. Additionally, rank this ticket LAST within its priority tier — it cannot be actioned without more information, regardless of how alarming the title sounds. A one-line title like "App is slow" with no description is ranked at the bottom of whichever tier its title suggests.

Gap Rule 2 — No reproduction steps:
Flag as 'No reproduction steps' unless the ticket contains EXPLICIT, SEQUENTIAL reproduction instructions that a developer could follow without any prior knowledge of the bug. The threshold is intentionally strict — apply this flag in ALL of the following cases:
- No numbered or bulleted steps (e.g. "1. Go to X, 2. Click Y, 3. See error")
- No clear trigger-action-result pattern (e.g. "When I do [specific action] on [specific screen/state], [exact failure] occurs")
- Description only states the symptom or outcome ("Login is broken", "Payment fails", "The dashboard shows wrong data") without describing HOW to reach the failure state
- Description uses vague triggers like "sometimes", "occasionally", "randomly", "intermittently" without a specific reproduction path
- The description reads like a complaint or observation rather than a reproducible procedure

The ONLY exception (self-evident): Do NOT flag if any developer could reproduce the bug in under 10 seconds purely from the title alone, with zero ambiguity — examples: "404 on /pricing page", "Typo: 'recieve' on signup button". If there is any ambiguity about environment, user state, data state, or navigation path, it is NOT self-evident — flag it.

Gap Rule 3 — Missing environment info:
Flag as 'Missing environment info' if the bug is plausibly environment-specific AND no environment details are provided. A bug is plausibly environment-specific if it involves: UI rendering, browser behaviour, mobile vs desktop, OS-specific paths, network conditions, account types, or subscription tiers. If the ticket has no mention of browser, OS, device, app version, environment (staging/prod), or account type — and the bug is not purely backend/data logic — flag it. Do not flag for purely backend bugs (e.g. "Payment webhook fails" does not need browser info).

Gap Rule 4 — Possible duplicate:
Compare every ticket title in the batch against every other. If two tickets have titles that are more than 70% similar in wording or describe the same failure mode in different words — flag both with 'Possible duplicate'. In the rationale for each, explicitly name the other ticket key (e.g. "Possible duplicate of FD-123"). Do not silently skip duplicates — flag both even if one appears more detailed.

Gap Rule 5 — Unknown reporter context:
If the reporter email is a personal address (e.g. gmail.com, yahoo.com, hotmail.com, outlook.com) or a clearly generic/non-company address — flag as 'Unknown reporter context' and note in the rationale that the reporter's organisational context is unknown, which reduces confidence in the severity assessment. Do not penalise the rank heavily for this alone, but do note the reduced confidence.

EXPLICIT SCORING OVERRIDES — apply these before general scoring priorities. They are not guidelines; they are hard rules:

Rule 1 — Security exploit hierarchy:
Actively exploitable security vulnerabilities (authentication bypass, unauthorized data access, permission escalation, session hijacking) must ALWAYS rank above configuration or access management issues — even when both carry Critical severity. A bug that lets an attacker bypass 2FA or access other users' data is categorically more urgent than an admin losing their own access. Within security bugs, rank by exploitability: externally triggerable > requires account > requires physical access.
For every security bug, the rationale field MUST answer three specific questions: (1) What data or capability is exposed — be precise, e.g. "exposes all project data for any workspace the guest has been invited to, including private roadmaps and client communications"; (2) Who could exploit it and how — e.g. "any guest user who knows or can guess a project URL, requiring no special tools or privileges"; (3) What is the blast radius — e.g. "affects all workspaces with guest users, estimated N% of enterprise accounts based on the ticket comments". Do not write generic security language — answer all three questions using content from the ticket.

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

TIEBREAKER HIERARCHY — when two or more bugs reach the same composite score, resolve the tie using these rules in strict order. Move to the next rule only if the current rule still produces a tie:

1. More users affected: whichever bug demonstrably affects a larger number of users (explicit counts, percentages, or "all users" language in description or comments) ranks higher. If one ticket says "affects 30% of mobile users" and another says "one customer reported", the first ranks higher.
2. More recent created date: if user counts are equal or uninferable, the bug with the more recent created date ranks higher. Recency signals an active, unresolved issue.
3. Active customer escalation in comments: if created dates are equal or absent, rank higher whichever has explicit escalation language in comments — account manager escalation, customer success flag, formal incident report request, or SLA credit demand.
4. Higher ARR customer in comments: if escalation signals are equal, rank higher whichever mentions a larger ARR value or a larger seat count for the affected customer.

If all four tiebreaker rules are exhausted and a tie still cannot be broken, use alphabetical order of bug_id as a final deterministic fallback — but this should be extremely rare.

ABSOLUTE RULE — NO TIES: Every bug must have a unique rank integer. The final ranked list must be a strict ordering from 1 to N with no two bugs sharing the same rank number. Before returning your response, verify that all rank values are unique.

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

  // ── Phase 1: Parse file + fetch plan + fetch KB in parallel ─────────────────
  // These three are independent — run them concurrently to cut ~400ms off setup.
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

  // Parse file content (must happen before the parallel block so we can read the file stream once)
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

  // Deduplicate rows by bug ID
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

  // Fetch plan + KB simultaneously — independent DB calls
  const [plan, { data: kb }] = await Promise.all([
    ensureUserPlan(supabase, user.id),
    supabase.from('knowledge_base').select('*').eq('user_id', user.id).single(),
  ])
  const limits = getPlanLimits(plan.plan)

  // Fire-and-forget: increment run counter — not on the critical path
  supabase
    .from('user_plans')
    .update({ monthly_runs_count: (plan.monthly_runs_count || 0) + 1 })
    .eq('user_id', user.id)
    .then(({ error }) => { if (error) console.error('[triage] run count update failed:', error.message) })

  const bugsConsumedSoFar = plan.monthly_bugs_consumed || 0

  let trimmedWarning: string | null = null

  if (!kb) {
    trimmedWarning = 'No Knowledge Base found — results will be less accurate. Set up your KB in Settings.'
  }

  // ── Monthly bug quota check ──────────────────────────────────────────────────
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
  if (bugs.length > limits.maxBugsPerRun) {
    const msg = `Showing top ${limits.maxBugsPerRun} bugs per run. Upgrade to analyse more at once.`
    trimmedWarning = trimmedWarning ? `${trimmedWarning} ${msg}` : msg
    bugs = bugs.slice(0, limits.maxBugsPerRun)
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

  // ── Phase 2: KB vector search + cross-run dup check in parallel ──────────────
  // Both are non-blocking for the Claude call — run them together.
  const uploadedIds = Array.from(seenIds)

  // Cross-run duplicate check — fire in parallel, don't block Claude
  const crossRunDupPromise = (async (): Promise<string | null> => {
    try {
      const { data: previousRuns } = await supabase
        .from('triage_runs')
        .select('id')
        .eq('user_id', user.id)
      const previousRunIds = (previousRuns || []).map((r: { id: string }) => r.id)
      if (previousRunIds.length === 0) return null
      const { data: existingResults } = await supabase
        .from('triage_results')
        .select('bug_id')
        .in('run_id', previousRunIds)
      const existingIds = new Set((existingResults || []).map((r: { bug_id: string }) => r.bug_id))
      const duplicates = uploadedIds.filter((id) => existingIds.has(id))
      if (duplicates.length === 0) return null
      return `${duplicates.length} bug${duplicates.length > 1 ? 's' : ''} in this upload were already triaged in a previous run.`
    } catch {
      return null // non-fatal
    }
  })()

  // KB vector context — skips OpenAI embedding if user has no uploaded docs
  let retrievedChunks = 'No relevant documentation context available.'
  try {
    retrievedChunks = await getKBContext(supabase, user.id, bugsForLlm)
  } catch {
    // Non-fatal — continue without vector context
  }

  // ── Phase 3: Claude (main bottleneck) + resolve dup warning in parallel ──────
  let llmResults: Record<string, unknown>[] = []
  let crossRunDupWarning: string | null = null
  try {
    ;[llmResults, crossRunDupWarning] = await Promise.all([
      callClaude(kb, retrievedChunks, bugsForLlm),
      crossRunDupPromise,
    ])
  } catch (e) {
    console.error('[triage] callClaude failed:', e)
    const msg = e instanceof Error ? e.message : 'Analysis failed. Please try again.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  if (crossRunDupWarning) {
    trimmedWarning = trimmedWarning ? `${trimmedWarning} ${crossRunDupWarning}` : crossRunDupWarning
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

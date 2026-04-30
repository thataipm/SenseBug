import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { ensureUserPlan, getPlanLimits } from '@/lib/plan'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidOrigin } from '@/lib/csrf'
import { stripJiraMarkup } from '@/lib/jira'
import { RANK_SYSTEM_PROMPT } from '@/lib/triage-prompts'
import { computeHealthScore, metricsFromResults } from '@/lib/health-score'
import Papa from 'papaparse'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Pass 1 system prompt is imported from @/lib/triage-prompts
// Pass 2 (detail) lives in src/app/api/triage/detail/[bug_id]/route.ts

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

// Column allowlist: only extra columns whose name contains one of these
// triage-signal keywords are forwarded to the LLM. This is intentionally
// an allowlist (not a blocklist) so that wide enterprise exports (Jira,
// ServiceNow, etc. with 400+ columns) don't flood the prompt with noise.
const USEFUL_SIGNAL_RE = /\b(severity|impact|revenue|customer|escalat|reproducib|repro|steps|environ|browser|device|os|actual|expected|workaround|urgency|urgence|accept|root.?cause|resolution.?note|user.?impact|business|criticali|blocker|blocking|complaint|sentiment|churn|arr|priority|feedback|effort|risk|affected|scope)\b/i

// stripJiraMarkup is imported from @/lib/jira (shared with the results page UI)

// Value-level noise: ISO dates, plain numbers, URLs, UUIDs / Atlassian
// account IDs — no signal for triage.
function isNoisyValue(v: string): boolean {
  const t = v.trim()
  if (!t) return true
  if (/^\d+$/.test(t)) return true                        // pure number
  if (/^https?:\/\//i.test(t)) return true                // URL
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return true          // ISO date
  // UUID / Atlassian account ID (e.g. 712020:5a2b3ff3-9b33-...)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return true
  if (/^\d{6}:[0-9a-f-]{36}$/i.test(t)) return true
  if (/^[0-9a-f]{24}$/i.test(t)) return true              // Mongo-style hex ID
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
    const cleanDesc = rawDesc ? stripJiraMarkup(rawDesc) : ''
    const bug: BugRow = {
      bug_id:      row[cols.idCol] || '',
      title:       row[cols.titleCol] || '',
      description: cleanDesc ? cleanDesc.slice(0, 1500) : '[No description provided]',
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
    if (commentCol  && row[commentCol])  bug.comments           = stripJiraMarkup(row[commentCol]).slice(0, 1000)
    if (reporterCol && row[reporterCol]) bug.reporter           = row[reporterCol]
    if (assigneeCol && row[assigneeCol]) bug.assignee           = row[assigneeCol]
    if (labelsCol   && row[labelsCol])   bug.labels             = row[labelsCol]

    // ── Extra-context sweep ───────────────────────────────────────────────
    // Only forward columns whose name matches triage-relevant signal keywords.
    // Using an allowlist (not a blocklist) keeps enterprise exports with 400+
    // columns from flooding the prompt with project IDs, user IDs, and other
    // irrelevant Jira/ServiceNow metadata. Cap at 8 fields × 150 chars.
    const extras: string[] = []
    for (const key of keys) {
      if (handledCols.has(key)) continue
      if (!USEFUL_SIGNAL_RE.test(key)) continue   // must match a triage-signal keyword
      const val = row[key]?.trim()
      if (!val || isNoisyValue(val)) continue
      extras.push(`${key}: ${val.slice(0, 150)}`)
      if (extras.length >= 8) break               // hard cap — keeps input lean
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

// ─── Helper: robust JSON array parser with auto-repair ───────────────────────
// Claude occasionally returns a truncated or slightly malformed JSON array
// (e.g. cut off before the closing `]`, or last object missing closing `}`).
// We try three progressively more aggressive repair strategies before giving up.
function tryParseJsonArray(raw: string): Record<string, unknown>[] {
  // 1. Direct parse — works for well-formed responses
  try {
    const p = JSON.parse(raw)
    if (Array.isArray(p)) return p as Record<string, unknown>[]
  } catch {}

  // 2. Append `]` — handles responses truncated just before the closing bracket
  try {
    const p = JSON.parse(raw + ']')
    if (Array.isArray(p)) return p as Record<string, unknown>[]
  } catch {}

  // 3. Find the last complete `}` and close the array there.
  //    Handles the case where the last object is partially written.
  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace > 0) {
    try {
      const p = JSON.parse(raw.slice(0, lastBrace + 1) + ']')
      if (Array.isArray(p)) return p as Record<string, unknown>[]
    } catch {}
  }

  throw new SyntaxError('AI response could not be parsed as a JSON array')
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
${bugsJson}`
}

// Two-pass architecture — Pass 1 (this route) only emits rank/priority/severity/
// quick_reason/gap_flags. That's ~80 output tokens per bug instead of ~500, so
// we can run much larger batches without hitting the time budget.
//
// BATCH_SIZE=25 → 25 × 80 = ~2 000 output tokens → ~27s per batch on haiku
// MAX_CONCURRENT=5 → 250 bugs (10 batches) = ceil(10/5) = 2 rounds × 27s ≈ 55s
// That's well under Vercel's 300s limit and ~5× faster than today's full-detail run.
const BATCH_SIZE = 25
const MAX_CONCURRENT_BATCHES = 5

async function callClaudeBatch(
  anthropic: Anthropic,
  kbData: Record<string, string>,
  retrievedChunks: string,
  batch: BugRow[]
): Promise<Record<string, unknown>[]> {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

  // Attempt up to 2 times. On the second attempt we slim down descriptions so
  // the output fits comfortably within the token budget.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const batchToSend = attempt === 1 ? batch : batch.map((b) => {
      // Drop extra_context entirely on retry — destructure is type-clean
      // (vs. assigning undefined to a Record<string, string> field).
      const { extra_context: _drop, ...rest } = b
      void _drop
      return {
        ...rest,
        description: rest.description ? rest.description.slice(0, 400) : rest.description,
        comments:    rest.comments    ? rest.comments.slice(0, 200)    : rest.comments,
      }
    })

    const userPrompt = buildUserPrompt(kbData, retrievedChunks, JSON.stringify(batchToSend, null, 2))

    let message: Awaited<ReturnType<typeof anthropic.messages.create>>
    try {
      message = await anthropic.messages.create({
        model,
        max_tokens: 16000,
        temperature: 0,   // deterministic output — prevents Claude inserting commentary between JSON objects
        // cache_control on the system prompt: Anthropic caches the first 5 min
        // of identical prompts. Batch 1 warms the cache; batches 2-N pay only
        // for the per-batch user content, cutting per-call latency 60-70%.
        system: [{ type: 'text', text: RANK_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [
          { role: 'user',      content: userPrompt },
          { role: 'assistant', content: '['        }, // prefill — forces JSON array output
        ],
      })
    } catch (apiErr) {
      if (attempt < 2) {
        console.warn(`[triage] Claude API error on attempt ${attempt}, retrying:`, apiErr)
        continue
      }
      throw apiErr
    }

    // Detect hard truncation
    if (message.stop_reason === 'max_tokens') {
      if (attempt < 2) {
        console.warn('[triage] max_tokens hit on attempt 1, retrying with slimmed content')
        continue
      }
      throw new Error('AI response was cut off (output token limit reached). Try uploading fewer bugs per run.')
    }

    // Claude continues from the '[' prefill — prepend it back
    const raw = '[' + (message.content[0].type === 'text' ? message.content[0].text : '')

    try {
      return tryParseJsonArray(raw)
    } catch (parseErr) {
      console.error(`[triage] JSON parse failed on attempt ${attempt}:`, raw.slice(0, 300))
      if (attempt < 2) {
        console.warn('[triage] Retrying batch with reduced content...')
        continue
      }
      throw new Error('The AI returned a malformed response after 2 attempts. Please try again.')
    }
  }

  // TypeScript needs this — unreachable in practice
  throw new Error('Unexpected end of callClaudeBatch')
}

// Run an array of async tasks with a maximum concurrency limit.
async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++
      results[index] = await tasks[index]()
    }
  }

  const workerCount = Math.min(maxConcurrent, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}

async function callClaude(
  kb: Record<string, string> | null,
  retrievedChunks: string,
  bugsForLlm: BugRow[]
): Promise<{ results: Record<string, unknown>[]; failedBatches: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in environment variables')

  const anthropic = new Anthropic({ apiKey })
  const kbData = kb ?? { product_overview: '', critical_flows: '', product_areas: '' }

  // Split into batches
  const batches: BugRow[][] = []
  for (let i = 0; i < bugsForLlm.length; i += BATCH_SIZE) {
    batches.push(bugsForLlm.slice(i, i + BATCH_SIZE))
  }

  // Fault-tolerant batch execution: a failed batch logs a warning and returns []
  // instead of aborting the entire run. With 18 batches a single bad response
  // would otherwise discard all results.
  let failedBatches = 0
  const batchResults = await runWithConcurrencyLimit(
    batches.map((batch, batchIdx) => async () => {
      try {
        return await callClaudeBatch(anthropic, kbData, retrievedChunks, batch)
      } catch (e) {
        failedBatches++
        console.error(
          `[triage] Batch ${batchIdx + 1}/${batches.length} failed permanently:`,
          e instanceof Error ? e.message : e
        )
        return [] as Record<string, unknown>[]
      }
    }),
    MAX_CONCURRENT_BATCHES
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

  return { results: allResults.map((r, i) => ({ ...r, rank: i + 1 })), failedBatches }
}

// ─── Helper: store triage run and results ─────────────────────────────────────

async function storeTriage(
  supabase: SupabaseClient,
  userId: string,
  filename: string,
  llmResults: Record<string, unknown>[],
  originalBugs: BugRow[],
  rawDataMap?: Map<string, { description: string; comments: string }>
) {
  // Filter out any LLM results with empty bug_id before storing
  const validResults = llmResults.filter((r) => r.bug_id && String(r.bug_id).trim() !== '')

  // Build a map of original bug data keyed by bug_id for O(1) lookup
  const bugMap = new Map(originalBugs.map((b) => [String(b.bug_id), b]))

  const { data: run, error: runError } = await supabase
    .from('triage_runs')
    .insert({ user_id: userId, filename, bug_count: validResults.length })
    .select()
    .single()

  if (runError || !run) throw new Error(`Failed to create triage run${runError ? ': ' + runError.message : ''}`)

  const toInsert = validResults.map((r) => {
    const bugId = String(r.bug_id || '')
    const orig    = bugMap.get(bugId)
    const rawData = rawDataMap?.get(bugId)

    // Prefer full raw description (pre-truncation) over the LLM-payload version
    const fullDesc = rawData?.description
      || (orig?.description !== '[No description provided]' ? orig?.description : null)

    return {
      run_id:               run.id,
      bug_id:               bugId,
      title:                String(r.title || ''),
      rank:                 Number(r.rank) || 999,
      priority:             String(r.priority || 'P4'),
      severity:             String(r.severity || 'Low'),
      // NEW: short reason rendered in the main results list (Pass 1 output)
      quick_reason:         r.quick_reason ? String(r.quick_reason) : null,
      gap_flags:            Array.isArray(r.gap_flags) ? r.gap_flags : [],
      // Detail fields stay NULL — they're populated lazily by /api/triage/detail
      // when the user opens a bug in the results panel. detail_generated_at = NULL
      // signals "not yet generated".
      business_impact:      null,
      rationale:            null,
      improved_description: null,
      detail_generated_at:  null,
      // Original ticket data captured at upload time (preserved across runs)
      original_description: fullDesc || null,
      original_comments:    rawData?.comments || null,
      reporter_priority:    orig?.priority || null,
    }
  })

  const { data: results, error: resultsError } = await supabase
    .from('triage_results')
    .insert(toInsert)
    .select()

  if (resultsError) {
    // Clean up the orphaned run row so history stays consistent before rethrowing
    await supabase.from('triage_runs').delete().eq('id', run.id)
    throw new Error(`Failed to save triage results: ${resultsError.message}`)
  }

  return { run, results: results || [] }
}

// Retry storeTriage up to maxAttempts times with exponential backoff.
// This prevents a transient DB error from forcing the user to re-upload
// and re-running the (already paid-for) Claude API call.
async function storeTriageWithRetry(
  supabase: SupabaseClient,
  userId: string,
  filename: string,
  llmResults: Record<string, unknown>[],
  originalBugs: BugRow[],
  rawDataMap?: Map<string, { description: string; comments: string }>,
  maxAttempts = 3
) {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await storeTriage(supabase, userId, filename, llmResults, originalBugs, rawDataMap)
    } catch (e) {
      lastError = e
      if (attempt < maxAttempts) {
        // 500 ms, then 1 000 ms before the final attempt
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
        console.warn(`[triage] storeTriage attempt ${attempt} failed — retrying...`)
      }
    }
  }
  throw lastError
}

// ─── Main route handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    // Surface (but don't fail on) parser warnings — silent partial parses make
    // missing-bug bugs hard to diagnose later.
    if (parsed.errors && parsed.errors.length > 0) {
      console.warn(
        `[triage] PapaParse reported ${parsed.errors.length} warning(s):`,
        parsed.errors.slice(0, 3)
      )
    }
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

  // Build raw data map for full-fidelity storage — captures description and comments
  // BEFORE the LLM payload truncation (2000/1500 char limits).
  // Requires DB migration: ALTER TABLE triage_results ADD COLUMN IF NOT EXISTS original_comments text;
  const csvKeys = Object.keys(rows[0])
  const commentColForStorage = findCol(csvKeys, [
    'comments', 'comment', 'notes', 'note', 'additional_notes',
    'user_notes', 'internal_notes', 'feedback', 'discussion',
  ])
  const rawDataMap = new Map(
    dedupedRows.map((row) => {
      const id         = String(row[cols.idCol]?.trim() || '')
      const fullDesc   = cols.descCol ? (row[cols.descCol] || '') : ''
      const fullComments = commentColForStorage ? (row[commentColForStorage] || '') : ''
      return [id, {
        description: fullDesc.slice(0, 8000),     // store up to 8k chars
        comments:    fullComments.slice(0, 4000),  // store up to 4k chars
      }]
    })
  )
  if (!dedupedRows.length) {
    return NextResponse.json({ error: 'No valid bug IDs found in this file.' }, { status: 400 })
  }

  // Fetch plan + KB simultaneously — independent DB calls
  const [plan, { data: kb }] = await Promise.all([
    ensureUserPlan(supabase, user.id),
    supabase.from('knowledge_base').select('*').eq('user_id', user.id).single(),
  ])
  const limits = getPlanLimits(plan.plan)

  const bugsConsumedSoFar = plan.monthly_bugs_consumed || 0

  let trimmedWarning: string | null = null

  if (!kb) {
    trimmedWarning = 'No Knowledge Base found — results will be less accurate. Set up your KB in Settings.'
  }

  const totalUploaded = dedupedRows.length

  // ── Monthly bug quota check ──────────────────────────────────────────────────
  let bugs = dedupedRows
  if (limits.monthlyBugLimit !== Infinity) {
    const remaining = limits.monthlyBugLimit - bugsConsumedSoFar

    if (remaining <= 0) {
      return NextResponse.json(
        { error: `Monthly limit of ${limits.monthlyBugLimit} bugs reached. Upgrade for more.`, plan: plan.plan, upgrade_url: '/pricing' },
        { status: 403 }
      )
    }

    if (bugs.length > remaining) {
      bugs = bugs.slice(0, remaining)
    }
  }

  // ── Per-run cap ──────────────────────────────────────────────────────────────
  if (bugs.length > limits.maxBugsPerRun) {
    bugs = bugs.slice(0, limits.maxBugsPerRun)
  }

  // Rows not processed in this run (trimmed by quota or per-run cap)
  const trimmedRows = dedupedRows.slice(bugs.length)

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
    const [claudeResult, dupWarning] = await Promise.all([
      callClaude(kb, retrievedChunks, bugsForLlm),
      crossRunDupPromise,
    ])
    llmResults        = claudeResult.results
    crossRunDupWarning = dupWarning

    // Surface partial-results warning when some batches failed but others succeeded
    if (claudeResult.failedBatches > 0) {
      const skipped = claudeResult.failedBatches * BATCH_SIZE
      const partialMsg = `${claudeResult.failedBatches} batch${claudeResult.failedBatches > 1 ? 'es' : ''} could not be analysed — up to ${skipped} bugs may be missing from results.`
      trimmedWarning = trimmedWarning ? `${trimmedWarning} ${partialMsg}` : partialMsg
    }
  } catch (e) {
    console.error('[triage] callClaude failed:', e)
    const msg = e instanceof Error ? e.message : 'Analysis failed. Please try again.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // If every single batch failed there's nothing to save — surface a hard error
  if (llmResults.length === 0) {
    return NextResponse.json(
      { error: 'Analysis failed — the AI could not process any bugs. Please try again.' },
      { status: 500 }
    )
  }

  if (crossRunDupWarning) {
    trimmedWarning = trimmedWarning ? `${trimmedWarning} ${crossRunDupWarning}` : crossRunDupWarning
  }

  // Store results — retried up to 3× so a transient DB error doesn't waste
  // the already-completed (and paid-for) Claude API call.
  let run, results
  try {
    ;({ run, results } = await storeTriageWithRetry(supabase, user.id, file.name, llmResults, bugsForLlm, rawDataMap))
  } catch (e) {
    console.error('[triage] storeTriage failed after retries:', e)
    const msg = e instanceof Error ? e.message : 'Failed to save results.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Increment usage counters — fire-and-forget, failures don't affect the user response.
  // Both counters are updated only after successful storeTriage so a failed run never
  // consumes quota.
  const actualBugsStored = (results || []).length
  if (actualBugsStored > 0) {
    supabase
      .from('user_plans')
      .update({
        monthly_bugs_consumed: bugsConsumedSoFar + actualBugsStored,
        monthly_runs_count: (plan.monthly_runs_count || 0) + 1,
      })
      .eq('user_id', user.id)
      .then(({ error }) => {
        if (error) console.error('[triage] Failed to update usage counters:', error)
      })

    // Health snapshot — fire-and-forget. Computed from the in-memory results so
    // we don't need an extra DB round-trip. Failures are logged but never surfaced
    // to the user.
    ;(async () => {
      try {
        const metrics = metricsFromResults(results)
        const scored  = computeHealthScore(metrics)
        const { error: snapErr } = await supabase
          .from('backlog_health_snapshots')
          .insert({
            user_id:             user.id,
            run_id:              run.id,
            score:               scored.score,
            total_bugs:          scored.total_bugs,
            p1_count:            scored.p1_count,
            p2_count:            scored.p2_count,
            critical_count:      scored.critical_count,
            flagged_count:       scored.flagged_count,
            missing_repro_count: scored.missing_repro_count,
            duplicate_count:     scored.duplicate_count,
            over_pri_count:      scored.over_pri_count,
            p1_rate:             scored.p1_rate,
            quality_flag_rate:   scored.quality_flag_rate,
            noise_rate:          scored.noise_rate,
          })
        if (snapErr) console.error('[triage] Failed to store health snapshot:', snapErr.message)
      } catch (e) {
        console.error('[triage] Health snapshot error:', e instanceof Error ? e.message : e)
      }
    })()
  }

  return NextResponse.json({
    run_id: run.id,
    results,
    warning: trimmedWarning,
    total_uploaded: totalUploaded,
    bugs_analyzed: actualBugsStored,
    trimmed_rows: trimmedRows.length > 0 ? trimmedRows : undefined,
  })
}

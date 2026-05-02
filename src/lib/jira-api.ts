import { stripJiraMarkup } from '@/lib/jira'

// ── Priority normalisation ────────────────────────────────────────────────────

const JIRA_PRIORITY_TO_SENSEBUG: Record<string, string> = {
  highest:  'P1',
  critical: 'P1',
  blocker:  'P1',
  high:     'P2',
  medium:   'P3',
  low:      'P4',
  lowest:   'P4',
  minor:    'P4',
  trivial:  'P4',
}

/** Map a Jira priority name (any case) to P1–P4. Returns null if unknown. */
export function normalizeJiraPriority(name: string | null | undefined): string | null {
  if (!name) return null
  return JIRA_PRIORITY_TO_SENSEBUG[name.toLowerCase().trim()] ?? null
}

const PRIORITY_TO_JIRA: Record<string, string> = {
  P1: 'Highest',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
}

function basicAuth(email: string, apiToken: string): string {
  return 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64')
}

// ── ADF text extraction ───────────────────────────────────────────────────────

/**
 * Recursively extract plain text from Atlassian Document Format (ADF) or a
 * plain string. Handles lists (preserving structure), tables, code blocks,
 * mentions, and all standard ADF node types.
 */
export function extractAdfText(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return stripJiraMarkup(content)
  if (typeof content !== 'object') return ''

  const node = content as Record<string, unknown>

  // ── Leaf nodes ──────────────────────────────────────────────────────────────
  if (node.type === 'text' && typeof node.text === 'string') return node.text
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'mention') {
    const attrs = node.attrs as Record<string, unknown> | undefined
    return `@${attrs?.text ?? attrs?.id ?? 'user'}`
  }
  if (node.type === 'emoji') {
    const attrs = node.attrs as Record<string, unknown> | undefined
    return String(attrs?.shortName ?? attrs?.text ?? '')
  }
  if (node.type === 'inlineCard') {
    const attrs = node.attrs as Record<string, unknown> | undefined
    return String(attrs?.url ?? '')
  }

  if (!Array.isArray(node.content)) return ''
  const children = node.content as unknown[]

  // ── List nodes (preserve structure so AI can read repro steps) ─────────────
  if (node.type === 'orderedList') {
    return children
      .map((item, i) => `${i + 1}. ${extractAdfText(item)}`)
      .filter(Boolean)
      .join('\n')
  }
  if (node.type === 'bulletList') {
    return children
      .map(item => `• ${extractAdfText(item)}`)
      .filter(Boolean)
      .join('\n')
  }
  if (node.type === 'listItem') {
    // A listItem contains block children (paragraphs) — flatten to a single line
    return children.map(extractAdfText).join(' ').trim()
  }

  // ── Table nodes ─────────────────────────────────────────────────────────────
  if (node.type === 'table') {
    return children.map(extractAdfText).filter(Boolean).join('\n')
  }
  if (node.type === 'tableRow') {
    return children.map(extractAdfText).filter(Boolean).join(' | ')
  }
  if (node.type === 'tableCell' || node.type === 'tableHeader') {
    return children.map(extractAdfText).join(' ').trim()
  }

  // ── Code block — keep content as-is ─────────────────────────────────────────
  if (node.type === 'codeBlock') {
    return children.map(extractAdfText).join('')
  }

  // ── Block-level containers ───────────────────────────────────────────────────
  const BLOCK_TYPES = new Set([
    'paragraph', 'heading', 'bulletList', 'orderedList',
    'blockquote', 'codeBlock', 'panel', 'rule',
  ])
  const parts = children.map(extractAdfText).filter(s => s.length > 0)
  const sep   = BLOCK_TYPES.has(node.type as string) ? '\n' : ''
  return parts.join(sep).replace(/\n{3,}/g, '\n\n').trim()
}

// ── Formatted comment extraction ─────────────────────────────────────────────

interface JiraComment {
  body:    unknown
  author?: { displayName?: string; emailAddress?: string }
  created?: string
}

/** Extract a comment to "[Author, Date]: text" format for triage context. */
function extractComment(c: JiraComment): string | null {
  const text = extractAdfText(c.body)
  if (!text.trim()) return null
  const author = c.author?.displayName ?? c.author?.emailAddress ?? 'Unknown'
  const date   = c.created
    ? new Date(c.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const header = date ? `[${author}, ${date}]` : `[${author}]`
  return `${header}: ${text.trim()}`
}

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface JiraIssueData {
  bug_id:            string
  title:             string
  description:       string
  comments:          string
  reporter_priority: string | null   // normalised to P1–P4
  labels:            string[]
  components:        string[]
  status:            string | null
  created:           string | null   // ISO date string
  updated:           string | null
}

/**
 * Fetch a Jira issue and return a rich, normalised shape suitable for triage.
 * Fetches labels, components, status, created/updated dates, and comment
 * attribution in addition to the basic title/description/comments.
 */
export async function fetchJiraIssue(
  siteUrl:   string,
  email:     string,
  apiToken:  string,
  issueKey:  string
): Promise<JiraIssueData> {
  const fields = 'summary,description,priority,comment,labels,components,status,created,updated'
  const url    = `${siteUrl}/rest/api/3/issue/${issueKey}?fields=${fields}`
  const res    = await fetch(url, {
    headers: { Authorization: basicAuth(email, apiToken), Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Jira fetch failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`)
  }
  const data   = await res.json()
  const f      = data.fields ?? {}

  const description = extractAdfText(f.description)
  const comments    = ((f.comment?.comments ?? []) as JiraComment[])
    .map(extractComment)
    .filter((s): s is string => s !== null)
    .join('\n---\n')

  const labels     = ((f.labels     ?? []) as string[]).filter(Boolean)
  const components = ((f.components ?? []) as Array<{ name?: string }>)
    .map(c => c.name ?? '')
    .filter(Boolean)

  return {
    bug_id:            issueKey,
    title:             String(f.summary ?? 'Untitled'),
    description,
    comments,
    reporter_priority: normalizeJiraPriority(f.priority?.name),
    labels,
    components,
    status:            f.status?.name  ?? null,
    created:           f.created       ?? null,
    updated:           f.updated       ?? null,
  }
}

/**
 * Update the priority field of a Jira issue.
 * Maps SenseBug priorities (P1–P4) to Jira priority names.
 */
export async function updateJiraPriority(
  siteUrl:          string,
  email:            string,
  apiToken:         string,
  issueKey:         string,
  sensebugPriority: string
): Promise<void> {
  const jiraPriority = PRIORITY_TO_JIRA[sensebugPriority] ?? 'Medium'
  const url          = `${siteUrl}/rest/api/3/issue/${issueKey}`
  const res          = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization:  basicAuth(email, apiToken),
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify({ fields: { priority: { name: jiraPriority } } }),
  })
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '')
    throw new Error(`Jira update failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`)
  }
}

/**
 * Add a comment to a Jira issue using Atlassian Document Format (ADF).
 */
export async function addJiraComment(
  siteUrl:     string,
  email:       string,
  apiToken:    string,
  issueKey:    string,
  commentText: string
): Promise<void> {
  const url = `${siteUrl}/rest/api/3/issue/${issueKey}/comment`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:  basicAuth(email, apiToken),
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify({
      body: {
        type:    'doc',
        version: 1,
        content: commentText.split('\n').map(line => ({
          type:    'paragraph',
          content: line.trim() ? [{ type: 'text', text: line }] : [],
        })),
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Jira comment failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`)
  }
}

/**
 * Verify that the credentials can reach the Jira instance.
 */
export async function testJiraConnection(
  siteUrl:  string,
  email:    string,
  apiToken: string
): Promise<string> {
  const url = `${siteUrl}/rest/api/3/myself`
  const res = await fetch(url, {
    headers: { Authorization: basicAuth(email, apiToken), Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Connection failed: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return String(data.displayName ?? data.emailAddress ?? email)
}

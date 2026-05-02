import { stripJiraMarkup } from '@/lib/jira'

const PRIORITY_TO_JIRA: Record<string, string> = {
  P1: 'Highest',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
}

function basicAuth(email: string, apiToken: string): string {
  return 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64')
}

/** Extract plain text from Jira's Atlassian Document Format (ADF) or plain string. */
export function extractAdfText(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return stripJiraMarkup(content)
  if (typeof content !== 'object') return ''
  const node = content as Record<string, unknown>
  if (node.type === 'text' && typeof node.text === 'string') return node.text
  if (node.type === 'hardBreak') return '\n'
  if (Array.isArray(node.content)) {
    const parts = (node.content as unknown[]).map(extractAdfText)
    const sep = node.type === 'paragraph' || node.type === 'bulletList' ? '\n' : ''
    return parts.join(sep).replace(/\n{3,}/g, '\n\n').trim()
  }
  return ''
}

/**
 * Fetch a Jira issue and return a normalized shape suitable for triage.
 * Handles both ADF and plain-text description fields.
 */
export async function fetchJiraIssue(
  siteUrl: string,
  email: string,
  apiToken: string,
  issueKey: string
): Promise<{
  bug_id: string
  title: string
  description: string
  comments: string
  reporter_priority: string | null
}> {
  const url = `${siteUrl}/rest/api/3/issue/${issueKey}?fields=summary,description,priority,comment`
  const res = await fetch(url, {
    headers: { Authorization: basicAuth(email, apiToken), Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Jira fetch failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const fields = data.fields ?? {}

  const description = extractAdfText(fields.description)
  const comments = ((fields.comment?.comments ?? []) as Array<{ body: unknown }>)
    .map(c => extractAdfText(c.body))
    .filter(Boolean)
    .join('\n---\n')

  return {
    bug_id:           issueKey,
    title:            String(fields.summary ?? 'Untitled'),
    description,
    comments,
    reporter_priority: fields.priority?.name ?? null,
  }
}

/**
 * Update the priority field of a Jira issue.
 * Maps SenseBug priorities (P1–P4) to Jira priority names.
 */
export async function updateJiraPriority(
  siteUrl: string,
  email: string,
  apiToken: string,
  issueKey: string,
  sensebugPriority: string
): Promise<void> {
  const jiraPriority = PRIORITY_TO_JIRA[sensebugPriority] ?? 'Medium'
  const url = `${siteUrl}/rest/api/3/issue/${issueKey}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization:  basicAuth(email, apiToken),
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify({ fields: { priority: { name: jiraPriority } } }),
  })
  // Jira returns 204 No Content on success
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '')
    throw new Error(`Jira update failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`)
  }
}

/**
 * Add a comment to a Jira issue using Atlassian Document Format (ADF).
 * Used to write AI summary comments back to Jira when a PM approves a verdict.
 */
export async function addJiraComment(
  siteUrl: string,
  email: string,
  apiToken: string,
  issueKey: string,
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
        // ADF does not render \n inside a paragraph — each line needs its own
        // paragraph node. Empty lines become empty paragraphs (adds spacing).
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
 * Returns the display name of the authenticated user on success.
 */
export async function testJiraConnection(
  siteUrl: string,
  email: string,
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

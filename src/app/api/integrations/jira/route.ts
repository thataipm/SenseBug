import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidOrigin } from '@/lib/csrf'
import { testJiraConnection } from '@/lib/jira-api'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET /api/integrations/jira
// Returns the current Jira integration for the authed user (no api_token in response).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('integrations')
    .select('id, provider, site_url, email, project_key, webhook_secret, created_at')
    .eq('user_id', user.id)
    .eq('provider', 'jira')
    .single()

  return NextResponse.json(data ?? null)
}

// POST /api/integrations/jira
// Creates or updates the Jira integration. Tests the connection before saving.
export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { site_url, email, api_token, project_key } = body

  if (!site_url || !email || !api_token) {
    return NextResponse.json({ error: 'site_url, email, and api_token are required' }, { status: 400 })
  }

  const normalizedUrl = String(site_url).replace(/\/$/, '').toLowerCase().startsWith('http')
    ? String(site_url).replace(/\/$/, '')
    : `https://${String(site_url).replace(/\/$/, '')}`

  // Verify the credentials actually work before persisting them
  try {
    await testJiraConnection(normalizedUrl, String(email), String(api_token))
  } catch (e) {
    return NextResponse.json(
      { error: `Could not connect to Jira: ${e instanceof Error ? e.message : 'unknown error'}` },
      { status: 422 }
    )
  }

  // Preserve existing webhook_secret so existing automation rules keep working
  const { data: existing } = await supabase
    .from('integrations')
    .select('webhook_secret')
    .eq('user_id', user.id)
    .eq('provider', 'jira')
    .single()

  const webhookSecret = existing?.webhook_secret ?? crypto.randomBytes(32).toString('hex')

  const { data, error } = await supabase
    .from('integrations')
    .upsert({
      user_id:        user.id,
      provider:       'jira',
      site_url:       normalizedUrl,
      email:          String(email),
      api_token:      String(api_token),
      project_key:    project_key ? String(project_key) : null,
      webhook_secret: webhookSecret,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })
    .select('id, provider, site_url, email, project_key, webhook_secret, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/integrations/jira
// Removes the Jira integration entirely.
export async function DELETE(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'jira')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/email'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

// Escape user-controlled strings before interpolating into HTML email body.
// Prevents stored XSS reaching the admin inbox via subject/message fields.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { type?: string; subject?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, subject, message } = body
  if (!type || !subject || !message) {
    return NextResponse.json({ error: 'type, subject, and message are required' }, { status: 400 })
  }
  if (message.trim().length < 10) {
    return NextResponse.json({ error: 'Message is too short' }, { status: 400 })
  }

  // ── Save to Supabase ─────────────────────────────────────────────────────────
  const { error: dbError } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      email:   user.email,
      type:    type.trim(),
      subject: subject.trim(),
      message: message.trim(),
    })

  if (dbError) {
    console.error('[feedback] DB insert error:', dbError.message)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  // ── Email admin ──────────────────────────────────────────────────────────────
  // Skip the email if ADMIN_EMAIL is not configured — DB write already succeeded,
  // so this is non-fatal (admin can still see feedback in the dashboard).
  if (!ADMIN_EMAIL) {
    console.warn('[feedback] ADMIN_EMAIL env var not set — skipping notification email')
    return NextResponse.json({ ok: true })
  }

  try {
    const resend = getResend()
    const typeLabelMap: Record<string, string> = {
      bug:     '🐛 Bug Report',
      feature: '💡 Feature Request',
      general: '💬 General Feedback',
    }
    const typeLabel = typeLabelMap[type] ?? type

    // Escape every user-controlled string before HTML interpolation.
    const safeSubject = escapeHtml(subject.trim())
    const safeMessage = escapeHtml(message.trim())
    const safeEmail   = escapeHtml(user.email ?? '—')
    const safeType    = escapeHtml(typeLabel)

    await resend.emails.send({
      from: 'SenseBug AI <hello@sensebug.com>',
      to:   ADMIN_EMAIL,
      // Plain-text subject is safe — Resend treats it as text, not HTML.
      subject: `[SenseBug Feedback] ${typeLabel}: ${subject.trim()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111; padding: 0 16px;">
          <div style="border-bottom: 2px solid #000; padding: 24px 0 16px;">
            <span style="font-size: 16px; font-weight: 900; letter-spacing: -0.5px;">SENSEBUG AI</span>
            <span style="font-size: 12px; color: #777; margin-left: 12px; font-family: monospace;">Feedback Notification</span>
          </div>
          <div style="padding: 24px 0;">
            <table style="width: 100%; border-collapse: collapse; background: #f9f9f9; border: 1px solid #e5e5e5; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 16px; color: #777; font-size: 13px; width: 90px;">Type</td>
                <td style="padding: 10px 16px; font-size: 13px; font-weight: 600;">${safeType}</td>
              </tr>
              <tr style="border-top: 1px solid #e5e5e5;">
                <td style="padding: 10px 16px; color: #777; font-size: 13px;">From</td>
                <td style="padding: 10px 16px; font-size: 13px; font-weight: 600;">${safeEmail}</td>
              </tr>
              <tr style="border-top: 1px solid #e5e5e5;">
                <td style="padding: 10px 16px; color: #777; font-size: 13px;">Subject</td>
                <td style="padding: 10px 16px; font-size: 13px; font-weight: 600;">${safeSubject}</td>
              </tr>
            </table>
            <div style="background: #fff; border: 1px solid #e5e5e5; padding: 16px; font-size: 14px; line-height: 1.7; color: #333; white-space: pre-wrap;">${safeMessage}</div>
          </div>
        </div>
      `,
    })
  } catch (emailErr) {
    // Non-fatal — DB write succeeded; just log
    console.error('[feedback] Email send error:', emailErr instanceof Error ? emailErr.message : emailErr)
  }

  return NextResponse.json({ ok: true })
}

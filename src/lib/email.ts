import { Resend } from 'resend'

// Lazy-initialize so the client is only created at request time,
// not at build time when RESEND_API_KEY isn't available.
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const FROM = 'SenseBug AI <hello@sensebug.com>'

export async function sendPurchaseConfirmationEmail(params: {
  to: string
  planName: string
  amount: string
  billingDate: string
}) {
  const { to, planName, amount, billingDate } = params
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Welcome to SenseBug AI ${planName} — you're all set`,
      html: `
        <div style="font-family: 'IBM Plex Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <div style="border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 28px;">
            <span style="font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">SENSEBUG AI</span>
          </div>
          <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">You're on ${planName}.</h1>
          <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            Your subscription is active and your new limits are in effect immediately.
          </p>
          <div style="background: #f9f9f9; border: 1px solid #e5e5e5; padding: 20px; margin-bottom: 28px;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="color: #777; padding: 6px 0;">Plan</td>
                <td style="font-weight: 600; text-align: right;">${planName}</td>
              </tr>
              <tr>
                <td style="color: #777; padding: 6px 0;">Amount</td>
                <td style="font-weight: 600; text-align: right;">${amount}</td>
              </tr>
              <tr>
                <td style="color: #777; padding: 6px 0;">Next billing date</td>
                <td style="font-weight: 600; text-align: right;">${billingDate}</td>
              </tr>
            </table>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 600;">
            Go to dashboard
          </a>
          <p style="color: #aaa; font-size: 12px; margin-top: 32px; line-height: 1.5;">
            To manage your subscription or download invoices, visit the <a href="${process.env.NEXT_PUBLIC_APP_URL}/account" style="color: #555;">Account</a> page.<br/>
            Questions? Reply to this email — we read every one.
          </p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendPurchaseConfirmationEmail error:', err instanceof Error ? err.message : err)
  }
}

export async function sendCancellationEmail(params: {
  to: string
  planName: string
  accessUntil: string | null
}) {
  const { to, planName, accessUntil } = params
  const accessNote = accessUntil
    ? `Your ${planName} features remain active until <strong>${new Date(accessUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.`
    : `Your ${planName} features remain active through the end of the current billing period.`

  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Your SenseBug AI subscription has been cancelled`,
      html: `
        <div style="font-family: 'IBM Plex Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <div style="border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 28px;">
            <span style="font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">SENSEBUG AI</span>
          </div>
          <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">Subscription cancelled.</h1>
          <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
            We've received your cancellation request. ${accessNote}
          </p>
          <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            After that, your account returns to the Starter plan — 50 bugs per month, unlimited runs. Your data and run history are preserved.
          </p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 600;">
            Resubscribe any time
          </a>
          <p style="color: #aaa; font-size: 12px; margin-top: 32px;">
            Changed your mind? You can resubscribe from the <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing" style="color: #555;">pricing page</a> at any time.
          </p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[email] sendCancellationEmail error:', err instanceof Error ? err.message : err)
  }
}

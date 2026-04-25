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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.sensebug.com'

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Convert Dodo's cents integer + ISO currency code to a display string like "$19.00/month" */
export function formatBillingAmount(amountCents: number, currency: string): string {
  const amount = (amountCents / 100).toFixed(2)
  const symbol = currency.toUpperCase() === 'USD' ? '$'
    : currency.toUpperCase() === 'EUR' ? '€'
    : currency.toUpperCase() === 'GBP' ? '£'
    : `${currency.toUpperCase()} `
  return `${symbol}${amount}/month`
}

/** Format an ISO date string as "April 25, 2026" */
export function formatEmailDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Shared email template shell ─────────────────────────────────────────────

function emailShell(content: string): string {
  return `
    <div style="font-family: 'IBM Plex Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111; padding: 0 16px;">
      <div style="border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 28px; padding-top: 32px;">
        <span style="font-size: 18px; font-weight: 900; letter-spacing: -0.5px;">SENSEBUG AI</span>
      </div>
      ${content}
      <p style="color: #bbb; font-size: 12px; margin-top: 40px; line-height: 1.6; padding-bottom: 32px; border-top: 1px solid #f0f0f0; padding-top: 20px;">
        Questions? Reply to this email — we read every one.<br/>
        <a href="${APP_URL}/account" style="color: #777;">Manage your subscription</a>
      </p>
    </div>
  `
}

function receiptTable(rows: Array<{ label: string; value: string }>): string {
  const rowsHtml = rows
    .map(
      ({ label, value }) => `
      <tr>
        <td style="color: #777; padding: 7px 0; font-size: 14px;">${label}</td>
        <td style="font-weight: 600; text-align: right; font-size: 14px;">${value}</td>
      </tr>`,
    )
    .join('')
  return `
    <div style="background: #f9f9f9; border: 1px solid #e5e5e5; padding: 20px; margin-bottom: 28px;">
      <table style="width: 100%; border-collapse: collapse;">${rowsHtml}</table>
    </div>`
}

function ctaButton(href: string, text: string): string {
  return `<a href="${href}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: 600;">${text}</a>`
}

// ─── 1. Purchase confirmation (new subscription / plan upgrade) ───────────────

export async function sendPurchaseConfirmationEmail(params: {
  to: string
  planName: string
  amount: string        // e.g. "$19.00/month"
  nextBillingDate: string // e.g. "May 25, 2026"
}) {
  const { to, planName, amount, nextBillingDate } = params
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `You're on SenseBug AI ${planName} — you're all set`,
      html: emailShell(`
        <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">You're on ${planName}.</h1>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Your subscription is active and your new limits are available immediately.
        </p>
        ${receiptTable([
          { label: 'Plan', value: `SenseBug AI ${planName}` },
          { label: 'Amount', value: amount },
          { label: 'Next billing date', value: nextBillingDate },
        ])}
        ${ctaButton(`${APP_URL}/dashboard`, 'Go to dashboard')}
      `),
    })
  } catch (err) {
    console.error('[email] sendPurchaseConfirmationEmail error:', err instanceof Error ? err.message : err)
  }
}

// ─── 2. Renewal receipt ───────────────────────────────────────────────────────

export async function sendRenewalEmail(params: {
  to: string
  planName: string
  amount: string        // e.g. "$19.00/month"
  billedDate: string    // e.g. "April 25, 2026"
  nextBillingDate: string
}) {
  const { to, planName, amount, billedDate, nextBillingDate } = params
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Your SenseBug AI ${planName} subscription has been renewed`,
      html: emailShell(`
        <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">Subscription renewed.</h1>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Your ${planName} plan has been renewed successfully. Nothing changes — you're all set for another month.
        </p>
        ${receiptTable([
          { label: 'Plan', value: `SenseBug AI ${planName}` },
          { label: 'Amount charged', value: amount },
          { label: 'Charged on', value: billedDate },
          { label: 'Next renewal', value: nextBillingDate },
        ])}
        <p style="color: #777; font-size: 13px; margin: 0 0 20px; line-height: 1.6;">
          You can view your billing history and download invoices from the
          <a href="${APP_URL}/account" style="color: #111;">Account page</a>.
        </p>
        ${ctaButton(`${APP_URL}/dashboard`, 'Go to dashboard')}
      `),
    })
  } catch (err) {
    console.error('[email] sendRenewalEmail error:', err instanceof Error ? err.message : err)
  }
}

// ─── 3. Cancellation confirmation ────────────────────────────────────────────

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
      html: emailShell(`
        <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">Subscription cancelled.</h1>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          We've received your cancellation request. ${accessNote}
        </p>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          After that, your account returns to the Starter plan — 50 bugs/month, unlimited runs. Your data and run history are preserved.
        </p>
        ${ctaButton(`${APP_URL}/pricing`, 'Resubscribe any time')}
      `),
    })
  } catch (err) {
    console.error('[email] sendCancellationEmail error:', err instanceof Error ? err.message : err)
  }
}

// ─── 4. Payment failed ────────────────────────────────────────────────────────

export async function sendPaymentFailedEmail(params: {
  to: string
  planName: string
}) {
  const { to, planName } = params
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Action required: SenseBug AI payment failed`,
      html: emailShell(`
        <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">Payment failed.</h1>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          We weren't able to process your payment for the SenseBug AI <strong>${planName}</strong> plan.
          Your subscription may be paused until payment succeeds.
        </p>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Please update your payment method to keep your access uninterrupted.
        </p>
        ${ctaButton(`${APP_URL}/account`, 'Update payment method')}
        <p style="color: #888; font-size: 13px; margin-top: 20px; line-height: 1.6;">
          If you believe this is an error or need help, reply to this email.
        </p>
      `),
    })
  } catch (err) {
    console.error('[email] sendPaymentFailedEmail error:', err instanceof Error ? err.message : err)
  }
}

// ─── 5. Renewal reminder (sent by cron 3 days before next_billing_date) ───────

export async function sendRenewalReminderEmail(params: {
  to: string
  planName: string
  amount: string
  renewalDate: string
}) {
  const { to, planName, amount, renewalDate } = params
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Your SenseBug AI subscription renews on ${renewalDate}`,
      html: emailShell(`
        <h1 style="font-size: 22px; font-weight: 800; margin: 0 0 8px;">Renewal coming up.</h1>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Just a heads-up — your SenseBug AI <strong>${planName}</strong> subscription renews in 3 days.
        </p>
        ${receiptTable([
          { label: 'Plan', value: `SenseBug AI ${planName}` },
          { label: 'Amount', value: amount },
          { label: 'Renewal date', value: renewalDate },
        ])}
        <p style="color: #777; font-size: 13px; margin: 0 0 20px; line-height: 1.6;">
          To cancel before renewal or update your payment method, visit the
          <a href="${APP_URL}/account" style="color: #111;">Account page</a>.
        </p>
        ${ctaButton(`${APP_URL}/dashboard`, 'Go to dashboard')}
      `),
    })
  } catch (err) {
    console.error('[email] sendRenewalReminderEmail error:', err instanceof Error ? err.message : err)
  }
}

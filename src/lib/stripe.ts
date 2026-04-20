import Stripe from 'stripe'

// Lazy-initialize so the client is only created at request time,
// not at build time when STRIPE_SECRET_KEY isn't available.
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia',
    })
  }
  return _stripe
}

export const STRIPE_PLANS: Record<string, { priceId: string; plan: 'pro' | 'team' }> = {
  pro: {
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    plan: 'pro',
  },
  team: {
    priceId: process.env.STRIPE_TEAM_PRICE_ID!,
    plan: 'team',
  },
}

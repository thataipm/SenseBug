import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
})

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

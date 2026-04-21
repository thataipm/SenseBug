import DodoPayments from 'dodopayments'

// Lazy-initialize so the client is only created at request time,
// not at build time when DODO_PAYMENTS_API_KEY isn't available.
let _dodo: DodoPayments | null = null

export function getDodo(): DodoPayments {
  if (!_dodo) {
    if (!process.env.DODO_PAYMENTS_API_KEY) {
      throw new Error('DODO_PAYMENTS_API_KEY environment variable is not set')
    }
    _dodo = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
    })
  }
  return _dodo
}

export const DODO_PLANS: Record<string, { productId: string; plan: 'pro' | 'max' }> = {
  pro: {
    productId: process.env.DODO_PRO_PRODUCT_ID!,
    plan: 'pro',
  },
  max: {
    productId: process.env.DODO_TEAM_PRODUCT_ID!,
    plan: 'max',
  },
}

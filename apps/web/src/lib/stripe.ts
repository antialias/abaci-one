import Stripe from 'stripe'

let _stripe: Stripe | null = null

/** Lazily initialised Stripe client — avoids crashes at build time when env vars are absent. */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('[stripe] STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(key, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    })
  }
  return _stripe
}

/** Price ID for the Family plan (monthly). Set in Stripe dashboard. */
export const FAMILY_MONTHLY_PRICE_ID = process.env.STRIPE_FAMILY_MONTHLY_PRICE_ID ?? ''

/** Price ID for the Family plan (annual). Set in Stripe dashboard. */
export const FAMILY_ANNUAL_PRICE_ID = process.env.STRIPE_FAMILY_ANNUAL_PRICE_ID ?? ''

/** Webhook signing secret. */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

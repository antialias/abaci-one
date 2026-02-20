import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe] STRIPE_SECRET_KEY is not set — Stripe calls will fail')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-01-28.clover',
  typescript: true,
})

/** Price ID for the Family plan (monthly). Set in Stripe dashboard. */
export const FAMILY_MONTHLY_PRICE_ID = process.env.STRIPE_FAMILY_MONTHLY_PRICE_ID ?? ''

/** Price ID for the Family plan (annual). Set in Stripe dashboard. */
export const FAMILY_ANNUAL_PRICE_ID = process.env.STRIPE_FAMILY_ANNUAL_PRICE_ID ?? ''

/** Webhook signing secret. */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

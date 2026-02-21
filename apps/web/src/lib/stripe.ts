import Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { appSettings, type PricingConfig } from '@/db/schema/app-settings'

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

/**
 * Get active price IDs and amounts, checking DB first then falling back to env vars.
 *
 * Returns the pricing config from app_settings if set, otherwise constructs
 * one from environment variables (amounts default to pricing.json values).
 */
export async function getActivePricing(): Promise<PricingConfig> {
  try {
    const [settings] = await db
      .select({ pricing: appSettings.pricing })
      .from(appSettings)
      .where(eq(appSettings.id, 'default'))
      .limit(1)

    if (settings?.pricing) {
      const parsed = JSON.parse(settings.pricing) as PricingConfig
      if (parsed.family?.monthly?.priceId && parsed.family?.annual?.priceId) {
        return parsed
      }
    }
  } catch {
    console.error('[stripe] Failed to read pricing from DB, falling back to env vars')
  }

  // Fall back to env vars
  return {
    family: {
      monthly: { amount: 600, priceId: FAMILY_MONTHLY_PRICE_ID },
      annual: { amount: 3768, priceId: FAMILY_ANNUAL_PRICE_ID },
    },
  }
}

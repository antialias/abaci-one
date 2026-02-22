import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings, type PricingConfig } from '@/db/schema/app-settings'
import { withAuth } from '@/lib/auth/withAuth'
import {
  getStripe,
  getActivePricing,
  FAMILY_MONTHLY_PRICE_ID,
  FAMILY_ANNUAL_PRICE_ID,
} from '@/lib/stripe'

/**
 * GET /api/admin/pricing
 *
 * Returns the current pricing configuration (from DB or env var fallback).
 */
export const GET = withAuth(
  async () => {
    try {
      const pricing = await getActivePricing()
      return NextResponse.json(pricing)
    } catch (error) {
      console.error('[admin/pricing] Error fetching pricing:', error)
      return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 })
    }
  },
  { role: 'admin' }
)

/**
 * PATCH /api/admin/pricing
 *
 * Update pricing by creating new Stripe prices and archiving old ones.
 *
 * Body: { monthly: number, annual: number } (amounts in cents)
 */
export const PATCH = withAuth(
  async (request) => {
    try {
      const body = await request.json()
      const { monthly, annual } = body

      // Validate amounts
      if (typeof monthly !== 'number' || !Number.isInteger(monthly) || monthly <= 0) {
        return NextResponse.json(
          { error: 'monthly must be a positive integer (cents)' },
          { status: 400 }
        )
      }
      if (typeof annual !== 'number' || !Number.isInteger(annual) || annual <= 0) {
        return NextResponse.json(
          { error: 'annual must be a positive integer (cents)' },
          { status: 400 }
        )
      }

      const stripe = getStripe()
      const currentPricing = await getActivePricing()

      // Look up the product ID from the current monthly price
      const currentMonthlyPriceId = currentPricing.family.monthly.priceId || FAMILY_MONTHLY_PRICE_ID
      if (!currentMonthlyPriceId) {
        return NextResponse.json(
          { error: 'No existing Stripe price found to determine product ID' },
          { status: 500 }
        )
      }

      const existingPrice = await stripe.prices.retrieve(currentMonthlyPriceId)
      const productId =
        typeof existingPrice.product === 'string' ? existingPrice.product : existingPrice.product.id

      const newPricing: PricingConfig = {
        family: {
          monthly: { ...currentPricing.family.monthly },
          annual: { ...currentPricing.family.annual },
        },
      }

      // Create new monthly price if amount changed
      if (monthly !== currentPricing.family.monthly.amount) {
        const newPrice = await stripe.prices.create({
          product: productId,
          currency: 'usd',
          unit_amount: monthly,
          recurring: { interval: 'month' },
        })

        // Archive old price
        if (currentPricing.family.monthly.priceId) {
          await stripe.prices.update(currentPricing.family.monthly.priceId, { active: false })
        }

        newPricing.family.monthly = { amount: monthly, priceId: newPrice.id }
      }

      // Create new annual price if amount changed
      if (annual !== currentPricing.family.annual.amount) {
        const newPrice = await stripe.prices.create({
          product: productId,
          currency: 'usd',
          unit_amount: annual,
          recurring: { interval: 'year' },
        })

        // Archive old price
        if (currentPricing.family.annual.priceId) {
          await stripe.prices.update(currentPricing.family.annual.priceId, { active: false })
        }

        newPricing.family.annual = { amount: annual, priceId: newPrice.id }
      }

      // Save to DB
      const pricingJson = JSON.stringify(newPricing)

      // Ensure default row exists
      const existing = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.id, 'default'))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(appSettings).values({ id: 'default', pricing: pricingJson })
      } else {
        await db
          .update(appSettings)
          .set({ pricing: pricingJson })
          .where(eq(appSettings.id, 'default'))
      }

      return NextResponse.json(newPricing)
    } catch (error) {
      console.error('[admin/pricing] Error updating pricing:', error)
      return NextResponse.json({ error: 'Failed to update pricing' }, { status: 500 })
    }
  },
  { role: 'admin' }
)

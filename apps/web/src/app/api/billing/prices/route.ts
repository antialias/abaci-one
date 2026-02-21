import { NextResponse } from 'next/server'
import { getActivePricing } from '@/lib/stripe'

/**
 * GET /api/billing/prices
 *
 * Returns current display pricing for the public pricing page.
 * No auth required — this is public information.
 */
export async function GET() {
  try {
    const pricing = await getActivePricing()

    const monthlyAmount = pricing.family.monthly.amount
    const annualAmount = pricing.family.annual.amount

    return NextResponse.json({
      family: {
        monthly: {
          amount: monthlyAmount,
          display: monthlyAmount / 100,
        },
        annual: {
          amount: annualAmount,
          display: annualAmount / 100,
          monthlyEquivalent: Math.round((annualAmount / 12) * 100) / 10000,
        },
      },
    })
  } catch (error) {
    console.error('[billing/prices] Error fetching prices:', error)
    // Fall back to static pricing.json values
    return NextResponse.json({
      family: {
        monthly: { amount: 600, display: 6 },
        annual: { amount: 3768, display: 37.68, monthlyEquivalent: 3.14 },
      },
    })
  }
}

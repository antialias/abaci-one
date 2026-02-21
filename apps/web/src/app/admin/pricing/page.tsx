'use client'

import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageWithNav } from '@/components/PageWithNav'
import { AdminNav } from '@/components/AdminNav'
import { useTheme } from '@/contexts/ThemeContext'
import { api } from '@/lib/queryClient'
import { pricingKeys } from '@/lib/queryKeys'
import { css } from '../../../../styled-system/css'

interface PricingConfig {
  family: {
    monthly: { amount: number; priceId: string }
    annual: { amount: number; priceId: string }
  }
}

async function fetchPricing(): Promise<PricingConfig> {
  const res = await api('admin/pricing')
  if (!res.ok) throw new Error('Failed to fetch pricing')
  return res.json()
}

async function updatePricing(data: { monthly: number; annual: number }): Promise<PricingConfig> {
  const res = await api('admin/pricing', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || 'Failed to update pricing')
  }
  return res.json()
}

export default function AdminPricingPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const queryClient = useQueryClient()

  const { data: pricing, isLoading } = useQuery({
    queryKey: pricingKeys.config(),
    queryFn: fetchPricing,
    staleTime: 5 * 60 * 1000,
  })

  // Local form state (in dollars, converted to/from cents)
  const [monthlyDollars, setMonthlyDollars] = useState<string>('')
  const [annualDollars, setAnnualDollars] = useState<string>('')
  const [initialized, setInitialized] = useState(false)

  // Initialize form from fetched data
  if (pricing && !initialized) {
    setMonthlyDollars((pricing.family.monthly.amount / 100).toFixed(2))
    setAnnualDollars((pricing.family.annual.amount / 100).toFixed(2))
    setInitialized(true)
  }

  const mutation = useMutation({
    mutationFn: updatePricing,
    onSuccess: (data) => {
      queryClient.setQueryData(pricingKeys.config(), data)
      setMonthlyDollars((data.family.monthly.amount / 100).toFixed(2))
      setAnnualDollars((data.family.annual.amount / 100).toFixed(2))
    },
  })

  const monthlyCents = Math.round(parseFloat(monthlyDollars || '0') * 100)
  const annualCents = Math.round(parseFloat(annualDollars || '0') * 100)
  const annualMonthlyEquivalent = annualCents > 0 ? (annualCents / 12 / 100).toFixed(2) : '0.00'

  const hasChanges =
    pricing &&
    (monthlyCents !== pricing.family.monthly.amount || annualCents !== pricing.family.annual.amount)

  const handleSave = useCallback(() => {
    if (monthlyCents > 0 && annualCents > 0) {
      mutation.mutate({ monthly: monthlyCents, annual: annualCents })
    }
  }, [monthlyCents, annualCents, mutation])

  const handleReset = useCallback(() => {
    if (pricing) {
      setMonthlyDollars((pricing.family.monthly.amount / 100).toFixed(2))
      setAnnualDollars((pricing.family.annual.amount / 100).toFixed(2))
    }
  }, [pricing])

  return (
    <PageWithNav>
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>
      <main
        data-component="admin-pricing"
        className={css({
          minHeight: 'calc(100vh - 110px)',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '600px', margin: '0 auto' })}>
          {/* Header */}
          <header className={css({ marginBottom: '2rem' })}>
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
              })}
            >
              Pricing Management
            </h1>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                marginTop: '0.5rem',
              })}
            >
              Manage Family plan prices. Changing a price creates a new Stripe Price and archives the
              old one. Existing subscribers keep their current price until renewal.
            </p>
          </header>

          {isLoading ? (
            <p className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>Loading...</p>
          ) : (
            <>
              {/* Price Inputs Card */}
              <div
                data-element="pricing-form"
                className={css({
                  backgroundColor: isDark ? 'gray.800' : 'white',
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                })}
              >
                <h2
                  className={css({
                    fontWeight: '600',
                    color: isDark ? 'white' : 'gray.800',
                    marginBottom: '1rem',
                  })}
                >
                  Family Plan Prices
                </h2>

                {/* Monthly price */}
                <div className={css({ marginBottom: '1rem' })}>
                  <label className={css({ display: 'block', marginBottom: '0.5rem' })}>
                    <span
                      className={css({
                        fontWeight: '600',
                        color: isDark ? 'white' : 'gray.800',
                        display: 'block',
                        marginBottom: '0.25rem',
                      })}
                    >
                      Monthly price
                    </span>
                    <span
                      className={css({
                        fontSize: '0.875rem',
                        color: isDark ? 'gray.400' : 'gray.600',
                      })}
                    >
                      Amount in USD per month
                    </span>
                  </label>
                  <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                    <span
                      className={css({
                        color: isDark ? 'gray.400' : 'gray.600',
                        fontSize: '1.25rem',
                      })}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.50"
                      value={monthlyDollars}
                      onChange={(e) => setMonthlyDollars(e.target.value)}
                      data-element="monthly-price-input"
                      className={css({
                        width: '120px',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isDark ? 'gray.600' : 'gray.300',
                        backgroundColor: isDark ? 'gray.700' : 'white',
                        color: isDark ? 'white' : 'gray.800',
                        fontSize: '1rem',
                      })}
                    />
                    <span className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>/mo</span>
                  </div>
                </div>

                {/* Annual price */}
                <div className={css({ marginBottom: '1rem' })}>
                  <label className={css({ display: 'block', marginBottom: '0.5rem' })}>
                    <span
                      className={css({
                        fontWeight: '600',
                        color: isDark ? 'white' : 'gray.800',
                        display: 'block',
                        marginBottom: '0.25rem',
                      })}
                    >
                      Annual price
                    </span>
                    <span
                      className={css({
                        fontSize: '0.875rem',
                        color: isDark ? 'gray.400' : 'gray.600',
                      })}
                    >
                      Amount in USD per year (billed annually)
                    </span>
                  </label>
                  <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                    <span
                      className={css({
                        color: isDark ? 'gray.400' : 'gray.600',
                        fontSize: '1.25rem',
                      })}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.50"
                      value={annualDollars}
                      onChange={(e) => setAnnualDollars(e.target.value)}
                      data-element="annual-price-input"
                      className={css({
                        width: '120px',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isDark ? 'gray.600' : 'gray.300',
                        backgroundColor: isDark ? 'gray.700' : 'white',
                        color: isDark ? 'white' : 'gray.800',
                        fontSize: '1rem',
                      })}
                    />
                    <span className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>/yr</span>
                  </div>
                  {annualCents > 0 && (
                    <p
                      className={css({
                        fontSize: '0.875rem',
                        color: isDark ? 'gray.400' : 'gray.600',
                        marginTop: '0.25rem',
                      })}
                    >
                      = ${annualMonthlyEquivalent}/mo equivalent
                    </p>
                  )}
                </div>

                {/* Save/Reset buttons */}
                <div
                  className={css({
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'center',
                    marginTop: '1.5rem',
                  })}
                >
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasChanges || mutation.isPending}
                    data-action="save-pricing"
                    className={css({
                      padding: '0.5rem 1rem',
                      backgroundColor: hasChanges ? 'blue.500' : isDark ? 'gray.700' : 'gray.300',
                      color: hasChanges ? 'white' : isDark ? 'gray.500' : 'gray.500',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: '600',
                      cursor: hasChanges ? 'pointer' : 'not-allowed',
                      _hover: hasChanges ? { backgroundColor: 'blue.600' } : {},
                    })}
                  >
                    {mutation.isPending ? 'Creating Stripe prices...' : 'Save'}
                  </button>
                  {hasChanges && (
                    <button
                      type="button"
                      onClick={handleReset}
                      data-action="reset-pricing"
                      className={css({
                        padding: '0.5rem 1rem',
                        backgroundColor: 'transparent',
                        color: isDark ? 'gray.400' : 'gray.600',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isDark ? 'gray.600' : 'gray.300',
                        cursor: 'pointer',
                        _hover: { borderColor: isDark ? 'gray.500' : 'gray.400' },
                      })}
                    >
                      Reset
                    </button>
                  )}
                  {hasChanges && (
                    <span className={css({ fontSize: '0.875rem', color: 'orange.500' })}>
                      Unsaved changes
                    </span>
                  )}
                </div>

                {mutation.isError && (
                  <p
                    className={css({
                      color: 'red.500',
                      fontSize: '0.875rem',
                      marginTop: '0.75rem',
                    })}
                  >
                    {mutation.error instanceof Error
                      ? mutation.error.message
                      : 'Failed to update pricing'}
                  </p>
                )}

                {mutation.isSuccess && (
                  <p
                    className={css({
                      color: 'green.500',
                      fontSize: '0.875rem',
                      marginTop: '0.75rem',
                    })}
                  >
                    Prices updated. New Stripe prices created and old ones archived.
                  </p>
                )}
              </div>

              {/* Current Stripe Price IDs (read-only reference) */}
              {pricing && (
                <div
                  data-element="stripe-ids"
                  className={css({
                    backgroundColor: isDark ? 'gray.800' : 'white',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.700' : 'gray.200',
                    padding: '1.5rem',
                  })}
                >
                  <h2
                    className={css({
                      fontWeight: '600',
                      color: isDark ? 'white' : 'gray.800',
                      marginBottom: '1rem',
                    })}
                  >
                    Current Stripe Price IDs
                  </h2>
                  <div className={css({ fontSize: '0.875rem' })}>
                    <div className={css({ marginBottom: '0.5rem' })}>
                      <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
                        Monthly:{' '}
                      </span>
                      <code
                        className={css({
                          color: isDark ? 'blue.300' : 'blue.700',
                          backgroundColor: isDark ? 'gray.700' : 'gray.100',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.8125rem',
                        })}
                      >
                        {pricing.family.monthly.priceId || '(env var)'}
                      </code>
                    </div>
                    <div>
                      <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
                        Annual:{' '}
                      </span>
                      <code
                        className={css({
                          color: isDark ? 'blue.300' : 'blue.700',
                          backgroundColor: isDark ? 'gray.700' : 'gray.100',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.8125rem',
                        })}
                      >
                        {pricing.family.annual.priceId || '(env var)'}
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </PageWithNav>
  )
}

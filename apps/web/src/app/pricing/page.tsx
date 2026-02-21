'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { useFamilyCoverage, useTier } from '@/hooks/useTier'
import { api } from '@/lib/queryClient'
import { billingKeys } from '@/lib/queryKeys'
import { css } from '../../../styled-system/css'

type BillingInterval = 'month' | 'year'

/** Core practice features — the main product */
const PRACTICE_FEATURES: readonly PricingFeature[] = [
  { label: 'Adaptive abacus practice' },
  { label: 'Skill mastery tracking' },
  { label: 'Progress dashboard' },
  { label: 'Session history', guestNote: 'browser-only for guests' },
  { label: '1 student', isLimit: true },
  { label: 'Up to 10 min sessions', isLimit: true },
  { label: '5 sessions per week', isLimit: true },
]

/** Supplementary features included in all plans */
const EXTRA_FEATURES: readonly PricingFeature[] = [
  { label: 'Worksheet parsing', value: '3/month' },
  { label: 'Arcade games & toys' },
  { label: 'Live observation links', guestNote: 'requires account' },
]

/** What the Family plan adds on top of Free */
const FAMILY_UPGRADES: readonly PricingFeature[] = [
  { label: 'Unlimited students' },
  { label: 'Up to 20 min sessions' },
  { label: 'Unlimited sessions per week' },
  { label: '30 worksheet parses/month' },
]

interface PricingFeature {
  label: string
  value?: string
  guestNote?: string
  /** Render with dimmer styling to indicate a limit, not a feature */
  isLimit?: boolean
}

interface DisplayPricing {
  family: {
    monthly: { amount: number; display: number }
    annual: { amount: number; display: number; monthlyEquivalent: number }
  }
}

/** Default display prices (fallback while loading) */
const DEFAULT_PRICING: DisplayPricing = {
  family: {
    monthly: { amount: 600, display: 6 },
    annual: { amount: 3768, display: 37.68, monthlyEquivalent: 3.14 },
  },
}

async function fetchDisplayPricing(): Promise<DisplayPricing> {
  const res = await api('billing/prices')
  if (!res.ok) return DEFAULT_PRICING
  return res.json()
}

async function createCheckout(interval: BillingInterval): Promise<string> {
  const res = await api('billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interval }),
  })
  if (!res.ok) throw new Error('Failed to create checkout session')
  const data = await res.json()
  return data.url
}

export default function PricingPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { tier } = useTier()
  const { isCovered, coveredBy } = useFamilyCoverage()
  const [interval, setInterval] = useState<BillingInterval>('month')

  const { data: pricing = DEFAULT_PRICING } = useQuery({
    queryKey: billingKeys.prices(),
    queryFn: fetchDisplayPricing,
    staleTime: 5 * 60 * 1000,
  })

  const checkout = useMutation({
    mutationFn: createCheckout,
    onSuccess: (url) => {
      window.location.href = url
    },
  })

  const isFamily = tier === 'family'
  const monthlyPrice = pricing.family.monthly.display
  const annualPrice = pricing.family.annual.display
  const annualMonthly = pricing.family.annual.monthlyEquivalent

  return (
    <PageWithNav>
      <main
        data-component="pricing-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          paddingTop: '2rem',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingBottom: '2rem',
        })}
      >
        <div className={css({ maxWidth: '900px', margin: '0 auto' })}>
          {/* Header */}
          <div className={css({ textAlign: 'center', marginBottom: '2rem' })}>
            <h1
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.900',
                marginBottom: '0.5rem',
              })}
            >
              Simple, transparent pricing
            </h1>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                fontSize: '1.125rem',
              })}
            >
              Everything you need to build strong math skills. The free tier is fully functional —
              upgrade when your family grows.
            </p>
          </div>

          {/* Coverage banner — shown when a co-parent provides family coverage */}
          {isCovered && tier !== 'family' && coveredBy && (
            <div
              data-element="coverage-banner"
              className={css({
                backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
                border: '1px solid',
                borderColor: isDark ? 'blue.700' : 'blue.200',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                fontSize: '0.875rem',
                color: isDark ? 'blue.300' : 'blue.800',
                textAlign: 'center',
              })}
            >
              Your children are covered by {coveredBy.name}&apos;s Family Plan. You don&apos;t need
              to subscribe.
            </div>
          )}

          {/* Billing toggle */}
          <div
            data-element="billing-toggle"
            className={css({
              display: 'flex',
              justifyContent: 'center',
              gap: '0.25rem',
              marginBottom: '2rem',
              padding: '4px',
              backgroundColor: isDark ? 'gray.800' : 'gray.200',
              borderRadius: '8px',
              width: 'fit-content',
              margin: '0 auto 2rem',
            })}
          >
            {(['month', 'year'] as const).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInterval(i)}
                data-option={i}
                data-selected={interval === i}
                className={css({
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                })}
                style={{
                  backgroundColor:
                    interval === i ? (isDark ? '#374151' : '#ffffff') : 'transparent',
                  color:
                    interval === i
                      ? isDark
                        ? '#f3f4f6'
                        : '#111827'
                      : isDark
                        ? '#9ca3af'
                        : '#6b7280',
                  boxShadow: interval === i ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {i === 'month' ? 'Monthly' : 'Annual'}
                {i === 'year' && (
                  <span
                    className={css({
                      marginLeft: '0.375rem',
                      fontSize: '0.75rem',
                      color: 'green.500',
                      fontWeight: '600',
                    })}
                  >
                    Save 48%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Plans */}
          <div
            data-element="plan-cards"
            className={css({
              display: 'grid',
              gridTemplateColumns: { base: '1fr', md: '9fr 10fr' },
              gap: '1.5rem',
              maxWidth: '750px',
              margin: '0 auto',
            })}
          >
            {/* Free Plan */}
            <div
              data-plan="free"
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
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: isDark ? 'white' : 'gray.900',
                  marginBottom: '0.25rem',
                })}
              >
                Free
              </h2>
              <p
                className={css({
                  color: isDark ? 'gray.400' : 'gray.600',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                })}
              >
                Everything you need for one student
              </p>
              <div className={css({ marginBottom: '1.5rem' })}>
                <span
                  className={css({
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: isDark ? 'white' : 'gray.900',
                  })}
                >
                  $0
                </span>
                <span className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>/mo</span>
              </div>

              {tier === 'guest' ? (
                <Link
                  href="/auth/signin"
                  data-action="get-started-free"
                  className={css({
                    display: 'block',
                    textAlign: 'center',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.600' : 'gray.300',
                    color: isDark ? 'white' : 'gray.900',
                    backgroundColor: 'transparent',
                    textDecoration: 'none',
                    marginBottom: '1.5rem',
                    _hover: {
                      backgroundColor: isDark ? 'gray.700' : 'gray.50',
                    },
                  })}
                >
                  Get Started Free
                </Link>
              ) : (
                <div
                  className={css({
                    textAlign: 'center',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.400' : 'gray.500',
                    backgroundColor: isDark ? 'gray.700/50' : 'gray.100',
                    marginBottom: '1.5rem',
                  })}
                >
                  {isFamily ? 'Included' : 'Current plan'}
                </div>
              )}

              <FeatureGroup features={PRACTICE_FEATURES} isDark={isDark} showGuestNotes />
              <SectionDivider label="Also included" isDark={isDark} />
              <FeatureGroup features={EXTRA_FEATURES} isDark={isDark} showGuestNotes />
            </div>

            {/* Family Plan */}
            <div
              data-plan="family"
              className={css({
                backgroundColor: isDark ? 'gray.800' : 'white',
                borderRadius: '12px',
                border: '2px solid',
                borderColor: isDark ? 'purple.500' : 'purple.400',
                padding: '1.5rem',
                position: 'relative',
              })}
            >
              <span
                className={css({
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: isDark ? 'purple.500' : 'purple.500',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  padding: '2px 12px',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                })}
              >
                Most Popular
              </span>
              <h2
                className={css({
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: isDark ? 'white' : 'gray.900',
                  marginBottom: '0.25rem',
                })}
              >
                Family
              </h2>
              <p
                className={css({
                  color: isDark ? 'gray.400' : 'gray.600',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                })}
              >
                For families with multiple students
              </p>
              <div className={css({ marginBottom: '1.5rem' })}>
                <span
                  className={css({
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: isDark ? 'white' : 'gray.900',
                  })}
                >
                  ${interval === 'month' ? monthlyPrice : annualMonthly}
                </span>
                <span className={css({ color: isDark ? 'gray.500' : 'gray.500' })}>/mo</span>
                {interval === 'year' && (
                  <span
                    className={css({
                      display: 'block',
                      fontSize: '0.8125rem',
                      color: isDark ? 'gray.500' : 'gray.500',
                      marginTop: '0.125rem',
                    })}
                  >
                    ${annualPrice}/yr billed annually
                  </span>
                )}
              </div>

              {isFamily ? (
                <Link
                  href="/settings?tab=billing"
                  data-action="manage-subscription"
                  className={css({
                    display: 'block',
                    textAlign: 'center',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    color: 'white',
                    backgroundColor: isDark ? 'purple.600' : 'purple.500',
                    textDecoration: 'none',
                    marginBottom: '1.5rem',
                    _hover: {
                      backgroundColor: isDark ? 'purple.500' : 'purple.600',
                    },
                  })}
                >
                  Manage Subscription
                </Link>
              ) : isCovered && coveredBy ? (
                <div className={css({ marginBottom: '1.5rem' })}>
                  <div
                    data-element="already-covered"
                    className={css({
                      textAlign: 'center',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      color: isDark ? 'gray.400' : 'gray.500',
                      backgroundColor: isDark ? 'gray.700/50' : 'gray.100',
                    })}
                  >
                    Already Covered
                    <span
                      className={css({
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: '400',
                        marginTop: '0.125rem',
                      })}
                    >
                      Via {coveredBy.name}&apos;s subscription
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => checkout.mutate(interval)}
                    disabled={checkout.isPending}
                    data-action="subscribe-anyway"
                    className={css({
                      display: 'block',
                      width: '100%',
                      marginTop: '0.5rem',
                      padding: '0.375rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      fontSize: '0.75rem',
                      color: isDark ? 'gray.500' : 'gray.400',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      _hover: {
                        color: isDark ? 'gray.400' : 'gray.500',
                      },
                    })}
                  >
                    {checkout.isPending ? 'Redirecting...' : 'Subscribe anyway'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => checkout.mutate(interval)}
                  disabled={checkout.isPending}
                  data-action="upgrade-to-family"
                  className={css({
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    color: 'white',
                    backgroundColor: isDark ? 'purple.600' : 'purple.500',
                    border: 'none',
                    cursor: 'pointer',
                    marginBottom: '1.5rem',
                    _hover: {
                      backgroundColor: isDark ? 'purple.500' : 'purple.600',
                    },
                    _disabled: {
                      opacity: 0.6,
                      cursor: 'not-allowed',
                    },
                  })}
                >
                  {checkout.isPending ? 'Redirecting...' : 'Upgrade to Family'}
                </button>
              )}

              {checkout.isError && (
                <p
                  className={css({
                    color: 'red.500',
                    fontSize: '0.875rem',
                    marginBottom: '1rem',
                    textAlign: 'center',
                  })}
                >
                  Something went wrong. Please try again.
                </p>
              )}

              <p
                className={css({
                  fontSize: '0.8125rem',
                  fontWeight: '500',
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginBottom: '0.5rem',
                })}
              >
                Everything in Free, plus:
              </p>
              <FeatureGroup features={FAMILY_UPGRADES} isDark={isDark} color="purple" />
            </div>
          </div>

          {/* FAQ / note */}
          <div
            className={css({
              maxWidth: '600px',
              margin: '2rem auto 0',
              textAlign: 'center',
            })}
          >
            <p
              className={css({
                color: isDark ? 'gray.500' : 'gray.500',
                fontSize: '0.875rem',
              })}
            >
              All plans include full adaptive practice, mastery tracking, and progress dashboards.
              Cancel anytime — no lock-in, no data loss.
            </p>
          </div>
        </div>
      </main>
    </PageWithNav>
  )
}

function FeatureGroup({
  features,
  isDark,
  showGuestNotes = false,
  color = 'green',
}: {
  features: readonly PricingFeature[]
  isDark: boolean
  showGuestNotes?: boolean
  color?: 'green' | 'purple'
}) {
  return (
    <ul className={css({ listStyle: 'none', padding: 0, margin: 0 })}>
      {features.map((f) => (
        <li
          key={f.label}
          className={css({
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.5rem',
            padding: '0.375rem 0',
            fontSize: '0.875rem',
            color: f.isLimit
              ? isDark
                ? 'gray.400'
                : 'gray.500'
              : isDark
                ? 'gray.300'
                : 'gray.700',
          })}
        >
          <Check
            size={16}
            className={css({
              color:
                color === 'purple'
                  ? isDark
                    ? 'purple.400'
                    : 'purple.500'
                  : isDark
                    ? 'green.400'
                    : 'green.500',
              flexShrink: 0,
              position: 'relative',
              top: '2px',
            })}
          />
          <span>
            {f.label}
            {f.value && (
              <span
                className={css({
                  marginLeft: '0.25rem',
                  fontWeight: '500',
                  color: f.isLimit
                    ? isDark
                      ? 'gray.400'
                      : 'gray.500'
                    : isDark
                      ? 'white'
                      : 'gray.900',
                })}
              >
                — {f.value}
              </span>
            )}
            {showGuestNotes && f.guestNote && (
              <span
                className={css({
                  display: 'block',
                  fontSize: '0.75rem',
                  color: isDark ? 'gray.500' : 'gray.400',
                  fontStyle: 'italic',
                })}
              >
                {f.guestNote}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

function SectionDivider({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <div
      className={css({
        fontSize: '0.75rem',
        fontWeight: '500',
        color: isDark ? 'gray.500' : 'gray.400',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginTop: '0.75rem',
        marginBottom: '0.25rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.100',
      })}
    >
      {label}
    </div>
  )
}

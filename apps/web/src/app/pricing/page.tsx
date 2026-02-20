'use client'

import { useMutation } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { useTier } from '@/hooks/useTier'
import { api } from '@/lib/queryClient'
import { css } from '../../../styled-system/css'

type BillingInterval = 'month' | 'year'

const FEATURES = [
  { label: 'Students', free: '1', family: 'Unlimited' },
  { label: 'Session duration', free: 'Up to 10 min', family: 'Up to 20 min' },
  { label: 'Sessions per week', free: '5', family: 'Unlimited' },
  { label: 'Worksheet parsing', free: '3/month', family: '30/month' },
  { label: 'Session history', free: true, family: true },
  { label: 'Adaptive practice', free: true, family: true },
  { label: 'Progress dashboard', free: true, family: true },
  { label: 'Games & toys', free: true, family: true },
  { label: 'Observation links', free: true, family: true },
] as const

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
  const [interval, setInterval] = useState<BillingInterval>('month')

  const checkout = useMutation({
    mutationFn: createCheckout,
    onSuccess: (url) => {
      window.location.href = url
    },
  })

  const isFamily = tier === 'family'
  const monthlyPrice = 6
  const annualPrice = 50
  const annualMonthly = Math.round((annualPrice / 12) * 100) / 100

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
                    Save 30%
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
              gridTemplateColumns: { base: '1fr', md: '1fr 1fr' },
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

              <FeatureList features={FEATURES} column="free" isDark={isDark} />
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

              <FeatureList features={FEATURES} column="family" isDark={isDark} />
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

function FeatureList({
  features,
  column,
  isDark,
}: {
  features: typeof FEATURES
  column: 'free' | 'family'
  isDark: boolean
}) {
  return (
    <ul className={css({ listStyle: 'none', padding: 0, margin: 0 })}>
      {features.map((f) => {
        const value = f[column]
        const isIncluded = value === true

        return (
          <li
            key={f.label}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0',
              fontSize: '0.875rem',
              color: isDark ? 'gray.300' : 'gray.700',
            })}
          >
            <Check
              size={16}
              className={css({
                color:
                  column === 'family'
                    ? isDark
                      ? 'purple.400'
                      : 'purple.500'
                    : isDark
                      ? 'green.400'
                      : 'green.500',
                flexShrink: 0,
              })}
            />
            <span>
              {f.label}
              {typeof value === 'string' && (
                <span
                  className={css({
                    marginLeft: '0.25rem',
                    fontWeight: '500',
                    color: isDark ? 'white' : 'gray.900',
                  })}
                >
                  — {value}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

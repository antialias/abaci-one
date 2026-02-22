'use client'

import { ArrowLeft, CreditCard, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { useTier } from '@/hooks/useTier'
import { useBillingSync, useBillingReset } from '@/hooks/useDebugSeedStudents'
import { css } from '../../../../styled-system/css'

export default function DebugBillingPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { tier, limits, isLoading: tierLoading } = useTier()

  const syncMutation = useBillingSync()
  const resetMutation = useBillingReset()

  const syncStatus = syncMutation.isPending
    ? 'loading'
    : syncMutation.isSuccess
      ? 'success'
      : syncMutation.isError
        ? 'error'
        : 'idle'
  const syncResult = syncMutation.isSuccess
    ? `Synced session ${(syncMutation.data as { sessionId: string }).sessionId}`
    : (syncMutation.error?.message ?? null)

  const resetStatus = resetMutation.isPending
    ? 'loading'
    : resetMutation.isSuccess
      ? 'success'
      : resetMutation.isError
        ? 'error'
        : 'idle'
  const resetResult = resetMutation.isSuccess
    ? 'Subscription deleted locally. You are now on the Free tier.'
    : (resetMutation.error?.message ?? null)

  return (
    <PageWithNav>
      <main
        data-component="debug-billing"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '600px', margin: '0 auto' })}>
          <header className={css({ marginBottom: '2rem' })}>
            <Link
              href="/debug"
              data-action="back-to-debug-hub"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.500',
                textDecoration: 'none',
                marginBottom: '0.75rem',
                _hover: { color: isDark ? 'gray.200' : 'gray.700' },
              })}
            >
              <ArrowLeft size={14} />
              Debug Hub
            </Link>
            <h1
              className={css({
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              Billing Debug
            </h1>
            <p className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
              View current tier, sync Stripe checkout sessions, and reset subscriptions for testing.
            </p>
          </header>

          {/* Current Tier */}
          <Section title="Current Tier" isDark={isDark}>
            {tierLoading ? (
              <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                <Loader2 size={16} className={css({ animation: 'spin 1s linear infinite' })} />
                <span className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>Loading...</span>
              </div>
            ) : (
              <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' })}>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '0.75rem' })}>
                  <span
                    data-element="tier-badge"
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.375rem 1rem',
                      borderRadius: '9999px',
                      fontSize: '0.9375rem',
                      fontWeight: '600',
                      backgroundColor:
                        tier === 'family'
                          ? isDark
                            ? 'purple.900/50'
                            : 'purple.50'
                          : isDark
                            ? 'gray.700'
                            : 'gray.100',
                      color:
                        tier === 'family'
                          ? isDark
                            ? 'purple.300'
                            : 'purple.700'
                          : isDark
                            ? 'gray.300'
                            : 'gray.600',
                    })}
                  >
                    <CreditCard size={14} />
                    {tier === 'family' ? 'Family' : tier === 'guest' ? 'Guest' : 'Free'}
                  </span>
                </div>
                {limits && (
                  <div
                    className={css({
                      fontSize: '0.8125rem',
                      color: isDark ? 'gray.400' : 'gray.500',
                      fontFamily: 'mono',
                      lineHeight: '1.6',
                    })}
                  >
                    <div>maxPracticeStudents: {limits.maxPracticeStudents ?? 'unlimited'}</div>
                    <div>maxSessionMinutes: {limits.maxSessionMinutes}</div>
                    <div>maxSessionsPerWeek: {limits.maxSessionsPerWeek ?? 'unlimited'}</div>
                    <div>maxOfflineParsingPerMonth: {limits.maxOfflineParsingPerMonth}</div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Sync from Stripe */}
          <Section title="Sync from Stripe" isDark={isDark}>
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
                marginBottom: '0.75rem',
              })}
            >
              Finds the most recent completed checkout session in Stripe and syncs it to the local
              database. Use this if the post-checkout redirect failed to sync.
            </p>
            <ActionButton
              onClick={() => syncMutation.mutate()}
              loading={syncStatus === 'loading'}
              icon={<RefreshCw size={14} />}
              isDark={isDark}
            >
              Sync Latest Checkout
            </ActionButton>
            {syncResult && (
              <StatusMessage type={syncStatus === 'success' ? 'success' : 'error'} isDark={isDark}>
                {syncResult}
              </StatusMessage>
            )}
          </Section>

          {/* Reset Subscription */}
          <Section title="Reset Subscription" isDark={isDark}>
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
                marginBottom: '0.75rem',
              })}
            >
              Deletes your local subscription row, resetting you to the Free tier. Does not cancel
              the Stripe subscription — only affects the local database.
            </p>
            <ActionButton
              onClick={() => resetMutation.mutate()}
              loading={resetStatus === 'loading'}
              icon={<Trash2 size={14} />}
              isDark={isDark}
              variant="danger"
            >
              Reset to Free Tier
            </ActionButton>
            {resetResult && (
              <StatusMessage type={resetStatus === 'success' ? 'success' : 'error'} isDark={isDark}>
                {resetResult}
              </StatusMessage>
            )}
          </Section>
        </div>
      </main>
    </PageWithNav>
  )
}

// ============================================================================
// Shared Components
// ============================================================================

function Section({
  title,
  isDark,
  children,
}: {
  title: string
  isDark: boolean
  children: React.ReactNode
}) {
  return (
    <section
      data-section={title.toLowerCase().replace(/\s+/g, '-')}
      className={css({ marginBottom: '1.5rem' })}
    >
      <h2
        className={css({
          fontSize: '0.875rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: isDark ? 'gray.500' : 'gray.500',
          marginBottom: '0.75rem',
          paddingLeft: '0.5rem',
        })}
      >
        {title}
      </h2>
      <div
        className={css({
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          padding: '1rem 1.25rem',
        })}
      >
        {children}
      </div>
    </section>
  )
}

function ActionButton({
  onClick,
  loading,
  icon,
  isDark,
  variant = 'default',
  children,
}: {
  onClick: () => void
  loading: boolean
  icon: React.ReactNode
  isDark: boolean
  variant?: 'default' | 'danger'
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      data-action={`billing-${variant === 'danger' ? 'reset' : 'sync'}`}
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        borderRadius: '6px',
        border: '1px solid',
        borderColor:
          variant === 'danger'
            ? isDark
              ? 'red.700'
              : 'red.300'
            : isDark
              ? 'gray.600'
              : 'gray.300',
        backgroundColor: 'transparent',
        color:
          variant === 'danger' ? (isDark ? 'red.400' : 'red.600') : isDark ? 'white' : 'gray.800',
        fontSize: '0.875rem',
        fontWeight: '500',
        cursor: 'pointer',
        _hover: {
          backgroundColor:
            variant === 'danger'
              ? isDark
                ? 'red.900/30'
                : 'red.50'
              : isDark
                ? 'gray.700'
                : 'gray.50',
        },
        _disabled: {
          opacity: 0.6,
          cursor: 'not-allowed',
        },
      })}
    >
      {loading ? (
        <Loader2 size={14} className={css({ animation: 'spin 1s linear infinite' })} />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}

function StatusMessage({
  type,
  isDark,
  children,
}: {
  type: 'success' | 'error'
  isDark: boolean
  children: React.ReactNode
}) {
  const isSuccess = type === 'success'
  return (
    <div
      data-element="status-message"
      className={css({
        marginTop: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '6px',
        fontSize: '0.8125rem',
        backgroundColor: isSuccess
          ? isDark
            ? 'green.900/30'
            : 'green.50'
          : isDark
            ? 'red.900/30'
            : 'red.50',
        color: isSuccess ? (isDark ? 'green.300' : 'green.700') : isDark ? 'red.300' : 'red.700',
        border: '1px solid',
        borderColor: isSuccess
          ? isDark
            ? 'green.800'
            : 'green.200'
          : isDark
            ? 'red.800'
            : 'red.200',
      })}
    >
      {children}
    </div>
  )
}

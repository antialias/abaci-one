'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import {
  ActiveSessionExistsClientError,
  sessionPlanKeys,
  useGenerateSessionPlan,
} from '@/hooks/useSessionPlan'
import { css } from '../../../../../styled-system/css'

interface SessionConfig {
  durationMinutes: number
}

interface ConfigureClientProps {
  studentId: string
  playerName: string
}

/**
 * Client component for session configuration
 *
 * This page is only accessible when there's no active session.
 * The server component guards against this by redirecting if a session exists.
 */
export function ConfigureClient({ studentId, playerName }: ConfigureClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    durationMinutes: 10,
  })

  const generatePlan = useGenerateSessionPlan()

  // Derive error state from mutation (excluding ActiveSessionExistsClientError since we handle it)
  const error =
    generatePlan.error && !(generatePlan.error instanceof ActiveSessionExistsClientError)
      ? {
          message: 'Unable to create practice plan',
          suggestion:
            'This may be a temporary issue. Try selecting a different duration or refresh the page.',
        }
      : null

  const handleGeneratePlan = useCallback(() => {
    generatePlan.reset()
    generatePlan.mutate(
      {
        playerId: studentId,
        durationMinutes: sessionConfig.durationMinutes,
      },
      {
        onSuccess: () => {
          // Redirect to main practice page - view will derive from session data
          router.push(`/practice/${studentId}`)
        },
        onError: (err) => {
          // If an active session already exists, use it and redirect
          if (err instanceof ActiveSessionExistsClientError) {
            // Update the cache with the existing plan so the practice page has it
            queryClient.setQueryData(sessionPlanKeys.active(studentId), err.existingPlan)
            // Redirect to practice page
            router.push(`/practice/${studentId}`)
          }
        },
      }
    )
  }, [studentId, sessionConfig, generatePlan, router, queryClient])

  const handleCancel = useCallback(() => {
    generatePlan.reset()
    router.push(`/practice/${studentId}`)
  }, [studentId, generatePlan, router])

  return (
    <PageWithNav>
      <main
        data-component="configure-practice-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          paddingTop: 'calc(80px + 2rem)',
          paddingLeft: '2rem',
          paddingRight: '2rem',
          paddingBottom: '2rem',
        })}
      >
        <div
          className={css({
            maxWidth: '800px',
            margin: '0 auto',
          })}
        >
          {/* Header */}
          <header
            className={css({
              textAlign: 'center',
              marginBottom: '2rem',
            })}
          >
            <h1
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              Configure Practice for {playerName}
            </h1>
            <p
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Set up your practice session
            </p>
          </header>

          {/* Configuration Card */}
          <div
            data-section="session-config"
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              padding: '2rem',
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '16px',
              boxShadow: 'md',
            })}
          >
            <h2
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                textAlign: 'center',
              })}
            >
              Configure Practice Session
            </h2>

            {/* Duration selector */}
            <div>
              <label
                className={css({
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.300' : 'gray.700',
                  marginBottom: '0.5rem',
                })}
              >
                Session Duration
              </label>
              <div
                className={css({
                  display: 'flex',
                  gap: '0.5rem',
                })}
              >
                {[5, 10, 15, 20].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSessionConfig((c) => ({ ...c, durationMinutes: mins }))}
                    className={css({
                      flex: 1,
                      padding: '1rem',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      color:
                        sessionConfig.durationMinutes === mins
                          ? 'white'
                          : isDark
                            ? 'gray.300'
                            : 'gray.700',
                      backgroundColor:
                        sessionConfig.durationMinutes === mins
                          ? 'blue.500'
                          : isDark
                            ? 'gray.700'
                            : 'gray.100',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      _hover: {
                        backgroundColor:
                          sessionConfig.durationMinutes === mins
                            ? 'blue.600'
                            : isDark
                              ? 'gray.600'
                              : 'gray.200',
                      },
                    })}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            {/* Session structure preview */}
            <div
              className={css({
                padding: '1rem',
                backgroundColor: isDark ? 'gray.700' : 'gray.50',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.200',
              })}
            >
              <div
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.300' : 'gray.700',
                  marginBottom: '0.75rem',
                })}
              >
                Today's Practice Structure
              </div>
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                })}
              >
                <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                  <span>🧮</span>
                  <span className={css({ color: isDark ? 'gray.300' : 'gray.700' })}>
                    <strong>Part 1:</strong> Use abacus
                  </span>
                </div>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                  <span>🧠</span>
                  <span className={css({ color: isDark ? 'gray.300' : 'gray.700' })}>
                    <strong>Part 2:</strong> Mental math (visualization)
                  </span>
                </div>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                  <span>💭</span>
                  <span className={css({ color: isDark ? 'gray.300' : 'gray.700' })}>
                    <strong>Part 3:</strong> Mental math (linear)
                  </span>
                </div>
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div
                data-element="error-banner"
                className={css({
                  padding: '1rem',
                  backgroundColor: isDark ? 'red.900' : 'red.50',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isDark ? 'red.700' : 'red.200',
                })}
              >
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                  })}
                >
                  <span className={css({ fontSize: '1.25rem' })}>⚠️</span>
                  <div>
                    <div
                      className={css({
                        fontWeight: 'bold',
                        color: isDark ? 'red.300' : 'red.700',
                        marginBottom: '0.25rem',
                      })}
                    >
                      {error.message}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.875rem',
                        color: isDark ? 'red.400' : 'red.600',
                      })}
                    >
                      {error.suggestion}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div
              className={css({
                display: 'flex',
                gap: '0.75rem',
                marginTop: '1rem',
              })}
            >
              <button
                type="button"
                onClick={handleCancel}
                className={css({
                  flex: 1,
                  padding: '1rem',
                  fontSize: '1rem',
                  color: isDark ? 'gray.300' : 'gray.600',
                  backgroundColor: isDark ? 'gray.700' : 'gray.100',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: {
                    backgroundColor: isDark ? 'gray.600' : 'gray.200',
                  },
                })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={generatePlan.isPending}
                className={css({
                  flex: 2,
                  padding: '1rem',
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: 'white',
                  backgroundColor: generatePlan.isPending ? 'gray.400' : 'green.500',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: generatePlan.isPending ? 'not-allowed' : 'pointer',
                  _hover: {
                    backgroundColor: generatePlan.isPending ? 'gray.400' : 'green.600',
                  },
                })}
              >
                {generatePlan.isPending ? 'Generating...' : 'Generate Plan'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </PageWithNav>
  )
}

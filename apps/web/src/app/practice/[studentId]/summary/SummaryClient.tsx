'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import {
  PracticeSubNav,
  SessionModeBanner,
  SessionOverview,
  SessionSummary,
  StartPracticeModal,
} from '@/components/practice'
import { useTheme } from '@/contexts/ThemeContext'
import type { Player } from '@/db/schema/players'
import type { SessionPlan } from '@/db/schema/session-plans'
import { useSessionMode } from '@/hooks/useSessionMode'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { css } from '../../../../../styled-system/css'

interface SummaryClientProps {
  studentId: string
  player: Player
  session: SessionPlan | null
  /** Average seconds per problem from recent sessions */
  avgSecondsPerProblem?: number
  /** Problem history for BKT computation in weak skills targeting */
  problemHistory?: ProblemResultWithContext[]
}

/**
 * Summary Client Component
 *
 * Displays the session results and provides navigation options.
 * Handles three cases:
 * - In-progress session: shows partial results
 * - Completed session: shows full results
 * - No session: shows empty state
 */
export function SummaryClient({
  studentId,
  player,
  session,
  avgSecondsPerProblem = 40,
  problemHistory,
}: SummaryClientProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [showStartPracticeModal, setShowStartPracticeModal] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'debug'>('summary')

  // Session mode - single source of truth for session planning decisions
  const { data: sessionMode, isLoading: isLoadingSessionMode } = useSessionMode(studentId)

  const isInProgress = session?.startedAt && !session?.completedAt

  // Handle practice again - show the start practice modal
  const handlePracticeAgain = useCallback(() => {
    setShowStartPracticeModal(true)
  }, [])

  // Determine header text based on session state
  const headerTitle = isInProgress
    ? 'Session In Progress'
    : session
      ? 'Session Complete'
      : 'No Sessions Yet'

  const headerSubtitle = isInProgress
    ? `${player.name} is currently practicing`
    : session
      ? 'Great work on your practice session!'
      : `${player.name} hasn't completed any sessions yet`

  return (
    <PageWithNav>
      {/* Practice Sub-Navigation */}
      <PracticeSubNav student={player} pageContext="summary" />

      <main
        data-component="practice-summary-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          paddingTop: '2rem',
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
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              {headerTitle}
            </h1>
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {headerSubtitle}
            </p>
          </header>

          {/* Session mode banner - handles celebration wind-down internally */}
          {sessionMode && (
            <div className={css({ marginBottom: '1.5rem' })}>
              <SessionModeBanner
                sessionMode={sessionMode}
                onAction={handlePracticeAgain}
                isLoading={isLoadingSessionMode}
                variant="dashboard"
              />
            </div>
          )}

          {/* View Mode Toggle (only show when there's a session) */}
          {session && (
            <div
              data-element="view-mode-toggle"
              className={css({
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem',
              })}
            >
              <button
                type="button"
                data-action="view-summary"
                onClick={() => setViewMode('summary')}
                className={css({
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: viewMode === 'summary' ? 'bold' : 'normal',
                  color: viewMode === 'summary' ? 'white' : isDark ? 'gray.300' : 'gray.600',
                  backgroundColor:
                    viewMode === 'summary' ? 'blue.500' : isDark ? 'gray.700' : 'gray.200',
                  borderRadius: '6px 0 0 6px',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: {
                    backgroundColor:
                      viewMode === 'summary' ? 'blue.600' : isDark ? 'gray.600' : 'gray.300',
                  },
                })}
              >
                Summary
              </button>
              <button
                type="button"
                data-action="view-debug"
                onClick={() => setViewMode('debug')}
                className={css({
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: viewMode === 'debug' ? 'bold' : 'normal',
                  color: viewMode === 'debug' ? 'white' : isDark ? 'gray.300' : 'gray.600',
                  backgroundColor:
                    viewMode === 'debug' ? 'blue.500' : isDark ? 'gray.700' : 'gray.200',
                  borderRadius: '0 6px 6px 0',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: {
                    backgroundColor:
                      viewMode === 'debug' ? 'blue.600' : isDark ? 'gray.600' : 'gray.300',
                  },
                })}
              >
                Debug View
              </button>
            </div>
          )}

          {/* Session Summary/Overview or Empty State */}
          {session ? (
            viewMode === 'summary' ? (
              <SessionSummary
                plan={session}
                studentId={studentId}
                studentName={player.name}
                onPracticeAgain={handlePracticeAgain}
              />
            ) : (
              <SessionOverview plan={session} studentName={player.name} />
            )
          ) : (
            <div
              className={css({
                padding: '3rem',
                textAlign: 'center',
                backgroundColor: isDark ? 'gray.800' : 'white',
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
              })}
            >
              <p
                className={css({
                  fontSize: '1.125rem',
                  color: isDark ? 'gray.400' : 'gray.600',
                  marginBottom: '1.5rem',
                })}
              >
                Start a practice session to see results here.
              </p>
              <button
                type="button"
                onClick={handlePracticeAgain}
                className={css({
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: 'white',
                  backgroundColor: 'blue.500',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: { backgroundColor: 'blue.600' },
                })}
              >
                Start Practice
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Start Practice Modal */}
      {showStartPracticeModal && sessionMode && (
        <StartPracticeModal
          studentId={studentId}
          studentName={player.name}
          focusDescription={sessionMode.focusDescription}
          sessionMode={sessionMode}
          avgSecondsPerProblem={avgSecondsPerProblem}
          existingPlan={null}
          problemHistory={problemHistory}
          onClose={() => setShowStartPracticeModal(false)}
          onStarted={() => setShowStartPracticeModal(false)}
        />
      )}
    </PageWithNav>
  )
}

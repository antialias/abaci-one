'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { SessionSummary } from '@/components/practice'
import { useTheme } from '@/contexts/ThemeContext'
import type { Player } from '@/db/schema/players'
import type { SessionPlan } from '@/db/schema/session-plans'
import { css } from '../../../../../styled-system/css'

interface SummaryClientProps {
  studentId: string
  player: Player
  session: SessionPlan | null
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
export function SummaryClient({ studentId, player, session }: SummaryClientProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const isInProgress = session?.startedAt && !session?.completedAt

  // Handle practice again - navigate to configure page for new session
  const handlePracticeAgain = useCallback(() => {
    router.push(`/practice/${studentId}/configure`, { scroll: false })
  }, [studentId, router])

  // Handle back to dashboard
  const handleBackToDashboard = useCallback(() => {
    router.push(`/practice/${studentId}/dashboard`, { scroll: false })
  }, [studentId, router])

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
      <main
        data-component="practice-summary-page"
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
              {headerTitle}
            </h1>
            <p
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {headerSubtitle}
            </p>
          </header>

          {/* Session Summary or Empty State */}
          {session ? (
            <SessionSummary
              plan={session}
              studentName={player.name}
              onPracticeAgain={handlePracticeAgain}
              onBackToDashboard={handleBackToDashboard}
            />
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
    </PageWithNav>
  )
}

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
  session: SessionPlan
}

/**
 * Summary Client Component
 *
 * Displays the session results and provides navigation options.
 */
export function SummaryClient({ studentId, player, session }: SummaryClientProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Handle practice again - navigate to configure page for new session
  const handlePracticeAgain = useCallback(() => {
    router.push(`/practice/${studentId}/configure`, { scroll: false })
  }, [studentId, router])

  // Handle back to dashboard
  const handleBackToDashboard = useCallback(() => {
    router.push(`/practice/${studentId}/dashboard`, { scroll: false })
  }, [studentId, router])

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
              Session Complete
            </h1>
            <p
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Great work on your practice session!
            </p>
          </header>

          {/* Session Summary */}
          <SessionSummary
            plan={session}
            studentName={player.name}
            onPracticeAgain={handlePracticeAgain}
            onBackToDashboard={handleBackToDashboard}
          />
        </div>
      </main>
    </PageWithNav>
  )
}

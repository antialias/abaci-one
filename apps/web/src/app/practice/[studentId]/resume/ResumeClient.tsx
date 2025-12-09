'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { ContinueSessionCard } from '@/components/practice'
import { useTheme } from '@/contexts/ThemeContext'
import type { Player } from '@/db/schema/players'
import type { SessionPlan } from '@/db/schema/session-plans'
import { useAbandonSession } from '@/hooks/useSessionPlan'
import { css } from '../../../../../styled-system/css'

interface ResumeClientProps {
  studentId: string
  player: Player
  session: SessionPlan
}

/**
 * Client component for the Resume page
 *
 * Shows the "Welcome back" card for students returning to an in-progress session.
 */
export function ResumeClient({ studentId, player, session }: ResumeClientProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const abandonSession = useAbandonSession()

  // Handle continuing the session - navigate to main practice page
  const handleContinue = useCallback(() => {
    router.push(`/practice/${studentId}`, { scroll: false })
  }, [studentId, router])

  // Handle starting fresh - abandon current session and go to configure
  const handleStartFresh = useCallback(() => {
    abandonSession.mutate(
      { playerId: studentId, planId: session.id },
      {
        onSuccess: () => {
          router.push(`/practice/${studentId}/configure`, { scroll: false })
        },
      }
    )
  }, [studentId, session.id, abandonSession, router])

  return (
    <PageWithNav>
      <main
        data-component="resume-practice-page"
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
              Daily Practice
            </h1>
            <p
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Build your soroban skills one step at a time
            </p>
          </header>

          {/* Continue Session Card */}
          <ContinueSessionCard
            studentName={player.name}
            studentEmoji={player.emoji}
            studentColor={player.color}
            session={session}
            onContinue={handleContinue}
            onStartFresh={handleStartFresh}
          />
        </div>
      </main>
    </PageWithNav>
  )
}

'use client'

import Link from 'next/link'
import { css } from '../../../../styled-system/css'

interface SessionEndedClientProps {
  studentName: string
  studentEmoji: string
  sessionCompleted: boolean
}

export function SessionEndedClient({
  studentName,
  studentEmoji,
  sessionCompleted,
}: SessionEndedClientProps) {
  return (
    <div
      data-component="session-ended-page"
      className={css({
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bg: 'bg.canvas',
        p: 6,
        textAlign: 'center',
      })}
    >
      <div
        className={css({
          fontSize: '6xl',
          mb: 4,
        })}
      >
        {sessionCompleted ? '🎉' : '⏳'}
      </div>

      <h1
        className={css({
          fontSize: '2xl',
          fontWeight: 'bold',
          color: 'text.primary',
          mb: 2,
        })}
      >
        {sessionCompleted ? 'Practice Session Complete!' : 'Session Not Started'}
      </h1>

      <p
        className={css({
          fontSize: 'lg',
          color: 'text.secondary',
          mb: 6,
          maxWidth: '400px',
        })}
      >
        {sessionCompleted
          ? `${studentEmoji} ${studentName} has finished their practice session.`
          : `${studentEmoji} ${studentName}'s practice session hasn't started yet.`}
      </p>

      <p
        className={css({
          fontSize: 'sm',
          color: 'text.muted',
          mb: 6,
        })}
      >
        {sessionCompleted
          ? 'If you have an account with access to this student, you can sign in to view the session report.'
          : 'Check back once the session has started.'}
      </p>

      <Link
        href="/"
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          px: 6,
          py: 3,
          bg: 'brand.500',
          color: 'white',
          borderRadius: 'lg',
          fontWeight: 'semibold',
          transition: 'all 0.2s',
          _hover: {
            bg: 'brand.600',
          },
        })}
      >
        Go to Home
      </Link>
    </div>
  )
}

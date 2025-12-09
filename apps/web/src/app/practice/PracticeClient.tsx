'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { StudentSelector, type StudentWithProgress } from '@/components/practice'
import { useTheme } from '@/contexts/ThemeContext'
import type { Player } from '@/db/schema/players'
import { css } from '../../../styled-system/css'

interface PracticeClientProps {
  initialPlayers: Player[]
}

/**
 * Practice page client component
 *
 * Receives prefetched player data as props from the server component.
 * This avoids SSR hydration issues with React Query.
 */
export function PracticeClient({ initialPlayers }: PracticeClientProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Use initial data from server
  const players = initialPlayers

  // Convert players to StudentWithProgress format
  const students: StudentWithProgress[] = players.map((player) => ({
    id: player.id,
    name: player.name,
    emoji: player.emoji,
    color: player.color,
    createdAt: player.createdAt,
  }))

  // Handle student selection - navigate to student's practice page
  const handleSelectStudent = useCallback(
    (student: StudentWithProgress) => {
      router.push(`/practice/${student.id}`)
    },
    [router]
  )

  return (
    <PageWithNav>
      <main
        data-component="practice-page"
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

          {/* Student Selector */}
          <StudentSelector students={students} onSelectStudent={handleSelectStudent} />
        </div>
      </main>
    </PageWithNav>
  )
}

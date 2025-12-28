'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { SessionObserverView } from '@/components/classroom'
import { PageWithNav } from '@/components/PageWithNav'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { css } from '../../../../../styled-system/css'

interface ObservationClientProps {
  session: ActiveSessionInfo
  observerId: string
  student: {
    name: string
    emoji: string
    color: string
  }
  studentId: string
}

export function ObservationClient({ session, observerId, student, studentId }: ObservationClientProps) {
  const router = useRouter()

  const handleExit = useCallback(() => {
    router.push(`/practice/${studentId}/dashboard`, { scroll: false })
  }, [router, studentId])

  return (
    <PageWithNav navTitle={`Observing ${student.name}`} navEmoji={student.emoji}>
      <main
        data-component="practice-observation-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: 'gray.50',
          _dark: { backgroundColor: 'gray.900' },
          display: 'flex',
          justifyContent: 'center',
          padding: { base: '16px', md: '24px' },
        })}
      >
        <div
          className={css({
            width: '100%',
            maxWidth: '960px',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
            border: '1px solid',
            borderColor: { base: 'rgba(0,0,0,0.05)', _dark: 'rgba(255,255,255,0.08)' },
          })}
        >
          <SessionObserverView
            session={session}
            student={student}
            observerId={observerId}
            onClose={handleExit}
            variant="page"
          />
        </div>
      </main>
    </PageWithNav>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  type ObservedSessionRef,
  SessionObserverView,
} from '@/components/classroom/SessionObserverModal'
import { SubscribeButton } from '@/components/notifications/SubscribeButton'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../../styled-system/css'

interface ObservationClientProps {
  /** The observed session; what it shows comes from its report */
  session: ObservedSessionRef
  observerId: string
  student: {
    name: string
    emoji: string
    color: string
  }
  studentId: string
  /** Whether the observer is a parent of the student (can share session) */
  isParent?: boolean
  /** URL to the session report (shown in the ended view) */
  sessionReportUrl?: string
}

export function ObservationClient({
  session,
  observerId,
  student,
  studentId,
  isParent = false,
  sessionReportUrl,
}: ObservationClientProps) {
  const router = useRouter()
  const [navHeight, setNavHeight] = useState(80) // Default fallback

  useEffect(() => {
    // Measure the actual nav height from the fixed header
    const measureNavHeight = () => {
      const header = document.querySelector('header')
      if (header) {
        const rect = header.getBoundingClientRect()
        // Nav top position + nav height + small margin
        const calculatedHeight = rect.top + rect.height + 16
        setNavHeight(calculatedHeight)
      }
    }

    // Measure on mount and when window resizes
    measureNavHeight()
    window.addEventListener('resize', measureNavHeight)

    // Also measure after a short delay to catch any late-rendering nav elements
    const timer = setTimeout(measureNavHeight, 100)

    return () => {
      window.removeEventListener('resize', measureNavHeight)
      clearTimeout(timer)
    }
  }, [])

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
          flexDirection: 'column',
          boxSizing: 'border-box',
        })}
        style={{
          paddingTop: `${navHeight}px`,
        }}
      >
        {/* Notification subscribe banner */}
        <div
          data-element="subscribe-banner"
          className={css({
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid',
            borderColor: 'gray.200',
            _dark: { borderColor: 'gray.700' },
          })}
        >
          <SubscribeButton
            playerId={studentId}
            playerName={student.name}
            userId={observerId}
            variant="subtle"
          />
        </div>
        <div
          className={css({
            flex: 1,
            width: '100%',
            overflow: 'hidden',
          })}
        >
          <SessionObserverView
            session={session}
            student={student}
            observerId={observerId}
            canShare={isParent}
            sessionReportUrl={sessionReportUrl}
            onClose={handleExit}
            variant="page"
          />
        </div>
      </main>
    </PageWithNav>
  )
}

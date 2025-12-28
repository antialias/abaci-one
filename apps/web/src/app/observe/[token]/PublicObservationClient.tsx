'use client'

import { useEffect, useState } from 'react'
import { SessionObserverView } from '@/components/classroom'
import type { ActiveSessionInfo } from '@/hooks/useClassroom'
import { css } from '../../../../styled-system/css'

interface PublicObservationClientProps {
  session: ActiveSessionInfo
  shareToken: string
  student: {
    name: string
    emoji: string
    color: string
  }
  expiresAt: number
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expired'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`
  }
  return `${minutes}m remaining`
}

export function PublicObservationClient({
  session,
  shareToken,
  student,
  expiresAt,
}: PublicObservationClientProps) {
  const [navHeight, setNavHeight] = useState(20) // Minimal padding for public page (no nav)
  const [timeRemaining, setTimeRemaining] = useState(expiresAt - Date.now())

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(expiresAt - Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [expiresAt])

  // Simple page without full nav (public access)
  return (
    <div
      data-component="public-observation-page"
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
      {/* Expiration banner */}
      <div
        data-element="expiration-banner"
        className={css({
          backgroundColor: timeRemaining > 0 ? 'blue.50' : 'red.50',
          _dark: { backgroundColor: timeRemaining > 0 ? 'blue.900' : 'red.900' },
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '0.875rem',
          color: timeRemaining > 0 ? 'blue.700' : 'red.700',
          _dark: { color: timeRemaining > 0 ? 'blue.200' : 'red.200' },
          borderBottom: '1px solid',
          borderColor: timeRemaining > 0 ? 'blue.200' : 'red.200',
          _dark: { borderColor: timeRemaining > 0 ? 'blue.800' : 'red.800' },
        })}
      >
        <span>👁️ View-only access</span>
        <span>•</span>
        <span>{formatTimeRemaining(timeRemaining)}</span>
      </div>

      {/* Main content */}
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
          observerId="" // Not used for token-based observation
          shareToken={shareToken}
          variant="page"
          isViewOnly
        />
      </div>
    </div>
  )
}

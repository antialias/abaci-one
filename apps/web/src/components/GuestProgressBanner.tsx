'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useTier } from '@/hooks/useTier'
import { css } from '../../styled-system/css'

const STORAGE_KEY = 'guest-session-count'
const DISMISSED_KEY = 'guest-banner-dismissed'
const LAST_VISIT_KEY = 'guest-last-visit'

interface GuestMessageOptions {
  /** Current session accuracy (0-1) */
  sessionAccuracy?: number | null
  /** Previous session accuracy (0-1) */
  previousAccuracy?: number | null
}

/**
 * Determine which guest progress message to show.
 *
 * Returns null if the user is not a guest, the banner was dismissed,
 * or there's no compelling reason to show it yet.
 *
 * Priority order: returning after 24h+ > accuracy gain > 3+ sessions.
 */
function useGuestMessage(options: GuestMessageOptions = {}): {
  message: string
  cta: string
} | null {
  const { sessionAccuracy, previousAccuracy } = options
  const { tier } = useTier()
  const [result, setResult] = useState<{ message: string; cta: string } | null>(null)

  useEffect(() => {
    if (tier !== 'guest') {
      setResult(null)
      return
    }

    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY)
      if (dismissed) {
        setResult(null)
        return
      }

      const count = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10)
      const lastVisit = localStorage.getItem(LAST_VISIT_KEY)
      const now = Date.now()

      // Update last visit
      localStorage.setItem(LAST_VISIT_KEY, now.toString())

      // Returning after 24h+ with sessions
      if (lastVisit && count > 0) {
        const hoursSince = (now - parseInt(lastVisit, 10)) / (1000 * 60 * 60)
        if (hoursSince >= 24) {
          setResult({
            message: `Welcome back! You have ${count} session${count === 1 ? '' : 's'} of progress stored locally.`,
            cta: 'Create a free account to keep it safe',
          })
          return
        }
      }

      // Accuracy improvement >= 5 percentage points
      if (
        sessionAccuracy != null &&
        previousAccuracy != null &&
        sessionAccuracy - previousAccuracy >= 0.05
      ) {
        const prevPct = Math.round(previousAccuracy * 100)
        const curPct = Math.round(sessionAccuracy * 100)
        setResult({
          message: `Great session! Your accuracy jumped from ${prevPct}% to ${curPct}%.`,
          cta: 'Create a free account to track your progress',
        })
        return
      }

      // After 3+ sessions
      if (count >= 3) {
        setResult({
          message: `You've completed ${count} sessions! Your progress is stored locally.`,
          cta: 'Create a free account to keep your progress',
        })
        return
      }

      setResult(null)
    } catch {
      setResult(null)
    }
  }, [tier, sessionAccuracy, previousAccuracy])

  return result
}

/** Increment the guest session counter (call after session completion). */
export function recordGuestSession(): void {
  try {
    const current = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10)
    localStorage.setItem(STORAGE_KEY, (current + 1).toString())
  } catch {
    // localStorage unavailable
  }
}

interface GuestProgressBannerProps {
  /**
   * When true, hides the dismiss button and uses subtler styling.
   * Used on the dashboard where the banner should always be visible.
   */
  persistent?: boolean
  /** Current session accuracy (0-1) */
  sessionAccuracy?: number | null
  /** Previous session accuracy (0-1) */
  previousAccuracy?: number | null
}

/**
 * Subtle banner prompting guests to create an account.
 * Shows after 3 sessions, after returning from 24h+ absence, or after accuracy improvement.
 * Dismissible (unless `persistent` is set) — won't show again once closed.
 */
export function GuestProgressBanner({
  persistent = false,
  sessionAccuracy,
  previousAccuracy,
}: GuestProgressBannerProps = {}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const message = useGuestMessage({ sessionAccuracy, previousAccuracy })
  const [visible, setVisible] = useState(true)

  const handleDismiss = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // ignore
    }
  }, [])

  if (!message || !visible) return null

  return (
    <div
      data-component="guest-progress-banner"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.625rem 1rem',
        backgroundColor: persistent
          ? isDark
            ? 'blue.900/20'
            : 'blue.50/70'
          : isDark
            ? 'blue.900/40'
            : 'blue.50',
        borderBottom: persistent ? 'none' : '1px solid',
        borderColor: isDark ? 'blue.800' : 'blue.100',
        fontSize: '0.8125rem',
        ...(persistent && {
          borderRadius: '8px',
          border: '1px solid',
          borderColor: isDark ? 'blue.800/50' : 'blue.100',
          margin: '0.75rem',
        }),
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flex: 1,
          flexWrap: 'wrap',
        })}
      >
        <span className={css({ color: isDark ? 'blue.300' : 'blue.700' })}>{message.message}</span>
        <Link
          href="/auth/signin"
          data-action="guest-save-progress"
          className={css({
            fontWeight: '600',
            color: isDark ? 'blue.200' : 'blue.600',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
            whiteSpace: 'nowrap',
            _hover: { color: isDark ? 'blue.100' : 'blue.700' },
          })}
        >
          {message.cta}
        </Link>
      </div>
      {!persistent && (
        <button
          type="button"
          onClick={handleDismiss}
          data-action="dismiss-guest-banner"
          className={css({
            background: 'none',
            border: 'none',
            color: isDark ? 'gray.500' : 'gray.400',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1,
            padding: '0.25rem',
            flexShrink: 0,
            _hover: { color: isDark ? 'gray.300' : 'gray.600' },
          })}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  )
}

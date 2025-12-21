'use client'

/**
 * Virtualized session history list with infinite scroll
 *
 * Uses @tanstack/react-virtual for virtualization to efficiently render
 * large numbers of sessions. Automatically loads more sessions as the
 * user scrolls near the bottom.
 */

import { useVirtualizer } from '@tanstack/react-virtual'
import Link from 'next/link'
import { useCallback, useEffect, useRef } from 'react'
import type { PracticeSession } from '@/db/schema/practice-sessions'
import { useSessionHistory } from '@/hooks/useSessionHistory'
import { css } from '../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

interface VirtualizedSessionListProps {
  studentId: string
  isDark: boolean
  /** Height of the scrollable container */
  height?: number | string
}

// ============================================================================
// Session Item Component
// ============================================================================

function SessionItem({
  session,
  studentId,
  isDark,
}: {
  session: PracticeSession
  studentId: string
  isDark: boolean
}) {
  const accuracy =
    session.problemsAttempted > 0 ? session.problemsCorrect / session.problemsAttempted : 0
  const isHighAccuracy = accuracy >= 0.8

  return (
    <Link
      href={`/practice/${studentId}/session/${session.id}`}
      data-element="session-history-item"
      data-session-id={session.id}
      className={css({
        display: 'block',
        padding: '1rem',
        borderRadius: '8px',
        backgroundColor: isDark ? 'gray.700' : 'white',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.200',
        textDecoration: 'none',
        transition: 'all 0.15s ease',
        _hover: {
          backgroundColor: isDark ? 'gray.650' : 'gray.50',
          borderColor: isDark ? 'gray.500' : 'gray.300',
          transform: 'translateY(-1px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        })}
      >
        <span
          className={css({
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
          })}
        >
          {new Date(session.completedAt || session.startedAt).toLocaleDateString()}
        </span>
        <span
          className={css({
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 'medium',
            backgroundColor: isHighAccuracy
              ? isDark
                ? 'green.900'
                : 'green.100'
              : isDark
                ? 'yellow.900'
                : 'yellow.100',
            color: isHighAccuracy
              ? isDark
                ? 'green.300'
                : 'green.700'
              : isDark
                ? 'yellow.300'
                : 'yellow.700',
          })}
        >
          {session.problemsCorrect}/{session.problemsAttempted} correct
        </span>
      </div>
      <div
        className={css({
          fontSize: '0.75rem',
          color: isDark ? 'gray.400' : 'gray.600',
          display: 'flex',
          gap: '1rem',
        })}
      >
        <span>{Math.round((session.totalTimeMs || 0) / 60000)} min</span>
        <span>{Math.round(accuracy * 100)}% accuracy</span>
      </div>
    </Link>
  )
}

// ============================================================================
// Loading Indicator
// ============================================================================

function LoadingIndicator({ isDark }: { isDark: boolean }) {
  return (
    <div
      data-element="loading-more"
      className={css({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        color: isDark ? 'gray.400' : 'gray.500',
        fontSize: '0.875rem',
      })}
    >
      <span
        className={css({
          display: 'inline-block',
          width: '1rem',
          height: '1rem',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginRight: '0.5rem',
        })}
      />
      Loading more sessions...
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function VirtualizedSessionList({
  studentId,
  isDark,
  height = 500,
}: VirtualizedSessionListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const {
    sessions,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isError,
    totalLoaded,
  } = useSessionHistory(studentId, { pageSize: 20 })

  // Debug logging
  console.log(
    `[VirtualizedSessionList] studentId=${studentId}, totalLoaded=${totalLoaded}, hasNextPage=${hasNextPage}, isLoading=${isLoading}, isFetchingNextPage=${isFetchingNextPage}`
  )

  // Virtualizer configuration
  const rowVirtualizer = useVirtualizer({
    count: sessions.length + (hasNextPage ? 1 : 0), // +1 for loading indicator
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90, // Estimated height of each session item
    overscan: 5, // Render 5 extra items above/below viewport
  })

  // Load more when scrolling near the bottom
  const handleScroll = useCallback(() => {
    if (!parentRef.current || isFetchingNextPage || !hasNextPage) return

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const scrollRemaining = scrollHeight - scrollTop - clientHeight

    // Trigger load when within 200px of bottom
    if (scrollRemaining < 200) {
      console.log(
        `[VirtualizedSessionList] Near bottom, fetching next page. scrollRemaining=${scrollRemaining}`
      )
      fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  // Attach scroll listener
  useEffect(() => {
    const element = parentRef.current
    if (!element) return

    element.addEventListener('scroll', handleScroll)
    return () => element.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Initial loading state
  if (isLoading) {
    return (
      <div
        className={css({
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: typeof height === 'number' ? `${height}px` : height,
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        <LoadingIndicator isDark={isDark} />
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div
        className={css({
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: typeof height === 'number' ? `${height}px` : height,
          color: isDark ? 'red.400' : 'red.600',
        })}
      >
        Failed to load session history
      </div>
    )
  }

  // Empty state
  if (sessions.length === 0) {
    return (
      <p
        className={css({
          color: isDark ? 'gray.500' : 'gray.500',
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '2rem',
        })}
      >
        No sessions recorded yet. Start practicing!
      </p>
    )
  }

  return (
    <div
      ref={parentRef}
      data-element="virtualized-session-list"
      className={css({
        height: typeof height === 'number' ? `${height}px` : height,
        overflow: 'auto',
        contain: 'strict',
      })}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const isLoadingRow = virtualItem.index === sessions.length

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className={css({ paddingBottom: '0.75rem' })}>
                {isLoadingRow ? (
                  <LoadingIndicator isDark={isDark} />
                ) : (
                  <SessionItem
                    session={sessions[virtualItem.index]}
                    studentId={studentId}
                    isDark={isDark}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

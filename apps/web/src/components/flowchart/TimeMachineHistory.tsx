'use client'

import { useRef, useEffect } from 'react'
import type { WorkingProblemHistoryEntry } from '@/lib/flowcharts/schema'
import { css, cx } from '../../../styled-system/css'
import { vstack } from '../../../styled-system/patterns'
import { MathDisplay } from './MathDisplay'

interface TimeMachineHistoryProps {
  /** History of working problem transformations */
  history: WorkingProblemHistoryEntry[]
  /** Callback when user clicks a history entry to rewind */
  onNavigate: (index: number) => void
  /** Font size for the current (hero) problem */
  fontSize?: 'lg' | 'xl'
}

/**
 * TimeMachineHistory - Apple Time Machine-style 3D perspective stack
 *
 * Displays the problem evolution as a stack of cards with the current
 * problem in front (hero) and past states fading into the background.
 *
 * - Current problem is prominent (full opacity, full scale)
 * - Previous problems are stacked behind with perspective depth
 * - Each layer: translateZ, scale down, fade opacity
 * - Clicking past layers triggers onNavigate to rewind
 */
export function TimeMachineHistory({
  history,
  onNavigate,
  fontSize = 'xl',
}: TimeMachineHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const latestEntryRef = useRef<HTMLDivElement>(null)

  // Scroll to show latest entry when history changes
  useEffect(() => {
    if (latestEntryRef.current) {
      latestEntryRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [history.length])

  if (history.length === 0) {
    return null
  }

  // How many history items to show (limit to prevent overwhelming)
  const maxVisible = 5
  const visibleHistory = history.slice(-maxVisible)
  const hiddenCount = history.length - visibleHistory.length

  return (
    <div
      ref={containerRef}
      data-testid="time-machine-history"
      data-entry-count={history.length}
      data-visible-count={visibleHistory.length}
      className={css({
        position: 'relative',
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto',
        perspective: '800px',
        perspectiveOrigin: 'center bottom',
        padding: '4',
      })}
    >
      {/* Stack container */}
      <div
        data-element="stack-container"
        className={vstack({
          gap: '3',
          alignItems: 'center',
          position: 'relative',
        })}
      >
        {/* Hidden count indicator */}
        {hiddenCount > 0 && (
          <div
            data-element="hidden-indicator"
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.400', _dark: 'gray.500' },
              textAlign: 'center',
              paddingY: '1', paddingX: '2',
            })}
          >
            {hiddenCount} earlier step{hiddenCount > 1 ? 's' : ''} hidden
          </div>
        )}

        {/* History entries */}
        {visibleHistory.map((entry, visibleIdx) => {
          // Calculate actual index in full history
          const actualIdx = history.length - visibleHistory.length + visibleIdx
          const isLatest = actualIdx === history.length - 1
          // Depth from current: 0 for latest, 1 for previous, etc.
          const depth = visibleHistory.length - 1 - visibleIdx

          // 3D transform values based on depth
          const translateZ = -depth * 20 // Push back
          const scale = 1 - depth * 0.05 // Shrink slightly
          const opacity = 1 - depth * 0.15 // Fade

          return (
            <div
              key={`${actualIdx}-${entry.nodeId}`}
              ref={isLatest ? latestEntryRef : undefined}
              data-testid={`time-machine-entry-${actualIdx}`}
              data-entry-index={actualIdx}
              data-is-latest={isLatest}
              data-is-clickable={!isLatest}
              data-depth={depth}
              onClick={!isLatest ? () => onNavigate(actualIdx) : undefined}
              role={!isLatest ? 'button' : undefined}
              tabIndex={!isLatest ? 0 : undefined}
              onKeyDown={
                !isLatest
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onNavigate(actualIdx)
                      }
                    }
                  : undefined
              }
              className={cx(
                css({
                  width: '100%',
                  padding: isLatest ? '4 5' : '3 4',
                  borderRadius: 'xl',
                  textAlign: 'center',
                  transformStyle: 'preserve-3d',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'transform, opacity',

                  // Base styling
                  backgroundColor: isLatest
                    ? { base: 'blue.50', _dark: 'blue.900' }
                    : { base: 'gray.50', _dark: 'gray.800' },
                  border: isLatest ? '3px solid' : '2px solid',
                  borderColor: isLatest
                    ? { base: 'blue.400', _dark: 'blue.500' }
                    : { base: 'gray.200', _dark: 'gray.700' },
                  boxShadow: isLatest ? 'lg' : 'sm',

                  // Interactive states for non-latest entries
                  cursor: isLatest ? 'default' : 'pointer',
                  _hover: isLatest
                    ? {}
                    : {
                        opacity: '1 !important',
                        backgroundColor: { base: 'blue.50', _dark: 'blue.900/50' },
                        borderColor: { base: 'blue.300', _dark: 'blue.600' },
                        transform: 'translateZ(0) scale(1) !important',
                      },
                  _focusVisible: isLatest
                    ? {}
                    : {
                        outline: '2px solid',
                        outlineColor: { base: 'blue.500', _dark: 'blue.400' },
                        outlineOffset: '2px',
                      },
                }),
                // Animation class for new entries
                isLatest &&
                  css({
                    animation: 'timeMachineEnter 0.5s ease-out',
                  })
              )}
              style={{
                transform: `translateZ(${translateZ}px) scale(${scale})`,
                opacity,
                zIndex: visibleHistory.length - depth,
              }}
            >
              {/* Math expression */}
              <div
                data-element="problem-expression"
                className={css({
                  color: isLatest
                    ? { base: 'blue.900', _dark: 'blue.100' }
                    : { base: 'gray.700', _dark: 'gray.300' },
                })}
              >
                <MathDisplay
                  expression={entry.value}
                  size={isLatest ? fontSize : depth === 1 ? 'lg' : 'md'}
                />
              </div>

              {/* Step label - shown for all entries */}
              <div
                data-element="step-label"
                className={css({
                  fontSize: isLatest ? 'sm' : 'xs',
                  fontWeight: 'medium',
                  marginTop: '2',
                  color: isLatest
                    ? { base: 'blue.600', _dark: 'blue.400' }
                    : { base: 'gray.500', _dark: 'gray.500' },
                })}
              >
                {entry.label}
              </div>

              {/* Step number badge */}
              <div
                data-element="step-number"
                className={css({
                  position: 'absolute',
                  top: '-2',
                  left: '-2',
                  width: '6',
                  height: '6',
                  borderRadius: 'full',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'xs',
                  fontWeight: 'bold',
                  backgroundColor: isLatest
                    ? { base: 'blue.500', _dark: 'blue.500' }
                    : { base: 'gray.400', _dark: 'gray.600' },
                  color: 'white',
                  border: '2px solid',
                  borderColor: { base: 'white', _dark: 'gray.900' },
                })}
              >
                {actualIdx + 1}
              </div>

              {/* "Current" indicator for latest */}
              {isLatest && (
                <div
                  data-element="current-indicator"
                  className={css({
                    position: 'absolute',
                    top: '-2',
                    right: '-2',
                    padding: '0.5 2',
                    borderRadius: 'full',
                    fontSize: '2xs',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: 'wide',
                    backgroundColor: { base: 'blue.500', _dark: 'blue.500' },
                    color: 'white',
                    border: '2px solid',
                    borderColor: { base: 'white', _dark: 'gray.900' },
                  })}
                >
                  Now
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

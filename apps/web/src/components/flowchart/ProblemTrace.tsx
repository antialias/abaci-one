'use client'

import { useState } from 'react'
import type { StateSnapshot, TransformExpression, ProblemValue } from '@/lib/flowcharts/schema'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

interface ProblemTraceProps {
  /** Snapshots from simulateWalk - each represents state after visiting a node */
  snapshots: StateSnapshot[]
  /** Callback when hovering over a trace step (for mermaid highlighting) */
  onHoverStep?: (nodeId: string | null) => void
  /** Whether to show expanded state details by default */
  defaultExpanded?: boolean
}

/**
 * Check if a snapshot has content worth expanding
 */
function hasExpandableContent(
  snapshot: StateSnapshot,
  prevSnapshot: StateSnapshot | null
): boolean {
  // Has transforms
  if (snapshot.transforms.length > 0) return true

  // Is first snapshot with working problem
  if (snapshot.workingProblem && !prevSnapshot) return true

  // Has working problem that changed from previous
  if (
    snapshot.workingProblem &&
    prevSnapshot?.workingProblem &&
    snapshot.workingProblem !== prevSnapshot.workingProblem
  ) {
    return true
  }

  return false
}

/**
 * ProblemTrace - Visualizes the step-by-step computation trace of a problem.
 *
 * Shows:
 * - Each node visited during the walk
 * - Transforms applied at each node (key: expr → result)
 * - Working problem evolution
 * - Hover interaction for mermaid diagram highlighting
 */
export function ProblemTrace({ snapshots, onHoverStep, defaultExpanded = false }: ProblemTraceProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(
    defaultExpanded ? new Set(snapshots.map((_, i) => i)) : new Set()
  )

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  if (snapshots.length === 0) {
    return (
      <div
        data-element="empty-trace"
        className={css({
          padding: '4',
          color: { base: 'gray.500', _dark: 'gray.400' },
          fontSize: 'sm',
          textAlign: 'center',
        })}
      >
        No trace available
      </div>
    )
  }

  return (
    <div
      data-component="problem-trace"
      className={vstack({
        gap: '0',
        alignItems: 'stretch',
        width: '100%',
      })}
    >
      {snapshots.map((snapshot, index) => {
        const isExpanded = expandedSteps.has(index)
        const isInitial = snapshot.nodeId === 'initial'
        const isLast = index === snapshots.length - 1
        const prevSnapshot = index > 0 ? snapshots[index - 1] : null
        const isExpandable = hasExpandableContent(snapshot, prevSnapshot)

        return (
          <div
            key={`${snapshot.nodeId}-${snapshot.timestamp}`}
            data-element="trace-step"
            data-node-id={snapshot.nodeId}
            className={css({
              position: 'relative',
              paddingLeft: '5',
              paddingBottom: isLast ? '0' : '1',
            })}
            onMouseEnter={() => !isInitial && onHoverStep?.(snapshot.nodeId)}
            onMouseLeave={() => onHoverStep?.(null)}
          >
            {/* Vertical line connecting steps */}
            {!isLast && (
              <div
                className={css({
                  position: 'absolute',
                  left: '7px',
                  top: '14px',
                  bottom: '0',
                  width: '2px',
                  backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                })}
              />
            )}

            {/* Step dot */}
            <div
              className={css({
                position: 'absolute',
                left: '2px',
                top: '6px',
                width: '12px',
                height: '12px',
                borderRadius: 'full',
                backgroundColor: isInitial
                  ? { base: 'blue.500', _dark: 'blue.400' }
                  : isLast
                    ? { base: 'green.500', _dark: 'green.400' }
                    : { base: 'gray.300', _dark: 'gray.600' },
                border: '2px solid',
                borderColor: { base: 'white', _dark: 'gray.900' },
              })}
            />

            {/* Step content */}
            <div
              className={css({
                borderRadius: 'md',
                overflow: 'hidden',
                cursor: isExpandable ? 'pointer' : 'default',
                transition: 'all 0.15s',
                _hover: isExpandable
                  ? {
                      backgroundColor: { base: 'gray.50', _dark: 'gray.800/50' },
                    }
                  : {},
              })}
              onClick={() => isExpandable && toggleStep(index)}
            >
              {/* Step header - compact single line */}
              <div
                className={hstack({
                  gap: '2',
                  paddingY: '1',
                  paddingX: '2',
                })}
              >
                {/* Expand/collapse indicator - only show if expandable */}
                {isExpandable ? (
                  <span
                    className={css({
                      fontSize: '10px',
                      color: { base: 'gray.400', _dark: 'gray.500' },
                      transition: 'transform 0.15s',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      width: '10px',
                      flexShrink: 0,
                    })}
                  >
                    ▶
                  </span>
                ) : (
                  <span className={css({ width: '10px', flexShrink: 0 })} />
                )}

                {/* Node title */}
                <span
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'medium',
                    color: { base: 'gray.600', _dark: 'gray.300' },
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  })}
                >
                  {snapshot.nodeTitle || snapshot.nodeId}
                </span>

                {/* Transform count badge */}
                {snapshot.transforms.length > 0 && (
                  <span
                    className={css({
                      fontSize: '10px',
                      paddingX: '1.5',
                      paddingY: '0.5',
                      borderRadius: 'sm',
                      backgroundColor: { base: 'blue.100', _dark: 'blue.900/50' },
                      color: { base: 'blue.600', _dark: 'blue.300' },
                      fontWeight: 'medium',
                    })}
                  >
                    {snapshot.transforms.length}
                  </span>
                )}
              </div>

              {/* Expanded content */}
              {isExpanded && isExpandable && (
                <div
                  className={vstack({
                    gap: '2',
                    paddingX: '2',
                    paddingBottom: '2',
                    paddingTop: '1',
                    alignItems: 'stretch',
                  })}
                >
                  {/* Working problem evolution - only show if it changed from previous */}
                  {snapshot.workingProblem &&
                    prevSnapshot?.workingProblem &&
                    snapshot.workingProblem !== prevSnapshot.workingProblem && (
                      <div
                        data-element="working-problem-change"
                        className={css({
                          padding: '2',
                          backgroundColor: { base: 'amber.50', _dark: 'amber.900/20' },
                          borderRadius: 'md',
                          fontSize: 'xs',
                          border: '1px solid',
                          borderColor: { base: 'amber.200', _dark: 'amber.800/30' },
                        })}
                      >
                        <div className={hstack({ gap: '2', alignItems: 'center', flexWrap: 'wrap' })}>
                          <span
                            className={css({
                              color: { base: 'gray.500', _dark: 'gray.400' },
                              fontFamily: 'mono',
                            })}
                          >
                            {prevSnapshot.workingProblem}
                          </span>
                          <span className={css({ color: { base: 'amber.500', _dark: 'amber.400' } })}>→</span>
                          <span
                            className={css({
                              fontWeight: 'semibold',
                              color: { base: 'gray.800', _dark: 'gray.100' },
                              fontFamily: 'mono',
                            })}
                          >
                            {snapshot.workingProblem}
                          </span>
                        </div>
                      </div>
                    )}

                  {/* First snapshot - just show initial working problem */}
                  {snapshot.workingProblem && !prevSnapshot && (
                    <div
                      data-element="initial-working-problem"
                      className={css({
                        padding: '2',
                        backgroundColor: { base: 'blue.50', _dark: 'blue.900/20' },
                        borderRadius: 'md',
                        fontSize: 'xs',
                        border: '1px solid',
                        borderColor: { base: 'blue.200', _dark: 'blue.800/30' },
                      })}
                    >
                      <span className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>Problem: </span>
                      <span
                        className={css({
                          fontWeight: 'semibold',
                          color: { base: 'gray.800', _dark: 'gray.100' },
                          fontFamily: 'mono',
                        })}
                      >
                        {snapshot.workingProblem}
                      </span>
                    </div>
                  )}

                  {/* Transforms */}
                  {snapshot.transforms.length > 0 && (
                    <div data-element="transforms" className={vstack({ gap: '1', alignItems: 'stretch' })}>
                      {snapshot.transforms.map((transform, tIndex) => (
                        <TransformDisplay
                          key={`${transform.key}-${tIndex}`}
                          transform={transform}
                          result={snapshot.values[transform.key]}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =============================================================================
// Helper Components
// =============================================================================

interface TransformDisplayProps {
  transform: TransformExpression
  result: ProblemValue
}

/**
 * Displays a single transform: key = expr → result
 */
function TransformDisplay({ transform, result }: TransformDisplayProps) {
  return (
    <div
      data-element="transform"
      className={css({
        fontFamily: 'mono',
        fontSize: '11px',
        padding: '1.5 2',
        backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
        borderRadius: 'sm',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1',
        alignItems: 'center',
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
      })}
    >
      {/* Key name */}
      <span className={css({ color: { base: 'purple.600', _dark: 'purple.400' }, fontWeight: 'semibold' })}>
        {transform.key}
      </span>

      <span className={css({ color: { base: 'gray.400', _dark: 'gray.500' } })}>=</span>

      {/* Expression (truncated if long) */}
      <span
        className={css({
          color: { base: 'gray.500', _dark: 'gray.400' },
          maxWidth: '150px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        })}
        title={transform.expr}
      >
        {transform.expr}
      </span>

      <span className={css({ color: { base: 'gray.400', _dark: 'gray.500' } })}>→</span>

      {/* Result */}
      <span className={css({ color: { base: 'green.600', _dark: 'green.400' }, fontWeight: 'semibold' })}>
        {formatResult(result)}
      </span>
    </div>
  )
}

/**
 * Format a ProblemValue for display
 */
function formatResult(value: ProblemValue): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object' && 'denom' in value) {
    // Mixed number
    const { whole, num, denom } = value
    if (whole === 0) return `${num}/${denom}`
    if (num === 0) return String(whole)
    return `${whole} ${num}/${denom}`
  }
  return String(value)
}

/**
 * All Problems Section Component
 *
 * A collapsible section showing all session problems.
 * Compact view with problem numbers - tap any problem to see details in a popover.
 *
 * Counts and verdicts come from the session report (Phase 5c): the header's
 * and each part's count are the report's planned problems, and a cell's mark
 * is its item's status by the report's rules (`arithmeticItemCells`), so the
 * cells add up to the report's totals. The cells themselves (one per slot,
 * with its problem and purpose) are the arithmetic kind's.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProblemSlot, SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import {
  type ArithmeticItemCell,
  type ArithmeticItemStatus,
  arithmeticItemCells,
  triesBeforeItem,
} from '@/lib/curriculum/parts/arithmetic/result-view'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { css } from '../../../styled-system/css'
import { calculateAutoPauseInfo, formatMs } from './autoPauseCalculator'
import { CompactLinearProblem, CompactVerticalProblem } from './CompactProblemDisplay'
import { getPartTypeLabel, isVerticalPart } from './sessionSummaryUtils'

export interface AllProblemsSectionProps {
  /** The session plan: the problems themselves */
  plan: SessionPlan
  /**
   * The session report: every count and verdict shown. Absent for a plan not
   * started (plan review): the problems show without verdicts.
   */
  report?: SessionReport | null
  /** Dark mode */
  isDark: boolean
}

/** Info needed to show the detail popover */
interface SelectedProblemInfo {
  slot: ProblemSlot
  part: SessionPart
  result?: SlotResult
  problemNumber: number
  /** How the report counts the problem (green / red only for a counted verdict) */
  status: ArithmeticItemStatus
  /** The stored tries recorded before the problem was first answered (its auto-pause history) */
  priorResults: SlotResult[]
  /** Position of the triggering element for popover positioning */
  triggerRect?: DOMRect
}

/** A cell's mark: right / wrong by the item's final verdict; excluded; not answered. */
const STATUS_MARK: Record<ArithmeticItemStatus, string> = {
  correct: '✓',
  incorrect: '❌',
  'not-counted': '⊘',
  'practice-only': '↻',
  unanswered: '○',
}

/** What a mark that counts nowhere means. */
const STATUS_TITLE: Partial<Record<ArithmeticItemStatus, string>> = {
  'not-counted': 'Excluded by an adult: does not count',
  'practice-only': 'Only practice tries: does not count',
}

/** Whether the report counts the item's verdict (green / red only then). */
function isCounted(status: ArithmeticItemStatus): boolean {
  return status === 'correct' || status === 'incorrect'
}

/**
 * Compact problem item - problem number + problem + answer + status
 * Clickable to show detailed popover
 */
function CompactProblemItem({
  cell,
  isDark,
  onClick,
}: {
  cell: ArithmeticItemCell
  isDark: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const { slot, part, number: problemNumber, status } = cell
  const result = cell.shown ?? undefined
  // Green / red only for a verdict the report counts
  const verdict = isCounted(status) ? result : undefined
  const problem = result?.problem ?? slot.problem
  if (!problem) return null

  return (
    <button
      type="button"
      data-element="compact-problem-item"
      data-problem-number={problemNumber}
      data-status={status}
      title={STATUS_TITLE[status]}
      onClick={onClick}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.5rem',
        backgroundColor: verdict
          ? verdict.isCorrect
            ? isDark
              ? 'green.900/40'
              : 'green.50'
            : isDark
              ? 'red.900/40'
              : 'red.50'
          : isDark
            ? 'gray.700'
            : 'white',
        borderRadius: '6px',
        border: '1px solid',
        borderColor: verdict
          ? verdict.isCorrect
            ? isDark
              ? 'green.700'
              : 'green.200'
            : isDark
              ? 'red.700'
              : 'red.200'
          : isDark
            ? 'gray.600'
            : 'gray.200',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        _hover: {
          borderColor: isDark ? 'blue.500' : 'blue.400',
          boxShadow: 'sm',
        },
        _active: {
          transform: 'scale(0.98)',
        },
      })}
    >
      {/* Problem number */}
      <span
        className={css({
          fontSize: '0.6875rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.500' : 'gray.400',
          minWidth: '1.25rem',
        })}
      >
        #{problemNumber}
      </span>

      {/* Status indicator */}
      <span
        className={css({
          fontSize: '0.875rem',
          fontWeight: 'bold',
          color: verdict
            ? verdict.isCorrect
              ? isDark
                ? 'green.400'
                : 'green.600'
              : isDark
                ? 'red.400'
                : 'red.600'
            : isDark
              ? 'gray.500'
              : 'gray.400',
        })}
      >
        {STATUS_MARK[status]}
      </span>

      {/* Problem display */}
      {isVerticalPart(part.type) ? (
        <CompactVerticalProblem
          terms={problem.terms}
          answer={problem.answer}
          studentAnswer={result?.studentAnswer}
          isCorrect={verdict?.isCorrect}
          isDark={isDark}
        />
      ) : (
        <CompactLinearProblem
          terms={problem.terms}
          answer={problem.answer}
          studentAnswer={result?.studentAnswer}
          isCorrect={verdict?.isCorrect}
          isDark={isDark}
        />
      )}
    </button>
  )
}

/**
 * Get display label for slot purpose
 */
function getPurposeLabel(purpose: ProblemSlot['purpose']): {
  label: string
  emoji: string
  color: string
} {
  switch (purpose) {
    case 'focus':
      return { label: 'Focus', emoji: '🎯', color: 'blue' }
    case 'reinforce':
      return { label: 'Reinforce', emoji: '💪', color: 'green' }
    case 'review':
      return { label: 'Review', emoji: '📝', color: 'purple' }
    case 'challenge':
      return { label: 'Challenge', emoji: '⭐', color: 'orange' }
  }
}

/**
 * Problem Detail Popover - shows detailed info for a selected problem
 */
function ProblemDetailPopover({
  info,
  isDark,
  onClose,
}: {
  info: SelectedProblemInfo
  isDark: boolean
  onClose: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const { slot, part, result, problemNumber } = info
  const problem = result?.problem ?? slot.problem
  // Green / red only for a verdict the report counts; a try that counts nowhere is neutral
  const verdict = isCounted(info.status) ? result : undefined
  const uncountedNote = STATUS_TITLE[info.status]

  // The auto-pause threshold in force when the problem was first answered
  // (counted tries only: `calculateAutoPauseInfo` reads through `isCountedTry`)
  const autoPauseInfo = calculateAutoPauseInfo(info.priorResults)

  const purposeInfo = getPurposeLabel(slot.purpose)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay to avoid immediate close from the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!problem) return null

  return (
    <div
      data-component="problem-detail-overlay"
      className={css({
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      })}
    >
      <div
        ref={popoverRef}
        data-element="problem-detail-popover"
        className={css({
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '12px',
          boxShadow: 'xl',
          maxWidth: '400px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        {/* Header */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span
              className={css({
                fontWeight: 'bold',
                fontSize: '1rem',
                color: isDark ? 'gray.100' : 'gray.800',
              })}
            >
              Problem #{problemNumber}
            </span>
            <span
              className={css({
                padding: '0.125rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: '500',
                backgroundColor: isDark ? `${purposeInfo.color}.900` : `${purposeInfo.color}.100`,
                color: isDark ? `${purposeInfo.color}.200` : `${purposeInfo.color}.700`,
              })}
            >
              {purposeInfo.emoji} {purposeInfo.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={css({
              fontSize: '1.25rem',
              color: isDark ? 'gray.400' : 'gray.500',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
              _hover: { color: isDark ? 'gray.200' : 'gray.700' },
            })}
          >
            ×
          </button>
        </div>

        {/* Problem display */}
        <div
          className={css({
            padding: '1rem',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div
            className={css({
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              textAlign: 'center',
              padding: '0.75rem',
              borderRadius: '8px',
              backgroundColor: verdict
                ? verdict.isCorrect
                  ? isDark
                    ? 'green.900/40'
                    : 'green.50'
                  : isDark
                    ? 'red.900/40'
                    : 'red.50'
                : isDark
                  ? 'gray.700'
                  : 'gray.100',
            })}
          >
            {/* Show problem as equation */}
            <span className={css({ color: isDark ? 'gray.200' : 'gray.800' })}>
              {problem.terms
                .map((t, i) => (i === 0 ? String(t) : t < 0 ? ` − ${Math.abs(t)}` : ` + ${t}`))
                .join('')}{' '}
              ={' '}
            </span>
            <span
              className={css({
                color: verdict
                  ? verdict.isCorrect
                    ? isDark
                      ? 'green.300'
                      : 'green.700'
                    : isDark
                      ? 'red.300'
                      : 'red.700'
                  : isDark
                    ? 'gray.100'
                    : 'gray.900',
              })}
            >
              {problem.answer}
            </span>
          </div>

          {/* Result info */}
          {uncountedNote && (
            <div
              data-element="uncounted-note"
              className={css({
                marginTop: '0.75rem',
                padding: '0.5rem',
                borderRadius: '6px',
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: isDark ? 'gray.300' : 'gray.700',
              })}
            >
              {uncountedNote}
            </div>
          )}
          {verdict && !verdict.isCorrect && (
            <div
              className={css({
                marginTop: '0.75rem',
                padding: '0.5rem',
                borderRadius: '6px',
                backgroundColor: isDark ? 'red.900/40' : 'red.50',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: isDark ? 'red.300' : 'red.700',
              })}
            >
              Student answered: <strong>{verdict.studentAnswer}</strong>
            </div>
          )}
        </div>

        {/* Details */}
        <div
          className={css({
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            fontSize: '0.875rem',
          })}
        >
          {/* Part type */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
            })}
          >
            <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>Part type:</span>
            <span
              className={css({
                fontWeight: 'bold',
                color: isDark ? 'gray.200' : 'gray.800',
              })}
            >
              {getPartTypeLabel(part.type)}
            </span>
          </div>

          {/* Response time */}
          {result && (
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
              })}
            >
              <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
                Response time:
              </span>
              <span
                className={css({
                  fontWeight: 'bold',
                  color:
                    result.responseTimeMs > autoPauseInfo.threshold
                      ? isDark
                        ? 'yellow.400'
                        : 'yellow.600'
                      : isDark
                        ? 'gray.200'
                        : 'gray.800',
                })}
              >
                {formatMs(result.responseTimeMs)}
                {result.responseTimeMs > autoPauseInfo.threshold && ' ⚠️'}
              </span>
            </div>
          )}

          {/* Auto-pause threshold */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
            })}
          >
            <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
              Pause threshold:
            </span>
            <span
              className={css({
                fontWeight: 'bold',
                color: isDark ? 'gray.200' : 'gray.800',
              })}
            >
              {formatMs(autoPauseInfo.threshold)}
            </span>
          </div>

          {/* Help used */}
          {result?.hadHelp && (
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
              })}
            >
              <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>Help used:</span>
              <span
                className={css({
                  fontWeight: 'bold',
                  color: isDark ? 'orange.300' : 'orange.600',
                })}
              >
                Yes
              </span>
            </div>
          )}

          {/* Abacus used */}
          {result?.usedOnScreenAbacus && (
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
              })}
            >
              <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
                On-screen abacus:
              </span>
              <span
                className={css({
                  fontWeight: 'bold',
                  color: isDark ? 'blue.300' : 'blue.600',
                })}
              >
                Used
              </span>
            </div>
          )}

          {/* Skills exercised */}
          {result && result.skillsExercised.length > 0 && (
            <div>
              <span
                className={css({
                  color: isDark ? 'gray.400' : 'gray.600',
                  display: 'block',
                  marginBottom: '0.375rem',
                })}
              >
                Skills:
              </span>
              <div
                className={css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                })}
              >
                {result.skillsExercised.map((skill) => (
                  <span
                    key={skill}
                    className={css({
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      backgroundColor: isDark ? 'gray.700' : 'gray.100',
                      color: isDark ? 'gray.300' : 'gray.600',
                    })}
                  >
                    {skill.split('.')[1] || skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AllProblemsSection({ plan, report, isDark }: AllProblemsSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProblem, setSelectedProblem] = useState<SelectedProblemInfo | null>(null)

  // One cell per problem, with its item's tries and status from the report
  const cells = useMemo(() => arithmeticItemCells(plan, report), [plan, report])
  // Planned problems: the report's; a plan not started counts its cells
  const totalProblems = report
    ? report.totals.plannedProblems
    : cells.reduce((sum, partCells) => sum + partCells.length, 0)
  const partProblems = (partIndex: number) =>
    report ? (report.parts[partIndex]?.plannedProblems ?? 0) : (cells[partIndex]?.length ?? 0)

  const handleProblemClick = useCallback(
    (cell: ArithmeticItemCell) => {
      setSelectedProblem({
        slot: cell.slot,
        part: cell.part,
        result: cell.shown ?? undefined,
        problemNumber: cell.number,
        status: cell.status,
        priorResults: triesBeforeItem(plan, cell),
      })
    },
    [plan]
  )

  const handleClosePopover = useCallback(() => {
    setSelectedProblem(null)
  }, [])

  return (
    <div
      data-component="all-problems-section"
      className={css({
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        backgroundColor: isDark ? 'gray.800' : 'white',
        overflow: 'hidden',
      })}
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '1rem',
          backgroundColor: isDark ? 'gray.800' : 'white',
          border: 'none',
          cursor: 'pointer',
          _hover: {
            backgroundColor: isDark ? 'gray.750' : 'gray.50',
          },
        })}
      >
        <span
          className={css({
            fontWeight: 'bold',
            color: isDark ? 'gray.200' : 'gray.800',
          })}
        >
          📝 All Session Problems ({totalProblems})
        </span>
        <span
          className={css({
            fontSize: '1.25rem',
            color: isDark ? 'gray.400' : 'gray.500',
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          })}
        >
          ▼
        </span>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div
          data-element="problems-content"
          className={css({
            borderTop: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          {/* Hint text */}
          <div
            className={css({
              padding: '0.5rem 1rem',
              fontSize: '0.75rem',
              color: isDark ? 'gray.500' : 'gray.400',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              backgroundColor: isDark ? 'gray.850' : 'gray.50',
            })}
          >
            Tap any problem to see details
          </div>

          {/* Problems grouped by part */}
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              padding: '1rem',
            })}
          >
            {plan.parts.map((part, partIndex) => (
              <section key={part.partNumber} data-section={`part-${part.partNumber}`}>
                {/* Part header */}
                <h3
                  className={css({
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.400' : 'gray.600',
                    marginBottom: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  })}
                >
                  Part {part.partNumber}: {getPartTypeLabel(part.type)}
                  <span
                    className={css({
                      fontWeight: 'normal',
                      marginLeft: '0.5rem',
                      textTransform: 'none',
                    })}
                  >
                    ({partProblems(partIndex)} problems)
                  </span>
                </h3>

                {/* Compact view with problem numbers - tap for details */}
                <div
                  className={css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  })}
                >
                  {(cells[partIndex] ?? []).map((cell) => (
                    <CompactProblemItem
                      key={cell.itemId}
                      cell={cell}
                      isDark={isDark}
                      onClick={() => handleProblemClick(cell)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* Problem detail popover */}
      {selectedProblem && (
        <ProblemDetailPopover info={selectedProblem} isDark={isDark} onClose={handleClosePopover} />
      )}
    </div>
  )
}

export default AllProblemsSection

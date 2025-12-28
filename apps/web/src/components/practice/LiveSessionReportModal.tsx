'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useMemo } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import type { ObservedResult } from '@/hooks/useSessionObserver'
import { css } from '../../../styled-system/css'
import { CompactLinearProblem } from './CompactProblemDisplay'

interface LiveSessionReportContentProps {
  /** Accumulated results from the session */
  results: ObservedResult[]
  /** Total problems in the session */
  totalProblems: number
  /** Session start time (for duration calculation) */
  sessionStartTime?: number
  /** Whether dark mode */
  isDark: boolean
}

interface LiveSessionReportInlineProps extends LiveSessionReportContentProps {
  /** Callback to go back to problem view */
  onBack: () => void
}

interface LiveSessionReportModalProps extends LiveSessionReportContentProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Close the modal */
  onClose: () => void
  /** Student name for display */
  studentName: string
}

/**
 * Get performance message based on accuracy
 */
function getPerformanceMessage(accuracy: number, isComplete: boolean): string {
  if (!isComplete) {
    if (accuracy >= 0.9) return 'Excellent progress so far!'
    if (accuracy >= 0.8) return 'Great work in progress!'
    if (accuracy >= 0.7) return 'Good effort so far!'
    return 'Keep going!'
  }
  if (accuracy >= 0.95) return 'Outstanding! Math champion!'
  if (accuracy >= 0.9) return 'Excellent work!'
  if (accuracy >= 0.8) return 'Great job!'
  if (accuracy >= 0.7) return "Good effort! You're getting stronger!"
  if (accuracy >= 0.6) return 'Nice try! Practice makes perfect!'
  return "Keep practicing! You'll get better!"
}

/**
 * Get purpose display info
 */
function getPurposeInfo(purpose: ObservedResult['purpose']): {
  label: string
  emoji: string
  colorLight: string
  colorDark: string
} {
  switch (purpose) {
    case 'focus':
      return { label: 'Focus', emoji: '🎯', colorLight: 'blue', colorDark: 'blue' }
    case 'reinforce':
      return { label: 'Reinforce', emoji: '💪', colorLight: 'green', colorDark: 'green' }
    case 'review':
      return { label: 'Review', emoji: '📝', colorLight: 'purple', colorDark: 'purple' }
    case 'challenge':
      return { label: 'Challenge', emoji: '⭐', colorLight: 'orange', colorDark: 'orange' }
  }
}

/**
 * Compact result item for the full report
 */
function ReportResultItem({ result, isDark }: { result: ObservedResult; isDark: boolean }) {
  const studentAnswerNum = parseInt(result.studentAnswer, 10)
  const purposeInfo = getPurposeInfo(result.purpose)

  return (
    <div
      data-element="report-result-item"
      data-correct={result.isCorrect}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        backgroundColor: result.isCorrect
          ? isDark
            ? 'green.900/40'
            : 'green.50'
          : isDark
            ? 'red.900/40'
            : 'red.50',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: result.isCorrect
          ? isDark
            ? 'green.700'
            : 'green.200'
          : isDark
            ? 'red.700'
            : 'red.200',
      })}
    >
      {/* Problem number */}
      <span
        className={css({
          fontSize: '0.6875rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.500' : 'gray.400',
          minWidth: '1.5rem',
        })}
      >
        #{result.problemNumber}
      </span>

      {/* Status indicator */}
      <span
        className={css({
          fontSize: '0.875rem',
          fontWeight: 'bold',
          color: result.isCorrect
            ? isDark
              ? 'green.400'
              : 'green.600'
            : isDark
              ? 'red.400'
              : 'red.600',
        })}
      >
        {result.isCorrect ? '✓' : '✗'}
      </span>

      {/* Problem display */}
      <div className={css({ flex: 1 })}>
        <CompactLinearProblem
          terms={result.terms}
          answer={result.answer}
          studentAnswer={Number.isNaN(studentAnswerNum) ? undefined : studentAnswerNum}
          isCorrect={result.isCorrect}
          isDark={isDark}
        />
      </div>

      {/* Purpose badge */}
      <span
        className={css({
          padding: '0.125rem 0.375rem',
          borderRadius: '4px',
          fontSize: '0.625rem',
          fontWeight: '500',
          backgroundColor: isDark
            ? `${purposeInfo.colorDark}.900/50`
            : `${purposeInfo.colorLight}.100`,
          color: isDark ? `${purposeInfo.colorDark}.300` : `${purposeInfo.colorLight}.700`,
        })}
      >
        {purposeInfo.emoji}
      </span>

      {/* Response time */}
      <span
        className={css({
          fontSize: '0.6875rem',
          color: isDark ? 'gray.500' : 'gray.400',
          minWidth: '2.5rem',
          textAlign: 'right',
        })}
      >
        {(result.responseTimeMs / 1000).toFixed(1)}s
      </span>
    </div>
  )
}

/**
 * Shared content component for the live session report
 */
function LiveSessionReportContent({
  results,
  totalProblems,
  sessionStartTime,
  isDark,
}: LiveSessionReportContentProps) {
  // Compute stats
  const stats = useMemo(() => {
    const correct = results.filter((r) => r.isCorrect).length
    const incorrect = results.filter((r) => !r.isCorrect).length
    const completed = results.length
    const accuracy = completed > 0 ? correct / completed : 0
    const totalTimeMs = results.reduce((sum, r) => sum + r.responseTimeMs, 0)
    const avgTimeMs = completed > 0 ? totalTimeMs / completed : 0

    return { correct, incorrect, completed, accuracy, totalTimeMs, avgTimeMs }
  }, [results])

  const isComplete = stats.completed === totalProblems
  const sessionDurationMinutes = sessionStartTime
    ? (Date.now() - sessionStartTime) / 1000 / 60
    : stats.totalTimeMs / 1000 / 60

  // Get incorrect results
  const incorrectResults = useMemo(() => results.filter((r) => !r.isCorrect), [results])

  return (
    <div
      data-element="report-content"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        width: '100%',
        maxWidth: '500px',
      })}
    >
      {/* Celebration header */}
      <div
        data-section="celebration-header"
        className={css({
          textAlign: 'center',
          padding: '1rem',
          backgroundColor: isDark
            ? stats.accuracy >= 0.8
              ? 'green.900/50'
              : stats.accuracy >= 0.6
                ? 'yellow.900/50'
                : 'orange.900/50'
            : stats.accuracy >= 0.8
              ? 'green.50'
              : stats.accuracy >= 0.6
                ? 'yellow.50'
                : 'orange.50',
          borderRadius: '12px',
          border: '2px solid',
          borderColor: isDark
            ? stats.accuracy >= 0.8
              ? 'green.700'
              : stats.accuracy >= 0.6
                ? 'yellow.700'
                : 'orange.700'
            : stats.accuracy >= 0.8
              ? 'green.200'
              : stats.accuracy >= 0.6
                ? 'yellow.200'
                : 'orange.200',
        })}
      >
        <div className={css({ fontSize: '2rem', marginBottom: '0.25rem' })}>
          {stats.accuracy >= 0.9
            ? '🌟'
            : stats.accuracy >= 0.8
              ? '🎉'
              : stats.accuracy >= 0.6
                ? '👍'
                : '💪'}
        </div>
        <p
          className={css({
            fontSize: '0.875rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.200' : 'gray.700',
          })}
        >
          {getPerformanceMessage(stats.accuracy, isComplete)}
        </p>
      </div>

      {/* Main stats grid */}
      <div
        data-section="main-stats"
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.75rem',
        })}
      >
        {/* Accuracy */}
        <div
          data-element="stat-accuracy"
          className={css({
            textAlign: 'center',
            padding: '0.75rem',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color:
                stats.accuracy >= 0.8
                  ? isDark
                    ? 'green.400'
                    : 'green.600'
                  : stats.accuracy >= 0.6
                    ? isDark
                      ? 'yellow.400'
                      : 'yellow.600'
                    : isDark
                      ? 'orange.400'
                      : 'orange.600',
            })}
          >
            {Math.round(stats.accuracy * 100)}%
          </div>
          <div
            className={css({
              fontSize: '0.625rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Accuracy
          </div>
        </div>

        {/* Correct/Total */}
        <div
          data-element="stat-problems"
          className={css({
            textAlign: 'center',
            padding: '0.75rem',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.400' : 'blue.600',
            })}
          >
            {stats.correct}/{stats.completed}
          </div>
          <div
            className={css({
              fontSize: '0.625rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Correct
          </div>
        </div>

        {/* Time */}
        <div
          data-element="stat-time"
          className={css({
            textAlign: 'center',
            padding: '0.75rem',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'purple.400' : 'purple.600',
            })}
          >
            {Math.round(sessionDurationMinutes)}
          </div>
          <div
            className={css({
              fontSize: '0.625rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Minutes
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div
        data-section="progress"
        className={css({
          padding: '0.625rem 0.875rem',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          borderRadius: '10px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.375rem',
          })}
        >
          <span
            className={css({
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.300' : 'gray.700',
            })}
          >
            Progress
          </span>
          <span
            className={css({
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {stats.completed} / {totalProblems}
          </span>
        </div>
        <div
          className={css({
            height: '6px',
            backgroundColor: isDark ? 'gray.700' : 'gray.200',
            borderRadius: '3px',
            overflow: 'hidden',
          })}
        >
          <div
            className={css({
              height: '100%',
              backgroundColor: isDark ? 'blue.500' : 'blue.500',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            })}
            style={{ width: `${(stats.completed / totalProblems) * 100}%` }}
          />
        </div>
      </div>

      {/* Average response time */}
      <div
        data-section="timing"
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0.625rem 0.875rem',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          borderRadius: '10px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          fontSize: '0.8125rem',
        })}
      >
        <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>Avg. response time</span>
        <span
          className={css({
            fontWeight: 'bold',
            color: isDark ? 'gray.200' : 'gray.800',
          })}
        >
          {(stats.avgTimeMs / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Problems needing attention */}
      {incorrectResults.length > 0 && (
        <div
          data-section="problems-to-review"
          className={css({
            padding: '0.875rem',
            borderRadius: '10px',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <h3
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.200' : 'gray.700',
              marginBottom: '0.625rem',
            })}
          >
            Problems to Review ({incorrectResults.length})
          </h3>
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.375rem',
              maxHeight: '150px',
              overflowY: 'auto',
            })}
          >
            {incorrectResults.map((result) => (
              <ReportResultItem key={result.problemNumber} result={result} isDark={isDark} />
            ))}
          </div>
        </div>
      )}

      {/* All problems */}
      <div
        data-section="all-problems"
        className={css({
          padding: '0.875rem',
          borderRadius: '10px',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.200' : 'gray.700',
            marginBottom: '0.625rem',
          })}
        >
          All Problems ({results.length})
        </h3>
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
            maxHeight: '200px',
            overflowY: 'auto',
          })}
        >
          {results.length === 0 ? (
            <div
              className={css({
                textAlign: 'center',
                padding: '0.75rem',
                fontSize: '0.8125rem',
                color: isDark ? 'gray.500' : 'gray.400',
              })}
            >
              No problems completed yet
            </div>
          ) : (
            results.map((result) => (
              <ReportResultItem key={result.problemNumber} result={result} isDark={isDark} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * LiveSessionReportInline - Full report view shown inline (not in a modal)
 * Used in SessionObserverModal when expanding from the LiveResultsPanel
 */
export function LiveSessionReportInline({
  results,
  totalProblems,
  sessionStartTime,
  isDark,
  onBack,
}: LiveSessionReportInlineProps) {
  return (
    <div
      data-component="live-session-report-inline"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
      })}
    >
      {/* Back button */}
      <button
        type="button"
        data-action="back-to-problem"
        onClick={onBack}
        className={css({
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          marginBottom: '1rem',
          padding: '0.375rem 0.75rem',
          fontSize: '0.8125rem',
          fontWeight: 'medium',
          color: isDark ? 'blue.400' : 'blue.600',
          backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
          border: '1px solid',
          borderColor: isDark ? 'blue.700' : 'blue.200',
          borderRadius: '6px',
          cursor: 'pointer',
          _hover: {
            backgroundColor: isDark ? 'blue.900/50' : 'blue.100',
          },
        })}
      >
        ← Back to Problem
      </button>

      <LiveSessionReportContent
        results={results}
        totalProblems={totalProblems}
        sessionStartTime={sessionStartTime}
        isDark={isDark}
      />
    </div>
  )
}

/**
 * LiveSessionReportModal - Full session report in a modal
 * (Kept for potential future use, but inline version is preferred)
 */
export function LiveSessionReportModal({
  isOpen,
  onClose,
  results,
  totalProblems,
  studentName,
  sessionStartTime,
  isDark,
}: LiveSessionReportModalProps) {
  const stats = useMemo(() => {
    const completed = results.length
    return { completed }
  }, [results])

  const isComplete = stats.completed === totalProblems

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-element="live-report-modal-overlay"
          className={css({
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: Z_INDEX.NESTED_MODAL_BACKDROP + 10,
          })}
        />

        <Dialog.Content
          data-component="live-session-report-modal"
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90vw',
            maxWidth: '600px',
            maxHeight: '85vh',
            backgroundColor: isDark ? 'gray.900' : 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: Z_INDEX.NESTED_MODAL + 10,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            outline: 'none',
          })}
        >
          {/* Header */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
            })}
          >
            <div>
              <Dialog.Title
                className={css({
                  fontWeight: 'bold',
                  color: isDark ? 'white' : 'gray.800',
                  fontSize: '1.125rem',
                  margin: 0,
                })}
              >
                {isComplete ? 'Session Complete' : 'Session In Progress'}
              </Dialog.Title>
              <Dialog.Description
                className={css({
                  fontSize: '0.8125rem',
                  color: isDark ? 'gray.400' : 'gray.500',
                  margin: 0,
                })}
              >
                {studentName}&apos;s practice session
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                data-action="close-report"
                className={css({
                  padding: '8px 16px',
                  backgroundColor: isDark ? 'gray.700' : 'gray.200',
                  color: isDark ? 'gray.200' : 'gray.700',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  _hover: { backgroundColor: isDark ? 'gray.600' : 'gray.300' },
                })}
              >
                Close
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable content */}
          <div
            className={css({
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              justifyContent: 'center',
            })}
          >
            <LiveSessionReportContent
              results={results}
              totalProblems={totalProblems}
              sessionStartTime={sessionStartTime}
              isDark={isDark}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default LiveSessionReportModal

/**
 * All Problems Section Component
 *
 * A collapsible section showing all session problems with a toggle
 * between compact and detailed views.
 */

'use client'

import { useState } from 'react'
import type { SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { calculateAutoPauseInfo } from './autoPauseCalculator'
import { CompactLinearProblem, CompactVerticalProblem } from './CompactProblemDisplay'
import { DetailedProblemCard } from './DetailedProblemCard'
import { getPartTypeLabel, isVerticalPart } from './sessionSummaryUtils'

export interface AllProblemsSectionProps {
  /** The session plan */
  plan: SessionPlan
  /** Dark mode */
  isDark: boolean
}

type ViewMode = 'compact' | 'detailed'

/**
 * Build a result map for quick lookup
 */
function buildResultMap(
  results: SlotResult[]
): Map<string, { result: SlotResult; position: number }> {
  const map = new Map<string, { result: SlotResult; position: number }>()
  results.forEach((result, position) => {
    const key = `${result.partNumber}-${result.slotIndex}`
    map.set(key, { result, position })
  })
  return map
}

/**
 * Calculate auto-pause stats at a specific position
 */
function calculateAutoPauseAtPosition(
  allResults: SlotResult[],
  position: number
): ReturnType<typeof calculateAutoPauseInfo> {
  const previousResults = allResults.slice(0, position)
  return calculateAutoPauseInfo(previousResults)
}

/**
 * Compact problem item - simple problem + answer + status
 */
function CompactProblemItem({
  slot,
  part,
  result,
  isDark,
}: {
  slot: SessionPlan['parts'][0]['slots'][0]
  part: SessionPart
  result?: SlotResult
  isDark: boolean
}) {
  const problem = result?.problem ?? slot.problem
  if (!problem) return null

  return (
    <div
      data-element="compact-problem-item"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.375rem 0.5rem',
        backgroundColor: result
          ? result.isCorrect
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
        borderColor: result
          ? result.isCorrect
            ? isDark
              ? 'green.700'
              : 'green.200'
            : isDark
              ? 'red.700'
              : 'red.200'
          : isDark
            ? 'gray.600'
            : 'gray.200',
      })}
    >
      {/* Status indicator */}
      <span
        className={css({
          fontSize: '0.875rem',
          fontWeight: 'bold',
          color: result
            ? result.isCorrect
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
        {result ? (result.isCorrect ? '✓' : '❌') : '○'}
      </span>

      {/* Problem display */}
      {isVerticalPart(part.type) ? (
        <CompactVerticalProblem
          terms={problem.terms}
          answer={problem.answer}
          studentAnswer={result?.studentAnswer}
          isCorrect={result?.isCorrect}
          isDark={isDark}
        />
      ) : (
        <CompactLinearProblem
          terms={problem.terms}
          answer={problem.answer}
          studentAnswer={result?.studentAnswer}
          isCorrect={result?.isCorrect}
          isDark={isDark}
        />
      )}
    </div>
  )
}

export function AllProblemsSection({ plan, isDark }: AllProblemsSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('compact')

  const results = plan.results as SlotResult[]
  const resultMap = buildResultMap(results)
  const totalProblems = plan.parts.reduce((sum, part) => sum + part.slots.length, 0)

  // Track problem number across all parts for detailed view
  let globalProblemNumber = 0

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
          📋 All Problems ({totalProblems})
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
          {/* View mode toggle */}
          <div
            data-element="view-mode-toggle"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              backgroundColor: isDark ? 'gray.850' : 'gray.50',
            })}
          >
            <span
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              View:
            </span>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={css({
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'compact' ? 'bold' : 'normal',
                color: viewMode === 'compact' ? 'white' : isDark ? 'gray.300' : 'gray.600',
                backgroundColor:
                  viewMode === 'compact' ? 'blue.500' : isDark ? 'gray.700' : 'gray.200',
                border: 'none',
                borderRadius: '6px 0 0 6px',
                cursor: 'pointer',
                _hover: {
                  backgroundColor:
                    viewMode === 'compact' ? 'blue.600' : isDark ? 'gray.600' : 'gray.300',
                },
              })}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detailed')}
              className={css({
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'detailed' ? 'bold' : 'normal',
                color: viewMode === 'detailed' ? 'white' : isDark ? 'gray.300' : 'gray.600',
                backgroundColor:
                  viewMode === 'detailed' ? 'blue.500' : isDark ? 'gray.700' : 'gray.200',
                border: 'none',
                borderRadius: '0 6px 6px 0',
                cursor: 'pointer',
                _hover: {
                  backgroundColor:
                    viewMode === 'detailed' ? 'blue.600' : isDark ? 'gray.600' : 'gray.300',
                },
              })}
            >
              Detailed
            </button>
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
            {plan.parts.map((part) => (
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
                    ({part.slots.length} problems)
                  </span>
                </h3>

                {/* Problems */}
                {viewMode === 'compact' ? (
                  // Compact view - grid/flex layout
                  <div
                    className={css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    })}
                  >
                    {part.slots.map((slot) => {
                      const key = `${part.partNumber}-${slot.index}`
                      const resultInfo = resultMap.get(key)

                      return (
                        <CompactProblemItem
                          key={key}
                          slot={slot}
                          part={part}
                          result={resultInfo?.result}
                          isDark={isDark}
                        />
                      )
                    })}
                  </div>
                ) : (
                  // Detailed view - list layout
                  <div
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                    })}
                  >
                    {part.slots.map((slot) => {
                      globalProblemNumber++
                      const key = `${part.partNumber}-${slot.index}`
                      const resultInfo = resultMap.get(key)
                      const position = resultInfo?.position ?? results.length
                      const autoPauseAtPosition = calculateAutoPauseAtPosition(results, position)

                      return (
                        <DetailedProblemCard
                          key={key}
                          slot={slot}
                          part={part}
                          result={resultInfo?.result}
                          autoPauseStats={autoPauseAtPosition.stats}
                          isDark={isDark}
                          problemNumber={globalProblemNumber}
                        />
                      )
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AllProblemsSection

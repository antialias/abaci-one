'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { useState } from 'react'
import type { SessionPart } from '@/db/schema/session-plans'
import { arithmeticPartOverview } from '@/lib/curriculum/parts/arithmetic/result-view'
import { plannedItemCount } from '@/lib/curriculum/parts/registry'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { css } from '../../../styled-system/css'
import { getPurposeColors, getPurposeConfig, type PurposeType } from './purposeExplanations'

interface SessionPlanOverviewProps {
  parts: SessionPart[]
  /**
   * The session report: each part's planned count, the total, and the part the
   * kid is in (`position.segment`). Before it loads, the counts are the
   * parts' own and the current part is `currentPartIndex`.
   */
  report?: SessionReport | null
  /** The part shown as current until the report says otherwise */
  currentPartIndex?: number
  isDark: boolean
}

/** The part the kid is in, by the report's position: a break counts as the part after it. */
function reportCurrentPartIndex(report: SessionReport): number | null {
  const segment = report.position?.segment
  if (!segment) return null
  if (segment.kind === 'part') return segment.partIndex
  if (segment.kind === 'break') return segment.afterPartIndex + 1
  return null
}

function plannedOf(part: SessionPart): number {
  try {
    return plannedItemCount(part)
  } catch {
    return 0
  }
}

function getPartEmoji(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return '🧮'
    case 'visualization':
      return '🧠'
    case 'linear':
      return '📝'
  }
}

function getPartLabel(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return 'Abacus'
    case 'visualization':
      return 'Visual'
    case 'linear':
      return 'Mental'
  }
}

/**
 * Collapsible panel showing the full session plan structure at a glance.
 *
 * Collapsed: single-line summary of all parts
 * Expanded: per-part rows with purpose distribution and comfort level
 */
export function SessionPlanOverview({
  parts,
  report,
  currentPartIndex,
  isDark,
}: SessionPlanOverviewProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Planned problems: the report's, per part and in total (Phase 5c)
  const partCount = (partIndex: number) =>
    report ? (report.parts[partIndex]?.plannedProblems ?? 0) : plannedOf(parts[partIndex])
  const totalProblems = report
    ? report.totals.plannedProblems
    : parts.reduce((sum, _part, i) => sum + partCount(i), 0)
  const currentIndex = report ? reportCurrentPartIndex(report) : (currentPartIndex ?? null)

  // Build collapsed summary: emoji (count) for each part
  const partSummaries = parts.map(
    (part, i) => `${getPartEmoji(part.type)} ${getPartLabel(part.type)} (${partCount(i)})`
  )

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} data-component="session-plan-overview">
      <Collapsible.Trigger asChild>
        <button
          type="button"
          data-action="toggle-session-plan"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.5rem 0.75rem',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            color: isDark ? 'gray.300' : 'gray.600',
            transition: 'all 0.15s ease',
            _hover: {
              backgroundColor: isDark ? 'gray.750' : 'gray.100',
            },
          })}
        >
          <span className={css({ fontWeight: 'bold' })}>📋</span>
          <span className={css({ flex: 1, textAlign: 'left' })}>
            Session Plan: {partSummaries.join(' → ')} — {totalProblems} problems
          </span>
          <span
            className={css({
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              fontSize: '0.625rem',
            })}
          >
            ▼
          </span>
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content
        className={css({
          overflow: 'hidden',
          '&[data-state="open"]': {
            animation: 'slideDown 200ms ease-out',
          },
          '&[data-state="closed"]': {
            animation: 'slideUp 200ms ease-out',
          },
        })}
      >
        <div
          data-element="plan-details"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
            padding: '0.5rem 0',
          })}
        >
          {parts.map((part, partIndex) => {
            const isCurrent = partIndex === currentIndex
            // Purpose mix and comfort level: what only arithmetic has
            const { purposeCounts, comfortLevel } = arithmeticPartOverview(part)

            const purposeEntries = (
              Object.entries(purposeCounts) as [PurposeType, number][]
            ).filter(([, count]) => count > 0)

            return (
              <div
                key={part.partNumber}
                data-element="part-row"
                data-part-type={part.type}
                data-current={isCurrent || undefined}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: isCurrent
                    ? isDark
                      ? 'blue.900/30'
                      : 'blue.50'
                    : isDark
                      ? 'gray.800/50'
                      : 'gray.50/50',
                  border: '1px solid',
                  borderColor: isCurrent ? (isDark ? 'blue.700/50' : 'blue.200') : 'transparent',
                })}
              >
                {/* Part info */}
                <span className={css({ fontSize: '0.875rem', flexShrink: 0 })}>
                  {getPartEmoji(part.type)}
                </span>
                <div className={css({ flex: 1, minWidth: 0 })}>
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: isDark ? 'gray.200' : 'gray.700',
                    })}
                  >
                    <span>{getPartLabel(part.type)}</span>
                    <span
                      className={css({
                        color: isDark ? 'gray.400' : 'gray.500',
                        fontWeight: 'normal',
                      })}
                    >
                      {partCount(partIndex)} problems
                      {part.estimatedMinutes > 0 && `, ~${part.estimatedMinutes} min`}
                    </span>
                    {comfortLevel !== undefined && (
                      <span
                        className={css({
                          fontSize: '0.625rem',
                          padding: '0.0625rem 0.25rem',
                          borderRadius: '4px',
                          backgroundColor:
                            comfortLevel >= 0.7
                              ? isDark
                                ? 'green.900/50'
                                : 'green.100'
                              : comfortLevel >= 0.4
                                ? isDark
                                  ? 'yellow.900/50'
                                  : 'yellow.100'
                                : isDark
                                  ? 'red.900/50'
                                  : 'red.100',
                          color:
                            comfortLevel >= 0.7
                              ? isDark
                                ? 'green.300'
                                : 'green.700'
                              : comfortLevel >= 0.4
                                ? isDark
                                  ? 'yellow.300'
                                  : 'yellow.700'
                                : isDark
                                  ? 'red.300'
                                  : 'red.700',
                          fontWeight: 'normal',
                        })}
                      >
                        {Math.round(comfortLevel * 100)}% comfort
                      </span>
                    )}
                  </div>
                  {/* Purpose chips */}
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      marginTop: '0.125rem',
                    })}
                  >
                    {purposeEntries.map(([purpose, count]) => {
                      const config = getPurposeConfig(purpose)
                      const colors = getPurposeColors(purpose, isDark)
                      return (
                        <span
                          key={purpose}
                          className={css({
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.125rem',
                            padding: '0.0625rem 0.25rem',
                            borderRadius: '4px',
                            fontSize: '0.625rem',
                            fontWeight: '500',
                            backgroundColor: colors.background,
                            color: colors.text,
                          })}
                        >
                          {config.emoji}×{count}
                        </span>
                      )
                    })}
                  </div>
                </div>
                {/* Current indicator */}
                {isCurrent && (
                  <span
                    className={css({
                      fontSize: '0.625rem',
                      fontWeight: 'bold',
                      color: isDark ? 'blue.300' : 'blue.600',
                      flexShrink: 0,
                    })}
                  >
                    ← Current
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export default SessionPlanOverview

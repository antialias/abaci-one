'use client'

import Link from 'next/link'
import type { LinearReadinessState } from '@/hooks/useLinearReadiness'
import { css } from '../../../../styled-system/css'

export function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/** Where "See what's needed" goes: the dashboard's Skills tab, Number sentences panel. */
export function numberSentencesPanelHref(studentId: string): string {
  return `/practice/${studentId}/dashboard?tab=skills#number-sentences`
}

/**
 * One line on why number sentences are locked. Two cases:
 * - nothing has graduated yet → name the frontier stage and how close it is
 * - something graduated but the teacher said "not yet" → say so
 */
export function describeLinearLock(state: LinearReadinessState): string {
  const vetoed = state.categories.filter((c) => c.status === 'vetoed')
  if (vetoed.length > 0) {
    return `You said 'not yet' to number sentences for ${joinNames(vetoed.map((c) => c.name))}.`
  }
  const { frontier } = state
  if (frontier) {
    return `Number sentences unlock when your ${frontier.name} are quick and steady. ${frontier.solidCount} of ${frontier.total} ready.`
  }
  return 'Number sentences are not available yet.'
}

/** Popover body for the locked Linear segment (tier 1 of the disclosure). */
export function LinearLockNote({
  state,
  studentId,
  isDark,
  onNavigate,
}: {
  state: LinearReadinessState
  studentId: string
  isDark: boolean
  /**
   * Fired when "See what's needed" is tapped. The link targets the dashboard the
   * modal usually sits on, so the modal has to get out of the way itself.
   */
  onNavigate?: () => void
}) {
  return (
    <div
      data-component="linear-lock-note"
      className={css({ display: 'flex', flexDirection: 'column', gap: '0.5rem' })}
    >
      <p data-element="linear-lock-reason">{describeLinearLock(state)}</p>
      <Link
        href={numberSentencesPanelHref(studentId)}
        onClick={onNavigate}
        data-action="see-linear-requirements"
        className={css({
          alignSelf: 'flex-start',
          fontWeight: '600',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
        })}
        style={{ color: isDark ? '#86efac' : '#166534' }}
      >
        See what's needed
      </Link>
    </div>
  )
}

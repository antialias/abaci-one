'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { useLinearReadiness, useLinearReadinessVeto } from '@/hooks/useLinearReadiness'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal } from '../StartPracticeModalContext'

/**
 * Proactive graduation nudge (L3).
 *
 * When a student's skills have become automatic enough for number sentences —
 * AND the linear mode is currently off — offer a one-tap "Turn on number
 * sentences". Passive: it never blocks and disappears the moment linear is on.
 * "Not yet" vetoes the shown categories (reversible per-category via the 📝 chip
 * in the skill manager).
 *
 * Inert unless the `linear_readiness` flag is on — the hook returns no categories
 * otherwise, so this renders nothing.
 */

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

export function LinearGraduationBanner() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { studentId, partWeights, cyclePartWeight } = useStartPracticeModal()
  const { data } = useLinearReadiness(studentId)
  const { setVeto } = useLinearReadinessVeto(studentId)

  // Only nudge while linear is off — once it's scheduled there's nothing to offer.
  const linearOff = partWeights.linear === 0
  const ready = (data?.categories ?? []).filter((c) => !c.vetoed)

  if (!linearOff || ready.length === 0) return null

  const namesText = joinNames(ready.map((c) => c.name))

  const turnOn = () => cyclePartWeight('linear') // 0 → 1, enabling the linear part
  const notYet = () => {
    for (const c of ready) {
      setVeto.mutate({ category: c.category, reason: 'graduation-banner-not-yet' })
    }
  }

  return (
    <div
      data-component="linear-graduation-banner"
      data-element="linear-graduation-banner"
      className={css({
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        padding: '0.75rem 0.875rem',
        marginBottom: '0.75rem',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDark ? 'green.700' : 'green.300',
        bg: isDark ? 'green.900' : 'green.50',
      })}
    >
      <span aria-hidden className={css({ fontSize: '1.5rem', lineHeight: 1 })}>
        📝
      </span>
      <div className={css({ flex: 1, minWidth: 0 })}>
        <p
          className={css({
            fontSize: '0.9375rem',
            fontWeight: '600',
            marginBottom: '0.125rem',
            color: isDark ? 'green.200' : 'green.800',
          })}
        >
          Ready for number sentences
        </p>
        <p
          className={css({
            fontSize: '0.8125rem',
            marginBottom: '0.625rem',
            color: isDark ? 'green.100' : 'green.700',
          })}
        >
          <strong>{namesText}</strong>{' '}
          {ready.length === 1 ? 'is' : 'are'} automatic enough to practice as horizontal
          number sentences (e.g. <span className={css({ whiteSpace: 'nowrap' })}>45 + 27 = ?</span>).
        </p>
        <div className={css({ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' })}>
          <button
            type="button"
            data-action="turn-on-number-sentences"
            onClick={turnOn}
            className={css({
              padding: '0.4375rem 0.875rem',
              fontSize: '0.8125rem',
              fontWeight: '700',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'filter 0.15s ease',
              bg: isDark ? 'green.600' : 'green.600',
              _hover: { filter: 'brightness(1.05)' },
            })}
          >
            Turn on number sentences
          </button>
          <button
            type="button"
            data-action="graduation-not-yet"
            onClick={notYet}
            disabled={setVeto.isPending}
            className={css({
              padding: '0.4375rem 0.625rem',
              fontSize: '0.8125rem',
              fontWeight: '500',
              border: 'none',
              borderRadius: '8px',
              cursor: setVeto.isPending ? 'default' : 'pointer',
              opacity: setVeto.isPending ? 0.6 : 1,
              bg: 'transparent',
              color: isDark ? 'gray.400' : 'gray.500',
              _hover: { textDecoration: 'underline' },
            })}
          >
            Not yet
          </button>
        </div>
      </div>
    </div>
  )
}

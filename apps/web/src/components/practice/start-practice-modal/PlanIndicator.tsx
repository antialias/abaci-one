'use client'

import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { useEffectiveTier } from '@/hooks/useTier'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal } from '../StartPracticeModalContext'

const TIER_LABELS: Record<string, string> = {
  family: 'Family Plan',
  free: 'Free Plan',
  guest: 'Guest',
}

export function PlanIndicator() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { studentId } = useStartPracticeModal()
  const { tier, limits, providedBy, isLoading } = useEffectiveTier(studentId)

  if (isLoading) return null

  const label = TIER_LABELS[tier] ?? tier
  const isInherited = providedBy !== null

  // Family plan (own or inherited) — blue/green accent
  if (tier === 'family') {
    return (
      <div
        data-component="plan-indicator"
        data-tier={tier}
        data-inherited={isInherited}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.625rem',
          borderRadius: '8px',
          fontSize: '0.6875rem',
          fontWeight: '500',
          lineHeight: '1.2',
        })}
        style={{
          background: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.06)',
          border: `1px solid ${isDark ? 'rgba(96, 165, 250, 0.25)' : 'rgba(59, 130, 246, 0.15)'}`,
          color: isDark ? '#93c5fd' : '#2563eb',
        }}
      >
        {isInherited
          ? `Using ${providedBy.name}'s ${label}`
          : label}
      </div>
    )
  }

  // Free tier — subtle with upgrade CTA
  return (
    <div
      data-component="plan-indicator"
      data-tier={tier}
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.375rem',
        padding: '0.375rem 0.625rem',
        borderRadius: '8px',
        fontSize: '0.6875rem',
        fontWeight: '500',
        lineHeight: '1.2',
      })}
      style={{
        background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        color: isDark ? '#94a3b8' : '#64748b',
      }}
    >
      <span>
        {label}
        {tier === 'free' && limits.maxSessionMinutes && limits.maxSessionsPerWeek
          ? ` — ${limits.maxSessionMinutes} min max, ${limits.maxSessionsPerWeek}/week`
          : ''}
      </span>
      {tier !== 'guest' && (
        <Link
          href="/pricing"
          data-action="upgrade-plan"
          className={css({
            fontSize: '0.625rem',
            fontWeight: '600',
            textDecoration: 'none',
            _hover: { textDecoration: 'underline' },
          })}
          style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}
        >
          Upgrade
        </Link>
      )}
    </div>
  )
}

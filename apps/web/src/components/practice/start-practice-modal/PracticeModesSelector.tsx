'use client'

import { useMemo } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useLinearReadiness } from '@/hooks/useLinearReadiness'
import { PART_TYPES, useStartPracticeModal } from '../StartPracticeModalContext'
import { LinearGraduationBanner } from './LinearGraduationBanner'
import { LinearLockNote } from './LinearLockNote'
import { ProportionBar, type ProportionBarSegment } from './ProportionBar'

const GREEN_COLORS: ProportionBarSegment['colors'] = {
  lightBg: 'rgba(22, 163, 74, 0.08)',
  lightBgBoosted: 'rgba(22, 163, 74, 0.15)',
  darkBg: 'rgba(34, 197, 94, 0.15)',
  darkBgBoosted: 'rgba(34, 197, 94, 0.25)',
  lightAccent: '#16a34a',
  darkAccent: '#4ade80',
}

export function PracticeModesSelector() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const {
    studentId,
    partWeights,
    linearLocked,
    closeModal,
    cyclePartWeight,
    disablePart,
    problemsPerType,
    enabledPartCount,
  } = useStartPracticeModal()
  // Same query the context's lock decision came from (deduped by React Query);
  // read here only for the popover copy.
  const { data: readiness } = useLinearReadiness(studentId)

  const segments = useMemo<ProportionBarSegment[]>(
    () =>
      PART_TYPES.map(({ type, emoji, label }) => ({
        key: type,
        emoji,
        label,
        weight: partWeights[type],
        badgeContent: partWeights[type] > 0 ? problemsPerType[type] : undefined,
        colors: GREEN_COLORS,
        locked:
          type === 'linear' && linearLocked && readiness
            ? {
                ariaLabel: 'Linear locked — tap to see why',
                content: (
                  <LinearLockNote
                    state={readiness}
                    studentId={studentId}
                    isDark={isDark}
                    onNavigate={closeModal}
                  />
                ),
              }
            : undefined,
      })),
    [partWeights, problemsPerType, linearLocked, readiness, studentId, isDark, closeModal]
  )

  return (
    <>
      <LinearGraduationBanner />
      <ProportionBar
        label="Practice Modes"
        dataSetting="practice-modes"
        segments={segments}
        onCycleWeight={(key) => cyclePartWeight(key as keyof typeof partWeights)}
        onDisable={(key) => disablePart(key as keyof typeof partWeights)}
        enabledCount={enabledPartCount}
      />
    </>
  )
}

'use client'

import { useMemo } from 'react'
import { useStartPracticeModal, PART_TYPES } from '../StartPracticeModalContext'
import { ProportionBar, type ProportionBarSegment } from './ProportionBar'

/** All practice mode segments use green tones */
const GREEN_COLORS: ProportionBarSegment['colors'] = {
  lightBg: 'rgba(22, 163, 74, 0.08)',
  lightBgBoosted: 'rgba(22, 163, 74, 0.15)',
  darkBg: 'rgba(34, 197, 94, 0.15)',
  darkBgBoosted: 'rgba(34, 197, 94, 0.25)',
  lightAccent: '#16a34a',
  darkAccent: '#4ade80',
}

export function PracticeModesSelector() {
  const { partWeights, cyclePartWeight, disablePart, problemsPerType, enabledPartCount } =
    useStartPracticeModal()

  const segments = useMemo<ProportionBarSegment[]>(
    () =>
      PART_TYPES.map(({ type, emoji, label }) => ({
        key: type,
        emoji,
        label,
        weight: partWeights[type],
        badgeContent: partWeights[type] > 0 ? problemsPerType[type] : undefined,
        colors: GREEN_COLORS,
      })),
    [partWeights, problemsPerType]
  )

  return (
    <ProportionBar
      label="Practice Modes"
      dataSetting="practice-modes"
      segments={segments}
      onCycleWeight={(key) => cyclePartWeight(key as keyof typeof partWeights)}
      onDisable={(key) => disablePart(key as keyof typeof partWeights)}
      enabledCount={enabledPartCount}
    />
  )
}

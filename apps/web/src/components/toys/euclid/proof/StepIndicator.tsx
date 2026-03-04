'use client'

import { PROOF_COLORS, PROOF_FONTS } from './styles'

interface StepIndicatorProps {
  state: 'done' | 'current' | 'future'
  stepNumber: number
  isHovered: boolean
  onClick?: () => void
  size?: number
}

export function StepIndicator({
  state,
  stepNumber,
  isHovered,
  onClick,
  size = 20,
}: StepIndicatorProps) {
  const isDone = state === 'done'
  const isCurrent = state === 'current'

  const background = isDone
    ? isHovered
      ? PROOF_COLORS.stepDoneHover
      : PROOF_COLORS.stepDone
    : isCurrent
      ? PROOF_COLORS.stepCurrent
      : PROOF_COLORS.stepFuture

  const color = isDone || isCurrent ? '#fff' : PROOF_COLORS.stepFutureText

  const content = isDone ? (isHovered ? '\u21BA' : '\u2713') : stepNumber

  if (onClick) {
    return (
      <button
        data-action="rewind-to-step"
        onClick={onClick}
        title={`Rewind to step ${stepNumber}`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          marginTop: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size * 0.55),
          fontWeight: 700,
          fontFamily: PROOF_FONTS.sans,
          background,
          color,
          transition: 'all 0.15s ease',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        marginTop: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.55),
        fontWeight: 700,
        fontFamily: PROOF_FONTS.sans,
        background,
        color,
        transition: 'all 0.3s ease',
      }}
    >
      {content}
    </div>
  )
}

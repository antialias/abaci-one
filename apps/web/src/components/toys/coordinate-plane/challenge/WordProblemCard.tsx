'use client'

import { useState, type CSSProperties } from 'react'
import type { WordProblem, AnnotatedSpan, AnnotationTag } from '../wordProblems/types'
import type { ChallengePhase, CardPlacement } from './types'
import { KidNumberInput, useKidNumberInput, type FeedbackState } from '../../../ui/KidNumberInput'
import { useIsTouchDevice, useHasPhysicalKeyboard } from '../../../../hooks/useDeviceCapabilities'

/** Colors for annotation underlines, keyed by tag */
const TAG_COLORS: Partial<Record<AnnotationTag, string>> = {
  slope: '#f59e0b',     // amber
  intercept: '#3b82f6', // blue
  target: '#ef4444',    // red
  answer: '#10b981',    // emerald
  point1: '#8b5cf6',    // violet
  point2: '#ec4899',    // pink
  x_unit: '#6b7280',    // gray
  y_unit: '#6b7280',    // gray
}

/** Difficulty dots — like a password strength indicator */
function DifficultyDots({ level }: { level: number }) {
  return (
    <div
      data-element="difficulty-dots"
      style={{ display: 'flex', gap: 3, alignItems: 'center' }}
    >
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: i <= level ? 'rgba(245, 158, 11, 0.8)' : 'rgba(148, 163, 184, 0.3)',
          }}
        />
      ))}
    </div>
  )
}

interface WordProblemCardProps {
  problem: WordProblem
  phase: ChallengePhase
  placement: CardPlacement
  revealStep: number
  isDark: boolean
  onNewProblem: () => void
  onDismiss: () => void
  onAnswerCorrect?: () => void
}

export function WordProblemCard({
  problem,
  phase,
  placement,
  revealStep,
  isDark,
  onNewProblem,
  onDismiss,
  onAnswerCorrect,
}: WordProblemCardProps) {
  const isRevealing = phase === 'revealing' || phase === 'revealed'
  const isCelebrating = phase === 'celebrating'

  // Compute which tags are revealed so far
  const revealedTags = new Set<AnnotationTag>()
  if (isRevealing) {
    const annotatedSpans = problem.spans.filter(s => s.tag && s.tag !== 'context' && s.tag !== 'question')
    for (let i = 0; i < Math.min(revealStep, annotatedSpans.length); i++) {
      if (annotatedSpans[i].tag) revealedTags.add(annotatedSpans[i].tag!)
    }
  }

  // Slide-in animation
  const slideFrom = getSlideDirection(placement.position)
  const isVisible = phase !== 'auto-adjusting'

  const bgColor = isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)'
  const textColor = isDark ? '#e2e8f0' : '#1e293b'
  const borderColor = isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(203, 213, 225, 0.8)'
  const mutedColor = isDark ? 'rgba(148, 163, 184, 0.7)' : 'rgba(100, 116, 139, 0.7)'

  return (
    <div
      data-component="word-problem-card"
      style={{
        position: 'absolute',
        ...placement.style,
        maxWidth: 360,
        minWidth: 240,
        padding: '14px 16px',
        borderRadius: 12,
        background: bgColor,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${borderColor}`,
        color: textColor,
        fontSize: 14,
        lineHeight: 1.6,
        fontFamily: 'system-ui, sans-serif',
        zIndex: 50,
        boxShadow: isCelebrating
          ? `0 0 20px rgba(245, 158, 11, 0.4), 0 4px 16px rgba(0,0,0,0.2)`
          : '0 4px 16px rgba(0,0,0,0.15)',
        transform: isVisible ? 'translateY(0)' : `translateY(${slideFrom})`,
        opacity: isVisible ? 1 : 0,
        transition: 'transform 300ms ease-out, opacity 300ms ease-out, box-shadow 300ms ease',
        pointerEvents: 'auto',
      }}
    >
      {/* Header row */}
      <div
        data-element="card-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <DifficultyDots level={problem.difficulty} />
        <button
          data-action="dismiss-problem"
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: mutedColor,
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 2px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Problem text with annotations */}
      <div data-element="problem-text" style={{ marginBottom: 12 }}>
        {problem.spans.map((span, i) => (
          <AnnotatedTextSpan
            key={i}
            span={span}
            isRevealed={span.tag ? revealedTags.has(span.tag) : false}
            isRevealing={isRevealing}
            phase={phase}
          />
        ))}
      </div>

      {/* Axis labels */}
      <div
        data-element="axis-labels"
        style={{
          fontSize: 11,
          color: mutedColor,
          marginBottom: 10,
        }}
      >
        x-axis: {problem.axisLabels.x} · y-axis: {problem.axisLabels.y}
      </div>

      {/* Footer */}
      {(phase === 'revealed' || phase === 'idle') && (
        <button
          data-action="new-problem"
          onClick={onNewProblem}
          style={{
            background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
            border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
            color: isDark ? '#93c5fd' : '#2563eb',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          New Problem
        </button>
      )}

      {/* Solving phase hint */}
      {phase === 'solving' && (
        <div
          data-element="solving-hint"
          style={{ fontSize: 11, color: mutedColor, fontStyle: 'italic' }}
        >
          Position the ruler to match this equation
        </div>
      )}

      {/* Answering phase: ask for x count using KidNumberInput */}
      {phase === 'answering' && (
        <AnswerInput
          problem={problem}
          onCorrect={onAnswerCorrect}
        />
      )}
    </div>
  )
}

/** Sub-component for the answering phase — uses KidNumberInput with auto-validation */
function AnswerInput({
  problem,
  onCorrect,
}: {
  problem: WordProblem
  onCorrect?: () => void
}) {
  const [feedback, setFeedback] = useState<FeedbackState>('none')
  const isTouchDevice = useIsTouchDevice()
  const hasPhysicalKeyboard = useHasPhysicalKeyboard()
  const showKeypad = isTouchDevice && hasPhysicalKeyboard !== true

  const [answered, setAnswered] = useState(false)

  const { state, actions } = useKidNumberInput({
    correctAnswer: problem.answer.x,
    clearOnCorrect: false,
    onCorrect: () => {
      setFeedback('correct')
      setAnswered(true)
      setTimeout(() => onCorrect?.(), 1200)
    },
    onIncorrect: () => {
      setFeedback('incorrect')
      setTimeout(() => setFeedback('none'), 400)
    },
  })

  return (
    <div
      data-element="answer-input-section"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <div
        data-element="answer-prompt"
        style={{ fontSize: 13, fontWeight: 500, textAlign: 'center' }}
      >
        {problem.emoji} How many {problem.axisLabels.x}?
      </div>
      <KidNumberInput
        value={state.value}
        onDigit={actions.addDigit}
        onBackspace={actions.backspace}
        feedback={feedback}
        disabled={answered}
        showKeypad={showKeypad && !answered}
        keypadMode="inline"
        displaySize="sm"
      />
    </div>
  )
}

const HOVER_PHASES = new Set<ChallengePhase>(['presenting', 'solving', 'answering'])

function AnnotatedTextSpan({
  span,
  isRevealed,
  isRevealing,
  phase,
}: {
  span: AnnotatedSpan
  isRevealed: boolean
  isRevealing: boolean
  phase: ChallengePhase
}) {
  const [isHovered, setIsHovered] = useState(false)
  const color = span.tag ? TAG_COLORS[span.tag] : undefined
  const showUnderline = isRevealing && isRevealed && color
  const canHover = color && HOVER_PHASES.has(phase)
  const showHover = canHover && isHovered

  const style: CSSProperties = {
    borderBottom: showUnderline ? `2px solid ${color}` : showHover ? `2px solid ${color}` : undefined,
    paddingBottom: showUnderline || showHover ? 1 : undefined,
    transition: isHovered
      ? 'all 150ms ease-out'
      : 'all 400ms ease',
    ...(showHover && {
      backgroundColor: `${color}26`,
      borderRadius: 3,
      cursor: 'help',
    }),
  }

  return (
    <span
      style={style}
      onPointerEnter={canHover ? () => setIsHovered(true) : undefined}
      onPointerLeave={canHover ? () => setIsHovered(false) : undefined}
    >
      {span.text}
    </span>
  )
}

function getSlideDirection(position: CardPlacement['position']): string {
  switch (position) {
    case 'top-left':
    case 'top-right':
      return '-20px'
    case 'bottom-left':
    case 'bottom-right':
      return '20px'
  }
}

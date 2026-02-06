'use client'

import { css } from '../../../styled-system/css'

interface DebugOverlayProps {
  /** The correct answer for the current problem */
  correctAnswer: number
  /** Current part index (0-based) */
  partIndex: number
  /** Current slot index within the part */
  slotIndex: number
  /** Current part type */
  partType: string
  /** Slot purpose */
  purpose: string
  /** Submit the correct answer */
  onSubmitCorrect: () => void
  /** Submit a wrong answer */
  onSubmitWrong: () => void
}

/**
 * Floating debug panel shown when URL has ?debug=1
 * Provides quick submit buttons for automated testing
 */
export function DebugOverlay({
  correctAnswer,
  partIndex,
  slotIndex,
  partType,
  purpose,
  onSubmitCorrect,
  onSubmitWrong,
}: DebugOverlayProps) {
  return (
    <div
      data-component="debug-overlay"
      className={css({
        position: 'fixed',
        bottom: '80px',
        right: '16px',
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        borderRadius: '12px',
        padding: '12px 16px',
        fontSize: '13px',
        fontFamily: 'mono',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '200px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.15)',
      })}
    >
      {/* Header */}
      <div
        data-element="debug-header"
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          paddingBottom: '6px',
        })}
      >
        <span className={css({ fontWeight: 'bold', color: '#ff6b6b' })}>DEBUG</span>
        <span className={css({ color: 'rgba(255,255,255,0.6)', fontSize: '11px' })}>
          Part {partIndex + 1} / Slot {slotIndex + 1}
        </span>
      </div>

      {/* Problem info */}
      <div data-element="debug-info" className={css({ color: 'rgba(255,255,255,0.7)' })}>
        <div>
          Type: {partType} | {purpose}
        </div>
        <div data-element="debug-answer" className={css({ fontWeight: 'bold', color: '#4ade80' })}>
          Answer: {correctAnswer}
        </div>
      </div>

      {/* Action buttons */}
      <div data-element="debug-actions" className={css({ display: 'flex', gap: '8px' })}>
        <button
          data-action="debug-submit-correct"
          onClick={onSubmitCorrect}
          className={css({
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#22c55e',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
            _hover: { opacity: 0.85 },
          })}
        >
          Submit Correct
        </button>
        <button
          data-action="debug-submit-wrong"
          onClick={onSubmitWrong}
          className={css({
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#ef4444',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
            _hover: { opacity: 0.85 },
          })}
        >
          Submit Wrong
        </button>
      </div>
    </div>
  )
}

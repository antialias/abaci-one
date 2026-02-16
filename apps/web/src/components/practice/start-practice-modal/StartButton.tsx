'use client'

import { css } from '../../../../styled-system/css'
import { useStartPracticeModal } from '../StartPracticeModalContext'

interface StartButtonProps {
  /** Optional override for the start handler (used for tutorial flow) */
  onStart?: () => void
}

export function StartButton({ onStart }: StartButtonProps) {
  const { isStarting, handleStart, generationProgress, generationProgressMessage } =
    useStartPracticeModal()

  // Use provided onStart or fall back to context handleStart
  const handleClick = onStart ?? handleStart

  const showProgress = isStarting && generationProgress > 0 && generationProgress < 100

  return (
    <button
      type="button"
      data-action="start-practice"
      data-status={isStarting ? 'starting' : 'ready'}
      onClick={handleClick}
      disabled={isStarting}
      className={css({
        width: '100%',
        padding: '1rem',
        fontSize: '1.0625rem',
        fontWeight: 'bold',
        color: 'white',
        borderRadius: '12px',
        border: 'none',
        cursor: isStarting ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        _hover: {
          transform: isStarting ? 'none' : 'translateY(-1px)',
        },
        _active: {
          transform: 'translateY(0)',
        },
      })}
      style={{
        background: isStarting ? '#9ca3af' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        boxShadow: isStarting ? 'none' : '0 6px 20px rgba(34, 197, 94, 0.35)',
      }}
    >
      {/* Progress bar overlay */}
      {showProgress && (
        <span
          data-element="progress-bar"
          className={css({
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: '3px',
            transition: 'width 0.3s ease',
          })}
          style={{
            width: `${generationProgress}%`,
            background: 'rgba(255, 255, 255, 0.6)',
          }}
        />
      )}

      {isStarting ? (
        <span
          data-element="progress-text"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          })}
        >
          <span>{generationProgressMessage || 'Starting...'}</span>
        </span>
      ) : (
        <span
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          })}
        >
          <span>Let's Go!</span>
          <span>→</span>
        </span>
      )}
    </button>
  )
}

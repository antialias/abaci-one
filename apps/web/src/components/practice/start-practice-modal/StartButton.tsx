'use client'

import { css } from '../../../../styled-system/css'
import { useStartPracticeModal } from '../StartPracticeModalContext'

export function StartButton() {
  const { showTutorialGate, showRemediationCta, isStarting, handleStart } = useStartPracticeModal()

  // Only show when no special CTA is active
  if (showTutorialGate || showRemediationCta) {
    return null
  }

  return (
    <button
      type="button"
      data-action="start-practice"
      data-status={isStarting ? 'starting' : 'ready'}
      onClick={handleStart}
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
      {isStarting ? (
        'Starting...'
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

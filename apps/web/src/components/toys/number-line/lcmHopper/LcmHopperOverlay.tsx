/**
 * DOM overlay for the LCM Hopper experience.
 *
 * Shows:
 * - Guess prompt ("Tap where they all meet!")
 * - Celebration card with LCM result
 * - Guess feedback (correct, close, wrong)
 *
 * Driven by revealProgress from the constant demo framework.
 */

import type { GuessResult } from './lcmHopperState'
import type { ActiveCombo } from './lcmComboGenerator'
import { EARLY_HOP_END, GUESS_END, REVEAL_END } from './renderLcmHopperOverlay'

interface LcmHopperOverlayProps {
  /** 0-1 progress from the constant demo framework */
  progress: number
  combo: ActiveCombo | null
  guessResult: GuessResult
  guessPosition: number | null
  isDark: boolean
  onDismiss: () => void
}

export function LcmHopperOverlay({
  progress,
  combo,
  guessResult,
  guessPosition,
  isDark,
  onDismiss,
}: LcmHopperOverlayProps) {
  if (!combo) return null

  const showGuessPrompt = progress >= EARLY_HOP_END && progress < GUESS_END
  const showCelebration = progress >= REVEAL_END

  if (!showGuessPrompt && !showCelebration) return null

  const bg = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'
  const text = isDark ? '#e2e8f0' : '#1e293b'
  const accent = isDark ? '#fbbf24' : '#d97706'
  const border = isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(217, 119, 6, 0.3)'

  return (
    <>
      {/* Guess prompt */}
      {showGuessPrompt && (
        <div
          data-component="lcm-guess-prompt"
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 14,
            padding: '10px 24px',
            borderRadius: 20,
            background: bg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${border}`,
            color: accent,
            fontSize: '1rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          Tap where they all meet!
        </div>
      )}

      {/* Celebration card */}
      {showCelebration && (
        <button
          data-component="lcm-celebration-card"
          type="button"
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 14,
            padding: '16px 28px',
            borderRadius: 16,
            background: bg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${border}`,
            color: text,
            textAlign: 'center',
            maxWidth: 320,
            cursor: 'pointer',
            font: 'inherit',
          }}
          onClick={onDismiss}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: accent, marginBottom: 4 }}>
            {combo.emojis.join(' ')} meet at {combo.lcm}!
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            That&apos;s the Least Common Multiple of {combo.strides.join(', ')}.
          </div>
          {guessResult === 'correct' && guessPosition !== null && (
            <div
              style={{
                marginTop: 8,
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#22c55e',
              }}
            >
              You guessed {guessPosition} — you got it!
            </div>
          )}
          {guessResult === 'close' && guessPosition !== null && (
            <div style={{ marginTop: 8, fontSize: '0.9rem', opacity: 0.8 }}>
              You guessed {guessPosition} — so close!
            </div>
          )}
          {guessResult === 'wrong' && guessPosition !== null && (
            <div style={{ marginTop: 8, fontSize: '0.85rem', opacity: 0.6 }}>
              You guessed {guessPosition}. Next time!
            </div>
          )}
        </button>
      )}
    </>
  )
}

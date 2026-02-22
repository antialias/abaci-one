'use client'

import { css } from '../../../../styled-system/css'
import { useTypeRacerJr } from '../Provider'

export function ResultsPhase() {
  const { state, resetGame } = useTypeRacerJr()

  const wordsTyped = state.completedWords.length
  const totalMistakes = state.completedWords.reduce((sum, w) => sum + w.mistakeCount, 0)
  const totalLetters = state.completedWords.reduce((sum, w) => sum + w.word.length, 0)
  const accuracy =
    totalLetters > 0
      ? Math.round(((totalLetters - totalMistakes) / totalLetters) * 100)
      : 0

  const durationMs = state.gameStartTime ? Date.now() - state.gameStartTime : 0
  const durationSec = Math.floor(durationMs / 1000)
  const minutes = Math.floor(durationSec / 60)
  const seconds = durationSec % 60

  let headline: string
  let emoji: string
  if (accuracy >= 95 && wordsTyped >= 5) {
    headline = 'Perfect Typing!'
    emoji = '🏆'
  } else if (accuracy >= 80) {
    headline = 'Great Typing!'
    emoji = '🌟'
  } else if (wordsTyped >= 3) {
    headline = 'Nice Try!'
    emoji = '👍'
  } else {
    headline = 'Keep Practicing!'
    emoji = '💪'
  }

  return (
    <div
      data-component="ResultsPhase"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5',
        p: '6',
        maxWidth: '400px',
        mx: 'auto',
        width: '100%',
      })}
    >
      {/* Headline */}
      <div className={css({ textAlign: 'center' })}>
        <div className={css({ fontSize: '64px', mb: '2' })}>{emoji}</div>
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'gray.800',
          })}
        >
          {headline}
        </h2>
      </div>

      {/* Stats grid */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '3',
          width: '100%',
        })}
      >
        <StatCard icon="📝" label="Words" value={String(wordsTyped)} />
        <StatCard
          icon="⭐"
          label="Stars"
          value={String(state.totalStars)}
          highlight={state.totalStars >= wordsTyped * 2}
        />
        <StatCard
          icon="🎯"
          label="Accuracy"
          value={`${accuracy}%`}
          highlight={accuracy >= 90}
        />
        <StatCard
          icon="⏱️"
          label="Time"
          value={minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`}
        />
        {state.bestStreak > 1 && (
          <StatCard icon="🔥" label="Best Streak" value={String(state.bestStreak)} highlight />
        )}
      </div>

      {/* Word list */}
      {state.completedWords.length > 0 && (
        <div
          className={css({
            width: '100%',
            bg: 'gray.50',
            borderRadius: 'lg',
            p: '3',
          })}
        >
          <div className={css({ fontSize: 'xs', fontWeight: '600', color: 'gray.500', mb: '2' })}>
            Words typed
          </div>
          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
            {state.completedWords.map((w, i) => (
              <span
                key={i}
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1',
                  bg: 'white',
                  px: '2',
                  py: '1',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  border: '1px solid',
                  borderColor: 'gray.200',
                })}
              >
                {w.emoji} {w.word} {'⭐'.repeat(w.stars)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Play Again */}
      <button
        type="button"
        data-action="play-again"
        onClick={resetGame}
        className={css({
          width: '100%',
          py: '4',
          px: '6',
          fontSize: 'xl',
          fontWeight: 'bold',
          color: 'white',
          bg: 'blue.500',
          borderRadius: 'xl',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          minHeight: '56px',
          _hover: { bg: 'blue.600' },
          _active: { transform: 'scale(0.98)' },
        })}
      >
        Play Again!
      </button>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1',
        p: '3',
        bg: 'white',
        borderRadius: 'lg',
        border: '1px solid',
        borderColor: highlight ? 'yellow.300' : 'gray.200',
      })}
      style={
        highlight
          ? { backgroundColor: '#fefce8' }
          : undefined
      }
    >
      <span className={css({ fontSize: '20px' })}>{icon}</span>
      <span className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'gray.800' })}>
        {value}
      </span>
      <span className={css({ fontSize: 'xs', color: 'gray.500' })}>{label}</span>
    </div>
  )
}

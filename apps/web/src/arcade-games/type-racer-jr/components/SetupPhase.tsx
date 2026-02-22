'use client'

import { css } from '../../../../styled-system/css'
import { useTypeRacerJr } from '../Provider'

const DIFFICULTY_INFO = {
  level1: { label: 'Easy', desc: '2-3 letter words', emoji: '🐱' },
  level2: { label: 'Medium', desc: '4 letter words', emoji: '🐟' },
  level3: { label: 'Hard', desc: '5-6 letter words', emoji: '🤖' },
} as const

const WORD_COUNTS = [5, 8, 10] as const
const TIME_LIMITS = [60, 90, 120] as const

export function SetupPhase() {
  const { state, startGame, setConfig } = useTypeRacerJr()

  return (
    <div
      data-component="SetupPhase"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6',
        p: '6',
        maxWidth: '480px',
        mx: 'auto',
        width: '100%',
      })}
    >
      {/* Title */}
      <div className={css({ textAlign: 'center' })}>
        <div className={css({ fontSize: '48px', mb: '2' })}>⌨️</div>
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'gray.800',
          })}
        >
          Type Racer Jr.
        </h2>
        <p className={css({ color: 'gray.500', fontSize: 'sm', mt: '1' })}>
          Type words letter by letter!
        </p>
      </div>

      {/* Game Mode */}
      <div className={css({ width: '100%' })}>
        <label className={css({ fontSize: 'sm', fontWeight: '600', color: 'gray.600', mb: '2', display: 'block' })}>
          Game Mode
        </label>
        <div className={css({ display: 'flex', gap: '3' })}>
          <button
            type="button"
            data-action="select-mode-free-play"
            onClick={() => setConfig('gameMode', 'free-play')}
            className={css({
              flex: 1,
              p: '4',
              borderRadius: 'xl',
              border: '3px solid',
              fontSize: 'lg',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1',
            })}
            style={{
              borderColor: state.gameMode === 'free-play' ? '#22c55e' : '#d1d5db',
              backgroundColor: state.gameMode === 'free-play' ? '#f0fdf4' : 'white',
              color: state.gameMode === 'free-play' ? '#16a34a' : '#6b7280',
            }}
          >
            <span className={css({ fontSize: '24px' })}>🎯</span>
            <span>Free Play</span>
          </button>
          <button
            type="button"
            data-action="select-mode-beat-the-clock"
            onClick={() => setConfig('gameMode', 'beat-the-clock')}
            className={css({
              flex: 1,
              p: '4',
              borderRadius: 'xl',
              border: '3px solid',
              fontSize: 'lg',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              minHeight: '80px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1',
            })}
            style={{
              borderColor: state.gameMode === 'beat-the-clock' ? '#f97316' : '#d1d5db',
              backgroundColor: state.gameMode === 'beat-the-clock' ? '#fff7ed' : 'white',
              color: state.gameMode === 'beat-the-clock' ? '#ea580c' : '#6b7280',
            }}
          >
            <span className={css({ fontSize: '24px' })}>⏱️</span>
            <span>Beat the Clock</span>
          </button>
        </div>
      </div>

      {/* Word count (free-play) or Time limit (beat-the-clock) */}
      {state.gameMode === 'free-play' ? (
        <div className={css({ width: '100%' })}>
          <label className={css({ fontSize: 'sm', fontWeight: '600', color: 'gray.600', mb: '2', display: 'block' })}>
            How many words?
          </label>
          <div className={css({ display: 'flex', gap: '2', justifyContent: 'center' })}>
            {WORD_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                data-action={`select-word-count-${count}`}
                onClick={() => setConfig('wordCount', count)}
                className={css({
                  px: '5',
                  py: '3',
                  borderRadius: 'lg',
                  border: '2px solid',
                  fontSize: 'lg',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  minWidth: '64px',
                })}
                style={{
                  borderColor: state.wordCount === count ? '#3b82f6' : '#d1d5db',
                  backgroundColor: state.wordCount === count ? '#eff6ff' : 'white',
                  color: state.wordCount === count ? '#2563eb' : '#6b7280',
                }}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={css({ width: '100%' })}>
          <label className={css({ fontSize: 'sm', fontWeight: '600', color: 'gray.600', mb: '2', display: 'block' })}>
            Time limit
          </label>
          <div className={css({ display: 'flex', gap: '2', justifyContent: 'center' })}>
            {TIME_LIMITS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                data-action={`select-time-${seconds}`}
                onClick={() => setConfig('timeLimit', seconds)}
                className={css({
                  px: '4',
                  py: '3',
                  borderRadius: 'lg',
                  border: '2px solid',
                  fontSize: 'lg',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  minWidth: '72px',
                })}
                style={{
                  borderColor: state.timeLimit === seconds ? '#f97316' : '#d1d5db',
                  backgroundColor: state.timeLimit === seconds ? '#fff7ed' : 'white',
                  color: state.timeLimit === seconds ? '#ea580c' : '#6b7280',
                }}
              >
                {seconds}s
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Difficulty */}
      <div className={css({ width: '100%' })}>
        <label className={css({ fontSize: 'sm', fontWeight: '600', color: 'gray.600', mb: '2', display: 'block' })}>
          Starting difficulty
        </label>
        <div className={css({ display: 'flex', gap: '2' })}>
          {(Object.keys(DIFFICULTY_INFO) as Array<keyof typeof DIFFICULTY_INFO>).map((level) => {
            const info = DIFFICULTY_INFO[level]
            const isSelected = state.currentDifficulty === level
            return (
              <button
                key={level}
                type="button"
                data-action={`select-difficulty-${level}`}
                onClick={() => setConfig('startingDifficulty', level)}
                className={css({
                  flex: 1,
                  p: '3',
                  borderRadius: 'lg',
                  border: '2px solid',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1',
                })}
                style={{
                  borderColor: isSelected ? '#8b5cf6' : '#d1d5db',
                  backgroundColor: isSelected ? '#f5f3ff' : 'white',
                  color: isSelected ? '#7c3aed' : '#6b7280',
                }}
              >
                <span className={css({ fontSize: '24px' })}>{info.emoji}</span>
                <span className={css({ fontWeight: 'bold', fontSize: 'sm' })}>
                  {info.label}
                </span>
                <span className={css({ fontSize: 'xs', color: 'gray.500' })}>
                  {info.desc}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Start button */}
      <button
        type="button"
        data-action="start-game"
        onClick={startGame}
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
        Start Typing!
      </button>
    </div>
  )
}

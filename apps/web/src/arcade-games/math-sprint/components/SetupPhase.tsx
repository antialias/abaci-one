/**
 * Math Sprint - Setup Phase
 *
 * Configure game settings before starting.
 */

'use client'

import { css } from '../../../../styled-system/css'
import { useMathSprint } from '../Provider'
import type { Difficulty } from '../types'

export function SetupPhase() {
  const { state, startGame, setConfig } = useMathSprint()

  const handleDifficultyChange = (difficulty: Difficulty) => {
    setConfig('difficulty', difficulty)
  }

  const handleQuestionsChange = (questions: number) => {
    setConfig('questionsPerRound', questions)
  }

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '32px 20px',
      })}
    >
      {/* Game Title */}
      <div className={css({ textAlign: 'center' })}>
        <h1
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'purple.700',
            marginBottom: '8px',
          })}
        >
          🧮 Math Sprint
        </h1>
        <p className={css({ color: 'gray.600' })}>
          Race to solve math problems! First correct answer wins points.
        </p>
      </div>

      {/* Settings Card */}
      <div
        className={css({
          background: 'white',
          border: '1px solid',
          borderColor: 'gray.200',
          borderRadius: '12px',
          padding: '24px',
        })}
      >
        <h2
          className={css({
            fontSize: 'lg',
            fontWeight: 'semibold',
            marginBottom: '16px',
          })}
        >
          Game Settings
        </h2>

        {/* Difficulty */}
        <div className={css({ marginBottom: '20px' })}>
          <label
            className={css({
              display: 'block',
              fontSize: 'sm',
              fontWeight: 'medium',
              marginBottom: '8px',
            })}
          >
            Difficulty
          </label>
          <div className={css({ display: 'flex', gap: '8px' })}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
              <button
                key={diff}
                type="button"
                onClick={() => handleDifficultyChange(diff)}
                className={css({
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '2px solid',
                  borderColor: state.difficulty === diff ? 'purple.500' : 'gray.300',
                  background: state.difficulty === diff ? 'purple.50' : 'white',
                  color: state.difficulty === diff ? 'purple.700' : 'gray.700',
                  fontWeight: state.difficulty === diff ? 'semibold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    borderColor: 'purple.400',
                  },
                })}
              >
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </button>
            ))}
          </div>
          <p className={css({ fontSize: 'xs', color: 'gray.500', marginTop: '4px' })}>
            {state.difficulty === 'easy' && 'Numbers 1-10, simple operations'}
            {state.difficulty === 'medium' && 'Numbers 1-50, varied operations'}
            {state.difficulty === 'hard' && 'Numbers 1-100, harder calculations'}
          </p>
        </div>

        {/* Questions Per Round */}
        <div>
          <label
            className={css({
              display: 'block',
              fontSize: 'sm',
              fontWeight: 'medium',
              marginBottom: '8px',
            })}
          >
            Questions: {state.questionsPerRound}
          </label>
          <input
            type="range"
            min="5"
            max="20"
            step="5"
            value={state.questionsPerRound}
            onChange={(e) => handleQuestionsChange(Number(e.target.value))}
            className={css({
              width: '100%',
            })}
          />
          <div className={css({ display: 'flex', justifyContent: 'space-between', fontSize: 'xs' })}>
            <span>5</span>
            <span>10</span>
            <span>15</span>
            <span>20</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div
        className={css({
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
          border: '1px solid',
          borderColor: 'yellow.300',
          borderRadius: '12px',
          padding: '16px',
        })}
      >
        <h3 className={css({ fontSize: 'sm', fontWeight: 'semibold', marginBottom: '8px' })}>
          How to Play
        </h3>
        <ul className={css({ fontSize: 'sm', color: 'gray.700', paddingLeft: '20px' })}>
          <li>Solve math problems as fast as you can</li>
          <li>First correct answer earns 10 points</li>
          <li>Everyone can answer at the same time</li>
          <li>Most points wins!</li>
        </ul>
      </div>

      {/* Start Button */}
      <button
        type="button"
        onClick={startGame}
        disabled={state.activePlayers.length < 2}
        className={css({
          padding: '14px 28px',
          fontSize: 'lg',
          fontWeight: 'semibold',
          color: 'white',
          background: state.activePlayers.length < 2 ? 'gray.400' : 'purple.600',
          borderRadius: '12px',
          border: 'none',
          cursor: state.activePlayers.length < 2 ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          _hover: {
            background: state.activePlayers.length < 2 ? 'gray.400' : 'purple.700',
          },
        })}
      >
        {state.activePlayers.length < 2
          ? `Need ${2 - state.activePlayers.length} more player(s)`
          : 'Start Game'}
      </button>
    </div>
  )
}

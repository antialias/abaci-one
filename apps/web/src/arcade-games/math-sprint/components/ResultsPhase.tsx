/**
 * Math Sprint - Results Phase
 *
 * Show final scores and winner.
 */

'use client'

import { css } from '../../../../styled-system/css'
import { useMathSprint } from '../Provider'

export function ResultsPhase() {
  const { state, resetGame } = useMathSprint()

  // Sort players by score
  const sortedPlayers = Object.entries(state.scores)
    .map(([playerId, score]) => ({
      playerId,
      score,
      correct: state.correctAnswersCount[playerId] || 0,
      player: state.playerMetadata[playerId],
    }))
    .sort((a, b) => b.score - a.score)

  const winner = sortedPlayers[0]

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
      {/* Winner Announcement */}
      <div
        className={css({
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
          border: '2px solid',
          borderColor: 'yellow.400',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
        })}
      >
        <div className={css({ fontSize: '4xl', marginBottom: '12px' })}>🏆</div>
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'yellow.800',
            marginBottom: '8px',
          })}
        >
          {winner.player?.name} Wins!
        </h2>
        <div className={css({ fontSize: 'lg', color: 'yellow.700' })}>
          {winner.score} points • {winner.correct} correct
        </div>
      </div>

      {/* Final Scores */}
      <div
        className={css({
          background: 'white',
          border: '1px solid',
          borderColor: 'gray.200',
          borderRadius: '12px',
          padding: '24px',
        })}
      >
        <h3
          className={css({
            fontSize: 'lg',
            fontWeight: 'semibold',
            marginBottom: '16px',
          })}
        >
          Final Scores
        </h3>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
          {sortedPlayers.map((item, index) => (
            <div
              key={item.playerId}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                background: index === 0 ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'gray.50',
                border: '1px solid',
                borderColor: index === 0 ? 'yellow.300' : 'gray.200',
                borderRadius: '12px',
              })}
            >
              {/* Rank */}
              <div
                className={css({
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: index === 0 ? 'yellow.500' : 'gray.300',
                  color: index === 0 ? 'white' : 'gray.700',
                  borderRadius: '50%',
                  fontWeight: 'bold',
                  fontSize: 'sm',
                })}
              >
                {index + 1}
              </div>

              {/* Player Info */}
              <div className={css({ flex: 1 })}>
                <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
                  <span className={css({ fontSize: 'xl' })}>{item.player?.emoji}</span>
                  <span className={css({ fontSize: 'md', fontWeight: 'semibold' })}>
                    {item.player?.name}
                  </span>
                </div>
                <div className={css({ fontSize: 'xs', color: 'gray.600', marginTop: '2px' })}>
                  {item.correct} / {state.questions.length} correct
                </div>
              </div>

              {/* Score */}
              <div
                className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  color: index === 0 ? 'yellow.700' : 'purple.600',
                })}
              >
                {item.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div
        className={css({
          background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
          border: '1px solid',
          borderColor: 'purple.300',
          borderRadius: '12px',
          padding: '20px',
        })}
      >
        <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' })}>
          <div className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'purple.700' })}>
              {state.questions.length}
            </div>
            <div className={css({ fontSize: 'sm', color: 'purple.600' })}>Questions</div>
          </div>
          <div className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'purple.700' })}>
              {state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1)}
            </div>
            <div className={css({ fontSize: 'sm', color: 'purple.600' })}>Difficulty</div>
          </div>
        </div>
      </div>

      {/* Play Again Button */}
      <button
        type="button"
        onClick={resetGame}
        className={css({
          padding: '14px 28px',
          fontSize: 'lg',
          fontWeight: 'semibold',
          color: 'white',
          background: 'purple.600',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'background 0.2s',
          _hover: {
            background: 'purple.700',
          },
        })}
      >
        Play Again
      </button>
    </div>
  )
}

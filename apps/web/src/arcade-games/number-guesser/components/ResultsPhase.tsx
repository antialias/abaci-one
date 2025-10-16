/**
 * Results Phase - Shows winner and final scores
 */

'use client'

import { css } from '../../../../styled-system/css'
import { useNumberGuesser } from '../Provider'

export function ResultsPhase() {
  const { state, goToSetup } = useNumberGuesser()

  const winnerMetadata = state.winner ? state.playerMetadata[state.winner] : null
  const winnerScore = state.winner ? state.scores[state.winner] : 0

  // Sort players by score
  const sortedPlayers = [...state.activePlayers].sort((a, b) => {
    const scoreA = state.scores[a] || 0
    const scoreB = state.scores[b] || 0
    return scoreB - scoreA
  })

  return (
    <div
      className={css({
        padding: '32px',
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
      {/* Winner Celebration */}
      <div
        className={css({
          textAlign: 'center',
          marginBottom: '32px',
        })}
      >
        <div
          className={css({
            fontSize: '96px',
            marginBottom: '16px',
            animation: 'bounce 1s ease-in-out infinite',
          })}
        >
          {winnerMetadata?.emoji || '🏆'}
        </div>
        <h1
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #fb923c, #f97316)',
            backgroundClip: 'text',
            color: 'transparent',
          })}
        >
          {winnerMetadata?.name || 'Someone'} Wins!
        </h1>
        <p
          className={css({
            fontSize: 'xl',
            color: 'gray.600',
          })}
        >
          with {winnerScore} {winnerScore === 1 ? 'round' : 'rounds'} won
        </p>
      </div>

      {/* Final Standings */}
      <div
        className={css({
          background: 'white',
          border: '2px solid',
          borderColor: 'orange.200',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
        })}
      >
        <h3
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            marginBottom: '16px',
            textAlign: 'center',
          })}
        >
          Final Standings
        </h3>
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          })}
        >
          {sortedPlayers.map((playerId, index) => {
            const player = state.playerMetadata[playerId]
            const score = state.scores[playerId] || 0
            const isWinner = playerId === state.winner

            return (
              <div
                key={playerId}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: isWinner ? 'linear-gradient(135deg, #fed7aa, #fdba74)' : 'gray.100',
                  borderRadius: '8px',
                  border: isWinner ? '2px solid' : 'none',
                  borderColor: isWinner ? 'orange.300' : undefined,
                })}
              >
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  })}
                >
                  <span
                    className={css({
                      fontSize: '2xl',
                      fontWeight: 'bold',
                      color: 'gray.400',
                      width: '32px',
                      textAlign: 'center',
                    })}
                  >
                    {index + 1}
                  </span>
                  <span className={css({ fontSize: '32px' })}>{player?.emoji || '🎮'}</span>
                  <span className={css({ fontSize: 'lg', fontWeight: '600' })}>
                    {player?.name || 'Unknown'}
                  </span>
                </div>
                <div
                  className={css({
                    fontSize: '2xl',
                    fontWeight: 'bold',
                    color: isWinner ? 'orange.700' : 'gray.700',
                  })}
                >
                  {score} {isWinner && '🏆'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Game Stats */}
      <div
        className={css({
          background: 'white',
          border: '1px solid',
          borderColor: 'gray.200',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'center',
        })}
      >
        <h3
          className={css({
            fontSize: 'md',
            fontWeight: 'bold',
            marginBottom: '8px',
          })}
        >
          Game Stats
        </h3>
        <p className={css({ color: 'gray.600', fontSize: 'sm' })}>
          {state.roundNumber} {state.roundNumber === 1 ? 'round' : 'rounds'} played
        </p>
        <p className={css({ color: 'gray.600', fontSize: 'sm' })}>
          {state.guesses.length} {state.guesses.length === 1 ? 'guess' : 'guesses'} made
        </p>
      </div>

      {/* Actions */}
      <button
        type="button"
        onClick={goToSetup}
        className={css({
          width: '100%',
          padding: '16px',
          background: 'linear-gradient(135deg, #fb923c, #f97316)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: 'lg',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.2s',
          _hover: {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 16px rgba(249, 115, 22, 0.3)',
          },
        })}
      >
        Play Again
      </button>
    </div>
  )
}

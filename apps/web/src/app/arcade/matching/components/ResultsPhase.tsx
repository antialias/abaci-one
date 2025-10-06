'use client'

import { useRouter } from 'next/navigation'
import { useArcadeMemoryPairs } from '../context/ArcadeMemoryPairsContext'
import { useGameMode } from '../../../../contexts/GameModeContext'
import { useUserProfile } from '../../../../contexts/UserProfileContext'
import { formatGameTime, getMultiplayerWinner, getPerformanceAnalysis } from '../utils/gameScoring'
import { css } from '../../../../../styled-system/css'

export function ResultsPhase() {
  const router = useRouter()
  const { state, resetGame, activePlayers, gameMode } = useArcadeMemoryPairs()
  const { players: playerMap, activePlayers: activePlayerIds } = useGameMode()

  // Get active player data array
  const activePlayerData = Array.from(activePlayerIds)
    .map(id => playerMap.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((player) => ({
      ...player,
      displayName: player.name,
      displayEmoji: player.emoji
    }))

  const gameTime = state.gameEndTime && state.gameStartTime
    ? state.gameEndTime - state.gameStartTime
    : 0

  const analysis = getPerformanceAnalysis(state)
  const multiplayerResult = gameMode === 'multiplayer' ? getMultiplayerWinner(state, activePlayers) : null

  return (
    <div className={css({
      textAlign: 'center',
      padding: { base: '16px', md: '20px' },
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflow: 'auto'
    })}>

      {/* Celebration Header */}
      <div className={css({
        marginBottom: { base: '16px', md: '24px' }
      })}>
        <h2 className={css({
          fontSize: { base: '32px', md: '48px' },
          marginBottom: { base: '8px', md: '12px' },
          color: 'green.600',
          fontWeight: 'bold'
        })}>
          🎉 Game Complete! 🎉
        </h2>

        {gameMode === 'single' ? (
          <p className={css({
            fontSize: { base: '16px', md: '20px' },
            color: 'gray.700',
            marginBottom: { base: '12px', md: '16px' }
          })}>
            Congratulations!
          </p>
        ) : multiplayerResult && (
          <div className={css({ marginBottom: { base: '12px', md: '16px' } })}>
            {multiplayerResult.isTie ? (
              <p className={css({
                fontSize: { base: '18px', md: '24px' },
                color: 'purple.600',
                fontWeight: 'bold'
              })}>
                🤝 It's a tie!
              </p>
            ) : multiplayerResult.winners.length === 1 ? (
              <p className={css({
                fontSize: { base: '18px', md: '24px' },
                color: 'blue.600',
                fontWeight: 'bold'
              })}>
                🏆 {activePlayerData.find(p => p.id === multiplayerResult.winners[0])?.displayName || `Player ${multiplayerResult.winners[0]}`} Wins!
              </p>
            ) : (
              <p className={css({
                fontSize: { base: '18px', md: '24px' },
                color: 'purple.600',
                fontWeight: 'bold'
              })}>
                🏆 {multiplayerResult.winners.length} Champions!
              </p>
            )}
          </div>
        )}

        {/* Star Rating */}
        <div className={css({
          fontSize: { base: '24px', md: '32px' },
          marginBottom: { base: '8px', md: '12px' }
        })}>
          {'⭐'.repeat(analysis.starRating)}
          {'☆'.repeat(5 - analysis.starRating)}
        </div>

        <div className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: 'orange.600'
        })}>
          Grade: {analysis.grade}
        </div>
      </div>

      {/* Game Statistics */}
      <div className={css({
        display: 'grid',
        gridTemplateColumns: { base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
        gap: { base: '8px', md: '12px' },
        marginBottom: { base: '16px', md: '24px' },
        maxWidth: '800px',
        margin: '0 auto'
      })}>

        <div className={css({
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          padding: { base: '12px', md: '16px' },
          borderRadius: { base: '8px', md: '12px' },
          textAlign: 'center'
        })}>
          <div className={css({ fontSize: { base: '20px', md: '28px' }, fontWeight: 'bold' })}>
            {state.matchedPairs}
          </div>
          <div className={css({ fontSize: { base: '11px', md: '14px' }, opacity: 0.9 })}>
            Pairs
          </div>
        </div>

        <div className={css({
          background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
          color: 'white',
          padding: { base: '12px', md: '16px' },
          borderRadius: { base: '8px', md: '12px' },
          textAlign: 'center'
        })}>
          <div className={css({ fontSize: { base: '20px', md: '28px' }, fontWeight: 'bold' })}>
            {state.moves}
          </div>
          <div className={css({ fontSize: { base: '11px', md: '14px' }, opacity: 0.9 })}>
            Moves
          </div>
        </div>

        <div className={css({
          background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
          color: 'white',
          padding: { base: '12px', md: '16px' },
          borderRadius: { base: '8px', md: '12px' },
          textAlign: 'center'
        })}>
          <div className={css({ fontSize: { base: '20px', md: '28px' }, fontWeight: 'bold' })}>
            {formatGameTime(gameTime)}
          </div>
          <div className={css({ fontSize: { base: '11px', md: '14px' }, opacity: 0.9 })}>
            Time
          </div>
        </div>

        <div className={css({
          background: 'linear-gradient(135deg, #55a3ff, #003d82)',
          color: 'white',
          padding: { base: '12px', md: '16px' },
          borderRadius: { base: '8px', md: '12px' },
          textAlign: 'center'
        })}>
          <div className={css({ fontSize: { base: '20px', md: '28px' }, fontWeight: 'bold' })}>
            {Math.round(analysis.statistics.accuracy)}%
          </div>
          <div className={css({ fontSize: { base: '11px', md: '14px' }, opacity: 0.9 })}>
            Accuracy
          </div>
        </div>
      </div>

      {/* Multiplayer Scores */}
      {gameMode === 'multiplayer' && multiplayerResult && (
        <div className={css({
          display: 'flex',
          justifyContent: 'center',
          gap: { base: '12px', md: '16px' },
          marginBottom: { base: '16px', md: '24px' },
          flexWrap: 'wrap'
        })}>
          {activePlayerData.map((player) => {
            const score = multiplayerResult.scores[player.id] || 0
            const isWinner = multiplayerResult.winners.includes(player.id)

            return (
              <div key={player.id} className={css({
                background: isWinner
                  ? 'linear-gradient(135deg, #ffd700, #ff8c00)'
                  : 'linear-gradient(135deg, #c0c0c0, #808080)',
                color: 'white',
                padding: { base: '12px', md: '16px' },
                borderRadius: { base: '8px', md: '12px' },
                textAlign: 'center',
                minWidth: { base: '100px', md: '120px' }
              })}>
                <div className={css({ fontSize: { base: '32px', md: '40px' }, marginBottom: '4px' })}>
                  {player.displayEmoji}
                </div>
                <div className={css({ fontSize: { base: '11px', md: '12px' }, marginBottom: '2px', opacity: 0.9 })}>
                  {player.displayName}
                </div>
                <div className={css({ fontSize: { base: '24px', md: '32px' }, fontWeight: 'bold' })}>
                  {score}
                </div>
                {isWinner && (
                  <div className={css({ fontSize: { base: '18px', md: '20px' } })}>👑</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div className={css({
        display: 'flex',
        justifyContent: 'center',
        gap: { base: '12px', md: '16px' },
        flexWrap: 'wrap',
        marginTop: 'auto'
      })}>
        <button
          className={css({
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: { base: '12px 24px', md: '14px 28px' },
            fontSize: { base: '14px', md: '16px' },
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
            _hover: {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 16px rgba(102, 126, 234, 0.6)'
            }
          })}
          onClick={resetGame}
        >
          🎮 Play Again
        </button>

        <button
          className={css({
            background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: { base: '12px 24px', md: '14px 28px' },
            fontSize: { base: '14px', md: '16px' },
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(167, 139, 250, 0.4)',
            _hover: {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 16px rgba(167, 139, 250, 0.6)'
            }
          })}
          onClick={() => {
            console.log('🔄 ResultsPhase: Exiting session and navigating to arcade')
            exitSession()
            router.push('/arcade')
          }}
        >
          🏟️ Back to Arcade
        </button>
      </div>
    </div>
  )
}
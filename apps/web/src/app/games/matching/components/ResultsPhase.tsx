'use client'

import { useRouter } from 'next/navigation'
import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useGameMode } from '../../../../contexts/GameModeContext'
import { formatGameTime, getMultiplayerWinner, getPerformanceAnalysis } from '../utils/gameScoring'
import { css } from '../../../../../styled-system/css'

export function ResultsPhase() {
  const router = useRouter()
  const { state, resetGame, activePlayers } = useMemoryPairs()
  const { players } = useGameMode()

  // Get active player data
  const activePlayerData = players.filter(p => activePlayers.includes(p.id))

  const gameTime = state.gameEndTime && state.gameStartTime
    ? state.gameEndTime - state.gameStartTime
    : 0

  const analysis = getPerformanceAnalysis(state)
  const multiplayerResult = state.gameMode === 'multiplayer' ? getMultiplayerWinner(state, activePlayers) : null

  return (
    <div className={css({
      textAlign: 'center',
      padding: '40px 20px'
    })}>

      {/* Celebration Header */}
      <div className={css({
        marginBottom: '40px'
      })}>
        <h2 className={css({
          fontSize: '48px',
          marginBottom: '16px',
          color: 'green.600',
          fontWeight: 'bold'
        })}>
          🎉 Game Complete! 🎉
        </h2>

        {state.gameMode === 'single' ? (
          <p className={css({
            fontSize: '24px',
            color: 'gray.700',
            marginBottom: '20px'
          })}>
            Congratulations on completing the memory challenge!
          </p>
        ) : multiplayerResult && (
          <div className={css({ marginBottom: '20px' })}>
            {multiplayerResult.isTie ? (
              <p className={css({
                fontSize: '24px',
                color: 'purple.600',
                fontWeight: 'bold'
              })}>
                🤝 It's a tie! All champions are memory masters!
              </p>
            ) : multiplayerResult.winners.length === 1 ? (
              <p className={css({
                fontSize: '24px',
                color: 'blue.600',
                fontWeight: 'bold'
              })}>
                🏆 {activePlayerData.find(p => p.id === multiplayerResult.winners[0])?.name || `Player ${multiplayerResult.winners[0]}`} Wins!
              </p>
            ) : (
              <p className={css({
                fontSize: '24px',
                color: 'purple.600',
                fontWeight: 'bold'
              })}>
                🏆 {multiplayerResult.winners.length} Champions tied for victory!
              </p>
            )}
          </div>
        )}

        {/* Star Rating */}
        <div className={css({
          fontSize: '32px',
          marginBottom: '20px'
        })}>
          {'⭐'.repeat(analysis.starRating)}
          {'☆'.repeat(5 - analysis.starRating)}
        </div>

        <div className={css({
          fontSize: '24px',
          fontWeight: 'bold',
          color: 'orange.600'
        })}>
          Grade: {analysis.grade}
        </div>
      </div>

      {/* Game Statistics */}
      <div className={css({
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '40px',
        maxWidth: '800px',
        margin: '0 auto 40px auto'
      })}>

        <div className={css({
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          padding: '24px',
          borderRadius: '16px',
          textAlign: 'center'
        })}>
          <div className={css({ fontSize: '32px', fontWeight: 'bold' })}>
            {state.matchedPairs}
          </div>
          <div className={css({ fontSize: '16px', opacity: 0.9 })}>
            Pairs Matched
          </div>
        </div>

        <div className={css({
          background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
          color: 'white',
          padding: '24px',
          borderRadius: '16px',
          textAlign: 'center'
        })}>
          <div className={css({ fontSize: '32px', fontWeight: 'bold' })}>
            {state.moves}
          </div>
          <div className={css({ fontSize: '16px', opacity: 0.9 })}>
            Total Moves
          </div>
        </div>

        <div className={css({
          background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
          color: 'white',
          padding: '24px',
          borderRadius: '16px',
          textAlign: 'center'
        })}>
          <div className={css({ fontSize: '32px', fontWeight: 'bold' })}>
            {formatGameTime(gameTime)}
          </div>
          <div className={css({ fontSize: '16px', opacity: 0.9 })}>
            Game Time
          </div>
        </div>

        <div className={css({
          background: 'linear-gradient(135deg, #55a3ff, #003d82)',
          color: 'white',
          padding: '24px',
          borderRadius: '16px',
          textAlign: 'center'
        })}>
          <div className={css({ fontSize: '32px', fontWeight: 'bold' })}>
            {Math.round(analysis.statistics.accuracy)}%
          </div>
          <div className={css({ fontSize: '16px', opacity: 0.9 })}>
            Accuracy
          </div>
        </div>
      </div>

      {/* Multiplayer Scores */}
      {state.gameMode === 'multiplayer' && multiplayerResult && (
        <div className={css({
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          marginBottom: '40px',
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
                padding: '20px',
                borderRadius: '16px',
                textAlign: 'center',
                minWidth: '150px'
              })}>
                <div className={css({ fontSize: '48px', marginBottom: '8px' })}>
                  {player.emoji}
                </div>
                <div className={css({ fontSize: '14px', marginBottom: '4px', opacity: 0.9 })}>
                  {player.name}
                </div>
                <div className={css({ fontSize: '36px', fontWeight: 'bold' })}>
                  {score}
                </div>
                {isWinner && (
                  <div className={css({ fontSize: '24px' })}>👑</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Performance Analysis */}
      <div className={css({
        background: 'rgba(248, 250, 252, 0.8)',
        padding: '30px',
        borderRadius: '16px',
        marginBottom: '40px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        maxWidth: '600px',
        margin: '0 auto 40px auto'
      })}>
        <h3 className={css({
          fontSize: '24px',
          marginBottom: '20px',
          color: 'gray.800'
        })}>
          Performance Analysis
        </h3>

        {analysis.strengths.length > 0 && (
          <div className={css({ marginBottom: '20px' })}>
            <h4 className={css({
              fontSize: '18px',
              color: 'green.600',
              marginBottom: '8px'
            })}>
              ✅ Strengths:
            </h4>
            <ul className={css({
              textAlign: 'left',
              color: 'gray.700',
              lineHeight: '1.6'
            })}>
              {analysis.strengths.map((strength, index) => (
                <li key={index}>{strength}</li>
              ))}
            </ul>
          </div>
        )}

        {analysis.improvements.length > 0 && (
          <div>
            <h4 className={css({
              fontSize: '18px',
              color: 'orange.600',
              marginBottom: '8px'
            })}>
              💡 Areas for Improvement:
            </h4>
            <ul className={css({
              textAlign: 'left',
              color: 'gray.700',
              lineHeight: '1.6'
            })}>
              {analysis.improvements.map((improvement, index) => (
                <li key={index}>{improvement}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className={css({
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        flexWrap: 'wrap'
      })}>
        <button
          className={css({
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
            _hover: {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(102, 126, 234, 0.6)'
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
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 6px 20px rgba(167, 139, 250, 0.4)',
            _hover: {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(167, 139, 250, 0.6)'
            }
          })}
          onClick={() => {
            console.log('🔄 ResultsPhase: Navigating to games with Next.js router (no page reload)')
            router.push('/games')
          }}
        >
          🏠 Back to Games
        </button>
      </div>
    </div>
  )
}
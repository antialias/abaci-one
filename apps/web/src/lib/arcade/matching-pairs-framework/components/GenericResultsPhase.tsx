'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { css } from '../../../../../styled-system/css'
import { useGameMode } from '@/contexts/GameModeContext'
import { useRecordGameResult } from '@/hooks/useRecordGameResult'
import type { GameResult } from '@/lib/arcade/stats/types'
import type {
  BaseMatchingCard,
  BaseMatchingConfig,
  GameStatistics,
  MatchingPairsContextValue,
} from '../types'

// ============================================================================
// Scoring Utilities (generic — operate on base state fields)
// ============================================================================

/**
 * Format time duration for display
 */
export function formatGameTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${remainingSeconds}s`
}

/**
 * Calculate star rating (1-5 stars) based on performance
 */
function calculateStarRating(
  accuracy: number,
  efficiency: number,
  gameTime: number,
  difficulty: number
): number {
  const expectedTime = difficulty * 30000
  const timeScore = Math.max(0, Math.min(100, (expectedTime / gameTime) * 100))
  const overallScore = accuracy * 0.4 + efficiency * 0.4 + timeScore * 0.2

  if (overallScore >= 90) return 5
  if (overallScore >= 80) return 4
  if (overallScore >= 70) return 3
  if (overallScore >= 60) return 2
  return 1
}

/**
 * Get performance analysis from generic matching-pairs state fields
 */
export function getPerformanceAnalysis(state: {
  matchedPairs: number
  totalPairs: number
  moves: number
  difficulty: number
  gameStartTime: number | null
  gameEndTime: number | null
}): {
  statistics: GameStatistics
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F'
  starRating: number
} {
  const { matchedPairs, totalPairs, moves, difficulty, gameStartTime, gameEndTime } = state
  const gameTime = gameStartTime && gameEndTime ? gameEndTime - gameStartTime : 0

  const accuracy = moves > 0 ? (matchedPairs / moves) * 100 : 0
  const averageTimePerMove = moves > 0 ? gameTime / moves : 0
  const statistics: GameStatistics = {
    totalMoves: moves,
    matchedPairs,
    totalPairs,
    gameTime,
    accuracy,
    averageTimePerMove,
  }

  const idealMoves = totalPairs * 2
  const efficiency = (idealMoves / Math.max(moves, idealMoves)) * 100

  let grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' = 'F'
  if (accuracy >= 95 && efficiency >= 90) grade = 'A+'
  else if (accuracy >= 90 && efficiency >= 85) grade = 'A'
  else if (accuracy >= 85 && efficiency >= 80) grade = 'B+'
  else if (accuracy >= 80 && efficiency >= 75) grade = 'B'
  else if (accuracy >= 75 && efficiency >= 70) grade = 'C+'
  else if (accuracy >= 70 && efficiency >= 65) grade = 'C'
  else if (accuracy >= 60 && efficiency >= 50) grade = 'D'

  const starRating = calculateStarRating(accuracy, efficiency, gameTime, difficulty)

  return { statistics, grade, starRating }
}

/**
 * Get multiplayer winner info
 */
function getMultiplayerWinner(
  scores: Record<string, number>,
  activePlayers: string[]
): {
  winners: string[]
  winnerScore: number
  scores: Record<string, number>
  isTie: boolean
} {
  const maxScore = Math.max(...activePlayers.map((p) => scores[p] || 0))
  const winners = activePlayers.filter((p) => (scores[p] || 0) === maxScore)
  return { winners, winnerScore: maxScore, scores, isTie: winners.length > 1 }
}

// ============================================================================
// GenericResultsPhase
// ============================================================================

export interface GenericResultsPhaseProps<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
> {
  ctx: MatchingPairsContextValue<TCard, TConfig>
  gameName: string
}

export function GenericResultsPhase<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
>({ ctx, gameName }: GenericResultsPhaseProps<TCard, TConfig>) {
  const router = useRouter()
  const { state, resetGame, activePlayers, gameMode, exitSession } = ctx
  const { players: playerMap, activePlayers: activePlayerIds } = useGameMode()
  const { mutate: recordGameResult } = useRecordGameResult()

  const activePlayerData = Array.from(activePlayerIds)
    .map((id) => playerMap.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((player) => ({
      ...player,
      displayName: player.name,
      displayEmoji: player.emoji,
    }))

  const gameTime =
    state.gameEndTime && state.gameStartTime ? state.gameEndTime - state.gameStartTime : 0

  const analysis = getPerformanceAnalysis(state)
  const multiplayerResult =
    gameMode === 'multiplayer' ? getMultiplayerWinner(state.scores, activePlayers) : null

  // Record game stats when results are shown
  useEffect(() => {
    if (!state.gameEndTime || !state.gameStartTime) return

    const gameResult: GameResult = {
      gameType: gameName,
      playerResults: activePlayerData.map((player) => {
        const isWinner = gameMode === 'single' || multiplayerResult?.winners.includes(player.id)
        const score =
          gameMode === 'multiplayer'
            ? multiplayerResult?.scores[player.id] || 0
            : state.matchedPairs

        return {
          playerId: player.id,
          won: isWinner || false,
          score,
          accuracy: analysis.statistics.accuracy / 100,
          completionTime: gameTime,
          metrics: {
            moves: state.moves,
            matchedPairs: state.matchedPairs,
          },
        }
      }),
      completedAt: state.gameEndTime,
      duration: gameTime,
      metadata: {
        gameMode,
        starRating: analysis.starRating,
        grade: analysis.grade,
      },
    }

    recordGameResult(gameResult)
  }, []) // Only record once on mount

  return (
    <div
      className={css({
        textAlign: 'center',
        padding: { base: '16px', md: '20px' },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'auto',
      })}
    >
      {/* Celebration Header */}
      <div className={css({ marginBottom: { base: '16px', md: '24px' } })}>
        <h2
          className={css({
            fontSize: { base: '32px', md: '48px' },
            marginBottom: { base: '8px', md: '12px' },
            color: 'green.600',
            fontWeight: 'bold',
          })}
        >
          🎉 Game Complete! 🎉
        </h2>

        {gameMode === 'single' ? (
          <p
            className={css({
              fontSize: { base: '16px', md: '20px' },
              color: 'gray.700',
              marginBottom: { base: '12px', md: '16px' },
            })}
          >
            Congratulations!
          </p>
        ) : (
          multiplayerResult && (
            <div className={css({ marginBottom: { base: '12px', md: '16px' } })}>
              {multiplayerResult.isTie ? (
                <p
                  className={css({
                    fontSize: { base: '18px', md: '24px' },
                    color: 'purple.600',
                    fontWeight: 'bold',
                  })}
                >
                  🤝 It's a tie!
                </p>
              ) : multiplayerResult.winners.length === 1 ? (
                <p
                  className={css({
                    fontSize: { base: '18px', md: '24px' },
                    color: 'blue.600',
                    fontWeight: 'bold',
                  })}
                >
                  🏆{' '}
                  {activePlayerData.find((p) => p.id === multiplayerResult.winners[0])?.displayName ||
                    `Player ${multiplayerResult.winners[0]}`}{' '}
                  Wins!
                </p>
              ) : (
                <p
                  className={css({
                    fontSize: { base: '18px', md: '24px' },
                    color: 'purple.600',
                    fontWeight: 'bold',
                  })}
                >
                  🏆 {multiplayerResult.winners.length} Champions!
                </p>
              )}
            </div>
          )
        )}

        {/* Star Rating */}
        <div className={css({ fontSize: { base: '24px', md: '32px' }, marginBottom: { base: '8px', md: '12px' } })}>
          {'⭐'.repeat(analysis.starRating)}
          {'☆'.repeat(5 - analysis.starRating)}
        </div>

        <div
          className={css({
            fontSize: { base: '20px', md: '24px' },
            fontWeight: 'bold',
            color: 'orange.600',
          })}
        >
          Grade: {analysis.grade}
        </div>
      </div>

      {/* Game Statistics */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: { base: '8px', md: '12px' },
          marginBottom: { base: '16px', md: '24px' },
          maxWidth: '800px',
          margin: '0 auto',
        })}
      >
        {[
          { value: state.matchedPairs, label: 'Pairs', gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
          { value: state.moves, label: 'Moves', gradient: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' },
          { value: formatGameTime(gameTime), label: 'Time', gradient: 'linear-gradient(135deg, #ff6b6b, #ee5a24)' },
          { value: `${Math.round(analysis.statistics.accuracy)}%`, label: 'Accuracy', gradient: 'linear-gradient(135deg, #55a3ff, #003d82)' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={css({
              color: 'white',
              padding: { base: '12px', md: '16px' },
              borderRadius: { base: '8px', md: '12px' },
              textAlign: 'center',
            })}
            style={{ background: stat.gradient }}
          >
            <div className={css({ fontSize: { base: '20px', md: '28px' }, fontWeight: 'bold' })}>
              {stat.value}
            </div>
            <div className={css({ fontSize: { base: '11px', md: '14px' }, opacity: 0.9 })}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Multiplayer Scores */}
      {gameMode === 'multiplayer' && multiplayerResult && (
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
            gap: { base: '12px', md: '16px' },
            marginBottom: { base: '16px', md: '24px' },
            flexWrap: 'wrap',
          })}
        >
          {activePlayerData.map((player) => {
            const score = multiplayerResult.scores[player.id] || 0
            const isWinner = multiplayerResult.winners.includes(player.id)

            return (
              <div
                key={player.id}
                className={css({
                  color: 'white',
                  padding: { base: '12px', md: '16px' },
                  borderRadius: { base: '8px', md: '12px' },
                  textAlign: 'center',
                  minWidth: { base: '100px', md: '120px' },
                })}
                style={{
                  background: isWinner
                    ? 'linear-gradient(135deg, #ffd700, #ff8c00)'
                    : 'linear-gradient(135deg, #c0c0c0, #808080)',
                }}
              >
                <div className={css({ fontSize: { base: '32px', md: '40px' }, marginBottom: '4px' })}>
                  {player.displayEmoji}
                </div>
                <div className={css({ fontSize: { base: '11px', md: '12px' }, marginBottom: '2px', opacity: 0.9 })}>
                  {player.displayName}
                </div>
                <div className={css({ fontSize: { base: '24px', md: '32px' }, fontWeight: 'bold' })}>
                  {score}
                </div>
                {isWinner && <div className={css({ fontSize: { base: '18px', md: '20px' } })}>👑</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Action Buttons */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'center',
          gap: { base: '12px', md: '16px' },
          flexWrap: 'wrap',
          marginTop: 'auto',
        })}
      >
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
              boxShadow: '0 6px 16px rgba(102, 126, 234, 0.6)',
            },
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
              boxShadow: '0 6px 16px rgba(167, 139, 250, 0.6)',
            },
          })}
          onClick={() => {
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

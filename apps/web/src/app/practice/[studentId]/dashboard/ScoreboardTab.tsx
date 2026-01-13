'use client'

import { css } from '../../../../../styled-system/css'
import { usePlayerGameHistory, usePlayerClassroomRank } from '@/hooks/useGameResults'
import type { GameResult } from '@/db/schema'

// ============================================================================
// Types
// ============================================================================

interface ScoreboardTabProps {
  studentId: string
  classroomId: string | null | undefined
  isDark: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function formatRelativeTime(date: Date | number): string {
  const now = Date.now()
  const timestamp = typeof date === 'number' ? date : date.getTime()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

// ============================================================================
// Sub-Components
// ============================================================================

function PersonalBestsGrid({
  personalBests,
  isDark,
}: {
  personalBests:
    | Record<
        string,
        {
          bestScore: number
          gamesPlayed: number
          displayName: string
          icon: string | null
        }
      >
    | undefined
  isDark: boolean
}) {
  if (!personalBests || Object.keys(personalBests).length === 0) {
    return (
      <div
        data-element="empty-state"
        className={css({
          textAlign: 'center',
          padding: '2rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        No games played yet. Personal bests will appear here after playing games!
      </div>
    )
  }

  return (
    <div
      data-element="personal-bests-grid"
      className={css({
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '0.75rem',
      })}
    >
      {Object.entries(personalBests).map(([gameName, data]) => (
        <div
          key={gameName}
          data-game={gameName}
          className={css({
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            padding: '1rem',
            boxShadow: 'sm',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            })}
          >
            <span className={css({ fontSize: '1.25rem' })}>{data.icon ?? '🎮'}</span>
            <span
              className={css({
                fontWeight: 'semibold',
                fontSize: '0.875rem',
                color: isDark ? 'gray.200' : 'gray.700',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              })}
            >
              {data.displayName}
            </span>
          </div>
          <div
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'green.400' : 'green.600',
            })}
          >
            {Math.round(data.bestScore)}%
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            {data.gamesPlayed} game{data.gamesPlayed === 1 ? '' : 's'} played
          </div>
        </div>
      ))}
    </div>
  )
}

function RecentGamesTable({ games, isDark }: { games: GameResult[] | undefined; isDark: boolean }) {
  if (!games || games.length === 0) {
    return (
      <div
        data-element="empty-state"
        className={css({
          textAlign: 'center',
          padding: '2rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        No recent games. Play some games and they&apos;ll appear here!
      </div>
    )
  }

  return (
    <div
      data-element="recent-games-table"
      className={css({
        overflowX: 'auto',
      })}
    >
      <table
        className={css({
          width: '100%',
          borderCollapse: 'collapse',
          '& th, & td': {
            padding: '0.75rem',
            textAlign: 'left',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          },
          '& th': {
            fontWeight: 'semibold',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            color: isDark ? 'gray.400' : 'gray.500',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
          },
          '& td': {
            fontSize: '0.875rem',
            color: isDark ? 'gray.200' : 'gray.700',
          },
        })}
      >
        <thead>
          <tr>
            <th>Game</th>
            <th>Score</th>
            <th>Time</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id} data-game-id={game.id}>
              <td>
                <span
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  })}
                >
                  <span>{game.gameIcon ?? '🎮'}</span>
                  <span>{game.gameDisplayName}</span>
                </span>
              </td>
              <td>
                <span
                  className={css({
                    fontWeight: 'semibold',
                    color:
                      game.normalizedScore >= 80
                        ? isDark
                          ? 'green.400'
                          : 'green.600'
                        : game.normalizedScore >= 60
                          ? isDark
                            ? 'yellow.400'
                            : 'yellow.600'
                          : isDark
                            ? 'gray.400'
                            : 'gray.600',
                  })}
                >
                  {Math.round(game.normalizedScore)}%
                </span>
              </td>
              <td>{game.durationMs ? formatDuration(game.durationMs) : '-'}</td>
              <td>{formatRelativeTime(game.playedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LeaderboardTable({
  rankings,
  currentPlayerId,
  isDark,
}: {
  rankings: Array<{
    playerId: string
    playerName: string
    playerEmoji: string
    bestScore: number
    gamesPlayed: number
    avgScore: number
    rank: number
  }>
  currentPlayerId: string
  isDark: boolean
}) {
  if (rankings.length === 0) {
    return (
      <div
        data-element="empty-state"
        className={css({
          textAlign: 'center',
          padding: '2rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        No classmates have played games yet. Be the first!
      </div>
    )
  }

  return (
    <div
      data-element="leaderboard-table"
      className={css({
        overflowX: 'auto',
      })}
    >
      <table
        className={css({
          width: '100%',
          borderCollapse: 'collapse',
          '& th, & td': {
            padding: '0.75rem',
            textAlign: 'left',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          },
          '& th': {
            fontWeight: 'semibold',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            color: isDark ? 'gray.400' : 'gray.500',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
          },
          '& td': {
            fontSize: '0.875rem',
            color: isDark ? 'gray.200' : 'gray.700',
          },
        })}
      >
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Best Score</th>
            <th>Games</th>
            <th>Avg Score</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((player) => {
            const isCurrentPlayer = player.playerId === currentPlayerId
            return (
              <tr
                key={player.playerId}
                data-player-id={player.playerId}
                data-is-current={isCurrentPlayer}
                className={css({
                  backgroundColor: isCurrentPlayer
                    ? isDark
                      ? 'blue.900/30'
                      : 'blue.50'
                    : 'transparent',
                })}
              >
                <td>
                  <span
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '1.5rem',
                      height: '1.5rem',
                      borderRadius: 'full',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      backgroundColor:
                        player.rank === 1
                          ? 'yellow.400'
                          : player.rank === 2
                            ? 'gray.300'
                            : player.rank === 3
                              ? 'orange.400'
                              : isDark
                                ? 'gray.700'
                                : 'gray.200',
                      color:
                        player.rank <= 3
                          ? isDark
                            ? 'gray.900'
                            : 'gray.900'
                          : isDark
                            ? 'gray.300'
                            : 'gray.600',
                    })}
                  >
                    {player.rank}
                  </span>
                </td>
                <td>
                  <span
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    })}
                  >
                    <span>{player.playerEmoji}</span>
                    <span
                      className={css({
                        fontWeight: isCurrentPlayer ? 'bold' : 'normal',
                      })}
                    >
                      {player.playerName}
                      {isCurrentPlayer && (
                        <span
                          className={css({
                            marginLeft: '0.5rem',
                            fontSize: '0.75rem',
                            color: isDark ? 'blue.400' : 'blue.600',
                          })}
                        >
                          (You)
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td>
                  <span
                    className={css({
                      fontWeight: 'semibold',
                      color:
                        player.bestScore >= 80
                          ? isDark
                            ? 'green.400'
                            : 'green.600'
                          : player.bestScore >= 60
                            ? isDark
                              ? 'yellow.400'
                              : 'yellow.600'
                            : isDark
                              ? 'gray.400'
                              : 'gray.600',
                    })}
                  >
                    {Math.round(player.bestScore)}%
                  </span>
                </td>
                <td>{player.gamesPlayed}</td>
                <td>{Math.round(player.avgScore)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ScoreboardTab({ studentId, classroomId, isDark }: ScoreboardTabProps) {
  // Fetch player's game history
  const { data: historyData, isLoading: historyLoading } = usePlayerGameHistory(studentId)

  // Fetch classroom leaderboard
  const {
    rankings,
    playerRanking,
    totalPlayers,
    isLoading: leaderboardLoading,
  } = usePlayerClassroomRank(classroomId ?? null, studentId)

  return (
    <div
      data-component="scoreboard-tab"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      })}
    >
      {/* Personal Bests Section */}
      <section
        data-section="personal-bests"
        className={css({
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          borderRadius: '16px',
          padding: '1.25rem',
        })}
      >
        <h2
          className={css({
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          })}
        >
          <span>🏆</span>
          <span>Personal Bests</span>
        </h2>
        {historyLoading ? (
          <div
            className={css({
              textAlign: 'center',
              padding: '1rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Loading...
          </div>
        ) : (
          <PersonalBestsGrid personalBests={historyData?.personalBests} isDark={isDark} />
        )}
      </section>

      {/* Recent Games Section */}
      <section
        data-section="recent-games"
        className={css({
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          borderRadius: '16px',
          padding: '1.25rem',
        })}
      >
        <h2
          className={css({
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          })}
        >
          <span>🎮</span>
          <span>Recent Games</span>
        </h2>
        {historyLoading ? (
          <div
            className={css({
              textAlign: 'center',
              padding: '1rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Loading...
          </div>
        ) : (
          <RecentGamesTable games={historyData?.history?.slice(0, 10)} isDark={isDark} />
        )}
      </section>

      {/* Classroom Leaderboard Section */}
      {classroomId && (
        <section
          data-section="classroom-leaderboard"
          className={css({
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            borderRadius: '16px',
            padding: '1.25rem',
          })}
        >
          <h2
            className={css({
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span>📊</span>
            <span>Classroom Leaderboard</span>
          </h2>
          {playerRanking && (
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.500',
                marginBottom: '1rem',
              })}
            >
              You&apos;re ranked #{playerRanking.rank} of {totalPlayers} players
            </p>
          )}
          {leaderboardLoading ? (
            <div
              className={css({
                textAlign: 'center',
                padding: '1rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              Loading...
            </div>
          ) : (
            <LeaderboardTable rankings={rankings} currentPlayerId={studentId} isDark={isDark} />
          )}
        </section>
      )}

      {/* No Classroom Message */}
      {!classroomId && (
        <section
          data-section="no-classroom"
          className={css({
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            borderRadius: '16px',
            padding: '1.25rem',
            textAlign: 'center',
          })}
        >
          <p className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>
            Join a classroom to see how you rank against your classmates!
          </p>
        </section>
      )}
    </div>
  )
}

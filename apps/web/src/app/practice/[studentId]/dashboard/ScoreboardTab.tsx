'use client'

import { css } from '../../../../../styled-system/css'
import { usePlayerGameHistory, usePlayerClassroomRank } from '@/hooks/useGameResults'
import { usePlayerSkillMetrics, useClassroomSkillsLeaderboard } from '@/hooks/useSkillMetrics'
import type { GameResult } from '@/db/schema'
import type {
  StudentSkillMetrics,
  ClassroomSkillsLeaderboard,
  SkillCategory,
  Trend,
} from '@/lib/curriculum/skill-metrics'
import { SKILL_CATEGORY_INFO } from '@/lib/curriculum/skill-metrics'

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

function formatRelativeTime(date: Date | number | string): string {
  const now = Date.now()
  const timestamp =
    typeof date === 'number'
      ? date
      : typeof date === 'string'
        ? new Date(date).getTime()
        : date.getTime()
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
// Skills Progress Components
// ============================================================================

/**
 * Get trend arrow and color
 */
function getTrendDisplay(trend: Trend, isDark: boolean): { arrow: string; color: string } {
  switch (trend) {
    case 'improving':
      return { arrow: '↑', color: isDark ? 'green.400' : 'green.600' }
    case 'declining':
      return { arrow: '↓', color: isDark ? 'red.400' : 'red.600' }
    default:
      return { arrow: '→', color: isDark ? 'gray.400' : 'gray.500' }
  }
}

/**
 * Progress bar component for mastery visualization
 */
export function MasteryBar({
  value,
  label,
  detail,
  emoji,
  isDark,
}: {
  value: number
  label: string
  detail?: string
  emoji: string
  isDark: boolean
}) {
  const percent = Math.round(value * 100)
  const barColor =
    percent >= 80
      ? isDark
        ? 'green.500'
        : 'green.500'
      : percent >= 50
        ? isDark
          ? 'yellow.500'
          : 'yellow.500'
        : isDark
          ? 'blue.500'
          : 'blue.500'

  return (
    <div data-element="mastery-bar" className={css({ marginBottom: '0.5rem' })}>
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '0.25rem',
        })}
      >
        <span
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.200' : 'gray.700',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          })}
        >
          <span>{emoji}</span>
          <span>{label}</span>
        </span>
        <span
          className={css({
            fontSize: '0.875rem',
            fontWeight: 'semibold',
            color: isDark ? 'gray.200' : 'gray.700',
          })}
        >
          {percent}%
          {detail && (
            <span
              className={css({
                fontWeight: 'normal',
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.500',
                marginLeft: '0.25rem',
              })}
            >
              ({detail})
            </span>
          )}
        </span>
      </div>
      <div
        className={css({
          height: '8px',
          backgroundColor: isDark ? 'gray.700' : 'gray.200',
          borderRadius: 'full',
          overflow: 'hidden',
        })}
      >
        <div
          className={css({
            height: '100%',
            backgroundColor: barColor,
            borderRadius: 'full',
            transition: 'width 0.3s ease',
          })}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Skills Progress section showing individual student metrics
 */
export function SkillsProgressSection({
  metrics,
  isLoading,
  isDark,
}: {
  metrics: StudentSkillMetrics | undefined
  isLoading: boolean
  isDark: boolean
}) {
  if (isLoading) {
    return (
      <div
        className={css({
          textAlign: 'center',
          padding: '2rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        Loading skill metrics...
      </div>
    )
  }

  if (!metrics || metrics.progress.totalProblems === 0) {
    return (
      <div
        data-element="empty-state"
        className={css({
          textAlign: 'center',
          padding: '2rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        Complete some practice sessions to see your skill progress!
      </div>
    )
  }

  const timingTrend = getTrendDisplay(metrics.timing.trend, isDark)
  const accuracyTrend = getTrendDisplay(metrics.accuracy.trend, isDark)

  // Order categories by typical learning progression
  const categoryOrder: SkillCategory[] = [
    'basic',
    'fiveComplements',
    'tenComplements',
    'fiveComplementsSub',
    'tenComplementsSub',
    'advanced',
  ]

  return (
    <div
      data-element="skills-progress"
      className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}
    >
      {/* Overall Mastery */}
      <MasteryBar
        value={metrics.overallMastery}
        label="Overall Mastery"
        emoji="🎯"
        isDark={isDark}
      />

      {/* Category Breakdown */}
      <div>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: 'semibold',
            color: isDark ? 'gray.300' : 'gray.600',
            marginBottom: '0.5rem',
          })}
        >
          Skills by Category
        </h3>
        {categoryOrder.map((category) => {
          const categoryData = metrics.categoryMastery[category]
          if (categoryData.skillCount === 0) return null

          const info = SKILL_CATEGORY_INFO[category]
          const detail =
            categoryData.masteredCount > 0
              ? `${categoryData.masteredCount}/${categoryData.skillCount} mastered`
              : `${categoryData.practicedCount}/${categoryData.skillCount} practiced`

          return (
            <MasteryBar
              key={category}
              value={categoryData.pKnownAvg}
              label={info.shortName}
              detail={detail}
              emoji={info.emoji}
              isDark={isDark}
            />
          )
        })}
      </div>

      {/* Stats Row */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          marginTop: '0.5rem',
        })}
      >
        {/* Speed */}
        <div
          className={css({
            backgroundColor: isDark ? 'gray.700' : 'white',
            padding: '0.75rem',
            borderRadius: '8px',
            textAlign: 'center',
          })}
        >
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
              marginBottom: '0.25rem',
            })}
          >
            Speed
          </div>
          <div
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            {metrics.timing.avgSecondsPerTerm !== null
              ? `${metrics.timing.avgSecondsPerTerm.toFixed(1)}s/term`
              : '-'}
            <span className={css({ marginLeft: '0.25rem', color: timingTrend.color })}>
              {timingTrend.arrow}
            </span>
          </div>
        </div>

        {/* Accuracy */}
        <div
          className={css({
            backgroundColor: isDark ? 'gray.700' : 'white',
            padding: '0.75rem',
            borderRadius: '8px',
            textAlign: 'center',
          })}
        >
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
              marginBottom: '0.25rem',
            })}
          >
            Accuracy
          </div>
          <div
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            {Math.round(metrics.accuracy.recentPercent)}%
            <span className={css({ marginLeft: '0.25rem', color: accuracyTrend.color })}>
              {accuracyTrend.arrow}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Stats */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-around',
          padding: '0.75rem',
          backgroundColor: isDark ? 'gray.700' : 'white',
          borderRadius: '8px',
        })}
      >
        <div className={css({ textAlign: 'center' })}>
          <div
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            {metrics.progress.weeklyProblems}
          </div>
          <div className={css({ fontSize: '0.75rem', color: isDark ? 'gray.400' : 'gray.500' })}>
            This Week
          </div>
        </div>
        <div className={css({ textAlign: 'center' })}>
          <div
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            {metrics.progress.practiceStreak}
          </div>
          <div className={css({ fontSize: '0.75rem', color: isDark ? 'gray.400' : 'gray.500' })}>
            Day Streak
          </div>
        </div>
        <div className={css({ textAlign: 'center' })}>
          <div
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            {metrics.progress.totalProblems}
          </div>
          <div className={css({ fontSize: '0.75rem', color: isDark ? 'gray.400' : 'gray.500' })}>
            Total
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Skills Leaderboard Components
// ============================================================================

/**
 * Skills leaderboard section for classroom comparison
 */
export function SkillsLeaderboardSection({
  leaderboard,
  isLoading,
  currentPlayerId,
  isDark,
}: {
  leaderboard: ClassroomSkillsLeaderboard | undefined
  isLoading: boolean
  currentPlayerId: string
  isDark: boolean
}) {
  if (isLoading) {
    return (
      <div
        className={css({
          textAlign: 'center',
          padding: '2rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        Loading skills leaderboard...
      </div>
    )
  }

  if (!leaderboard || leaderboard.playerCount === 0) {
    return (
      <div
        data-element="empty-state"
        className={css({
          textAlign: 'center',
          padding: '2rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        No classmates have practiced yet. Be the first!
      </div>
    )
  }

  // Helper to render a ranking section
  const renderRanking = (
    title: string,
    emoji: string,
    rankings: ClassroomSkillsLeaderboard['byWeeklyProblems'],
    formatValue: (v: number) => string
  ) => {
    if (rankings.length === 0) return null

    const currentPlayerRank = rankings.find((r) => r.playerId === currentPlayerId)

    return (
      <div
        className={css({
          backgroundColor: isDark ? 'gray.700' : 'white',
          borderRadius: '8px',
          padding: '0.75rem',
        })}
      >
        <h4
          className={css({
            fontSize: '0.875rem',
            fontWeight: 'semibold',
            color: isDark ? 'gray.200' : 'gray.700',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          })}
        >
          <span>{emoji}</span>
          <span>{title}</span>
        </h4>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.25rem' })}>
          {rankings.slice(0, 3).map((player) => {
            const isCurrentPlayer = player.playerId === currentPlayerId
            return (
              <div
                key={player.playerId}
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: isCurrentPlayer
                    ? isDark
                      ? 'blue.900/50'
                      : 'blue.50'
                    : 'transparent',
                })}
              >
                <span
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.200' : 'gray.700',
                    fontWeight: isCurrentPlayer ? 'bold' : 'normal',
                  })}
                >
                  {player.rank}. {player.playerEmoji} {player.playerName}
                </span>
                <span
                  className={css({
                    fontSize: '0.875rem',
                    fontWeight: 'semibold',
                    color: isDark ? 'green.400' : 'green.600',
                  })}
                >
                  {formatValue(player.value)}
                </span>
              </div>
            )
          })}
          {currentPlayerRank && currentPlayerRank.rank > 3 && (
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: isDark ? 'blue.900/50' : 'blue.50',
                marginTop: '0.25rem',
                borderTop: '1px dashed',
                borderColor: isDark ? 'gray.600' : 'gray.300',
              })}
            >
              <span
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? 'gray.200' : 'gray.700',
                  fontWeight: 'bold',
                })}
              >
                {currentPlayerRank.rank}. {currentPlayerRank.playerEmoji} You
              </span>
              <span
                className={css({
                  fontSize: '0.875rem',
                  fontWeight: 'semibold',
                  color: isDark ? 'green.400' : 'green.600',
                })}
              >
                {formatValue(currentPlayerRank.value)}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      data-element="skills-leaderboard"
      className={css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' })}
    >
      {/* Effort-based rankings */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        })}
      >
        {renderRanking(
          'Practice Warriors',
          '⚔️',
          leaderboard.byWeeklyProblems,
          (v) => `${v} this week`
        )}
        {renderRanking('Streak Masters', '🔥', leaderboard.byPracticeStreak, (v) => `${v} days`)}
        {renderRanking(
          'Rising Stars',
          '⭐',
          leaderboard.byImprovementRate,
          (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
        )}
      </div>

      {/* Speed Champions */}
      {leaderboard.speedChampions.length > 0 && (
        <div>
          <h4
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'semibold',
              color: isDark ? 'gray.300' : 'gray.600',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            })}
          >
            <span>🏎️</span>
            <span>Speed Champions</span>
            <span
              className={css({
                fontWeight: 'normal',
                fontSize: '0.75rem',
                color: isDark ? 'gray.500' : 'gray.400',
              })}
            >
              (mastered skills only)
            </span>
          </h4>
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
            })}
          >
            {leaderboard.speedChampions.slice(0, 4).map((champion) => (
              <div
                key={champion.category}
                className={css({
                  backgroundColor: isDark ? 'gray.700' : 'white',
                  borderRadius: '8px',
                  padding: '0.75rem',
                })}
              >
                <h5
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 'semibold',
                    color: isDark ? 'gray.300' : 'gray.600',
                    marginBottom: '0.5rem',
                  })}
                >
                  {SKILL_CATEGORY_INFO[champion.category as SkillCategory]?.emoji ?? '📊'}{' '}
                  {champion.categoryName}
                </h5>
                {champion.leaders.slice(0, 3).map((player) => {
                  const isCurrentPlayer = player.playerId === currentPlayerId
                  return (
                    <div
                      key={player.playerId}
                      className={css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.875rem',
                        padding: '0.125rem 0',
                        fontWeight: isCurrentPlayer ? 'bold' : 'normal',
                        color: isDark ? 'gray.200' : 'gray.700',
                      })}
                    >
                      <span>
                        {player.rank}. {player.playerEmoji} {player.playerName}
                      </span>
                      <span className={css({ color: isDark ? 'cyan.400' : 'cyan.600' })}>
                        {player.value.toFixed(1)}s
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ScoreboardTab({ studentId, classroomId, isDark }: ScoreboardTabProps) {
  // Fetch player's game history
  const { data: historyData, isLoading: historyLoading } = usePlayerGameHistory(studentId)

  // Fetch classroom leaderboard (game-based)
  const {
    rankings,
    playerRanking,
    totalPlayers,
    isLoading: leaderboardLoading,
  } = usePlayerClassroomRank(classroomId ?? null, studentId)

  // Fetch player's skill metrics
  const { data: skillMetrics, isLoading: skillsLoading } = usePlayerSkillMetrics(studentId)

  // Fetch classroom skills leaderboard
  const { data: skillsLeaderboard, isLoading: skillsLeaderboardLoading } =
    useClassroomSkillsLeaderboard(classroomId ?? null)

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

      {/* Skills Progress Section */}
      <section
        data-section="skills-progress"
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
          <span>📈</span>
          <span>Skills Progress</span>
        </h2>
        <SkillsProgressSection metrics={skillMetrics} isLoading={skillsLoading} isDark={isDark} />
      </section>

      {/* Skills Leaderboard Section */}
      {classroomId && (
        <section
          data-section="skills-leaderboard"
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
            <span>🏅</span>
            <span>Classroom Achievements</span>
          </h2>
          <SkillsLeaderboardSection
            leaderboard={skillsLeaderboard}
            isLoading={skillsLeaderboardLoading}
            currentPlayerId={studentId}
            isDark={isDark}
          />
        </section>
      )}

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

import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { getPlayer } from '@/lib/arcade/player-manager'
import { getRecentSessionResults } from '@/lib/curriculum/session-planner'
import { getPlayerCurriculum } from '@/lib/curriculum/progress-manager'
import { computeBktFromHistory } from '@/lib/curriculum/bkt/compute-bkt'
import { getPhaseDisplayInfo } from '@/lib/curriculum/definitions'
import { getSkillDisplayName } from '@/lib/curriculum/skill-tutorial-config'
import type { ChildProfile, SkillSnapshot, GameSnapshot } from './childProfile'
import type { GameStatsBreakdown } from '@/db/schema/player-stats'
import { getAgeFromBirthday } from '@/lib/playerAge'

/** Static map — avoids importing game manifests which pull in React. */
const GAME_DISPLAY_NAMES: Record<string, string> = {
  matching: 'Matching Pairs',
  'complement-race': 'Complement Race',
  'card-sorting': 'Card Sorting',
  'memory-quiz': 'Memory Quiz',
  rithmomachia: 'Rithmomachia',
  'know-your-world': 'Know Your World',
}

function getGameDisplayName(gameType: string): string {
  return GAME_DISPLAY_NAMES[gameType] ?? gameType
}

function formatRecency(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return 'about a week ago'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return 'a while ago'
}

function toSkillSnapshot(skill: {
  skillId: string
  masteryClassification: 'strong' | 'developing' | 'weak'
}): SkillSnapshot {
  return {
    displayName: getSkillDisplayName(skill.skillId),
    mastery: skill.masteryClassification,
  }
}

/**
 * Assemble an ephemeral child profile from DB data.
 *
 * Runs parallel queries (~25ms) + sync BKT computation (~5-10ms).
 * Total budget: <100ms (runs during ring time).
 *
 * Returns:
 * - `ChildProfile` on success
 * - `{ failed: true }` if playerId was provided but assembly failed
 * - `undefined` if no playerId was provided (handled by caller)
 */
export async function assembleChildProfile(
  playerId: string
): Promise<ChildProfile | { failed: true }> {
  try {
    const [player, results, curriculum, stats] = await Promise.all([
      getPlayer(playerId),
      getRecentSessionResults(playerId, 50),
      getPlayerCurriculum(playerId),
      db.query.playerStats.findFirst({
        where: eq(schema.playerStats.playerId, playerId),
      }),
    ])

    if (!player) {
      console.warn('[assembleChildProfile] player not found: %s', playerId)
      return { failed: true }
    }

    const profile: ChildProfile = {
      name: player.name,
      age: getAgeFromBirthday(player.birthday) ?? undefined,
      emoji: player.emoji || undefined,
    }

    // Curriculum position
    if (curriculum?.currentPhaseId) {
      const phaseInfo = getPhaseDisplayInfo(curriculum.currentPhaseId)
      profile.currentFocus = phaseInfo.phaseName
    }

    // BKT skill analysis
    if (results.length > 0) {
      const bkt = computeBktFromHistory(results)

      profile.strengths = bkt.strengths.slice(0, 3).map(toSkillSnapshot)
      profile.struggles = bkt.interventionNeeded.slice(0, 3).map(toSkillSnapshot)
      profile.developing = bkt.skills
        .filter((s) => s.masteryClassification === 'developing')
        .slice(0, 3)
        .map(toSkillSnapshot)

      // Count unique sessions
      const sessionIds = new Set(results.map((r) => r.sessionId))
      profile.totalSessions = sessionIds.size

      // Last practiced
      profile.lastPracticed = formatRecency(new Date(results[0].timestamp))
    }

    // Game stats
    if (stats) {
      profile.gamesPlayed = stats.gamesPlayed
      profile.totalWins = stats.totalWins

      if (stats.favoriteGameType) {
        profile.favoriteGame = getGameDisplayName(stats.favoriteGameType)
      }

      // Build game highlights from per-game breakdown
      const gameStats = stats.gameStats as Record<string, GameStatsBreakdown> | null
      if (gameStats && typeof gameStats === 'object') {
        const highlights: GameSnapshot[] = Object.entries(gameStats)
          .filter(([, gs]) => gs.gamesPlayed > 0)
          .sort((a, b) => b[1].gamesPlayed - a[1].gamesPlayed)
          .slice(0, 3)
          .map(([gameType, gs]) => ({
            displayName: getGameDisplayName(gameType),
            gamesPlayed: gs.gamesPlayed,
            wins: gs.wins,
            highestAccuracy: gs.highestAccuracy,
          }))

        if (highlights.length > 0) {
          profile.gameHighlights = highlights
        }
      }
    }

    return profile
  } catch (err) {
    console.error('[assembleChildProfile] failed for player %s:', playerId, err)
    return { failed: true }
  }
}

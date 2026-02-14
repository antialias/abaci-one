export interface SkillSnapshot {
  displayName: string // e.g. "+4 = +5 - 1"
  mastery: 'strong' | 'developing' | 'weak'
}

export interface GameSnapshot {
  displayName: string // e.g. "Matching Pairs"
  gamesPlayed: number
  wins: number
  highestAccuracy: number // 0-1
}

export interface ChildProfile {
  name: string
  age?: number
  emoji?: string
  // Practice / curriculum
  currentFocus?: string // e.g. "Five Complements (Addition)"
  strengths?: SkillSnapshot[] // top 3 strong skills
  struggles?: SkillSnapshot[] // top 3 weak skills
  developing?: SkillSnapshot[] // top 3 in-progress skills
  totalSessions?: number
  lastPracticed?: string // "today", "yesterday", "3 days ago", etc.
  // Arcade games
  gamesPlayed?: number // total across all game types
  favoriteGame?: string // display name of most-played game
  gameHighlights?: GameSnapshot[] // top 2-3 games with stats
  totalWins?: number
}

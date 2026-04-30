import { SESSION_SONG_GENRES } from '@/db/schema/player-session-preferences'
import { SeededRandom } from '@/lib/SeededRandom'
import type { SongPromptInput } from './extract-session-stats'

export type SongConceptId =
  | 'comeback-case-file'
  | 'strategy-toolbox'
  | 'streak-parade'
  | 'boss-level-replay'
  | 'slow-burn-lab'
  | 'skill-terrain-tour'
  | 'side-quest-arcade'
  | 'steady-build'

export interface SongConcept {
  id: SongConceptId
  title: string
  lens: string
  fitReason: string
  hookSeeds: string[]
  requiredDetails: string[]
  recommendedGenres: string[]
  gameBreakInterludeStyle?: string
  avoid: string[]
}

export interface SongConceptSelectionContext {
  seed: string
  recentConceptIds?: string[]
  recentGenreTags?: string[]
  genrePreference?: string
}

interface ConceptTemplate {
  id: SongConceptId
  title: string
  lens: string
  recommendedGenres: string[]
  gameBreakInterludeStyle?: string
}

interface ConceptCandidate {
  template: ConceptTemplate
  score: number
  reasons: string[]
  hookSeeds: string[]
  requiredDetails: string[]
}

const CONCEPTS: Record<SongConceptId, ConceptTemplate> = {
  'comeback-case-file': {
    id: 'comeback-case-file',
    title: 'Comeback Case File',
    lens: 'a detective replay that follows the clue trail from wrong turns to the solved problem',
    recommendedGenres: ['electro-swing', 'jazz', 'hip-hop', 'funk'],
  },
  'strategy-toolbox': {
    id: 'strategy-toolbox',
    title: 'Strategy Toolbox',
    lens: 'a workshop song about choosing the right tool instead of getting stuck',
    recommendedGenres: ['folk', 'country', 'bossa-nova', 'pop'],
  },
  'streak-parade': {
    id: 'streak-parade',
    title: 'Streak Parade',
    lens: 'a marching celebration where each correct answer becomes another step in the line',
    recommendedGenres: ['marching-band', 'funk', 'disco', 'pop'],
  },
  'boss-level-replay': {
    id: 'boss-level-replay',
    title: 'Boss Level Replay',
    lens: 'an arcade announcer replaying the hardest problem like a level boss',
    recommendedGenres: ['chiptune', 'rock', 'edm', 'hip-hop'],
  },
  'slow-burn-lab': {
    id: 'slow-burn-lab',
    title: 'Slow Burn Lab',
    lens: 'a lab experiment where patience, careful checks, and one tricky equation finally react',
    recommendedGenres: ['bossa-nova', 'jazz', 'edm', 'reggae'],
  },
  'skill-terrain-tour': {
    id: 'skill-terrain-tour',
    title: 'Skill Terrain Tour',
    lens: 'a travel-map song that visits each skill landscape the student crossed',
    recommendedGenres: ['afrobeat', 'salsa', 'bollywood', 'folk'],
  },
  'side-quest-arcade': {
    id: 'side-quest-arcade',
    title: 'Side Quest Arcade',
    lens: 'a main math quest with a game-break side mission that changes the beat',
    recommendedGenres: ['hip-hop', 'chiptune', 'funk', 'edm'],
    gameBreakInterludeStyle: 'short hype break that names the real game move or outcome',
  },
  'steady-build': {
    id: 'steady-build',
    title: 'Steady Build',
    lens: 'a small city-builder song where each problem adds one more block to the day',
    recommendedGenres: ['pop', 'folk', 'reggae', 'bossa-nova'],
  },
}

const GENERIC_AVOID = [
  'generic trophy/star praise',
  'invented problems or scores',
  'new names that are not the player name',
  'making mistakes sound embarrassing',
]

function uniqueStrings(values: Array<string | null | undefined>, limit = Number.POSITIVE_INFINITY) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
    if (result.length >= limit) break
  }
  return result
}

function hashStringToSeed(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function jitter(seed: string, id: SongConceptId, amount = 2): number {
  return new SeededRandom(hashStringToSeed(`${seed}:${id}`)).nextFloat(0, amount)
}

function normalizedGenre(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

function recentConceptPenalty(id: SongConceptId, recentConceptIds: string[] = []): number {
  const index = recentConceptIds.indexOf(id)
  if (index === -1) return 0
  if (index === 0) return 10
  if (index <= 2) return 6
  return 3
}

function getPrimaryMoment(
  input: SongPromptInput,
  kind: SongPromptInput['practiceDrama']['problemMoments'][number]['kind']
) {
  return (
    input.practiceDrama.problemMoments.find(
      (moment) => moment.kind === kind && input.practiceDrama.storyAngle.includes(moment.problem)
    ) ?? input.practiceDrama.problemMoments.find((moment) => moment.kind === kind)
  )
}

function skillHookSeeds(input: SongPromptInput) {
  return input.practiceDrama.skillSpotlights.slice(0, 4).map((skill) => {
    const example = skill.exampleProblems[0] ? ` on ${skill.exampleProblems[0]}` : ''
    return `${skill.skill}${example}`
  })
}

function gameBreakSeeds(input: SongPromptInput) {
  const gb = input.gameBreak
  if (!gb) return []
  return uniqueStrings(
    [`${gb.gameName}: ${gb.headline}`, gb.outcome, ...gb.highlights, ...gb.details, ...gb.moments],
    6
  )
}

function addCandidate(
  candidates: ConceptCandidate[],
  template: ConceptTemplate,
  score: number,
  reasons: Array<string | null | undefined>,
  hookSeeds: Array<string | null | undefined>,
  requiredDetails: Array<string | null | undefined>
) {
  candidates.push({
    template,
    score,
    reasons: uniqueStrings(reasons, 4),
    hookSeeds: uniqueStrings(hookSeeds, 6),
    requiredDetails: uniqueStrings(requiredDetails, 5),
  })
}

function buildCandidates(input: SongPromptInput): ConceptCandidate[] {
  const moments = input.practiceDrama.problemMoments
  const comeback = getPrimaryMoment(input, 'comeback')
  const helped = getPrimaryMoment(input, 'help_breakthrough')
  const streak = getPrimaryMoment(input, 'streak_peak')
  const slow = getPrimaryMoment(input, 'slow_burn')
  const hard = getPrimaryMoment(input, 'hard_problem')
  const finale = getPrimaryMoment(input, 'finale')
  const comebackCount = moments.filter((moment) => moment.kind === 'comeback').length
  const skillCount = input.practiceDrama.skillSpotlights.length
  const gameSeeds = gameBreakSeeds(input)
  const candidates: ConceptCandidate[] = []

  addCandidate(
    candidates,
    CONCEPTS['comeback-case-file'],
    (comeback ? 30 : 0) +
      Math.min(comeback?.attempts ?? 0, 6) +
      Math.min(input.currentSession.retryMoments * 2, 8) +
      Math.min(comebackCount * 4, 12) +
      (input.history.trend === 'improving' ? 3 : 0),
    comeback
      ? [
          `${comeback.problem} was solved after ${comeback.attempts} attempts`,
          comeback.reason,
          input.history.trend === 'improving' ? 'recent trend is improving' : null,
        ]
      : [],
    comeback
      ? [
          comeback.problem,
          `${comeback.attempts} attempts`,
          ...comeback.strategySteps,
          ...comeback.skills.slice(0, 2),
        ]
      : [],
    comeback ? [comeback.problem, `${comeback.attempts} attempts`] : []
  )

  addCandidate(
    candidates,
    CONCEPTS['strategy-toolbox'],
    (helped || input.currentSession.helpMoments > 0 ? 28 : 0) +
      Math.min(input.currentSession.helpMoments * 4, 12) +
      Math.min(moments.flatMap((moment) => moment.strategySteps).length, 6),
    [
      helped?.reason,
      input.currentSession.helpMoments > 0
        ? `${input.currentSession.helpMoments} help moment${input.currentSession.helpMoments === 1 ? '' : 's'}`
        : null,
    ],
    uniqueStrings([
      helped?.problem,
      ...(helped?.strategySteps ?? []),
      ...(helped?.skills ?? []),
      ...skillHookSeeds(input),
    ]),
    uniqueStrings([
      helped?.problem,
      input.currentSession.helpMoments > 0 ? 'help was used as a strategy' : null,
      ...(helped?.strategySteps.slice(0, 1) ?? []),
    ])
  )

  addCandidate(
    candidates,
    CONCEPTS['streak-parade'],
    (input.currentSession.bestCorrectStreak >= 4 ? 22 : 0) +
      Math.min(input.currentSession.bestCorrectStreak, 18) +
      (input.currentSession.accuracy >= 0.85 ? 5 : 0) +
      (streak ? 5 : 0),
    [
      `${input.currentSession.bestCorrectStreak} correct answers in a row`,
      input.currentSession.accuracy >= 0.85 ? 'high-accuracy session' : null,
      streak?.reason,
    ],
    uniqueStrings([
      `${input.currentSession.bestCorrectStreak} in a row`,
      streak?.problem,
      streak?.reason,
      ...skillHookSeeds(input).slice(0, 2),
    ]),
    uniqueStrings([
      `${input.currentSession.bestCorrectStreak} correct answers in a row`,
      streak?.problem,
    ])
  )

  addCandidate(
    candidates,
    CONCEPTS['boss-level-replay'],
    (hard ? 24 : 0) +
      (hard?.outcome === 'incorrect' ? 5 : 0) +
      (hard?.purpose === 'challenge' ? 4 : 0) +
      (hard?.reason.includes('complexity') ? 5 : 0) +
      Math.min(input.currentSession.totalIncorrectAttempts, 8),
    [
      hard?.reason,
      hard?.purpose === 'challenge' ? 'challenge problem' : null,
      input.currentSession.totalIncorrectAttempts > 0
        ? `${input.currentSession.totalIncorrectAttempts} incorrect attempts created tension`
        : null,
    ],
    uniqueStrings([
      hard?.problem,
      hard?.reason,
      ...(hard?.skills ?? []),
      ...(hard?.strategySteps ?? []),
    ]),
    uniqueStrings([hard?.problem, hard?.reason])
  )

  addCandidate(
    candidates,
    CONCEPTS['slow-burn-lab'],
    (slow ? 27 : 0) + (slow?.responseSeconds ? 6 : 0) + (finale ? 2 : 0),
    [slow?.reason, finale?.reason],
    uniqueStrings([
      slow?.problem,
      slow?.responseSeconds != null ? `${slow.responseSeconds} seconds` : null,
      ...(slow?.strategySteps ?? []),
      finale?.problem,
    ]),
    uniqueStrings([
      slow?.problem,
      slow?.responseSeconds != null ? `${slow.responseSeconds} seconds` : null,
    ])
  )

  addCandidate(
    candidates,
    CONCEPTS['skill-terrain-tour'],
    (skillCount >= 4 ? 24 : 0) +
      Math.min(skillCount * 2, 12) +
      (input.currentSession.skillsPracticed.length >= 6 ? 5 : 0),
    [
      `${skillCount} skill spotlights`,
      input.currentSession.skillsPracticed.length >= 6 ? 'many skills practiced' : null,
    ],
    skillHookSeeds(input),
    input.practiceDrama.skillSpotlights.slice(0, 3).map((skill) => skill.skill)
  )

  addCandidate(
    candidates,
    CONCEPTS['side-quest-arcade'],
    input.gameBreak
      ? 24 +
          Math.min(gameSeeds.length, 8) +
          (input.gameBreak.moments.length > 0 ? 4 : 0) +
          (input.gameBreak.details.length > 0 ? 3 : 0)
      : 0,
    input.gameBreak ? [`${input.gameBreak.gameName} game break`, input.gameBreak.headline] : [],
    gameSeeds,
    gameSeeds.slice(0, 3)
  )

  addCandidate(
    candidates,
    CONCEPTS['steady-build'],
    moments.length === 0 ? 18 : 3,
    moments.length === 0
      ? ['thin session evidence; keep the story grounded and simple']
      : ['fallback concept available if stronger concepts repeat too often'],
    uniqueStrings([
      input.practiceDrama.storyAngle,
      `${input.currentSession.problemsDone} problems completed`,
      ...skillHookSeeds(input).slice(0, 2),
    ]),
    uniqueStrings([input.practiceDrama.storyAngle])
  )

  return candidates
}

export function selectSongConcept(
  input: SongPromptInput,
  context: SongConceptSelectionContext
): SongConcept {
  const candidates = buildCandidates(input)
    .map((candidate) => ({
      ...candidate,
      score:
        candidate.score -
        recentConceptPenalty(candidate.template.id, context.recentConceptIds) +
        jitter(context.seed, candidate.template.id),
    }))
    .sort((a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id))

  const winner = candidates[0] ?? {
    template: CONCEPTS['steady-build'],
    score: 0,
    reasons: ['fallback concept'],
    hookSeeds: [input.practiceDrama.storyAngle],
    requiredDetails: [input.practiceDrama.storyAngle],
  }

  return {
    id: winner.template.id,
    title: winner.template.title,
    lens: winner.template.lens,
    fitReason: winner.reasons[0] ?? input.practiceDrama.storyAngle,
    hookSeeds: uniqueStrings(winner.hookSeeds, 6),
    requiredDetails: uniqueStrings(winner.requiredDetails, 5),
    recommendedGenres: winner.template.recommendedGenres,
    ...(winner.template.gameBreakInterludeStyle && {
      gameBreakInterludeStyle: winner.template.gameBreakInterludeStyle,
    }),
    avoid: GENERIC_AVOID,
  }
}

function availableGenreIds() {
  return SESSION_SONG_GENRES.map((genre) => genre.id).filter(
    (id) => id !== 'shuffle' && id !== 'any'
  )
}

function rankGenres(genres: string[], concept: SongConcept, context: SongConceptSelectionContext) {
  const recent = new Set((context.recentGenreTags ?? []).map(normalizedGenre))
  const recommended = new Set(concept.recommendedGenres.map(normalizedGenre))

  return genres
    .map((genre) => ({
      genre,
      score:
        (recommended.has(normalizedGenre(genre)) ? 20 : 0) -
        (recent.has(normalizedGenre(genre)) ? 8 : 0) +
        new SeededRandom(hashStringToSeed(`${context.seed}:genre:${genre}`)).nextFloat(0, 6),
    }))
    .sort((a, b) => b.score - a.score || a.genre.localeCompare(b.genre))
    .map(({ genre }) => genre)
}

export function resolveSongGenres(
  preference: string | null | undefined,
  concept: SongConcept,
  context: SongConceptSelectionContext
): string {
  const raw = preference?.trim() || 'shuffle'
  if (raw !== 'shuffle' && raw !== 'any') return raw

  const pool = availableGenreIds()
  const ranked = rankGenres(pool, concept, context)

  if (raw === 'any') {
    return ranked[0] ?? concept.recommendedGenres[0] ?? 'pop'
  }

  const rng = new SeededRandom(hashStringToSeed(`${context.seed}:genre-count`))
  const count = 2 + (rng.chance(0.5) ? 1 : 0)
  return ranked.slice(0, count).join(', ')
}

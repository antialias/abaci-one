import type { CompositionPlan } from '@/lib/elevenlabs/music-client'
import type { SongPromptInput } from './extract-session-stats'

export const SESSION_SONG_PLAN_VALIDATION_FLAG = 'session-song.plan-validation'
export const MAX_SONG_DURATION_MS = 60_000

export type SongPlanValidationMode = 'off' | 'observe' | 'repair' | 'enforce'

export type SongPlanValidationOutcome =
  | 'skipped'
  | 'passed'
  | 'flagged'
  | 'repaired'
  | 'fallback'
  | 'blocked'

export type SongPlanEvidenceType =
  | 'player'
  | 'problem'
  | 'skill'
  | 'game'
  | 'duration'
  | 'invented_fact'

export interface SongPlanValidationPolicy {
  mode: SongPlanValidationMode
  maxRepairAttempts: number
  fallbackOnFailedRepair: boolean
  logPassingPlans: boolean
}

export interface SongPlanValidationIssue {
  code: string
  message: string
  evidenceType?: SongPlanEvidenceType
}

export interface SongPlanValidationResult {
  ok: boolean
  issues: SongPlanValidationIssue[]
  totalDurationMs: number
}

export interface SongPlanValidationMetadata {
  mode: SongPlanValidationMode
  outcome: SongPlanValidationOutcome
  issues: SongPlanValidationIssue[]
  rawTotalDurationMs: number
  finalTotalDurationMs: number
  repaired: boolean
  fallbackUsed: boolean
  repairAttempts: number
}

export interface SongPlanCandidate extends CompositionPlan {
  title: string
}

export class SongCompositionValidationError extends Error {
  constructor(
    message: string,
    public metadata: SongPlanValidationMetadata,
    public candidate?: SongPlanCandidate
  ) {
    super(message)
    this.name = 'SongCompositionValidationError'
  }
}

const DEFAULT_ENABLED_POLICY: SongPlanValidationPolicy = {
  mode: 'observe',
  maxRepairAttempts: 1,
  fallbackOnFailedRepair: true,
  logPassingPlans: false,
}

const OFF_POLICY: SongPlanValidationPolicy = {
  mode: 'off',
  maxRepairAttempts: 0,
  fallbackOnFailedRepair: false,
  logPassingPlans: false,
}

const GAME_BREAK_SECTION_RE =
  /\b(interlude|rap\s*break|bridge|breakdown|the\s+drop|drop|cadence|side\s*quest|halftime|half-time|spoken)\b/i

const COMMON_CHILD_NAMES = [
  'alex',
  'amelia',
  'ava',
  'ben',
  'charlie',
  'ella',
  'emma',
  'ethan',
  'harper',
  'henry',
  'isabella',
  'jack',
  'jamie',
  'leo',
  'liam',
  'lily',
  'lucas',
  'lucy',
  'mason',
  'max',
  'maya',
  'mia',
  'noah',
  'olivia',
  'sam',
  'sophia',
  'zoe',
]

const KNOWN_GAME_NAMES = [
  'complement race',
  'know your world',
  'matching pairs',
  'math discovery',
  'memory lightning',
  'music note match',
  'rithmomachia',
  'type racer',
  'type racer jr',
]

export function resolveSongPlanValidationPolicy(
  flag: {
    enabled: boolean
    config: unknown
  } | null
): SongPlanValidationPolicy {
  if (!flag?.enabled) return OFF_POLICY

  const config =
    typeof flag.config === 'string' ? parseConfigString(flag.config) : asRecord(flag.config)

  if (!config) return DEFAULT_ENABLED_POLICY

  const mode = isValidationMode(config.mode) ? config.mode : DEFAULT_ENABLED_POLICY.mode
  const maxRepairAttempts =
    typeof config.maxRepairAttempts === 'number' && Number.isFinite(config.maxRepairAttempts)
      ? Math.max(0, Math.min(3, Math.floor(config.maxRepairAttempts)))
      : DEFAULT_ENABLED_POLICY.maxRepairAttempts

  return {
    mode,
    maxRepairAttempts: mode === 'off' || mode === 'observe' ? 0 : maxRepairAttempts,
    fallbackOnFailedRepair:
      typeof config.fallbackOnFailedRepair === 'boolean'
        ? config.fallbackOnFailedRepair
        : DEFAULT_ENABLED_POLICY.fallbackOnFailedRepair,
    logPassingPlans:
      typeof config.logPassingPlans === 'boolean'
        ? config.logPassingPlans
        : DEFAULT_ENABLED_POLICY.logPassingPlans,
  }
}

export function validateCompositionPlan(
  input: SongPromptInput,
  candidate: SongPlanCandidate
): SongPlanValidationResult {
  const issues: SongPlanValidationIssue[] = []
  const lyrics = getLyricsText(candidate)
  const planText = getPlanText(candidate)
  const totalDurationMs = getTotalDurationMs(candidate)

  if (totalDurationMs > MAX_SONG_DURATION_MS) {
    issues.push({
      code: 'over_duration',
      message: `Composition plan is ${totalDurationMs}ms, above the 60000ms limit.`,
      evidenceType: 'duration',
    })
  }

  if (!input.gameBreak) {
    const badSection = candidate.sections.find((section) =>
      GAME_BREAK_SECTION_RE.test(section.section_name)
    )
    if (badSection) {
      issues.push({
        code: 'unexpected_game_break_section',
        message: `Section "${badSection.section_name}" looks like a game-break section, but this session has no game break.`,
        evidenceType: 'game',
      })
    }
  }

  if (input.gameBreak) {
    const gameCandidates = collectGameEvidenceCandidates(input)
    if (gameCandidates.length > 0 && !containsAnyEvidence(planText, gameCandidates)) {
      issues.push({
        code: 'missing_game_detail',
        message: `The song mentions the game break without using a concrete detail from ${input.gameBreak.gameName}.`,
        evidenceType: 'game',
      })
    }
  }

  const actualNames = getAllowedPlayerNames(input.player.name)
  if (!actualNames.some((name) => containsWord(lyrics, name))) {
    issues.push({
      code: 'missing_player_name',
      message: `Lyrics do not include the actual player name "${input.player.name}".`,
      evidenceType: 'player',
    })
  }

  const inventedName = findInventedChildName(lyrics, actualNames)
  if (inventedName) {
    issues.push({
      code: 'invented_child_name',
      message: `Lyrics mention "${inventedName}", which is not the actual player name.`,
      evidenceType: 'player',
    })
  }

  const problemCandidates = collectProblemEvidenceCandidates(input)
  if (problemCandidates.length > 0 && !containsAnyEvidence(lyrics, problemCandidates)) {
    issues.push({
      code: 'missing_problem_evidence',
      message: 'Lyrics do not include a real problem expression or singable equivalent.',
      evidenceType: 'problem',
    })
  }

  const skillCandidates = collectSkillEvidenceCandidates(input)
  if (skillCandidates.length > 0 && !containsAnyEvidence(lyrics, skillCandidates)) {
    issues.push({
      code: 'missing_skill_evidence',
      message: 'Lyrics do not include a real skill or strategy from the session.',
      evidenceType: 'skill',
    })
  }

  const unsupportedNumericClaim = findUnsupportedNumericClaim(
    planText,
    collectAllowedNumbers(input)
  )
  if (unsupportedNumericClaim) {
    issues.push({
      code: 'invented_numeric_claim',
      message: `Lyrics include unsupported concrete claim "${unsupportedNumericClaim}".`,
      evidenceType: 'invented_fact',
    })
  }

  const inventedGame = findInventedGameName(planText, input.gameBreak?.gameName)
  if (inventedGame) {
    issues.push({
      code: 'invented_game',
      message: `Lyrics mention "${inventedGame}", which was not the session game break.`,
      evidenceType: 'invented_fact',
    })
  }

  return {
    ok: issues.length === 0,
    issues,
    totalDurationMs,
  }
}

export function getTotalDurationMs(plan: CompositionPlan): number {
  return plan.sections.reduce((sum, section) => sum + (section.duration_ms ?? 0), 0)
}

export function clampCompositionPlanDuration<T extends CompositionPlan>(plan: T): T {
  const totalMs = getTotalDurationMs(plan)
  if (totalMs <= MAX_SONG_DURATION_MS || totalMs <= 0) return clonePlan(plan)

  const scale = MAX_SONG_DURATION_MS / totalMs
  return {
    ...clonePlan(plan),
    sections: plan.sections.map((section) => ({
      ...section,
      duration_ms: Math.round(section.duration_ms * scale),
    })),
  }
}

export function buildFallbackSongPlan(
  input: SongPromptInput,
  original?: Partial<SongPlanCandidate>,
  genre = 'any'
): SongPlanCandidate {
  const firstName = getAllowedPlayerNames(input.player.name)[0] ?? input.player.name
  const problem = input.practiceDrama.problemMoments[0]?.problem
  const skill =
    input.practiceDrama.problemMoments.flatMap((moment) => [
      ...moment.strategySteps,
      ...moment.skills,
    ])[0] ?? input.practiceDrama.skillSpotlights[0]?.skill
  const gameDetail = collectGameEvidenceCandidates(input)[0]
  const genres =
    genre === 'any'
      ? []
      : genre
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
  const globalStyles = uniqueStrings([
    'children',
    'upbeat',
    ...genres,
    ...(original?.positive_global_styles ?? []),
  ]).slice(0, 8)

  const sections: SongPlanCandidate['sections'] = [
    {
      section_name: 'Verse 1',
      positive_local_styles: ['bright', 'storytelling'],
      negative_local_styles: [],
      duration_ms: 12_000,
      lines: [
        fitLine(`${firstName} took the bead road today`),
        fitLine(problem ? `${problem} came into view` : 'A math trail came into view'),
      ],
    },
    {
      section_name: 'Chorus',
      positive_local_styles: ['catchy', 'singalong'],
      negative_local_styles: [],
      duration_ms: 9_000,
      lines: [
        fitLine(`${firstName}, keep that rhythm bright`),
        'One more step and the beads feel light',
      ],
    },
    {
      section_name: 'Verse 2',
      positive_local_styles: ['warm', 'confident'],
      negative_local_styles: [],
      duration_ms: 12_000,
      lines: [
        fitLine(skill ? `Used ${skill} with steady hands` : 'Kept the practice moving strong'),
        'Tried it again and carried on',
      ],
    },
  ]

  if (input.gameBreak) {
    sections.push({
      section_name: 'Game Break',
      positive_local_styles: ['playful', 'rhythmic'],
      negative_local_styles: [],
      duration_ms: 8_000,
      lines: [
        fitLine(`${input.gameBreak.gameName} made a side quest`),
        fitLine(gameDetail ?? input.gameBreak.headline),
      ],
    })
  }

  sections.push({
    section_name: 'Final Chorus',
    positive_local_styles: ['celebration', 'singalong'],
    negative_local_styles: [],
    duration_ms: 9_000,
    lines: [fitLine(`${firstName}, keep that rhythm bright`), 'Math steps shining in the light'],
  })

  return {
    title: fitLine(`${firstName}'s Practice Beat`, 80),
    positive_global_styles: globalStyles,
    negative_global_styles: uniqueStrings([
      'explicit',
      'sad',
      ...(original?.negative_global_styles ?? []),
    ]).slice(0, 8),
    sections,
  }
}

export function buildValidationEvidenceSummary(input: SongPromptInput): string {
  const lines = [
    `Player name: ${input.player.name}`,
    `Problems: ${input.practiceDrama.problemMoments.map((moment) => moment.problem).join(' | ') || 'none'}`,
    `Skills/strategies: ${collectSkillEvidenceCandidates(input).slice(0, 12).join(' | ') || 'none'}`,
    input.gameBreak
      ? `Game break: ${input.gameBreak.gameName} | ${collectGameEvidenceCandidates(input).slice(0, 12).join(' | ') || 'no concrete details'}`
      : 'Game break: none',
  ]
  return lines.join('\n')
}

function parseConfigString(raw: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(raw))
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isValidationMode(value: unknown): value is SongPlanValidationMode {
  return value === 'off' || value === 'observe' || value === 'repair' || value === 'enforce'
}

function clonePlan<T extends CompositionPlan>(plan: T): T {
  return {
    ...plan,
    positive_global_styles: [...plan.positive_global_styles],
    negative_global_styles: [...plan.negative_global_styles],
    sections: plan.sections.map((section) => ({
      ...section,
      positive_local_styles: [...section.positive_local_styles],
      negative_local_styles: [...section.negative_local_styles],
      lines: [...section.lines],
    })),
  }
}

function getLyricsText(candidate: SongPlanCandidate): string {
  return candidate.sections.flatMap((section) => section.lines).join('\n')
}

function getPlanText(candidate: SongPlanCandidate): string {
  return [
    candidate.title,
    candidate.positive_global_styles.join(' '),
    candidate.sections
      .map((section) => [section.section_name, section.lines.join(' ')].join(' '))
      .join(' '),
  ].join('\n')
}

function normalizeCompact(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function containsAnyEvidence(text: string, candidates: string[]): boolean {
  const normalizedText = normalizeCompact(text)
  return candidates.some((candidate) => {
    const normalized = normalizeCompact(candidate)
    return normalized.length >= 2 && normalizedText.includes(normalized)
  })
}

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-zA-Z])${escaped}([^a-zA-Z]|$)`, 'i').test(text)
}

function getAllowedPlayerNames(name: string): string[] {
  const parts = name.split(/\s+/).filter(Boolean)
  return uniqueStrings([name, parts[0]])
}

function findInventedChildName(lyrics: string, allowedNames: string[]): string | null {
  const allowed = new Set(allowedNames.map((name) => name.toLowerCase()))
  return COMMON_CHILD_NAMES.find((name) => !allowed.has(name) && containsWord(lyrics, name)) ?? null
}

function collectProblemEvidenceCandidates(input: SongPromptInput): string[] {
  return uniqueStrings(
    input.practiceDrama.problemMoments.flatMap((moment) => mathEvidenceVariants(moment.problem))
  )
}

function collectSkillEvidenceCandidates(input: SongPromptInput): string[] {
  return uniqueStrings([
    ...input.currentSession.skillsPracticed,
    ...input.practiceDrama.skillSpotlights.map((skill) => skill.skill),
    ...input.practiceDrama.problemMoments.flatMap((moment) => [
      ...moment.skills,
      ...moment.strategySteps.map(getSkillPhraseFromStrategyStep),
    ]),
  ]).flatMap((item) => skillEvidenceVariants(item))
}

function collectGameEvidenceCandidates(input: SongPromptInput): string[] {
  const gameBreak = input.gameBreak
  if (!gameBreak) return []

  const rawDetails = [
    gameBreak.headline,
    gameBreak.outcome,
    gameBreak.accuracy != null ? `${gameBreak.accuracy}% accuracy` : null,
    ...gameBreak.highlights,
    ...gameBreak.details,
    ...gameBreak.moments,
  ].filter((detail): detail is string => Boolean(detail?.trim()))

  const gameNameCompact = normalizeCompact(gameBreak.gameName)
  const candidates = rawDetails.flatMap((detail) => {
    const withoutGame = detail.replace(new RegExp(escapeRegExp(gameBreak.gameName), 'gi'), ' ')
    return [
      withoutGame,
      ...withoutGame.split(/[|,;]/),
      ...withoutGame.split(':').slice(1),
      ...extractNumbers(withoutGame).flatMap((n) => [String(n), n >= 10 ? numberToWords(n) : '']),
    ]
  })

  return uniqueStrings(
    candidates
      .map((candidate) => candidate.replace(/\s+/g, ' ').trim())
      .filter((candidate) => {
        const compact = normalizeCompact(candidate)
        return (
          compact.length >= 3 && compact !== gameNameCompact && !/^(played|game)$/i.test(candidate)
        )
      })
  )
}

function getSkillPhraseFromStrategyStep(step: string): string {
  const usingMatch = step.match(/\busing\s+(.+)$/i)
  return usingMatch?.[1]?.trim() ?? step
}

function skillEvidenceVariants(value: string): string[] {
  const sourceLooksLikeEquation = /[=+-]/.test(value) && extractNumbers(value).length >= 2
  return mathEvidenceVariants(value).filter((variant) => {
    const normalized = normalizeCompact(variant)
    if (normalized.length < 4) return false
    if (/^\d+$/.test(normalized)) return sourceLooksLikeEquation
    return !/^(?:plus|minus)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/.test(
      normalized
    )
  })
}

function collectAllowedNumbers(input: SongPromptInput): Set<number> {
  const values = [
    input.currentSession.problemsDone,
    input.currentSession.problemsTotal,
    input.currentSession.bestCorrectStreak,
    input.currentSession.durationMinutes,
    input.currentSession.totalIncorrectAttempts,
    input.currentSession.helpMoments,
    input.currentSession.retryMoments,
    input.currentSession.averageResponseSeconds,
    Math.round(input.currentSession.accuracy * 100),
    ...input.practiceDrama.problemMoments.flatMap((moment) => [
      moment.answer,
      ...moment.studentAnswers,
      moment.attempts,
      moment.incorrectAttempts,
      moment.responseSeconds,
      ...extractNumbers(moment.problem),
      ...moment.strategySteps.flatMap(extractNumbers),
    ]),
    ...input.practiceDrama.skillSpotlights.flatMap((skill) => [
      skill.attempts,
      skill.correct,
      skill.problems,
      ...skill.exampleProblems.flatMap(extractNumbers),
    ]),
    input.gameBreak?.accuracy,
    ...(input.gameBreak
      ? [
          ...input.gameBreak.highlights,
          ...input.gameBreak.details,
          ...input.gameBreak.moments,
          input.gameBreak.outcome ?? '',
        ].flatMap(extractNumbers)
      : []),
  ]

  return new Set(
    values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  )
}

function findUnsupportedNumericClaim(text: string, allowedNumbers: Set<number>): string | null {
  const patterns = [
    /\b(\d+)\s*(attempts?|tries|mistakes?|wrong|incorrect|scores?|points?|stars?|words?|notes?|regions?|countries?|numbers?|streak|in a row)\b/gi,
    /\b(score|points|stars|attempts?|tries|words?|notes?|regions?|countries?)\s*(?:of|was|is|:)?\s*(\d+)\b/gi,
  ]

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const numberText = /^\d+$/.test(match[1]) ? match[1] : match[2]
      const value = Number(numberText)
      if (Number.isFinite(value) && !allowedNumbers.has(value)) return match[0]
    }
  }

  return null
}

function findInventedGameName(text: string, actualGameName?: string): string | null {
  const actual = actualGameName ? normalizeCompact(actualGameName) : null
  return (
    KNOWN_GAME_NAMES.find((gameName) => {
      if (actual && normalizeCompact(gameName) === actual) return false
      return containsPhrase(text, gameName)
    }) ?? null
  )
}

function containsPhrase(text: string, phrase: string): boolean {
  return normalizeCompact(text).includes(normalizeCompact(phrase))
}

function mathEvidenceVariants(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  const beforeEquals = trimmed.includes('=') ? trimmed.split('=')[0].trim() : ''
  return uniqueStrings([
    trimmed,
    beforeEquals,
    mathSymbolsToWords(trimmed, false),
    beforeEquals ? mathSymbolsToWords(beforeEquals, false) : '',
    mathSymbolsToWords(trimmed, true),
    beforeEquals ? mathSymbolsToWords(beforeEquals, true) : '',
  ])
}

function mathSymbolsToWords(value: string, convertNumbers: boolean): string {
  return value
    .replace(/\+/g, ' plus ')
    .replace(/-/g, ' minus ')
    .replace(/=/g, ' equals ')
    .replace(/\b\d+\b/g, (match) => (convertNumbers ? numberToWords(Number(match)) : match))
    .replace(/\s+/g, ' ')
    .trim()
}

function extractNumbers(value: string): number[] {
  return [...value.matchAll(/\b\d+(?:\.\d+)?\b/g)]
    .map((match) => Number(match[0]))
    .filter((number) => Number.isFinite(number))
}

function numberToWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999) return String(value)
  const ones = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ]
  const tens = [
    '',
    '',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
  ]

  if (value < 20) return ones[value]
  if (value < 100) {
    const ten = Math.floor(value / 10)
    const one = value % 10
    return one === 0 ? tens[ten] : `${tens[ten]} ${ones[one]}`
  }

  const hundred = Math.floor(value / 100)
  const remainder = value % 100
  return remainder === 0
    ? `${ones[hundred]} hundred`
    : `${ones[hundred]} hundred ${numberToWords(remainder)}`
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const key = normalizeCompact(trimmed)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

function fitLine(value: string, max = 78): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trim()}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

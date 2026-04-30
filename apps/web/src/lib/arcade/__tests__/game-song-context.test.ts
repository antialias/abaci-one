import { describe, expect, it } from 'vitest'
import { constantExplorerValidator } from '@/arcade-games/constant-explorer/Validator'
import type { KnowYourWorldState } from '@/arcade-games/know-your-world/types'
import { knowYourWorldValidator } from '@/arcade-games/know-your-world/Validator'
import type { MemoryQuizState } from '@/arcade-games/memory-quiz/types'
import { memoryQuizGameValidator } from '@/arcade-games/memory-quiz/Validator'
import type { TypeRacerJrState } from '@/arcade-games/type-racer-jr/types'
import { typeRacerJrValidator } from '@/arcade-games/type-racer-jr/Validator'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { createMatchingPairsValidator } from '@/lib/arcade/matching-pairs-framework/create-validator'
import type {
  BaseMatchingCard,
  BaseMatchingConfig,
  MatchingPairsState,
  MatchingPairsVariant,
} from '@/lib/arcade/matching-pairs-framework/types'

type ReportBuilder<TState, TConfig = unknown> = {
  getResultsReport?: (state: TState, config: TConfig) => GameResultsReport
}

interface TestCard extends BaseMatchingCard {
  number: number
}

type TestConfig = BaseMatchingConfig

function contextText(context: {
  details?: string[]
  dramaticMoments?: string[]
  strategyNotes?: string[]
  outcome?: string
}) {
  return [
    ...(context.details ?? []),
    ...(context.dramaticMoments ?? []),
    ...(context.strategyNotes ?? []),
    context.outcome,
  ]
    .filter(Boolean)
    .join(' | ')
}

function getTypeRacerReport(state: TypeRacerJrState) {
  return (typeRacerJrValidator as ReportBuilder<TypeRacerJrState, unknown>).getResultsReport!(
    state,
    {}
  )
}

function getMemoryQuizReport(state: MemoryQuizState) {
  return (memoryQuizGameValidator as ReportBuilder<MemoryQuizState, unknown>).getResultsReport!(
    state,
    {}
  )
}

function createTestMatchingVariant(): MatchingPairsVariant<TestCard, TestConfig> {
  return {
    gameName: 'matching',
    defaultConfig: {
      difficulty: 6,
      turnTimer: 0,
    },
    cardSchema: {} as any,
    generateCards: () => [],
    validateMatch: (card1, card2) => ({
      isValid: card1.number === card2.number,
      type: 'number',
    }),
    validateConfigField: () => null,
    getTotalPairs: (config) => config.difficulty,
    getOriginalConfig: (config) => ({ difficulty: config.difficulty }),
    hasConfigChangedFrom: (current, original) => current.difficulty !== original.difficulty,
    CardFront: (() => null) as any,
    getCardBackStyle: () => ({ gradient: '', icon: '' }),
    SetupContent: (() => null) as any,
    getGridConfig: () => ({}),
  }
}

describe('game songContext builders', () => {
  it('gives Type Racer Jr. clean runs opening/final words and clean-run drama', () => {
    const wordQueue = [
      { word: 'cat', emoji: 'cat' },
      { word: 'moon', emoji: 'moon' },
      { word: 'rocket', emoji: 'rocket' },
    ]
    const state: TypeRacerJrState = {
      gamePhase: 'results',
      gameMode: 'free-play',
      timeLimit: null,
      wordCount: 3,
      keyboardLayout: 'qwerty',
      showVirtualKeyboard: false,
      currentDifficulty: 'level1',
      consecutiveCleanWords: 3,
      wordQueue,
      currentWordIndex: 3,
      completedWords: wordQueue.map((entry, index) => ({
        ...entry,
        stars: 3,
        mistakeCount: 0,
        durationMs: 900 + index * 100,
      })),
      usedWords: wordQueue.map((entry) => entry.word),
      totalStars: 9,
      bestStreak: 3,
      gameStartTime: Date.now() - 5000,
      currentWordStartTime: null,
      playerId: 'player-1',
      playerMetadata: {
        'player-1': {
          id: 'player-1',
          name: 'Ava',
          emoji: 'keyboard',
          userId: 'user-1',
        },
      },
      endReason: 'all-words-done',
    }

    const text = contextText(getTypeRacerReport(state).songContext!)

    expect(text).toContain('Opening word: cat')
    expect(text).toContain('Final word: rocket')
    expect(text).toContain('Clean run:')
    expect(text).toContain('Words typed: cat, moon, rocket')
  })

  it('gives Memory Lightning partial recalls near-miss, comeback, and number details', () => {
    const state: MemoryQuizState = {
      cards: [],
      quizCards: [],
      correctAnswers: [12, 34, 56],
      currentCardIndex: 3,
      displayTime: 2,
      selectedCount: 3,
      selectedDifficulty: 'easy',
      foundNumbers: [12, 56],
      guessesRemaining: 1,
      currentInput: '',
      incorrectGuesses: 1,
      activePlayers: ['player-1'],
      playerMetadata: {
        'player-1': {
          id: 'player-1',
          name: 'Ava',
          emoji: 'brain',
          userId: 'user-1',
        },
      },
      playerScores: {
        'user-1': { correct: 2, incorrect: 1 },
      },
      playMode: 'cooperative',
      numberFoundBy: {
        '12': 'user-1',
        '56': 'user-1',
      },
      gamePhase: 'results',
      finishButtonsBound: false,
      wrongGuessAnimations: [],
      gameStartTime: Date.now() - 7000,
      hasPhysicalKeyboard: false,
      testingMode: false,
      showOnScreenKeyboard: false,
      prefixAcceptanceTimeout: null,
    }

    const text = contextText(getMemoryQuizReport(state).songContext!)

    expect(text).toContain('Numbers shown: 12, 34, 56')
    expect(text).toContain('Near miss: one number left hidden: 34')
    expect(text).toContain('Comeback:')
    expect(text).toContain('Tough item: 34 stayed hidden')
  })

  it('gives Know Your World map runs regions, hints, tough items, and near misses', () => {
    const state: KnowYourWorldState = {
      gamePhase: 'results',
      selectedMap: 'usa',
      gameMode: 'cooperative',
      includeSizes: ['huge', 'large'],
      assistanceLevel: 'standard',
      selectedContinent: 'all',
      currentPrompt: 'ny',
      regionsToFind: [],
      regionsFound: ['ca', 'tx'],
      regionsGivenUp: [],
      currentPlayer: 'player-1',
      scores: { 'player-1': 20 },
      attempts: { 'player-1': 3 },
      guessHistory: [
        {
          playerId: 'player-1',
          regionId: 'fl',
          regionName: 'Florida',
          correct: false,
          attempts: 1,
          timestamp: 1,
        },
        {
          playerId: 'player-1',
          regionId: 'ca',
          regionName: 'California',
          correct: true,
          attempts: 2,
          timestamp: 2,
        },
        {
          playerId: 'player-1',
          regionId: 'tx',
          regionName: 'Texas',
          correct: true,
          attempts: 1,
          timestamp: 3,
        },
        {
          playerId: 'player-1',
          regionId: 'ny',
          regionName: 'New York',
          correct: false,
          attempts: 1,
          timestamp: 4,
        },
      ],
      startTime: Date.now() - 8000,
      endTime: Date.now(),
      activePlayers: ['player-1'],
      activeUserIds: ['user-1'],
      playerMetadata: {
        'player-1': {
          name: 'Ava',
          emoji: 'map',
          userId: 'user-1',
        },
      },
      giveUpReveal: null,
      giveUpVotes: [],
      hintsUsed: 1,
      hintActive: null,
      nameConfirmationProgress: 0,
    }

    const report = knowYourWorldValidator.getResultsReport(state, {})
    const text = contextText(report.songContext!)

    expect(text).toContain('Regions found: California, Texas')
    expect(text).toContain('Near miss: one region left: New York')
    expect(text).toContain('Tough item: California took 2 attempts')
    expect(text).toContain('Used 1 hint')
  })

  it('gives Matching Pairs partial boards final matches, hidden pairs, and mismatch comebacks', () => {
    const variant = createTestMatchingVariant()
    const validator = createMatchingPairsValidator(variant)
    const cards: TestCard[] = [
      { id: 'a-5', type: 'number', number: 5, matched: true },
      { id: 'b-5', type: 'number', number: 5, matched: true },
      { id: 'a-8', type: 'number', number: 8, matched: true },
      { id: 'b-8', type: 'number', number: 8, matched: true },
      { id: 'a-13', type: 'number', number: 13, matched: false },
      { id: 'b-13', type: 'number', number: 13, matched: false },
    ]
    const state: MatchingPairsState<TestCard, TestConfig> & TestConfig = {
      cards,
      gameCards: cards,
      flippedCards: [],
      difficulty: 6,
      turnTimer: 0,
      gamePhase: 'results',
      currentPlayer: 'player-1',
      matchedPairs: 2,
      totalPairs: 3,
      moves: 4,
      scores: { 'player-1': 2 },
      activePlayers: ['player-1'],
      playerMetadata: {
        'player-1': {
          id: 'player-1',
          name: 'Ava',
          emoji: 'cards',
          userId: 'user-1',
        },
      },
      consecutiveMatches: { 'player-1': 2 },
      gameStartTime: Date.now() - 9000,
      gameEndTime: Date.now(),
      currentMoveStartTime: null,
      celebrationAnimations: [],
      isProcessingMove: false,
      showMismatchFeedback: false,
      lastMatchedPair: ['a-8', 'b-8'],
      playerHovers: {},
    }

    const report = (validator as ReportBuilder<typeof state, TestConfig>).getResultsReport!(state, {
      difficulty: 6,
      turnTimer: 0,
    })
    const text = contextText(report.songContext!)

    expect(text).toContain('Final match: 8')
    expect(text).toContain('Still hidden: 13')
    expect(text).toContain('Near miss: one pair left hidden: 13')
    expect(text).toContain('Comeback:')
  })

  it('gives Constant Explorer a signature-item discovery context', () => {
    const report = constantExplorerValidator.getResultsReport(
      {
        constantId: 'pi',
        phase: 'complete',
        playerId: 'player-1',
        playerName: 'Ava',
        startedAt: Date.now() - 2000,
      },
      {}
    )
    const text = contextText(report.songContext!)

    expect(text).toContain('Signature constant:')
    expect(text).toContain('Pi')
    expect(text).toContain('Signature items:')
  })
})

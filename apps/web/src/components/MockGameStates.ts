/**
 * Mock game states for game previews
 * Creates proper initial states in "playing" phase for each game type
 */

import { complementRaceValidator } from '@/arcade-games/complement-race/Validator'
import { matchingGameValidator } from '@/arcade-games/matching/Validator'
import { memoryQuizGameValidator } from '@/arcade-games/memory-quiz/Validator'
import { cardSortingValidator } from '@/arcade-games/card-sorting/Validator'
import { rithmomachiaValidator } from '@/arcade-games/rithmomachia/Validator'
import {
  DEFAULT_COMPLEMENT_RACE_CONFIG,
  DEFAULT_MATCHING_CONFIG,
  DEFAULT_MEMORY_QUIZ_CONFIG,
  DEFAULT_CARD_SORTING_CONFIG,
  DEFAULT_RITHMOMACHIA_CONFIG,
} from '@/lib/arcade/game-configs'
import type { ComplementRaceState } from '@/arcade-games/complement-race/types'
import type { MatchingState } from '@/arcade-games/matching/types'
import type { MemoryQuizState } from '@/arcade-games/memory-quiz/types'
import type { CardSortingState } from '@/arcade-games/card-sorting/types'
import type { RithmomachiaState } from '@/arcade-games/rithmomachia/types'

/**
 * Create a mock state for Complement Race in playing phase
 * Shows mid-game state with progress and activity
 */
export function createMockComplementRaceState(): ComplementRaceState {
  const baseState = complementRaceValidator.getInitialState(DEFAULT_COMPLEMENT_RACE_CONFIG)

  // Create some passengers for visual interest
  const mockPassengers = [
    {
      id: 'p1',
      name: 'Alice',
      avatar: '👩‍💼',
      originStationId: 'depot',
      destinationStationId: 'canyon',
      isUrgent: false,
      claimedBy: 'demo-player-1',
      deliveredBy: null,
      carIndex: 0,
      timestamp: Date.now() - 10000,
    },
    {
      id: 'p2',
      name: 'Bob',
      avatar: '👨‍🎓',
      originStationId: 'riverside',
      destinationStationId: 'grand-central',
      isUrgent: true,
      claimedBy: null,
      deliveredBy: null,
      carIndex: null,
      timestamp: Date.now() - 5000,
    },
  ]

  // Create stations for sprint mode
  const mockStations = [
    { id: 'station-0', name: 'Depot', position: 0, icon: '🏭', emoji: '🏭' },
    {
      id: 'station-1',
      name: 'Riverside',
      position: 20,
      icon: '🌊',
      emoji: '🌊',
    },
    {
      id: 'station-2',
      name: 'Hillside',
      position: 40,
      icon: '⛰️',
      emoji: '⛰️',
    },
    {
      id: 'station-3',
      name: 'Canyon View',
      position: 60,
      icon: '🏜️',
      emoji: '🏜️',
    },
    { id: 'station-4', name: 'Meadows', position: 80, icon: '🌾', emoji: '🌾' },
    {
      id: 'station-5',
      name: 'Grand Central',
      position: 100,
      icon: '🏛️',
      emoji: '🏛️',
    },
  ]

  // Override to playing phase with mid-game action
  // IMPORTANT: Set style to 'sprint' for Steam Sprint mode with train visualization
  return {
    ...baseState,
    config: {
      ...baseState.config,
      style: 'sprint', // Steam Sprint mode with train and passengers
    },
    style: 'sprint', // Also set at top level for local context
    gamePhase: 'playing',
    isGameActive: true,
    activePlayers: ['demo-player-1'],
    playerMetadata: {
      'demo-player-1': {
        name: 'Demo Player',
        color: '#3b82f6',
      },
    },
    players: {
      'demo-player-1': {
        id: 'demo-player-1',
        name: 'Demo Player',
        color: '#3b82f6',
        score: 420,
        streak: 5,
        bestStreak: 8,
        correctAnswers: 18,
        totalQuestions: 21,
        position: 65, // Well into the race
        isReady: true,
        isActive: true,
        currentAnswer: null,
        lastAnswerTime: Date.now() - 2000,
        passengers: ['p1'],
        deliveredPassengers: 5,
      },
    },
    currentQuestions: {
      'demo-player-1': {
        id: 'demo-q-current',
        number: 6,
        targetSum: 10,
        correctAnswer: 4,
        showAsAbacus: true,
        timestamp: Date.now() - 1500,
      },
    },
    currentQuestion: {
      id: 'demo-q-current',
      number: 6,
      targetSum: 10,
      correctAnswer: 4,
      showAsAbacus: true,
      timestamp: Date.now() - 1500,
    },
    // Sprint mode specific fields
    momentum: 45, // Mid-level momentum
    trainPosition: 65, // 65% along the track
    pressure: 30, // Some pressure building up
    elapsedTime: 45, // 45 seconds into the game
    lastCorrectAnswerTime: Date.now() - 2000,
    currentRoute: 1,
    stations: mockStations,
    passengers: mockPassengers,
    deliveredPassengers: 5,
    cumulativeDistance: 65,
    showRouteCelebration: false,
    questionStartTime: Date.now() - 1500,
    gameStartTime: Date.now() - 45000, // Game has been running for 45 seconds
    raceStartTime: Date.now() - 45000,
    // Additional fields for compatibility
    score: 420,
    streak: 5,
    bestStreak: 8,
    correctAnswers: 18,
    totalQuestions: 21,
    currentInput: '',
  }
}

/**
 * Create a mock state for Matching game in playing phase
 * Shows mid-game with some cards matched and one card flipped
 */
export function createMockMatchingState(): MatchingState {
  const baseState = matchingGameValidator.getInitialState(DEFAULT_MATCHING_CONFIG)

  // Create mock cards showing mid-game progress
  // 2 pairs matched, 1 card currently flipped (looking for its match)
  const mockGameCards = [
    // Matched pair 1
    {
      id: 'c1',
      type: 'number' as const,
      number: 5,
      matched: true,
      matchedBy: 'demo-player-1',
    },
    {
      id: 'c2',
      type: 'number' as const,
      number: 5,
      matched: true,
      matchedBy: 'demo-player-1',
    },
    // Matched pair 2
    {
      id: 'c3',
      type: 'number' as const,
      number: 8,
      matched: true,
      matchedBy: 'demo-player-1',
    },
    {
      id: 'c4',
      type: 'number' as const,
      number: 8,
      matched: true,
      matchedBy: 'demo-player-1',
    },
    // Unmatched cards - player is looking for matches
    { id: 'c5', type: 'number' as const, number: 3, matched: false },
    { id: 'c6', type: 'number' as const, number: 7, matched: false },
    { id: 'c7', type: 'number' as const, number: 3, matched: false },
    { id: 'c8', type: 'number' as const, number: 7, matched: false },
    { id: 'c9', type: 'number' as const, number: 2, matched: false },
    { id: 'c10', type: 'number' as const, number: 2, matched: false },
    { id: 'c11', type: 'number' as const, number: 9, matched: false },
    { id: 'c12', type: 'number' as const, number: 9, matched: false },
  ]

  // One card is currently flipped
  const flippedCard = mockGameCards[4] // The first "3"

  // Override to playing phase
  return {
    ...baseState,
    gamePhase: 'playing',
    activePlayers: ['demo-player-1'],
    playerMetadata: {
      'demo-player-1': {
        id: 'demo-player-1',
        name: 'Demo Player',
        emoji: '🎮',
        userId: 'demo-viewer-id',
        color: '#3b82f6',
      },
    },
    currentPlayer: 'demo-player-1',
    gameCards: mockGameCards,
    cards: mockGameCards,
    flippedCards: [flippedCard],
    scores: {
      'demo-player-1': 2,
    },
    consecutiveMatches: {
      'demo-player-1': 2,
    },
    matchedPairs: 2,
    totalPairs: 6,
    moves: 12,
    gameStartTime: Date.now() - 25000, // Game has been running for 25 seconds
    currentMoveStartTime: Date.now() - 500,
    isProcessingMove: false,
    showMismatchFeedback: false,
  }
}

/**
 * Create a mock state for Memory Quiz in input phase
 * Shows mid-game with some numbers already found
 */
export function createMockMemoryQuizState(): MemoryQuizState {
  const baseState = memoryQuizGameValidator.getInitialState(DEFAULT_MEMORY_QUIZ_CONFIG)

  // Create mock quiz cards
  const mockQuizCards = [
    { number: 123, svgComponent: null, element: null },
    { number: 456, svgComponent: null, element: null },
    { number: 789, svgComponent: null, element: null },
    { number: 234, svgComponent: null, element: null },
    { number: 567, svgComponent: null, element: null },
  ]

  // Override to input phase with some numbers found
  return {
    ...baseState,
    gamePhase: 'input',
    quizCards: mockQuizCards,
    correctAnswers: mockQuizCards.map((c) => c.number),
    cards: mockQuizCards,
    currentCardIndex: mockQuizCards.length, // Display phase complete
    foundNumbers: [123, 456], // 2 out of 5 found
    guessesRemaining: 3,
    currentInput: '',
    incorrectGuesses: 1,
    activePlayers: ['demo-player-1'],
    playerMetadata: {
      'demo-player-1': {
        id: 'demo-player-1',
        name: 'Demo Player',
        emoji: '🎮',
        userId: 'demo-viewer-id',
        color: '#3b82f6',
      },
    },
    playerScores: {
      'demo-viewer-id': {
        correct: 2,
        incorrect: 1,
      },
    },
    numberFoundBy: {
      123: 'demo-viewer-id',
      456: 'demo-viewer-id',
    },
    playMode: 'cooperative',
    selectedCount: 5,
    selectedDifficulty: 'medium',
    displayTime: 3000,
    hasPhysicalKeyboard: true,
    testingMode: false,
    showOnScreenKeyboard: false,
    prefixAcceptanceTimeout: null,
    finishButtonsBound: false,
    wrongGuessAnimations: [],
  }
}

/**
 * Create a mock state for Card Sorting in playing phase
 * Shows mid-game with some cards placed in sorting area
 */
export function createMockCardSortingState(): CardSortingState {
  const baseState = cardSortingValidator.getInitialState(DEFAULT_CARD_SORTING_CONFIG)

  // Create mock cards with AbacusReact SVG placeholders
  const mockCards = [
    { id: 'c1', number: 23, svgContent: '<svg>23</svg>' },
    { id: 'c2', number: 45, svgContent: '<svg>45</svg>' },
    { id: 'c3', number: 12, svgContent: '<svg>12</svg>' },
    { id: 'c4', number: 78, svgContent: '<svg>78</svg>' },
    { id: 'c5', number: 56, svgContent: '<svg>56</svg>' },
  ]

  // Correct order (sorted)
  const correctOrder = [...mockCards].sort((a, b) => a.number - b.number)

  // Show 3 cards placed, 2 still available
  return {
    ...baseState,
    gamePhase: 'playing',
    playerId: 'demo-player-1',
    playerMetadata: {
      id: 'demo-player-1',
      name: 'Demo Player',
      emoji: '🎮',
      userId: 'demo-viewer-id',
    },
    activePlayers: ['demo-player-1'],
    allPlayerMetadata: {
      'demo-player-1': {
        id: 'demo-player-1',
        name: 'Demo Player',
        emoji: '🎮',
        userId: 'demo-viewer-id',
      },
    },
    gameStartTime: Date.now() - 30000, // 30 seconds ago
    selectedCards: mockCards,
    correctOrder,
    availableCards: [mockCards[3], mockCards[4]], // 78 and 56 still available
    placedCards: [mockCards[2], mockCards[0], mockCards[1], null, null], // 12, 23, 45, empty, empty
    cardPositions: [],
    cursorPositions: {},
  }
}

/**
 * Create a mock state for Rithmomachia in playing phase
 * Shows mid-game with some pieces captured
 */
export function createMockRithmomachiaState(): RithmomachiaState {
  const baseState = rithmomachiaValidator.getInitialState(DEFAULT_RITHMOMACHIA_CONFIG)

  // Start the game (transitions to playing phase)
  return {
    ...baseState,
    gamePhase: 'playing',
    turn: 'W', // White's turn
    // Captured pieces show some progress
    capturedPieces: {
      W: [
        // White has captured 2 black pieces
        {
          id: 'B_C_01',
          color: 'B',
          type: 'C',
          value: 4,
          square: 'CAPTURED',
          captured: true,
        },
        {
          id: 'B_T_01',
          color: 'B',
          type: 'T',
          value: 9,
          square: 'CAPTURED',
          captured: true,
        },
      ],
      B: [
        // Black has captured 1 white piece
        {
          id: 'W_C_02',
          color: 'W',
          type: 'C',
          value: 6,
          square: 'CAPTURED',
          captured: true,
        },
      ],
    },
    history: [
      // Add a few moves to show activity
      {
        ply: 1,
        color: 'W',
        from: 'C2',
        to: 'C4',
        pieceId: 'W_C_01',
        capture: null,
        ambush: null,
        fenLikeHash: 'mock-hash-1',
        noProgressCount: 1,
        resultAfter: 'ONGOING',
      },
      {
        ply: 2,
        color: 'B',
        from: 'N7',
        to: 'N5',
        pieceId: 'B_T_02',
        capture: null,
        ambush: null,
        fenLikeHash: 'mock-hash-2',
        noProgressCount: 2,
        resultAfter: 'ONGOING',
      },
    ],
    noProgressCount: 2,
    stateHashes: ['initial-hash', 'mock-hash-1', 'mock-hash-2'],
  }
}

/**
 * Get mock state for any game by name
 */
export function getMockGameState(gameName: string): any {
  switch (gameName) {
    case 'complement-race':
      return createMockComplementRaceState()
    case 'matching':
      return createMockMatchingState()
    case 'memory-quiz':
      return createMockMemoryQuizState()
    case 'card-sorting':
      return createMockCardSortingState()
    case 'rithmomachia':
      return createMockRithmomachiaState()
    // For games we haven't implemented yet, return a basic "playing" state
    default:
      return {
        gamePhase: 'playing',
        activePlayers: ['demo-player-1'],
        playerMetadata: {
          'demo-player-1': {
            id: 'demo-player-1',
            name: 'Demo Player',
            emoji: '🎮',
            color: '#3b82f6',
            userId: 'demo-viewer-id',
          },
        },
      }
  }
}

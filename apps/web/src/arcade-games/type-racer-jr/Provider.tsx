'use client'

import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useGameMode } from '@/contexts/GameModeContext'
import { useArcadeSession } from '@/hooks/useArcadeSession'
import { useRoomData, useUpdateGameConfig } from '@/hooks/useRoomData'
import { useUserId } from '@/hooks/useUserId'
import {
  buildPlayerMetadata as buildPlayerMetadataUtil,
  buildPlayerOwnershipFromRoomData,
} from '@/lib/arcade/player-ownership.client'
import { useGameCompletionCallback } from '@/contexts/GameCompletionContext'
import { TEAM_MOVE } from '@/lib/arcade/validation/types'
import type {
  TypeRacerJrState,
  TypeRacerJrMove,
  TypeRacerJrConfig,
  DifficultyLevel,
  CompletedWord,
  WordEntry,
} from './types'
import { pickWords, type DifficultyLevel as WordDifficultyLevel } from './words'
import type { GameMove } from '@/lib/arcade/validation'

// ============================================================================
// Local-only typing state (not synced over network)
// ============================================================================

interface LocalTypingState {
  currentLetterIndex: number
  currentWordMistakes: number
  typedLetters: Array<{ letter: string; correct: boolean }>
  showCelebration: boolean
  celebrationStars: number
}

const initialLocalState: LocalTypingState = {
  currentLetterIndex: 0,
  currentWordMistakes: 0,
  typedLetters: [],
  showCelebration: false,
  celebrationStars: 0,
}

// ============================================================================
// Context interface
// ============================================================================

export interface TypeRacerJrContextValue {
  state: TypeRacerJrState
  localState: LocalTypingState
  isGameActive: boolean
  currentWord: WordEntry | null
  exitSession?: () => void

  // Actions
  startGame: () => void
  typeLetter: (letter: string) => void
  endGame: (reason: 'timer-expired' | 'player-quit') => void
  resetGame: () => void
  setConfig: (
    field: 'gameMode' | 'timeLimit' | 'startingDifficulty' | 'wordCount',
    value: unknown
  ) => void
  dismissCelebration: () => void
}

const TypeRacerJrContext = createContext<TypeRacerJrContextValue | null>(null)

export function useTypeRacerJr(): TypeRacerJrContextValue {
  const context = useContext(TypeRacerJrContext)
  if (!context) {
    throw new Error('useTypeRacerJr must be used within TypeRacerJrProvider')
  }
  return context
}

// ============================================================================
// Optimistic move application
// ============================================================================

function applyMoveOptimistically(state: TypeRacerJrState, move: GameMove): TypeRacerJrState {
  const typedMove = move as TypeRacerJrMove

  switch (typedMove.type) {
    case 'START_GAME':
      return {
        ...state,
        gamePhase: 'playing',
        wordQueue: typedMove.data.wordQueue,
        currentWordIndex: 0,
        completedWords: [],
        totalStars: 0,
        bestStreak: 0,
        consecutiveCleanWords: 0,
        usedWords: typedMove.data.wordQueue.map((w) => w.word),
        gameStartTime: Date.now(),
        currentWordStartTime: Date.now(),
        playerMetadata: typedMove.data.playerMetadata,
        endReason: null,
      }

    case 'COMPLETE_WORD': {
      const currentWord = state.wordQueue[state.currentWordIndex]
      const completedWord: CompletedWord = {
        word: typedMove.data.word,
        emoji: currentWord?.emoji ?? '',
        stars: typedMove.data.stars,
        mistakeCount: typedMove.data.mistakeCount,
        durationMs: typedMove.data.durationMs,
      }

      const newConsecutiveClean =
        typedMove.data.mistakeCount === 0 ? state.consecutiveCleanWords + 1 : 0
      const nextWordIndex = state.currentWordIndex + 1
      const allWordsDone = nextWordIndex >= state.wordQueue.length

      const newState: TypeRacerJrState = {
        ...state,
        completedWords: [...state.completedWords, completedWord],
        currentWordIndex: nextWordIndex,
        totalStars: state.totalStars + typedMove.data.stars,
        consecutiveCleanWords: newConsecutiveClean,
        bestStreak: Math.max(state.bestStreak, newConsecutiveClean),
        currentWordStartTime: allWordsDone ? null : Date.now(),
      }

      if (allWordsDone) {
        return { ...newState, gamePhase: 'results', endReason: 'all-words-done' }
      }
      return newState
    }

    case 'ADVANCE_DIFFICULTY':
      return {
        ...state,
        currentDifficulty: typedMove.data.newDifficulty,
        wordQueue: [...state.wordQueue, ...typedMove.data.newWords],
        usedWords: [...state.usedWords, ...typedMove.data.newWords.map((w) => w.word)],
        consecutiveCleanWords: 0,
      }

    case 'END_GAME':
      return { ...state, gamePhase: 'results', endReason: typedMove.data.reason }

    case 'SET_CONFIG': {
      const { field, value } = typedMove.data
      if (field === 'gameMode') {
        return {
          ...state,
          gameMode: value as TypeRacerJrState['gameMode'],
          timeLimit: value === 'beat-the-clock' ? (state.timeLimit ?? 60) : null,
          wordCount: value === 'free-play' ? (state.wordCount ?? 5) : null,
        }
      }
      if (field === 'startingDifficulty') {
        return { ...state, currentDifficulty: value as DifficultyLevel }
      }
      return { ...state, [field]: value }
    }

    case 'RESET_GAME':
      return {
        ...state,
        gamePhase: 'setup',
        wordQueue: [],
        currentWordIndex: 0,
        completedWords: [],
        totalStars: 0,
        bestStreak: 0,
        consecutiveCleanWords: 0,
        usedWords: [],
        gameStartTime: null,
        currentWordStartTime: null,
        endReason: null,
      }

    default:
      return state
  }
}

// ============================================================================
// Star calculation
// ============================================================================

function calculateStars(mistakeCount: number, durationMs: number, wordLength: number): number {
  // 3 stars: 0 mistakes + fast (< 1.5s per letter)
  // 2 stars: 0 mistakes
  // 1 star: completed
  if (mistakeCount === 0) {
    const msPerLetter = durationMs / wordLength
    return msPerLetter < 1500 ? 3 : 2
  }
  return 1
}

// ============================================================================
// Provider
// ============================================================================

export function TypeRacerJrProvider({ children }: { children: ReactNode }) {
  const { data: viewerId } = useUserId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  const activePlayers = Array.from(activePlayerIds)

  // Local typing state (not synced)
  const [localState, setLocalState] = useState<LocalTypingState>(initialLocalState)
  const wordStartTimeRef = useRef<number>(Date.now())

  // Merge saved game config
  const mergedInitialState = useMemo((): TypeRacerJrState => {
    const gameConfig = roomData?.gameConfig as Record<string, unknown> | null | undefined
    const savedConfig = gameConfig?.['type-racer-jr'] as Record<string, unknown> | null | undefined

    const defaultState: TypeRacerJrState = {
      gamePhase: 'setup',
      gameMode: 'free-play',
      timeLimit: null,
      wordCount: 5,
      currentDifficulty: 'level1',
      consecutiveCleanWords: 0,
      wordQueue: [],
      currentWordIndex: 0,
      completedWords: [],
      usedWords: [],
      totalStars: 0,
      bestStreak: 0,
      gameStartTime: null,
      currentWordStartTime: null,
      playerId: '',
      playerMetadata: {},
      endReason: null,
    }

    if (!savedConfig) return defaultState

    return {
      ...defaultState,
      gameMode: (savedConfig.gameMode as TypeRacerJrState['gameMode']) ?? defaultState.gameMode,
      timeLimit: (savedConfig.timeLimit as TypeRacerJrState['timeLimit']) ?? defaultState.timeLimit,
      currentDifficulty:
        (savedConfig.startingDifficulty as DifficultyLevel) ?? defaultState.currentDifficulty,
      wordCount: (savedConfig.wordCount as number | null) ?? defaultState.wordCount,
    }
  }, [roomData?.gameConfig])

  // Arcade session
  const { state, sendMove, exitSession } = useArcadeSession<TypeRacerJrState>({
    userId: viewerId || '',
    roomId: roomData?.id || undefined,
    initialState: mergedInitialState,
    applyMove: applyMoveOptimistically,
  })

  // Game completion callback (for practice breaks)
  const onGameComplete = useGameCompletionCallback()
  const previousPhaseRef = useRef<string | null>(null)
  useEffect(() => {
    if (state.gamePhase === 'results' && previousPhaseRef.current !== 'results' && onGameComplete) {
      onGameComplete(state as unknown as Record<string, unknown>)
    }
    previousPhaseRef.current = state.gamePhase
  }, [state.gamePhase, onGameComplete, state])

  // Reset local state when game phase changes
  useEffect(() => {
    if (state.gamePhase === 'playing') {
      setLocalState(initialLocalState)
      wordStartTimeRef.current = Date.now()
    }
  }, [state.gamePhase])

  // Current word
  const currentWord: WordEntry | null =
    state.gamePhase === 'playing' && state.currentWordIndex < state.wordQueue.length
      ? state.wordQueue[state.currentWordIndex]
      : null

  // Build player metadata
  const buildPlayerMeta = useCallback(() => {
    const playerOwnership = buildPlayerOwnershipFromRoomData(roomData)
    return buildPlayerMetadataUtil(activePlayers, playerOwnership, players, viewerId || undefined)
  }, [activePlayers, players, roomData, viewerId])

  // ---- Action: Start Game ----
  const startGame = useCallback(() => {
    const wordCount = state.gameMode === 'free-play' ? (state.wordCount ?? 5) : 50 // Beat the clock: large pool

    const words = pickWords(state.currentDifficulty as WordDifficultyLevel, wordCount)

    const playerMetadata = buildPlayerMeta()

    sendMove({
      type: 'START_GAME',
      playerId: TEAM_MOVE,
      userId: viewerId || '',

      data: { wordQueue: words, playerMetadata },
    })

    setLocalState(initialLocalState)
    wordStartTimeRef.current = Date.now()
  }, [
    state.gameMode,
    state.wordCount,
    state.currentDifficulty,
    viewerId,
    sendMove,
    buildPlayerMeta,
  ])

  // ---- Action: Type Letter ----
  const typeLetter = useCallback(
    (letter: string) => {
      if (!currentWord || state.gamePhase !== 'playing') return

      const expectedLetter = currentWord.word[localState.currentLetterIndex]
      if (!expectedLetter) return

      const isCorrect = letter === expectedLetter.toLowerCase()

      if (isCorrect) {
        const newTypedLetters = [...localState.typedLetters, { letter, correct: true }]
        const newIndex = localState.currentLetterIndex + 1

        // Check if word is complete
        if (newIndex >= currentWord.word.length) {
          const durationMs = Date.now() - wordStartTimeRef.current
          const stars = calculateStars(
            localState.currentWordMistakes,
            durationMs,
            currentWord.word.length
          )

          // Show celebration
          setLocalState({
            currentLetterIndex: newIndex,
            currentWordMistakes: localState.currentWordMistakes,
            typedLetters: newTypedLetters,
            showCelebration: true,
            celebrationStars: stars,
          })

          // Send COMPLETE_WORD move
          sendMove({
            type: 'COMPLETE_WORD',
            playerId: TEAM_MOVE,
            userId: viewerId || '',

            data: {
              word: currentWord.word,
              stars,
              mistakeCount: localState.currentWordMistakes,
              durationMs,
            },
          })

          // Check if difficulty should advance
          const newConsecutiveClean =
            localState.currentWordMistakes === 0 ? state.consecutiveCleanWords + 1 : 0

          if (newConsecutiveClean >= 3) {
            const nextDifficulty = getNextDifficulty(state.currentDifficulty)
            if (nextDifficulty) {
              const usedSet = new Set(state.usedWords)
              const newWords = pickWords(nextDifficulty as WordDifficultyLevel, 10, usedSet)

              sendMove({
                type: 'ADVANCE_DIFFICULTY',
                playerId: TEAM_MOVE,
                userId: viewerId || '',

                data: { newDifficulty: nextDifficulty, newWords },
              })
            }
          }
        } else {
          setLocalState((prev) => ({
            ...prev,
            currentLetterIndex: newIndex,
            typedLetters: newTypedLetters,
          }))
        }
      } else {
        // Wrong key — increment mistakes, stay on same letter
        setLocalState((prev) => ({
          ...prev,
          currentWordMistakes: prev.currentWordMistakes + 1,
          typedLetters: [...prev.typedLetters, { letter, correct: false }],
        }))
      }
    },
    [
      currentWord,
      state.gamePhase,
      state.consecutiveCleanWords,
      state.currentDifficulty,
      state.usedWords,
      localState,
      viewerId,
      sendMove,
    ]
  )

  // ---- Action: Dismiss Celebration ----
  const dismissCelebration = useCallback(() => {
    setLocalState({
      ...initialLocalState,
    })
    wordStartTimeRef.current = Date.now()
  }, [])

  // ---- Action: End Game ----
  const endGame = useCallback(
    (reason: 'timer-expired' | 'player-quit') => {
      sendMove({
        type: 'END_GAME',
        playerId: TEAM_MOVE,
        userId: viewerId || '',

        data: { reason },
      })
    },
    [viewerId, sendMove]
  )

  // ---- Action: Reset Game ----
  const resetGame = useCallback(() => {
    sendMove({
      type: 'RESET_GAME',
      playerId: TEAM_MOVE,
      userId: viewerId || '',

      data: {},
    })
    setLocalState(initialLocalState)
  }, [viewerId, sendMove])

  // ---- Action: Set Config ----
  const setConfig = useCallback(
    (field: 'gameMode' | 'timeLimit' | 'startingDifficulty' | 'wordCount', value: unknown) => {
      sendMove({
        type: 'SET_CONFIG',
        playerId: TEAM_MOVE,
        userId: viewerId || '',

        data: { field, value },
      })

      // Persist to room config
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, unknown>) || {}
        const currentConfig = (currentGameConfig['type-racer-jr'] as Record<string, unknown>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'type-racer-jr': {
              ...currentConfig,
              [field]: value,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData?.id, roomData?.gameConfig, updateGameConfig]
  )

  const isGameActive = state.gamePhase === 'playing'

  const contextValue: TypeRacerJrContextValue = {
    state,
    localState,
    isGameActive,
    currentWord,
    exitSession,
    startGame,
    typeLetter,
    endGame,
    resetGame,
    setConfig,
    dismissCelebration,
  }

  return <TypeRacerJrContext.Provider value={contextValue}>{children}</TypeRacerJrContext.Provider>
}

// ============================================================================
// Helpers
// ============================================================================

function getNextDifficulty(current: DifficultyLevel): DifficultyLevel | null {
  switch (current) {
    case 'level1':
      return 'level2'
    case 'level2':
      return 'level3'
    default:
      return null
  }
}

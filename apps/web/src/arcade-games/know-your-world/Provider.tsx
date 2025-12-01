'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildPlayerMetadata,
  useArcadeSession,
  useGameMode,
  useRoomData,
  useUpdateGameConfig,
  useViewerId,
} from '@/lib/arcade/game-sdk'
import { buildPlayerOwnershipFromRoomData } from '@/lib/arcade/player-ownership.client'
import type { KnowYourWorldState, AssistanceLevel } from './types'
import type { RegionSize } from './maps'
import type { FeedbackType } from './utils/hotColdPhrases'
import { MusicProvider } from './music'

// Controls state for GameInfoPanel (set by MapRenderer, read by GameInfoPanel)
export interface ControlsState {
  // Pointer lock state
  isPointerLocked: boolean
  fakeCursorPosition: { x: number; y: number } | null

  // Hot/cold state
  showHotCold: boolean
  hotColdEnabled: boolean
  hotColdFeedbackType: FeedbackType | null
  onHotColdToggle: () => void

  // Hint state
  hasHint: boolean
  currentHint: string | null

  // Give up animation state
  isGiveUpAnimating: boolean

  // Speech/audio state
  isSpeechSupported: boolean
  hasAccentOption: boolean
  isSpeaking: boolean
  onSpeak: () => void
  onStopSpeaking: () => void

  // Auto settings
  autoSpeak: boolean
  onAutoSpeakToggle: () => void
  withAccent: boolean
  onWithAccentToggle: () => void
  autoHint: boolean
  onAutoHintToggle: () => void
}

// Celebration state for correct region finds
export type CelebrationType = 'lightning' | 'standard' | 'hard-earned'

export interface CelebrationState {
  regionId: string
  regionName: string
  type: CelebrationType
  startTime: number
}

// Puzzle piece animation target (Learning mode only)
// Contains the screen position where the region silhouette should animate to
export interface PuzzlePieceTarget {
  regionId: string
  regionName: string
  celebrationType: CelebrationType
  // Target screen position (top-left of where the region appears on the map)
  x: number
  y: number
  // Target screen dimensions
  width: number
  height: number
  // SVG coordinate bounding box (from getBBox()) for correct viewBox
  svgBBox: {
    x: number
    y: number
    width: number
    height: number
  }
  // Source screen position (from takeover screen) - populated by GameInfoPanel
  sourceRect?: {
    x: number
    y: number
    width: number
    height: number
  }
}

const defaultControlsState: ControlsState = {
  isPointerLocked: false,
  fakeCursorPosition: null,
  showHotCold: false,
  hotColdEnabled: false,
  hotColdFeedbackType: null,
  onHotColdToggle: () => {},
  hasHint: false,
  currentHint: null,
  isGiveUpAnimating: false,
  // Speech/audio defaults
  isSpeechSupported: false,
  hasAccentOption: false,
  isSpeaking: false,
  onSpeak: () => {},
  onStopSpeaking: () => {},
  // Auto settings defaults
  autoSpeak: false,
  onAutoSpeakToggle: () => {},
  withAccent: false,
  onWithAccentToggle: () => {},
  autoHint: false,
  onAutoHintToggle: () => {},
}

interface KnowYourWorldContextValue {
  state: KnowYourWorldState
  lastError: string | null
  clearError: () => void
  exitSession: () => void

  // Game actions
  startGame: () => void
  clickRegion: (regionId: string, regionName: string) => void
  nextRound: () => void
  endGame: () => void
  giveUp: () => void
  requestHint: () => void
  returnToSetup: () => void
  confirmLetter: (letter: string, letterIndex: number) => void

  // Setup actions
  setMap: (map: 'world' | 'usa') => void
  setMode: (mode: 'cooperative' | 'race' | 'turn-based') => void
  setRegionSizes: (sizes: RegionSize[]) => void
  setAssistanceLevel: (level: AssistanceLevel) => void
  setContinent: (continent: import('./continents').ContinentId | 'all') => void

  // Cursor position sharing (for multiplayer)
  otherPlayerCursors: Record<
    string,
    {
      x: number
      y: number
      userId: string
      hoveredRegionId: string | null
    } | null
  >
  sendCursorUpdate: (
    playerId: string,
    userId: string,
    cursorPosition: { x: number; y: number } | null,
    hoveredRegionId: string | null
  ) => void

  // Member players mapping (userId -> players) for cursor emoji display
  memberPlayers: Record<string, Array<{ id: string; name: string; emoji: string; color: string }>>

  // Controls state shared between MapRenderer and GameInfoPanel
  controlsState: ControlsState
  setControlsState: React.Dispatch<React.SetStateAction<ControlsState>>

  // Learning mode takeover state (set by GameInfoPanel, read by MapRenderer)
  // When true, a scrim covers the map and user can't interact
  isInTakeover: boolean
  setIsInTakeover: React.Dispatch<React.SetStateAction<boolean>>

  // Celebration state for correct region finds
  celebration: CelebrationState | null
  setCelebration: React.Dispatch<React.SetStateAction<CelebrationState | null>>
  promptStartTime: React.MutableRefObject<number>

  // Puzzle piece animation state (Learning mode only)
  // When set, GameInfoPanel animates the region silhouette to the target position
  puzzlePieceTarget: PuzzlePieceTarget | null
  setPuzzlePieceTarget: React.Dispatch<React.SetStateAction<PuzzlePieceTarget | null>>

  // Shared container ref for pointer lock button detection
  sharedContainerRef: React.RefObject<HTMLDivElement>
}

const KnowYourWorldContext = createContext<KnowYourWorldContextValue | null>(null)

export function useKnowYourWorld() {
  const context = useContext(KnowYourWorldContext)
  if (!context) {
    throw new Error('useKnowYourWorld must be used within KnowYourWorldProvider')
  }
  return context
}

export function KnowYourWorldProvider({ children }: { children: React.ReactNode }) {
  const { data: viewerId } = useViewerId()
  const { roomData } = useRoomData()
  const { activePlayers: activePlayerIds, players } = useGameMode()
  const { mutate: updateGameConfig } = useUpdateGameConfig()

  const activePlayers = Array.from(activePlayerIds)

  // Controls state shared between MapRenderer and GameInfoPanel
  const [controlsState, setControlsState] = useState<ControlsState>(defaultControlsState)

  // Learning mode takeover state (set by GameInfoPanel, read by MapRenderer)
  const [isInTakeover, setIsInTakeover] = useState(false)

  // Celebration state for correct region finds
  const [celebration, setCelebration] = useState<CelebrationState | null>(null)
  const promptStartTime = useRef<number>(Date.now())

  // Puzzle piece animation state (Learning mode only)
  const [puzzlePieceTarget, setPuzzlePieceTarget] = useState<PuzzlePieceTarget | null>(null)

  // Shared container ref for pointer lock button detection
  const sharedContainerRef = useRef<HTMLDivElement>(null)

  // Merge saved config from room
  const initialState = useMemo(() => {
    const gameConfig = (roomData?.gameConfig as any)?.['know-your-world']

    // Validate selectedContinent
    const rawContinent = gameConfig?.selectedContinent
    const validContinents = [
      'all',
      'africa',
      'asia',
      'europe',
      'north-america',
      'south-america',
      'oceania',
      'antarctica',
    ]
    const selectedContinent: import('./continents').ContinentId | 'all' =
      typeof rawContinent === 'string' && validContinents.includes(rawContinent)
        ? (rawContinent as any)
        : 'all'

    // Validate includeSizes - should be an array of valid size strings
    const validSizes: RegionSize[] = ['huge', 'large', 'medium', 'small', 'tiny']
    const rawSizes = gameConfig?.includeSizes
    const includeSizes: RegionSize[] = Array.isArray(rawSizes)
      ? rawSizes.filter((s: string) => validSizes.includes(s as RegionSize))
      : ['huge', 'large', 'medium'] // Default to most regions

    // Validate assistanceLevel
    const validAssistanceLevels = ['learning', 'guided', 'helpful', 'standard', 'none']
    const rawAssistance = gameConfig?.assistanceLevel
    const assistanceLevel: AssistanceLevel =
      typeof rawAssistance === 'string' && validAssistanceLevels.includes(rawAssistance)
        ? (rawAssistance as AssistanceLevel)
        : 'helpful'

    return {
      gamePhase: 'setup' as const,
      selectedMap: (gameConfig?.selectedMap as 'world' | 'usa') || 'world',
      gameMode: (gameConfig?.gameMode as 'cooperative' | 'race' | 'turn-based') || 'cooperative',
      includeSizes,
      assistanceLevel,
      selectedContinent,
      currentPrompt: null,
      regionsToFind: [],
      regionsFound: [],
      regionsGivenUp: [],
      currentPlayer: '',
      scores: {},
      attempts: {},
      guessHistory: [],
      startTime: 0,
      activePlayers: [],
      activeUserIds: [],
      playerMetadata: {},
      giveUpReveal: null,
      giveUpVotes: [],
      hintsUsed: 0,
      hintActive: null,
      nameConfirmationProgress: 0,
    }
  }, [roomData])

  const {
    state,
    sendMove,
    exitSession,
    lastError,
    clearError,
    otherPlayerCursors,
    sendCursorUpdate: sessionSendCursorUpdate,
  } = useArcadeSession<KnowYourWorldState>({
    userId: viewerId || '',
    roomId: roomData?.id,
    initialState,
    applyMove: (state) => state, // Server handles all state updates
  })

  // Update promptStartTime when currentPrompt changes (for celebration timing)
  useEffect(() => {
    if (state.currentPrompt) {
      promptStartTime.current = Date.now()
    }
  }, [state.currentPrompt])

  // Pass through cursor updates with the provided player ID and userId
  const sendCursorUpdate = useCallback(
    (
      playerId: string,
      sessionUserId: string,
      cursorPosition: { x: number; y: number } | null,
      hoveredRegionId: string | null
    ) => {
      if (playerId && sessionUserId) {
        sessionSendCursorUpdate(playerId, sessionUserId, cursorPosition, hoveredRegionId)
      }
    },
    [sessionSendCursorUpdate]
  )

  // Action: Start Game
  const startGame = useCallback(() => {
    // Build ownership map from roomData to correctly map players to their owners
    const ownershipMap = buildPlayerOwnershipFromRoomData(roomData)
    const playerMetadata = buildPlayerMetadata(
      activePlayers,
      ownershipMap,
      players,
      viewerId || undefined
    )

    sendMove({
      type: 'START_GAME',
      playerId: activePlayers[0] || 'player-1',
      userId: viewerId || '',
      data: {
        activePlayers,
        playerMetadata,
        selectedMap: state.selectedMap,
        gameMode: state.gameMode,
        includeSizes: state.includeSizes,
        assistanceLevel: state.assistanceLevel,
      },
    })
  }, [
    activePlayers,
    players,
    viewerId,
    roomData,
    sendMove,
    state.selectedMap,
    state.gameMode,
    state.includeSizes,
    state.assistanceLevel,
  ])

  // Action: Click Region
  const clickRegion = useCallback(
    (regionId: string, regionName: string) => {
      console.log('[CLICK] clickRegion called:', {
        regionId,
        regionName,
        currentPlayer: state.currentPlayer,
        viewerId,
        currentPrompt: state.currentPrompt,
        isCorrect: regionId === state.currentPrompt,
      })

      // Use the current player from game state (PLAYER ID, not USER ID)
      // In turn-based mode, this is the player whose turn it is
      // In other modes, all moves use the current player ID
      sendMove({
        type: 'CLICK_REGION',
        playerId: state.currentPlayer, // CRITICAL: Use PLAYER ID from state, not USER ID
        userId: viewerId || '',
        data: { regionId, regionName },
      })

      console.log('[CLICK] sendMove dispatched')
    },
    [viewerId, sendMove, state.currentPlayer, state.currentPrompt]
  )

  // Action: Next Round
  const nextRound = useCallback(() => {
    sendMove({
      type: 'NEXT_ROUND',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [activePlayers, viewerId, sendMove, state.currentPlayer])

  // Action: End Game
  const endGame = useCallback(() => {
    sendMove({
      type: 'END_GAME',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove, state.currentPlayer, activePlayers])

  // Action: Give Up (skip current region, reveal it, move to next)
  const giveUp = useCallback(() => {
    sendMove({
      type: 'GIVE_UP',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove, state.currentPlayer, activePlayers])

  // Action: Request Hint (highlight current region briefly)
  const requestHint = useCallback(() => {
    sendMove({
      type: 'REQUEST_HINT',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove, state.currentPlayer, activePlayers])

  // Action: Confirm Letter (for learning mode name confirmation)
  const confirmLetter = useCallback(
    (letter: string, letterIndex: number) => {
      sendMove({
        type: 'CONFIRM_LETTER',
        playerId: state.currentPlayer || activePlayers[0] || '',
        userId: viewerId || '',
        data: { letter, letterIndex },
      })
    },
    [viewerId, sendMove, state.currentPlayer, activePlayers]
  )

  // Setup Action: Set Map
  const setMap = useCallback(
    (selectedMap: 'world' | 'usa') => {
      sendMove({
        type: 'SET_MAP',
        playerId: activePlayers[0] || '', // Use first active player
        userId: viewerId || '',
        data: { selectedMap },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              selectedMap,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Setup Action: Set Mode
  const setMode = useCallback(
    (gameMode: 'cooperative' | 'race' | 'turn-based') => {
      sendMove({
        type: 'SET_MODE',
        playerId: activePlayers[0] || '', // Use first active player
        userId: viewerId || '',
        data: { gameMode },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              gameMode,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Setup Action: Set Region Sizes (which sizes to include)
  const setRegionSizes = useCallback(
    (includeSizes: RegionSize[]) => {
      sendMove({
        type: 'SET_REGION_SIZES',
        playerId: activePlayers[0] || '',
        userId: viewerId || '',
        data: { includeSizes },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              includeSizes,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Setup Action: Set Assistance Level
  const setAssistanceLevel = useCallback(
    (assistanceLevel: AssistanceLevel) => {
      sendMove({
        type: 'SET_ASSISTANCE_LEVEL',
        playerId: activePlayers[0] || '',
        userId: viewerId || '',
        data: { assistanceLevel },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              assistanceLevel,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Setup Action: Set Continent
  const setContinent = useCallback(
    (selectedContinent: import('./continents').ContinentId | 'all') => {
      sendMove({
        type: 'SET_CONTINENT',
        playerId: activePlayers[0] || '', // Use first active player
        userId: viewerId || '',
        data: { selectedContinent },
      })

      // Persist to database
      if (roomData?.id) {
        const currentGameConfig = (roomData.gameConfig as Record<string, any>) || {}
        const currentConfig = (currentGameConfig['know-your-world'] as Record<string, any>) || {}

        updateGameConfig({
          roomId: roomData.id,
          gameConfig: {
            ...currentGameConfig,
            'know-your-world': {
              ...currentConfig,
              selectedContinent,
            },
          },
        })
      }
    },
    [viewerId, sendMove, roomData, updateGameConfig, activePlayers]
  )

  // Action: Return to Setup
  const returnToSetup = useCallback(() => {
    sendMove({
      type: 'RETURN_TO_SETUP',
      playerId: state.currentPlayer || activePlayers[0] || '',
      userId: viewerId || '',
      data: {},
    })
  }, [viewerId, sendMove, state.currentPlayer, activePlayers])

  // Memoize memberPlayers from roomData for cursor emoji display
  const memberPlayers = useMemo(() => {
    return (roomData?.memberPlayers ?? {}) as Record<
      string,
      Array<{ id: string; name: string; emoji: string; color: string }>
    >
  }, [roomData?.memberPlayers])

  // Music is active when game is in playing phase
  const isMusicActive = state.gamePhase === 'playing'

  // Pass celebration state to music provider (with type only)
  const musicCelebration = celebration ? { type: celebration.type } : null

  return (
    <KnowYourWorldContext.Provider
      value={{
        state,
        lastError,
        clearError,
        exitSession,
        startGame,
        clickRegion,
        nextRound,
        endGame,
        giveUp,
        requestHint,
        confirmLetter,
        returnToSetup,
        setMap,
        setMode,
        setRegionSizes,
        setAssistanceLevel,
        setContinent,
        otherPlayerCursors,
        sendCursorUpdate,
        memberPlayers,
        controlsState,
        setControlsState,
        isInTakeover,
        setIsInTakeover,
        celebration,
        setCelebration,
        promptStartTime,
        puzzlePieceTarget,
        setPuzzlePieceTarget,
        sharedContainerRef,
      }}
    >
      <MusicProvider
        isGameActive={isMusicActive}
        currentRegionId={state.currentPrompt}
        mapType={state.selectedMap}
        hotColdFeedback={controlsState.hotColdFeedbackType}
        celebration={musicCelebration}
      >
        {children}
      </MusicProvider>
    </KnowYourWorldContext.Provider>
  )
}

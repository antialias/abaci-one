import type { GameValidator, ValidationResult } from '@/lib/arcade/game-sdk'
import type {
  KnowYourWorldConfig,
  KnowYourWorldMove,
  KnowYourWorldState,
  GuessRecord,
} from './types'

/**
 * Lazy-load map functions to avoid importing ES modules at module init time
 * This is critical for server-side usage where ES modules can't be required
 */
async function getFilteredMapDataLazy(
  ...args: Parameters<typeof import('./maps').getFilteredMapData>
) {
  const { getFilteredMapData } = await import('./maps')
  return getFilteredMapData(...args)
}

export class KnowYourWorldValidator
  implements GameValidator<KnowYourWorldState, KnowYourWorldMove>
{
  async validateMove(
    state: KnowYourWorldState,
    move: KnowYourWorldMove
  ): Promise<ValidationResult> {
    switch (move.type) {
      case 'START_GAME':
        return await this.validateStartGame(state, move.data)
      case 'CLICK_REGION':
        return this.validateClickRegion(state, move.playerId, move.data)
      case 'NEXT_ROUND':
        return await this.validateNextRound(state)
      case 'END_GAME':
        return this.validateEndGame(state)
      case 'END_STUDY':
        return this.validateEndStudy(state)
      case 'RETURN_TO_SETUP':
        return this.validateReturnToSetup(state)
      case 'SET_MAP':
        return this.validateSetMap(state, move.data.selectedMap)
      case 'SET_MODE':
        return this.validateSetMode(state, move.data.gameMode)
      case 'SET_DIFFICULTY':
        return this.validateSetDifficulty(state, move.data.difficulty)
      case 'SET_STUDY_DURATION':
        return this.validateSetStudyDuration(state, move.data.studyDuration)
      case 'SET_CONTINENT':
        return this.validateSetContinent(state, move.data.selectedContinent)
      default:
        return { valid: false, error: 'Unknown move type' }
    }
  }

  private async validateStartGame(state: KnowYourWorldState, data: any): Promise<ValidationResult> {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only start from setup phase' }
    }

    const { activePlayers, playerMetadata, selectedMap, gameMode, difficulty } = data

    if (!activePlayers || activePlayers.length === 0) {
      return { valid: false, error: 'Need at least 1 player' }
    }

    // Get map data and shuffle regions (with continent and difficulty filters)
    const mapData = await getFilteredMapDataLazy(selectedMap, state.selectedContinent, difficulty)
    const regionIds = mapData.regions.map((r) => r.id)
    const shuffledRegions = this.shuffleArray([...regionIds])

    // Initialize scores and attempts
    const scores: Record<string, number> = {}
    const attempts: Record<string, number> = {}
    for (const playerId of activePlayers) {
      scores[playerId] = 0
      attempts[playerId] = 0
    }

    // Check if we should go to study phase or directly to playing
    const shouldStudy = state.studyDuration > 0

    const newState: KnowYourWorldState = {
      ...state,
      gamePhase: shouldStudy ? 'studying' : 'playing',
      activePlayers,
      playerMetadata,
      selectedMap,
      gameMode,
      difficulty,
      studyTimeRemaining: shouldStudy ? state.studyDuration : 0,
      studyStartTime: shouldStudy ? Date.now() : 0,
      currentPrompt: shouldStudy ? null : shuffledRegions[0],
      regionsToFind: shuffledRegions.slice(shouldStudy ? 0 : 1),
      regionsFound: [],
      currentPlayer: activePlayers[0],
      scores,
      attempts,
      guessHistory: [],
      startTime: Date.now(),
    }

    return { valid: true, newState }
  }

  private validateClickRegion(
    state: KnowYourWorldState,
    playerId: string,
    data: any
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Can only click regions during playing phase' }
    }

    if (!state.currentPrompt) {
      return { valid: false, error: 'No region to find' }
    }

    const { regionId, regionName } = data

    // Turn-based mode: Check if it's this player's turn
    if (state.gameMode === 'turn-based' && state.currentPlayer !== playerId) {
      return { valid: false, error: 'Not your turn' }
    }

    const isCorrect = regionId === state.currentPrompt
    const guessRecord: GuessRecord = {
      playerId,
      regionId,
      regionName,
      correct: isCorrect,
      attempts: 1,
      timestamp: Date.now(),
    }

    if (isCorrect) {
      // Correct guess!
      const newScores = { ...state.scores }
      const newRegionsFound = [...state.regionsFound, regionId]
      const guessHistory = [...state.guessHistory, guessRecord]

      // Award points based on mode
      if (state.gameMode === 'cooperative') {
        // In cooperative mode, all players share the score
        for (const pid of state.activePlayers) {
          newScores[pid] = (newScores[pid] || 0) + 10
        }
      } else {
        // In race and turn-based, only the player who guessed gets points
        newScores[playerId] = (newScores[playerId] || 0) + 10
      }

      // Check if all regions found
      if (state.regionsToFind.length === 0) {
        // Game complete!
        const newState: KnowYourWorldState = {
          ...state,
          gamePhase: 'results',
          currentPrompt: null,
          regionsFound: newRegionsFound,
          scores: newScores,
          guessHistory,
          endTime: Date.now(),
        }
        return { valid: true, newState }
      }

      // Move to next region
      const nextPrompt = state.regionsToFind[0]
      const remainingRegions = state.regionsToFind.slice(1)

      // For turn-based mode, rotate to next player
      let nextPlayer = state.currentPlayer
      if (state.gameMode === 'turn-based') {
        const currentIndex = state.activePlayers.indexOf(state.currentPlayer)
        const nextIndex = (currentIndex + 1) % state.activePlayers.length
        nextPlayer = state.activePlayers[nextIndex]
      }

      const newState: KnowYourWorldState = {
        ...state,
        currentPrompt: nextPrompt,
        regionsToFind: remainingRegions,
        regionsFound: newRegionsFound,
        currentPlayer: nextPlayer,
        scores: newScores,
        guessHistory,
      }

      return { valid: true, newState }
    } else {
      // Incorrect guess
      const newAttempts = { ...state.attempts }
      newAttempts[playerId] = (newAttempts[playerId] || 0) + 1

      const guessHistory = [...state.guessHistory, guessRecord]

      // For turn-based mode, rotate to next player after wrong guess
      let nextPlayer = state.currentPlayer
      if (state.gameMode === 'turn-based') {
        const currentIndex = state.activePlayers.indexOf(state.currentPlayer)
        const nextIndex = (currentIndex + 1) % state.activePlayers.length
        nextPlayer = state.activePlayers[nextIndex]
      }

      const newState: KnowYourWorldState = {
        ...state,
        attempts: newAttempts,
        guessHistory,
        currentPlayer: nextPlayer,
      }

      return {
        valid: true,
        newState,
        error: `Incorrect! Try again. Looking for: ${state.currentPrompt}`,
      }
    }
  }

  private async validateNextRound(state: KnowYourWorldState): Promise<ValidationResult> {
    if (state.gamePhase !== 'results') {
      return { valid: false, error: 'Can only start next round from results' }
    }

    // Get map data and shuffle regions (with continent and difficulty filters)
    const mapData = await getFilteredMapDataLazy(
      state.selectedMap,
      state.selectedContinent,
      state.difficulty
    )
    const regionIds = mapData.regions.map((r) => r.id)
    const shuffledRegions = this.shuffleArray([...regionIds])

    // Reset game state but keep players and config
    const scores: Record<string, number> = {}
    const attempts: Record<string, number> = {}
    for (const playerId of state.activePlayers) {
      scores[playerId] = 0
      attempts[playerId] = 0
    }

    // Check if we should go to study phase or directly to playing
    const shouldStudy = state.studyDuration > 0

    const newState: KnowYourWorldState = {
      ...state,
      gamePhase: shouldStudy ? 'studying' : 'playing',
      studyTimeRemaining: shouldStudy ? state.studyDuration : 0,
      studyStartTime: shouldStudy ? Date.now() : 0,
      currentPrompt: shouldStudy ? null : shuffledRegions[0],
      regionsToFind: shuffledRegions.slice(shouldStudy ? 0 : 1),
      regionsFound: [],
      currentPlayer: state.activePlayers[0],
      scores,
      attempts,
      guessHistory: [],
      startTime: Date.now(),
      endTime: undefined,
    }

    return { valid: true, newState }
  }

  private validateEndGame(state: KnowYourWorldState): ValidationResult {
    const newState: KnowYourWorldState = {
      ...state,
      gamePhase: 'results',
      currentPrompt: null,
      endTime: Date.now(),
    }

    return { valid: true, newState }
  }

  private validateSetMap(
    state: KnowYourWorldState,
    selectedMap: 'world' | 'usa'
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only change map during setup' }
    }

    const newState: KnowYourWorldState = {
      ...state,
      selectedMap,
    }

    return { valid: true, newState }
  }

  private validateSetMode(
    state: KnowYourWorldState,
    gameMode: 'cooperative' | 'race' | 'turn-based'
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only change mode during setup' }
    }

    const newState: KnowYourWorldState = {
      ...state,
      gameMode,
    }

    return { valid: true, newState }
  }

  private validateSetDifficulty(state: KnowYourWorldState, difficulty: string): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only change difficulty during setup' }
    }

    const newState: KnowYourWorldState = {
      ...state,
      difficulty,
    }

    return { valid: true, newState }
  }

  private validateSetStudyDuration(
    state: KnowYourWorldState,
    studyDuration: 0 | 30 | 60 | 120
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only change study duration during setup' }
    }

    const newState: KnowYourWorldState = {
      ...state,
      studyDuration,
    }

    return { valid: true, newState }
  }

  private validateSetContinent(
    state: KnowYourWorldState,
    selectedContinent: import('./continents').ContinentId | 'all'
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only change continent during setup' }
    }

    const newState: KnowYourWorldState = {
      ...state,
      selectedContinent,
    }

    return { valid: true, newState }
  }

  private validateEndStudy(state: KnowYourWorldState): ValidationResult {
    if (state.gamePhase !== 'studying') {
      return { valid: false, error: 'Can only end study during studying phase' }
    }

    // Transition from studying to playing
    // Set the first prompt from the regions to find
    const currentPrompt = state.regionsToFind[0] || null
    const remainingRegions = state.regionsToFind.slice(1)

    const newState: KnowYourWorldState = {
      ...state,
      gamePhase: 'playing',
      currentPrompt,
      regionsToFind: remainingRegions,
      studyTimeRemaining: 0,
    }

    return { valid: true, newState }
  }

  private validateReturnToSetup(state: KnowYourWorldState): ValidationResult {
    if (state.gamePhase === 'setup') {
      return { valid: false, error: 'Already in setup phase' }
    }

    // Return to setup, preserving config settings but resetting game state
    const newState: KnowYourWorldState = {
      ...state,
      gamePhase: 'setup',
      currentPrompt: null,
      regionsToFind: [],
      regionsFound: [],
      currentPlayer: '',
      scores: {},
      attempts: {},
      guessHistory: [],
      startTime: 0,
      endTime: undefined,
      studyTimeRemaining: 0,
      studyStartTime: 0,
    }

    return { valid: true, newState }
  }

  isGameComplete(state: KnowYourWorldState): boolean {
    return state.gamePhase === 'results'
  }

  getInitialState(config: unknown): KnowYourWorldState {
    const typedConfig = config as KnowYourWorldConfig

    return {
      gamePhase: 'setup',
      selectedMap: typedConfig?.selectedMap || 'world',
      gameMode: typedConfig?.gameMode || 'cooperative',
      difficulty: typedConfig?.difficulty || 'easy',
      studyDuration: typedConfig?.studyDuration || 0,
      selectedContinent: typedConfig?.selectedContinent || 'all',
      studyTimeRemaining: 0,
      studyStartTime: 0,
      currentPrompt: null,
      regionsToFind: [],
      regionsFound: [],
      currentPlayer: '',
      scores: {},
      attempts: {},
      guessHistory: [],
      startTime: 0,
      activePlayers: [],
      playerMetadata: {},
    }
  }

  // Helper: Shuffle array (Fisher-Yates)
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

export const knowYourWorldValidator = new KnowYourWorldValidator()

import type { GameValidator, ValidationResult } from '@/lib/arcade/game-sdk'
import type {
  KnowYourWorldConfig,
  KnowYourWorldMove,
  KnowYourWorldState,
  GuessRecord,
  AssistanceLevel,
} from './types'
import type { RegionSize } from './maps'

/**
 * Lazy-load map functions to avoid importing ES modules at module init time
 * This is critical for server-side usage where ES modules can't be required
 */
async function getFilteredMapDataBySizesLazy(
  ...args: Parameters<typeof import('./maps').getFilteredMapDataBySizes>
) {
  const { getFilteredMapDataBySizes } = await import('./maps')
  return getFilteredMapDataBySizes(...args)
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
        return await this.validateStartGame(state, move.userId, move.data)
      case 'CLICK_REGION':
        return this.validateClickRegion(state, move.playerId, move.userId, move.data)
      case 'NEXT_ROUND':
        return await this.validateNextRound(state)
      case 'END_GAME':
        return this.validateEndGame(state)
      case 'RETURN_TO_SETUP':
        return this.validateReturnToSetup(state)
      case 'SET_MAP':
        return this.validateSetMap(state, move.data.selectedMap)
      case 'SET_MODE':
        return this.validateSetMode(state, move.data.gameMode)
      case 'SET_REGION_SIZES':
        return this.validateSetRegionSizes(state, move.data.includeSizes)
      case 'SET_ASSISTANCE_LEVEL':
        return this.validateSetAssistanceLevel(state, move.data.assistanceLevel)
      case 'SET_CONTINENT':
        return this.validateSetContinent(state, move.data.selectedContinent)
      case 'GIVE_UP':
        return await this.validateGiveUp(state, move.playerId, move.userId)
      case 'REQUEST_HINT':
        return this.validateRequestHint(state, move.playerId, move.timestamp)
      case 'CONFIRM_LETTER':
        return await this.validateConfirmLetter(state, move.playerId, move.userId, move.data)
      default:
        return { valid: false, error: 'Unknown move type' }
    }
  }

  private async validateStartGame(
    state: KnowYourWorldState,
    userId: string,
    data: any
  ): Promise<ValidationResult> {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only start from setup phase' }
    }

    const { activePlayers, playerMetadata, selectedMap, gameMode, includeSizes, assistanceLevel } =
      data

    if (!activePlayers || activePlayers.length === 0) {
      return { valid: false, error: 'Need at least 1 player' }
    }

    // Get map data and shuffle regions (with continent and size filters)
    const mapData = await getFilteredMapDataBySizesLazy(
      selectedMap,
      state.selectedContinent,
      includeSizes || state.includeSizes
    )
    const regionIds = mapData.regions.map((r) => r.id)
    const shuffledRegions = this.shuffleArray([...regionIds])

    // Initialize scores and attempts
    const scores: Record<string, number> = {}
    const attempts: Record<string, number> = {}
    for (const playerId of activePlayers) {
      scores[playerId] = 0
      attempts[playerId] = 0
    }

    // Track the initial userId (session) - other sessions will be added as they make moves
    const activeUserIds = userId ? [userId] : []

    const newState: KnowYourWorldState = {
      ...state,
      gamePhase: 'playing',
      activePlayers,
      activeUserIds,
      playerMetadata,
      selectedMap,
      gameMode,
      includeSizes: includeSizes || state.includeSizes,
      assistanceLevel: assistanceLevel || state.assistanceLevel,
      currentPrompt: shuffledRegions[0],
      regionsToFind: shuffledRegions.slice(1),
      regionsFound: [],
      regionsGivenUp: [],
      currentPlayer: activePlayers[0],
      scores,
      attempts,
      guessHistory: [],
      startTime: Date.now(),
      giveUpReveal: null,
      giveUpVotes: [],
      hintsUsed: 0,
      hintActive: null,
      nameConfirmationProgress: 0, // Reset for new prompt
    }

    return { valid: true, newState }
  }

  private validateClickRegion(
    state: KnowYourWorldState,
    playerId: string,
    userId: string,
    data: any
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return {
        valid: false,
        error: 'Can only click regions during playing phase',
      }
    }

    if (!state.currentPrompt) {
      return { valid: false, error: 'No region to find' }
    }

    const { regionId, regionName } = data

    // Turn-based mode: Check if it's this player's turn
    if (state.gameMode === 'turn-based' && state.currentPlayer !== playerId) {
      return { valid: false, error: 'Not your turn' }
    }

    // Track this session if not already known
    const activeUserIds = this.addUserIdIfNew(state.activeUserIds, userId)

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
          giveUpReveal: null,
          giveUpVotes: [], // Clear votes when game ends
          hintActive: null,
          activeUserIds,
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
        giveUpReveal: null,
        giveUpVotes: [], // Clear votes when moving to next region
        hintActive: null, // Clear hint when moving to next region
        activeUserIds,
        nameConfirmationProgress: 0, // Reset for new prompt
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
        activeUserIds,
      }

      return {
        valid: true,
        newState,
        // Error message includes clicked region name for client to format based on difficulty
        // Format: "CLICKED:[regionName]" so client can parse and format appropriately
        error: `CLICKED:${regionName}`,
      }
    }
  }

  // Helper: Add userId to activeUserIds if not already present
  private addUserIdIfNew(activeUserIds: string[] | undefined, userId: string): string[] {
    const existing = activeUserIds ?? []
    if (!userId || existing.includes(userId)) {
      return existing
    }
    return [...existing, userId]
  }

  private async validateNextRound(state: KnowYourWorldState): Promise<ValidationResult> {
    if (state.gamePhase !== 'results') {
      return { valid: false, error: 'Can only start next round from results' }
    }

    // Get map data and shuffle regions (with continent and size filters)
    const mapData = await getFilteredMapDataBySizesLazy(
      state.selectedMap,
      state.selectedContinent,
      state.includeSizes
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

    const newState: KnowYourWorldState = {
      ...state,
      gamePhase: 'playing',
      currentPrompt: shuffledRegions[0],
      regionsToFind: shuffledRegions.slice(1),
      regionsFound: [],
      regionsGivenUp: [],
      currentPlayer: state.activePlayers[0],
      scores,
      attempts,
      guessHistory: [],
      startTime: Date.now(),
      endTime: undefined,
      giveUpReveal: null,
      giveUpVotes: [],
      hintsUsed: 0,
      hintActive: null,
      nameConfirmationProgress: 0, // Reset for new round
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

  private validateSetRegionSizes(
    state: KnowYourWorldState,
    includeSizes: RegionSize[]
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return {
        valid: false,
        error: 'Can only change region sizes during setup',
      }
    }

    const newState: KnowYourWorldState = {
      ...state,
      includeSizes,
    }

    return { valid: true, newState }
  }

  private validateSetAssistanceLevel(
    state: KnowYourWorldState,
    assistanceLevel: AssistanceLevel
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return {
        valid: false,
        error: 'Can only change assistance level during setup',
      }
    }

    const newState: KnowYourWorldState = {
      ...state,
      assistanceLevel,
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
      regionsGivenUp: [],
      currentPlayer: '',
      scores: {},
      attempts: {},
      guessHistory: [],
      startTime: 0,
      endTime: undefined,
      giveUpReveal: null,
      nameConfirmationProgress: 0,
    }

    return { valid: true, newState }
  }

  private async validateGiveUp(
    state: KnowYourWorldState,
    playerId: string,
    userId: string
  ): Promise<ValidationResult> {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Can only give up during playing phase' }
    }

    if (!state.currentPrompt) {
      return { valid: false, error: 'No region to give up on' }
    }

    // For turn-based: check if it's this player's turn
    if (state.gameMode === 'turn-based' && state.currentPlayer !== playerId) {
      return { valid: false, error: 'Not your turn' }
    }

    // Track this session if not already known
    const activeUserIds = this.addUserIdIfNew(state.activeUserIds, userId)

    // For cooperative mode with multiple sessions: require unanimous vote by session
    // (All local players on the same session count as one vote since they can discuss together)
    const isCooperativeMultiplayer = state.gameMode === 'cooperative' && activeUserIds.length > 1

    if (isCooperativeMultiplayer) {
      // Check if this session has already voted
      const existingVotes = state.giveUpVotes ?? []
      if (existingVotes.includes(userId)) {
        return {
          valid: false,
          error: 'Your session has already voted to give up',
        }
      }

      // Add this session's vote
      const newVotes = [...existingVotes, userId]

      // Check if unanimous (all sessions have voted)
      const isUnanimous = activeUserIds.every((uid) => newVotes.includes(uid))

      if (!isUnanimous) {
        // Not unanimous yet - just record the vote
        const newState: KnowYourWorldState = {
          ...state,
          giveUpVotes: newVotes,
          activeUserIds,
        }
        return { valid: true, newState }
      }

      // Unanimous! Fall through to execute the give up
    }

    // Execute the actual give up (single session, turn-based, or unanimous cooperative)
    return this.executeGiveUp(state, activeUserIds)
  }

  private async executeGiveUp(
    state: KnowYourWorldState,
    activeUserIds: string[]
  ): Promise<ValidationResult> {
    // Get region info for the reveal
    const mapData = await getFilteredMapDataBySizesLazy(
      state.selectedMap,
      state.selectedContinent,
      state.includeSizes
    )
    const region = mapData.regions.find((r) => r.id === state.currentPrompt)

    if (!region) {
      return { valid: false, error: 'Region not found' }
    }

    // Track this region as given up (add if not already tracked)
    // Use fallback for older game states that don't have regionsGivenUp
    const existingGivenUp = state.regionsGivenUp ?? []
    const regionsGivenUp = existingGivenUp.includes(region.id)
      ? existingGivenUp
      : [...existingGivenUp, region.id]

    // Determine re-ask position based on assistance level
    // Learning/Guided/Helpful: re-ask soon (after 2-3 regions) to reinforce learning
    // Standard/None: re-ask at the end
    const isHighAssistance =
      state.assistanceLevel === 'learning' ||
      state.assistanceLevel === 'guided' ||
      state.assistanceLevel === 'helpful'
    const reaskDelay = isHighAssistance ? 3 : state.regionsToFind.length

    // Build new regions queue: take next regions, then insert given-up region at appropriate position
    const remainingRegions = [...state.regionsToFind]

    // Insert the given-up region back into the queue
    const insertPosition = Math.min(reaskDelay, remainingRegions.length)
    remainingRegions.splice(insertPosition, 0, region.id)

    // If there are no other regions (only the one we just gave up), it will be re-asked immediately
    const nextPrompt = remainingRegions[0]
    const newRegionsToFind = remainingRegions.slice(1)

    // For turn-based, rotate player
    let nextPlayer = state.currentPlayer
    if (state.gameMode === 'turn-based') {
      const currentIndex = state.activePlayers.indexOf(state.currentPlayer)
      const nextIndex = (currentIndex + 1) % state.activePlayers.length
      nextPlayer = state.activePlayers[nextIndex]
    }

    const newState: KnowYourWorldState = {
      ...state,
      currentPrompt: nextPrompt,
      regionsToFind: newRegionsToFind,
      regionsGivenUp,
      currentPlayer: nextPlayer,
      giveUpReveal: {
        regionId: region.id,
        regionName: region.name,
        timestamp: Date.now(),
      },
      giveUpVotes: [], // Clear votes after give up is executed
      hintActive: null, // Clear hint when moving to next region
      activeUserIds,
      nameConfirmationProgress: 0, // Reset for new prompt
    }

    return { valid: true, newState }
  }

  private validateRequestHint(
    state: KnowYourWorldState,
    playerId: string,
    timestamp: number
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return {
        valid: false,
        error: 'Can only request hints during playing phase',
      }
    }

    if (!state.currentPrompt) {
      return { valid: false, error: 'No region to hint' }
    }

    // For turn-based: check if it's this player's turn
    if (state.gameMode === 'turn-based' && state.currentPlayer !== playerId) {
      return { valid: false, error: 'Not your turn' }
    }

    // Set hint active with current region
    const newState: KnowYourWorldState = {
      ...state,
      hintsUsed: (state.hintsUsed ?? 0) + 1,
      hintActive: {
        regionId: state.currentPrompt,
        timestamp,
      },
    }

    return { valid: true, newState }
  }

  private async validateConfirmLetter(
    state: KnowYourWorldState,
    playerId: string,
    userId: string,
    data: { letter: string; letterIndex: number }
  ): Promise<ValidationResult> {
    if (state.gamePhase !== 'playing') {
      return {
        valid: false,
        error: 'Can only confirm letters during playing phase',
      }
    }

    if (!state.currentPrompt) {
      return { valid: false, error: 'No region to confirm' }
    }

    // For turn-based: check if it's this player's turn
    if (state.gameMode === 'turn-based' && state.currentPlayer !== playerId) {
      return { valid: false, error: 'Not your turn' }
    }

    const { letter, letterIndex } = data

    // Check that letterIndex matches current progress
    const currentProgress = state.nameConfirmationProgress ?? 0
    if (letterIndex !== currentProgress) {
      return {
        valid: false,
        error: `Expected letter index ${currentProgress}, got ${letterIndex}`,
      }
    }

    // currentPrompt is actually the region ID (e.g., "ru"), not the name
    // We need to look up the actual region name from the map data
    const mapData = await getFilteredMapDataBySizesLazy(
      state.selectedMap,
      state.selectedContinent,
      state.includeSizes
    )
    const region = mapData.regions.find((r) => r.id === state.currentPrompt)
    if (!region) {
      return { valid: false, error: 'Region not found in map data' }
    }
    const regionName = region.name

    // Check if the letter matches
    const expectedLetter = regionName[letterIndex]?.toLowerCase()
    if (letter.toLowerCase() !== expectedLetter) {
      // Wrong letter - don't advance progress (but move is still valid, just ignored)
      return { valid: true, newState: state }
    }

    // Correct letter - advance progress
    const activeUserIds = this.addUserIdIfNew(state.activeUserIds, userId)

    const newState: KnowYourWorldState = {
      ...state,
      nameConfirmationProgress: currentProgress + 1,
      activeUserIds,
    }

    return { valid: true, newState }
  }

  isGameComplete(state: KnowYourWorldState): boolean {
    return state.gamePhase === 'results'
  }

  getInitialState(config: unknown): KnowYourWorldState {
    const typedConfig = config as KnowYourWorldConfig

    // Validate includeSizes - should be an array of valid size strings
    const validSizes: RegionSize[] = ['huge', 'large', 'medium', 'small', 'tiny']
    const rawSizes = typedConfig?.includeSizes
    const includeSizes: RegionSize[] = Array.isArray(rawSizes)
      ? rawSizes.filter((s: string) => validSizes.includes(s as RegionSize))
      : ['huge', 'large', 'medium'] // Default

    // Validate assistanceLevel
    const validAssistanceLevels: AssistanceLevel[] = [
      'learning',
      'guided',
      'helpful',
      'standard',
      'none',
    ]
    const rawAssistance = typedConfig?.assistanceLevel
    const assistanceLevel: AssistanceLevel = validAssistanceLevels.includes(
      rawAssistance as AssistanceLevel
    )
      ? (rawAssistance as AssistanceLevel)
      : 'helpful' // Default

    return {
      gamePhase: 'setup',
      selectedMap: typedConfig?.selectedMap || 'world',
      gameMode: typedConfig?.gameMode || 'cooperative',
      includeSizes,
      assistanceLevel,
      selectedContinent: typedConfig?.selectedContinent || 'all',
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

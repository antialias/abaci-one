/**
 * Server-side validator for Complement Race multiplayer game
 * Handles question generation, answer validation, passenger management, and race progression
 */

import type { GameValidator, ValidationResult } from '@/lib/arcade/game-sdk'
import type {
  ComplementRaceState,
  ComplementRaceMove,
  ComplementRaceConfig,
  ComplementQuestion,
  Passenger,
  Station,
  PlayerState,
  AnswerValidation,
} from './types'

// ============================================================================
// Constants
// ============================================================================

const PLAYER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'] // Blue, Green, Amber, Purple

const DEFAULT_STATIONS: Station[] = [
  { id: 'depot', name: 'Depot', position: 0, icon: '🚉', emoji: '🚉' },
  { id: 'riverside', name: 'Riverside', position: 20, icon: '🌊', emoji: '🌊' },
  { id: 'hillside', name: 'Hillside', position: 40, icon: '⛰️', emoji: '⛰️' },
  { id: 'canyon', name: 'Canyon View', position: 60, icon: '🏜️', emoji: '🏜️' },
  { id: 'meadows', name: 'Meadows', position: 80, icon: '🌾', emoji: '🌾' },
  { id: 'grand-central', name: 'Grand Central', position: 100, icon: '🏛️', emoji: '🏛️' },
]

const PASSENGER_NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'Diana',
  'Eve',
  'Frank',
  'Grace',
  'Henry',
  'Iris',
  'Jack',
  'Kate',
  'Leo',
  'Mia',
  'Noah',
  'Olivia',
  'Paul',
]

const PASSENGER_AVATARS = [
  '👨‍💼',
  '👩‍💼',
  '👨‍🎓',
  '👩‍🎓',
  '👨‍🍳',
  '👩‍🍳',
  '👨‍⚕️',
  '👩‍⚕️',
  '👨‍🔧',
  '👩‍🔧',
  '👨‍🏫',
  '👩‍🏫',
  '👵',
  '👴',
  '🧑‍🎨',
  '👨‍🚒',
]

// ============================================================================
// Validator Class
// ============================================================================

export class ComplementRaceValidator
  implements GameValidator<ComplementRaceState, ComplementRaceMove>
{
  validateMove(state: ComplementRaceState, move: ComplementRaceMove): ValidationResult {
    switch (move.type) {
      case 'START_GAME':
        return this.validateStartGame(state, move.data.activePlayers, move.data.playerMetadata)

      case 'SET_READY':
        return this.validateSetReady(state, move.playerId, move.data.ready)

      case 'SET_CONFIG':
        return this.validateSetConfig(state, move.data.field, move.data.value)

      case 'SUBMIT_ANSWER':
        return this.validateSubmitAnswer(
          state,
          move.playerId,
          move.data.answer,
          move.data.responseTime
        )

      case 'UPDATE_INPUT':
        return this.validateUpdateInput(state, move.playerId, move.data.input)

      case 'CLAIM_PASSENGER':
        return this.validateClaimPassenger(
          state,
          move.playerId,
          move.data.passengerId,
          move.data.carIndex
        )

      case 'DELIVER_PASSENGER':
        return this.validateDeliverPassenger(state, move.playerId, move.data.passengerId)

      case 'NEXT_QUESTION':
        return this.validateNextQuestion(state)

      case 'START_NEW_ROUTE':
        return this.validateStartNewRoute(state, move.data.routeNumber)

      case 'END_GAME':
        return this.validateEndGame(state)

      case 'PLAY_AGAIN':
        return this.validatePlayAgain(state)

      case 'GO_TO_SETUP':
        return this.validateGoToSetup(state)

      default:
        return {
          valid: false,
          error: `Unknown move type: ${(move as { type: string }).type}`,
        }
    }
  }

  // ==========================================================================
  // Setup & Lobby Phase
  // ==========================================================================

  private validateStartGame(
    state: ComplementRaceState,
    activePlayers: string[],
    playerMetadata: Record<string, unknown>
  ): ValidationResult {
    if (state.gamePhase !== 'setup' && state.gamePhase !== 'lobby') {
      return { valid: false, error: 'Game already started' }
    }

    if (!activePlayers || activePlayers.length < 1) {
      return { valid: false, error: 'Need at least 1 player' }
    }

    if (activePlayers.length > state.config.maxPlayers) {
      return { valid: false, error: `Too many players (max ${state.config.maxPlayers})` }
    }

    // Initialize player states
    const players: Record<string, PlayerState> = {}
    for (let i = 0; i < activePlayers.length; i++) {
      const playerId = activePlayers[i]
      const metadata = playerMetadata[playerId] as { name: string }

      players[playerId] = {
        id: playerId,
        name: metadata.name || `Player ${i + 1}`,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        score: 0,
        streak: 0,
        bestStreak: 0,
        correctAnswers: 0,
        totalQuestions: 0,
        position: 0, // Only used for practice/survival; sprint mode is client-side
        isReady: false,
        isActive: true,
        currentAnswer: null,
        lastAnswerTime: null,
        passengers: [],
        deliveredPassengers: 0,
      }
    }

    // Generate initial questions for each player
    const currentQuestions: Record<string, ComplementQuestion> = {}
    for (const playerId of activePlayers) {
      currentQuestions[playerId] = this.generateQuestion(state.config.mode)
    }

    // Sprint mode: generate initial passengers
    const passengers =
      state.config.style === 'sprint'
        ? this.generatePassengers(state.config.passengerCount, state.stations)
        : []

    // Calculate maxConcurrentPassengers based on initial passenger layout (sprint mode only)
    let updatedConfig = state.config
    if (state.config.style === 'sprint' && passengers.length > 0) {
      const maxConcurrentPassengers = Math.max(
        1,
        this.calculateMaxConcurrentPassengers(passengers, state.stations)
      )
      console.log(
        `[Game Start] Calculated maxConcurrentPassengers: ${maxConcurrentPassengers} for ${passengers.length} passengers`
      )
      updatedConfig = {
        ...state.config,
        maxConcurrentPassengers,
      }
    }

    // Generate AI opponents if enabled
    const aiOpponents =
      state.config.enableAI && state.config.aiOpponentCount > 0
        ? this.generateAIOpponents(state.config.aiOpponentCount)
        : []

    const newState: ComplementRaceState = {
      ...state,
      config: updatedConfig,
      gamePhase: 'playing', // Go directly to playing (countdown can be added later)
      activePlayers,
      playerMetadata: playerMetadata as typeof state.playerMetadata,
      players,
      currentQuestions,
      questionStartTime: Date.now(),
      passengers,
      routeStartTime: state.config.style === 'sprint' ? Date.now() : null,
      raceStartTime: Date.now(), // Race starts immediately
      gameStartTime: Date.now(),
      aiOpponents,
    }

    return { valid: true, newState }
  }

  private validateSetReady(
    state: ComplementRaceState,
    playerId: string,
    ready: boolean
  ): ValidationResult {
    if (state.gamePhase !== 'lobby') {
      return { valid: false, error: 'Not in lobby phase' }
    }

    if (!state.players[playerId]) {
      return { valid: false, error: 'Player not in game' }
    }

    const newState: ComplementRaceState = {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...state.players[playerId],
          isReady: ready,
        },
      },
    }

    // Check if all players are ready
    const allReady = Object.values(newState.players).every((p) => p.isReady)
    if (allReady && state.activePlayers.length >= 1) {
      newState.gamePhase = 'countdown'
      newState.raceStartTime = Date.now() + 3000 // 3 second countdown
    }

    return { valid: true, newState }
  }

  private validateSetConfig(
    state: ComplementRaceState,
    field: keyof ComplementRaceConfig,
    value: unknown
  ): ValidationResult {
    if (state.gamePhase !== 'setup') {
      return { valid: false, error: 'Can only change config in setup' }
    }

    // Validate the value based on field
    // (Add specific validation per field as needed)

    const newState: ComplementRaceState = {
      ...state,
      config: {
        ...state.config,
        [field]: value,
      },
    }

    return { valid: true, newState }
  }

  // ==========================================================================
  // Playing Phase: Answer Validation
  // ==========================================================================

  private validateSubmitAnswer(
    state: ComplementRaceState,
    playerId: string,
    answer: number,
    responseTime: number
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Game not in playing phase' }
    }

    const player = state.players[playerId]
    if (!player) {
      return { valid: false, error: 'Player not found' }
    }

    const question = state.currentQuestions[playerId]
    if (!question) {
      return { valid: false, error: 'No question for this player' }
    }

    // Validate answer
    const correct = answer === question.correctAnswer
    const validation = this.calculateAnswerScore(
      correct,
      responseTime,
      player.streak,
      state.config.style
    )

    // Update player state
    const updatedPlayer: PlayerState = {
      ...player,
      totalQuestions: player.totalQuestions + 1,
      correctAnswers: correct ? player.correctAnswers + 1 : player.correctAnswers,
      score: player.score + validation.totalPoints,
      streak: validation.newStreak,
      bestStreak: Math.max(player.bestStreak, validation.newStreak),
      lastAnswerTime: Date.now(),
      currentAnswer: null,
    }

    // Update position based on game mode
    if (state.config.style === 'practice') {
      // Practice: Move forward on correct answer
      if (correct) {
        updatedPlayer.position = Math.min(100, player.position + 100 / state.config.raceGoal)
      }
    } else if (state.config.style === 'sprint') {
      // Sprint: All momentum/position handled client-side for smooth 20fps movement
      // Server only tracks scoring, passengers, and game progression
      // No server-side position updates needed
    } else if (state.config.style === 'survival') {
      // Survival: Always move forward, speed based on accuracy
      const moveDistance = correct ? 5 : 2
      updatedPlayer.position = player.position + moveDistance
    }

    // Generate new question for this player
    const newQuestion = this.generateQuestion(state.config.mode)

    const newState: ComplementRaceState = {
      ...state,
      players: {
        ...state.players,
        [playerId]: updatedPlayer,
      },
      currentQuestions: {
        ...state.currentQuestions,
        [playerId]: newQuestion,
      },
    }

    // Update AI opponents (make them progress at their speed)
    if (state.config.enableAI && state.aiOpponents.length > 0) {
      newState.aiOpponents = this.updateAIOpponents(
        state.aiOpponents,
        state.config.style,
        state.config.raceGoal
      )
    }

    // Check win conditions
    const winner = this.checkWinCondition(newState)
    if (winner) {
      newState.gamePhase = 'results'
      newState.winner = winner
      newState.raceEndTime = Date.now()
      newState.leaderboard = this.calculateLeaderboard(newState)
    }

    return { valid: true, newState }
  }

  private validateUpdateInput(
    state: ComplementRaceState,
    playerId: string,
    input: string
  ): ValidationResult {
    if (state.gamePhase !== 'playing') {
      return { valid: false, error: 'Game not in playing phase' }
    }

    const player = state.players[playerId]
    if (!player) {
      return { valid: false, error: 'Player not found' }
    }

    const newState: ComplementRaceState = {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          currentAnswer: input,
        },
      },
    }

    return { valid: true, newState }
  }

  // ==========================================================================
  // Sprint Mode: Passenger Management
  // ==========================================================================

  private validateClaimPassenger(
    state: ComplementRaceState,
    playerId: string,
    passengerId: string,
    carIndex: number
  ): ValidationResult {
    if (state.config.style !== 'sprint') {
      return { valid: false, error: 'Passengers only available in sprint mode' }
    }

    const player = state.players[playerId]
    if (!player) {
      return { valid: false, error: 'Player not found' }
    }

    // Check if player has space
    if (player.passengers.length >= state.config.maxConcurrentPassengers) {
      return { valid: false, error: 'Train is full' }
    }

    // Find passenger
    const passengerIndex = state.passengers.findIndex((p) => p.id === passengerId)
    if (passengerIndex === -1) {
      return { valid: false, error: 'Passenger not found' }
    }

    const passenger = state.passengers[passengerIndex]
    if (passenger.claimedBy !== null) {
      return { valid: false, error: 'Passenger already claimed' }
    }

    // Sprint mode: Position is client-side, trust client's spatial checking
    // (Client checks position in useSteamJourney before sending CLAIM move)
    // Other modes: Validate position server-side
    if (state.config.style !== 'sprint') {
      const originStation = state.stations.find((s) => s.id === passenger.originStationId)
      if (!originStation) {
        return { valid: false, error: 'Origin station not found' }
      }

      const distance = Math.abs(player.position - originStation.position)
      if (distance > 5) {
        return { valid: false, error: 'Not at origin station' }
      }
    }

    // Claim passenger and assign to physical car
    const updatedPassengers = [...state.passengers]
    updatedPassengers[passengerIndex] = {
      ...passenger,
      claimedBy: playerId,
      carIndex, // Store which physical car (0-N) the passenger is seated in
    }

    const newState: ComplementRaceState = {
      ...state,
      passengers: updatedPassengers,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          passengers: [...player.passengers, passengerId],
        },
      },
    }

    return { valid: true, newState }
  }

  private validateDeliverPassenger(
    state: ComplementRaceState,
    playerId: string,
    passengerId: string
  ): ValidationResult {
    if (state.config.style !== 'sprint') {
      return { valid: false, error: 'Passengers only available in sprint mode' }
    }

    const player = state.players[playerId]
    if (!player) {
      return { valid: false, error: 'Player not found' }
    }

    // Check if player has this passenger
    if (!player.passengers.includes(passengerId)) {
      return { valid: false, error: 'Player does not have this passenger' }
    }

    // Find passenger
    const passengerIndex = state.passengers.findIndex((p) => p.id === passengerId)
    if (passengerIndex === -1) {
      return { valid: false, error: 'Passenger not found' }
    }

    const passenger = state.passengers[passengerIndex]
    if (passenger.deliveredBy !== null) {
      return { valid: false, error: 'Passenger already delivered' }
    }

    // Sprint mode: Position is client-side, trust client's spatial checking
    // (Client checks position in useSteamJourney before sending DELIVER move)
    // Other modes: Validate position server-side
    if (state.config.style !== 'sprint') {
      const destStation = state.stations.find((s) => s.id === passenger.destinationStationId)
      if (!destStation) {
        return { valid: false, error: 'Destination station not found' }
      }

      const distance = Math.abs(player.position - destStation.position)
      if (distance > 5) {
        return { valid: false, error: 'Not at destination station' }
      }
    }

    // Deliver passenger and award points
    const points = passenger.isUrgent ? 20 : 10
    const updatedPassengers = [...state.passengers]
    updatedPassengers[passengerIndex] = {
      ...passenger,
      deliveredBy: playerId,
    }

    const newState: ComplementRaceState = {
      ...state,
      passengers: updatedPassengers,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          passengers: player.passengers.filter((id) => id !== passengerId),
          deliveredPassengers: player.deliveredPassengers + 1,
          score: player.score + points,
        },
      },
    }

    return { valid: true, newState }
  }

  private validateStartNewRoute(state: ComplementRaceState, routeNumber: number): ValidationResult {
    if (state.config.style !== 'sprint') {
      return { valid: false, error: 'Routes only available in sprint mode' }
    }

    // Reset all player positions to 0 for new route (client handles momentum reset)
    const resetPlayers: Record<string, PlayerState> = {}
    for (const [playerId, player] of Object.entries(state.players)) {
      resetPlayers[playerId] = {
        ...player,
        position: 0, // Server position not used in sprint; client will reset
        passengers: [], // Clear any remaining passengers
      }
    }

    // Generate new passengers
    const newPassengers = this.generatePassengers(state.config.passengerCount, state.stations)

    // Calculate maxConcurrentPassengers based on the new route's passenger layout
    const maxConcurrentPassengers = Math.max(
      1,
      this.calculateMaxConcurrentPassengers(newPassengers, state.stations)
    )

    console.log(
      `[Route ${routeNumber}] Calculated maxConcurrentPassengers: ${maxConcurrentPassengers} for ${newPassengers.length} passengers`
    )

    const newState: ComplementRaceState = {
      ...state,
      currentRoute: routeNumber,
      routeStartTime: Date.now(),
      players: resetPlayers,
      passengers: newPassengers,
      config: {
        ...state.config,
        maxConcurrentPassengers, // Update config with calculated value
      },
    }

    return { valid: true, newState }
  }

  // ==========================================================================
  // Game Flow Control
  // ==========================================================================

  private validateNextQuestion(state: ComplementRaceState): ValidationResult {
    // Generate new questions for all players
    const newQuestions: Record<string, ComplementQuestion> = {}
    for (const playerId of state.activePlayers) {
      newQuestions[playerId] = this.generateQuestion(state.config.mode)
    }

    const newState: ComplementRaceState = {
      ...state,
      currentQuestions: newQuestions,
      questionStartTime: Date.now(),
    }

    return { valid: true, newState }
  }

  private validateEndGame(state: ComplementRaceState): ValidationResult {
    const newState: ComplementRaceState = {
      ...state,
      gamePhase: 'results',
      raceEndTime: Date.now(),
      leaderboard: this.calculateLeaderboard(state),
    }

    return { valid: true, newState }
  }

  private validatePlayAgain(state: ComplementRaceState): ValidationResult {
    if (state.gamePhase !== 'results') {
      return { valid: false, error: 'Game not finished' }
    }

    // Reset to lobby with same players
    return this.validateGoToSetup(state)
  }

  private validateGoToSetup(state: ComplementRaceState): ValidationResult {
    const newState: ComplementRaceState = this.getInitialState(state.config)

    return { valid: true, newState }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private generateQuestion(mode: 'friends5' | 'friends10' | 'mixed'): ComplementQuestion {
    let targetSum: number
    if (mode === 'friends5') {
      targetSum = 5
    } else if (mode === 'friends10') {
      targetSum = 10
    } else {
      targetSum = Math.random() < 0.5 ? 5 : 10
    }

    const number = Math.floor(Math.random() * targetSum)
    const correctAnswer = targetSum - number

    return {
      id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      number,
      targetSum,
      correctAnswer,
      showAsAbacus: Math.random() < 0.5, // 50/50 random display
      timestamp: Date.now(),
    }
  }

  private calculateAnswerScore(
    correct: boolean,
    responseTime: number,
    currentStreak: number,
    gameStyle: 'practice' | 'sprint' | 'survival'
  ): AnswerValidation {
    if (!correct) {
      return {
        correct: false,
        responseTime,
        speedBonus: 0,
        streakBonus: 0,
        totalPoints: 0,
        newStreak: 0,
      }
    }

    // Base points
    const basePoints = 100

    // Speed bonus (max 300 for <500ms, down to 0 at 3000ms)
    const speedBonus = Math.max(0, 300 - Math.floor(responseTime / 100))

    // Streak bonus
    const newStreak = currentStreak + 1
    const streakBonus = newStreak * 50

    // Total
    const totalPoints = basePoints + speedBonus + streakBonus

    return {
      correct: true,
      responseTime,
      speedBonus,
      streakBonus,
      totalPoints,
      newStreak,
    }
  }

  private generatePassengers(count: number, stations: Station[]): Passenger[] {
    const passengers: Passenger[] = []
    const usedCombos = new Set<string>()

    for (let i = 0; i < count; i++) {
      let name: string
      let avatar: string
      let comboKey: string

      // Keep trying until we get a unique name/avatar combo
      do {
        const nameIndex = Math.floor(Math.random() * PASSENGER_NAMES.length)
        const avatarIndex = Math.floor(Math.random() * PASSENGER_AVATARS.length)
        name = PASSENGER_NAMES[nameIndex]
        avatar = PASSENGER_AVATARS[avatarIndex]
        comboKey = `${name}-${avatar}`
      } while (usedCombos.has(comboKey) && usedCombos.size < 100) // Prevent infinite loop

      usedCombos.add(comboKey)

      // Pick origin and destination stations
      // KEY: Destination must be AHEAD of origin (higher position on track)
      // This ensures passengers travel forward, creating better overlap
      let originStation: Station
      let destinationStation: Station

      if (Math.random() < 0.4 || stations.length < 3) {
        // 40% chance to start at depot (first station)
        originStation = stations[0]
        // Pick any station ahead as destination
        const stationsAhead = stations.slice(1)
        destinationStation = stationsAhead[Math.floor(Math.random() * stationsAhead.length)]
      } else {
        // Start at a random non-depot, non-final station
        const nonDepotStations = stations.slice(1, -1) // Exclude depot and final station
        originStation = nonDepotStations[Math.floor(Math.random() * nonDepotStations.length)]
        // Pick a station ahead of origin (higher position)
        const stationsAhead = stations.filter((s) => s.position > originStation.position)
        destinationStation = stationsAhead[Math.floor(Math.random() * stationsAhead.length)]
      }

      // 30% chance of urgent
      const isUrgent = Math.random() < 0.3

      const passenger = {
        id: `p-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        avatar,
        originStationId: originStation.id,
        destinationStationId: destinationStation.id,
        isUrgent,
        claimedBy: null,
        deliveredBy: null,
        carIndex: null, // Not boarded yet
        timestamp: Date.now(),
      }

      passengers.push(passenger)

      console.log(
        `[Passenger ${i + 1}/${count}] ${name} waiting at ${originStation.emoji} ${originStation.name} (pos ${originStation.position}) → ${destinationStation.emoji} ${destinationStation.name} (pos ${destinationStation.position}) ${isUrgent ? '⚡ URGENT' : ''}`
      )
    }

    console.log(`[Generated ${passengers.length} passengers total]`)
    return passengers
  }

  private generateAIOpponents(count: number): Array<{
    id: string
    name: string
    personality: 'competitive' | 'analytical'
    position: number
    speed: number
    lastComment: string | null
    lastCommentTime: number
  }> {
    const aiNames = ['Robo-Racer', 'Calculator', 'Speed Demon', 'Brain Bot']
    const personalities: Array<'competitive' | 'analytical'> = ['competitive', 'analytical']

    const opponents = []
    for (let i = 0; i < Math.min(count, aiNames.length); i++) {
      opponents.push({
        id: `ai-${i}`,
        name: aiNames[i],
        personality: personalities[i % personalities.length],
        position: 0,
        speed: 0.8 + Math.random() * 0.4, // Speed multiplier 0.8-1.2
        lastComment: null,
        lastCommentTime: 0,
      })
    }

    return opponents
  }

  private updateAIOpponents(
    opponents: Array<{
      id: string
      name: string
      personality: 'competitive' | 'analytical'
      position: number
      speed: number
      lastComment: string | null
      lastCommentTime: number
    }>,
    gameStyle: 'practice' | 'sprint' | 'survival',
    raceGoal: number
  ) {
    return opponents.map((opponent) => {
      let newPosition = opponent.position

      if (gameStyle === 'practice') {
        // AI moves forward based on their speed (simulates answering questions)
        newPosition = Math.min(100, opponent.position + (100 / raceGoal) * opponent.speed)
      } else if (gameStyle === 'survival') {
        // AI always moves forward
        newPosition = opponent.position + 4 * opponent.speed
      }
      // Sprint mode: AI doesn't participate (train journey is single-player focused)

      return {
        ...opponent,
        position: newPosition,
      }
    })
  }

  /**
   * Calculate the maximum number of passengers that will be on the train
   * concurrently at any given moment during the route
   */
  private calculateMaxConcurrentPassengers(passengers: Passenger[], stations: Station[]): number {
    // Create events for boarding and delivery
    interface StationEvent {
      position: number
      isBoarding: boolean // true = board, false = delivery
    }

    const events: StationEvent[] = []

    for (const passenger of passengers) {
      const originStation = stations.find((s) => s.id === passenger.originStationId)
      const destStation = stations.find((s) => s.id === passenger.destinationStationId)

      if (originStation && destStation) {
        events.push({ position: originStation.position, isBoarding: true })
        events.push({ position: destStation.position, isBoarding: false })
      }
    }

    // Sort events by position, with deliveries before boardings at the same position
    events.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position
      // At same position, deliveries happen before boarding
      return a.isBoarding ? 1 : -1
    })

    // Track current passenger count and maximum
    let currentCount = 0
    let maxCount = 0

    for (const event of events) {
      if (event.isBoarding) {
        currentCount++
        maxCount = Math.max(maxCount, currentCount)
      } else {
        currentCount--
      }
    }

    return maxCount
  }

  private checkWinCondition(state: ComplementRaceState): string | null {
    const { config, players } = state

    // Infinite mode: Never end the game
    if (config.winCondition === 'infinite') {
      return null
    }

    // Practice mode: First to reach goal
    if (config.style === 'practice') {
      // Check human players
      for (const [playerId, player] of Object.entries(players)) {
        if (player.correctAnswers >= config.raceGoal) {
          return playerId
        }
      }
      // Check AI opponents
      for (const ai of state.aiOpponents) {
        if (ai.position >= 100) {
          return ai.id
        }
      }
    }

    // Sprint mode: Check route-based, score-based, or time-based win conditions
    if (config.style === 'sprint') {
      if (config.winCondition === 'score-based' && config.targetScore) {
        for (const [playerId, player] of Object.entries(players)) {
          if (player.score >= config.targetScore) {
            return playerId
          }
        }
      }

      if (config.winCondition === 'route-based' && config.routeCount) {
        if (state.currentRoute >= config.routeCount) {
          // Find player with highest score
          let maxScore = 0
          let winner: string | null = null
          for (const [playerId, player] of Object.entries(players)) {
            if (player.score > maxScore) {
              maxScore = player.score
              winner = playerId
            }
          }
          return winner
        }
      }

      if (config.winCondition === 'time-based' && config.timeLimit) {
        const elapsed = state.routeStartTime ? (Date.now() - state.routeStartTime) / 1000 : 0
        if (elapsed >= config.timeLimit) {
          // Find player with most deliveries
          let maxDeliveries = 0
          let winner: string | null = null
          for (const [playerId, player] of Object.entries(players)) {
            if (player.deliveredPassengers > maxDeliveries) {
              maxDeliveries = player.deliveredPassengers
              winner = playerId
            }
          }
          return winner
        }
      }
    }

    // Survival mode: Most laps in time limit
    if (config.style === 'survival' && config.timeLimit) {
      const elapsed = state.raceStartTime ? (Date.now() - state.raceStartTime) / 1000 : 0
      if (elapsed >= config.timeLimit) {
        // Find player or AI with highest position (most laps)
        let maxPosition = 0
        let winner: string | null = null

        // Check human players
        for (const [playerId, player] of Object.entries(players)) {
          if (player.position > maxPosition) {
            maxPosition = player.position
            winner = playerId
          }
        }

        // Check AI opponents
        for (const ai of state.aiOpponents) {
          if (ai.position > maxPosition) {
            maxPosition = ai.position
            winner = ai.id
          }
        }

        return winner
      }
    }

    return null
  }

  private calculateLeaderboard(state: ComplementRaceState): Array<{
    playerId: string
    score: number
    rank: number
  }> {
    const entries = Object.values(state.players)
      .map((p) => ({ playerId: p.id, score: p.score }))
      .sort((a, b) => b.score - a.score)

    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
  }

  // ==========================================================================
  // GameValidator Interface Implementation
  // ==========================================================================

  isGameComplete(state: ComplementRaceState): boolean {
    return state.gamePhase === 'results' && state.winner !== null
  }

  getInitialState(config: unknown): ComplementRaceState {
    const typedConfig = config as ComplementRaceConfig

    return {
      config: typedConfig,
      gamePhase: 'setup',
      activePlayers: [],
      playerMetadata: {},
      players: {},
      currentQuestions: {},
      questionStartTime: 0,
      stations: DEFAULT_STATIONS,
      passengers: [],
      currentRoute: 1,
      routeStartTime: null,
      raceStartTime: null,
      raceEndTime: null,
      winner: null,
      leaderboard: [],
      aiOpponents: [],
      gameStartTime: null,
      gameEndTime: null,
    }
  }
}

export const complementRaceValidator = new ComplementRaceValidator()

import type { GameValidator, ValidationContext, ValidationResult } from '@/lib/arcade/game-sdk'
import type {
  AmbushContext,
  CaptureContext,
  Color,
  HarmonyDeclaration,
  MoveRecord,
  Piece,
  RithmomachiaConfig,
  RithmomachiaMove,
  RithmomachiaState,
} from './types'
import { opponentColor } from './types'
import { hasAnyValidHarmony, isHarmonyStillValid, validateHarmony } from './utils/harmonyValidator'
import { validateMove } from './utils/pathValidator'
import {
  clonePieces,
  createInitialBoard,
  getEffectiveValue,
  getLivePiecesForColor,
  getPieceAt,
  getPieceById,
} from './utils/pieceSetup'
import { checkRelation } from './utils/relationEngine'
import { computeZobristHash, isThreefoldRepetition } from './utils/zobristHash'

/**
 * Validator for Rithmomachia game logic.
 * Implements all rules: movement, captures, harmony, victory conditions.
 */
export class RithmomachiaValidator implements GameValidator<RithmomachiaState, RithmomachiaMove> {
  /**
   * Get initial game state from config.
   */
  getInitialState(config: RithmomachiaConfig): RithmomachiaState {
    const pieces = createInitialBoard()
    const initialHash = computeZobristHash(pieces, 'W')

    const state: RithmomachiaState = {
      // Configuration (stored in state per arcade pattern)
      pointWinEnabled: config.pointWinEnabled,
      pointWinThreshold: config.pointWinThreshold,
      repetitionRule: config.repetitionRule,
      fiftyMoveRule: config.fiftyMoveRule,
      allowAnySetOnRecheck: config.allowAnySetOnRecheck,
      timeControlMs: config.timeControlMs ?? null,
      whitePlayerId: config.whitePlayerId ?? null,
      blackPlayerId: config.blackPlayerId ?? null,

      // Game phase
      gamePhase: 'setup',

      // Board setup
      boardCols: 16,
      boardRows: 8,
      turn: 'W',
      pieces,
      capturedPieces: { W: [], B: [] },
      history: [],
      pendingHarmony: null,
      noProgressCount: 0,
      stateHashes: [initialHash],
      winner: null,
      winCondition: null,
    }

    // Add point tracking if enabled by config
    if (config.pointWinEnabled) {
      state.pointsCaptured = { W: 0, B: 0 }
    }

    return state
  }

  /**
   * Validate a move and return the updated state if valid.
   */
  validateMove(
    state: RithmomachiaState,
    move: RithmomachiaMove,
    context?: ValidationContext
  ): ValidationResult {
    // Allow SET_CONFIG in any phase
    if (move.type === 'SET_CONFIG') {
      return this.handleSetConfig(state, move, context)
    }

    // Allow RESET_GAME in any phase
    if (move.type === 'RESET_GAME') {
      return this.handleResetGame(state, move, context)
    }

    // Allow GO_TO_SETUP from results phase
    if (move.type === 'GO_TO_SETUP') {
      return this.handleGoToSetup(state, move, context)
    }

    // Game must be in playing phase for game moves
    if (state.gamePhase === 'setup') {
      if (move.type === 'START_GAME') {
        return this.handleStartGame(state, move, context)
      }
      return { valid: false, error: 'Game not started' }
    }

    if (state.gamePhase === 'results') {
      return { valid: false, error: 'Game already ended' }
    }

    // Check for existing winner
    if (state.winner) {
      return { valid: false, error: 'Game already has a winner' }
    }

    switch (move.type) {
      case 'MOVE':
        return this.handleMove(state, move, context)

      case 'DECLARE_HARMONY':
        return this.handleDeclareHarmony(state, move, context)

      case 'RESIGN':
        return this.handleResign(state, move, context)

      case 'OFFER_DRAW':
      case 'ACCEPT_DRAW':
        return this.handleDraw(state, move, context)

      case 'CLAIM_REPETITION':
        return this.handleClaimRepetition(state, move, context)

      case 'CLAIM_FIFTY_MOVE':
        return this.handleClaimFiftyMove(state, move, context)

      default:
        return { valid: false, error: 'Unknown move type' }
    }
  }

  /**
   * Check if the game is complete.
   */
  isGameComplete(state: RithmomachiaState): boolean {
    return state.winner !== null || state.gamePhase === 'results'
  }

  // ==================== MOVE HANDLERS ====================

  /**
   * Handle START_GAME move.
   */
  private handleStartGame(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'START_GAME' }>,
    context?: ValidationContext
  ): ValidationResult {
    const newState = {
      ...state,
      gamePhase: 'playing' as const,
    }

    return { valid: true, newState }
  }

  /**
   * Handle MOVE action (piece movement with optional capture/ambush).
   */
  private handleMove(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'MOVE' }>,
    context?: ValidationContext
  ): ValidationResult {
    const { from, to, pieceId, pyramidFaceUsed, capture, ambush } = move.data

    // Get the piece
    let piece: Piece
    try {
      piece = getPieceById(state.pieces, pieceId)
    } catch (e) {
      return { valid: false, error: `Piece not found: ${pieceId}` }
    }

    // Check ownership (turn must match piece color)
    if (piece.color !== state.turn) {
      return { valid: false, error: `Not ${piece.color}'s turn` }
    }

    // Check piece is not captured
    if (piece.captured) {
      return { valid: false, error: 'Piece already captured' }
    }

    // Check from square matches piece location
    if (piece.square !== from) {
      return { valid: false, error: `Piece is not at ${from}, it's at ${piece.square}` }
    }

    // Validate movement geometry and path
    const moveValidation = validateMove(piece, from, to, state.pieces)
    if (!moveValidation.valid) {
      return { valid: false, error: moveValidation.reason }
    }

    // Check destination
    const targetPiece = getPieceAt(state.pieces, to)

    // If destination is empty
    if (!targetPiece) {
      // No capture possible, just move
      if (capture) {
        return { valid: false, error: 'Cannot capture on empty square' }
      }

      // Process the move
      const newState = this.applyMove(
        state,
        piece,
        from,
        to,
        pyramidFaceUsed,
        null,
        ambush,
        context
      )
      return { valid: true, newState }
    }

    // Destination is occupied
    // Cannot capture own piece
    if (targetPiece.color === piece.color) {
      return { valid: false, error: 'Cannot capture own piece' }
    }

    // Must have a capture declaration if landing on enemy
    if (!capture) {
      return { valid: false, error: 'Must declare capture relation when landing on enemy piece' }
    }

    // Validate the capture relation
    const captureValidation = this.validateCapture(
      state,
      piece,
      targetPiece,
      capture,
      pyramidFaceUsed
    )
    if (!captureValidation.valid) {
      return { valid: false, error: captureValidation.error }
    }

    // Process the move with capture
    const captureContext: CaptureContext = {
      relation: capture.relation,
      moverPieceId: pieceId,
      targetPieceId: capture.targetPieceId,
      helperPieceId: capture.helperPieceId,
      moverFaceUsed: pyramidFaceUsed ?? null,
    }

    const newState = this.applyMove(
      state,
      piece,
      from,
      to,
      pyramidFaceUsed,
      captureContext,
      ambush,
      context
    )
    return { valid: true, newState }
  }

  /**
   * Validate a capture relation.
   */
  private validateCapture(
    state: RithmomachiaState,
    mover: Piece,
    target: Piece,
    capture: NonNullable<Extract<RithmomachiaMove, { type: 'MOVE' }>['data']['capture']>,
    pyramidFaceUsed?: number | null
  ): ValidationResult {
    // Get mover value
    let moverValue: number
    if (mover.type === 'P') {
      if (!pyramidFaceUsed) {
        return { valid: false, error: 'Pyramid must choose a face for capture' }
      }
      // Validate face is valid
      if (!mover.pyramidFaces?.some((f) => f === pyramidFaceUsed)) {
        return { valid: false, error: 'Invalid pyramid face' }
      }
      moverValue = pyramidFaceUsed
    } else {
      moverValue = mover.value!
    }

    // Get target value
    const targetValue = getEffectiveValue(target)
    if (targetValue === null) {
      return { valid: false, error: 'Target has no value' }
    }

    // Get helper value (if required)
    let helperValue: number | undefined
    if (capture.helperPieceId) {
      let helperPiece: Piece
      try {
        helperPiece = getPieceById(state.pieces, capture.helperPieceId)
      } catch (e) {
        return { valid: false, error: `Helper piece not found: ${capture.helperPieceId}` }
      }

      // Helper must be friendly
      if (helperPiece.color !== mover.color) {
        return { valid: false, error: 'Helper must be friendly' }
      }

      // Helper must not be captured
      if (helperPiece.captured) {
        return { valid: false, error: 'Helper is captured' }
      }

      // Helper cannot be the mover
      if (helperPiece.id === mover.id) {
        return { valid: false, error: 'Helper cannot be the mover itself' }
      }

      // Helper cannot be a Pyramid (v1 simplification)
      if (helperPiece.type === 'P') {
        return { valid: false, error: 'Pyramids cannot be helpers in v1' }
      }

      helperValue = getEffectiveValue(helperPiece) ?? undefined
    }

    // Check the relation
    const relationCheck = checkRelation(capture.relation, moverValue, targetValue, helperValue)

    if (!relationCheck.valid) {
      return { valid: false, error: relationCheck.explanation || 'Relation check failed' }
    }

    return { valid: true }
  }

  /**
   * Apply a move to the state (mutates and returns new state).
   */
  private applyMove(
    state: RithmomachiaState,
    piece: Piece,
    from: string,
    to: string,
    pyramidFaceUsed: number | null | undefined,
    capture: CaptureContext | null,
    ambush: AmbushContext | undefined,
    context?: ValidationContext
  ): RithmomachiaState {
    // Clone state
    const newState = { ...state }
    newState.pieces = clonePieces(state.pieces)
    newState.capturedPieces = {
      W: [...state.capturedPieces.W],
      B: [...state.capturedPieces.B],
    }
    newState.history = [...state.history]
    newState.stateHashes = [...state.stateHashes]

    // Move the piece
    newState.pieces[piece.id].square = to

    // Set pyramid face if used
    if (pyramidFaceUsed && piece.type === 'P') {
      newState.pieces[piece.id].activePyramidFace = pyramidFaceUsed
    }

    // Handle capture
    let capturedPiece: Piece | null = null
    if (capture) {
      const targetPiece = newState.pieces[capture.targetPieceId]
      targetPiece.captured = true
      newState.capturedPieces[opponentColor(piece.color)].push(targetPiece)
      capturedPiece = targetPiece

      // Reset no-progress counter
      newState.noProgressCount = 0

      // Update points if enabled
      if (newState.pointsCaptured) {
        const points = this.getPiecePoints(targetPiece)
        newState.pointsCaptured[piece.color] += points
      }
    } else {
      // No capture = increment no-progress counter
      newState.noProgressCount += 1
    }

    // Handle ambush (if declared)
    if (ambush) {
      const ambushValidation = this.validateAmbush(newState, piece.color, ambush)
      if (ambushValidation.valid) {
        const enemyPiece = newState.pieces[ambush.enemyPieceId]
        enemyPiece.captured = true
        newState.capturedPieces[opponentColor(piece.color)].push(enemyPiece)

        // Update points if enabled
        if (newState.pointsCaptured) {
          const points = this.getPiecePoints(enemyPiece)
          newState.pointsCaptured[piece.color] += points
        }

        // Reset no-progress counter
        newState.noProgressCount = 0
      }
    }

    // Compute new hash
    const newHash = computeZobristHash(newState.pieces, opponentColor(piece.color))
    newState.stateHashes.push(newHash)

    // Create move record
    const moveRecord: MoveRecord = {
      ply: newState.history.length + 1,
      color: piece.color,
      from,
      to,
      pieceId: piece.id,
      pyramidFaceUsed: pyramidFaceUsed ?? null,
      capture: capture ?? null,
      ambush: ambush ?? null,
      harmonyDeclared: null,
      fenLikeHash: newHash,
      noProgressCount: newState.noProgressCount,
      resultAfter: 'ONGOING',
    }

    newState.history.push(moveRecord)

    // Switch turn
    newState.turn = opponentColor(piece.color)

    // Check for pending harmony validation
    if (newState.pendingHarmony && newState.pendingHarmony.by === newState.turn) {
      // It's now the declarer's turn again - check if harmony still exists
      const config = this.getConfigFromState(newState)
      if (config.allowAnySetOnRecheck) {
        // Check for ANY valid harmony
        if (hasAnyValidHarmony(newState.pieces, newState.pendingHarmony.by)) {
          // Harmony persisted! Victory!
          newState.winner = newState.pendingHarmony.by
          newState.winCondition = 'HARMONY'
          newState.gamePhase = 'results'
          moveRecord.resultAfter = newState.winner === 'W' ? 'WINS_W' : 'WINS_B'
        } else {
          // Harmony broken
          newState.pendingHarmony = null
        }
      } else {
        // Check if the SAME harmony still exists
        if (isHarmonyStillValid(newState.pieces, newState.pendingHarmony)) {
          newState.winner = newState.pendingHarmony.by
          newState.winCondition = 'HARMONY'
          newState.gamePhase = 'results'
          moveRecord.resultAfter = newState.winner === 'W' ? 'WINS_W' : 'WINS_B'
        } else {
          newState.pendingHarmony = null
        }
      }
    }

    // Check for point victory (if enabled)
    if (newState.pointsCaptured && context) {
      const config = this.getConfigFromState(newState)
      if (config.pointWinEnabled) {
        const capturedByMover = newState.pointsCaptured[piece.color]
        if (capturedByMover >= config.pointWinThreshold) {
          newState.winner = piece.color
          newState.winCondition = 'POINTS'
          newState.gamePhase = 'results'
          moveRecord.resultAfter = newState.winner === 'W' ? 'WINS_W' : 'WINS_B'
        }
      }
    }

    // Check for exhaustion (opponent has no legal moves)
    const opponentHasMoves = this.hasLegalMoves(newState, newState.turn)
    if (!opponentHasMoves) {
      newState.winner = opponentColor(newState.turn)
      newState.winCondition = 'EXHAUSTION'
      newState.gamePhase = 'results'
      moveRecord.resultAfter = newState.winner === 'W' ? 'WINS_W' : 'WINS_B'
    }

    return newState
  }

  /**
   * Validate an ambush capture.
   */
  private validateAmbush(
    state: RithmomachiaState,
    color: Color,
    ambush: AmbushContext
  ): ValidationResult {
    // Get the enemy piece
    let enemyPiece: Piece
    try {
      enemyPiece = getPieceById(state.pieces, ambush.enemyPieceId)
    } catch (e) {
      return { valid: false, error: `Enemy piece not found: ${ambush.enemyPieceId}` }
    }

    // Must be enemy
    if (enemyPiece.color === color) {
      return { valid: false, error: 'Ambush target must be enemy' }
    }

    // Get helpers
    let helper1: Piece
    let helper2: Piece
    try {
      helper1 = getPieceById(state.pieces, ambush.helper1Id)
      helper2 = getPieceById(state.pieces, ambush.helper2Id)
    } catch (e) {
      return { valid: false, error: 'Helper not found' }
    }

    // Helpers must be friendly
    if (helper1.color !== color || helper2.color !== color) {
      return { valid: false, error: 'Helpers must be friendly' }
    }

    // Helpers must be alive
    if (helper1.captured || helper2.captured) {
      return { valid: false, error: 'Helper is captured' }
    }

    // Helpers must be distinct
    if (helper1.id === helper2.id) {
      return { valid: false, error: 'Helpers must be distinct' }
    }

    // Helpers cannot be Pyramids (v1)
    if (helper1.type === 'P' || helper2.type === 'P') {
      return { valid: false, error: 'Pyramids cannot be helpers in v1' }
    }

    // Get values
    const enemyValue = getEffectiveValue(enemyPiece)
    const helper1Value = getEffectiveValue(helper1)
    const helper2Value = getEffectiveValue(helper2)

    if (enemyValue === null || helper1Value === null || helper2Value === null) {
      return { valid: false, error: 'Piece has no value' }
    }

    // Check the relation using the TWO helpers
    // For ambush, we interpret the relation as: helper1 and helper2 combine to match enemy
    // For example: SUM means helper1 + helper2 = enemy
    const relationCheck = checkRelation(ambush.relation, helper1Value, enemyValue, helper2Value)

    if (!relationCheck.valid) {
      return { valid: false, error: relationCheck.explanation || 'Ambush relation failed' }
    }

    return { valid: true }
  }

  /**
   * Handle DECLARE_HARMONY action.
   */
  private handleDeclareHarmony(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'DECLARE_HARMONY' }>,
    context?: ValidationContext
  ): ValidationResult {
    const { pieceIds, harmonyType, params } = move.data

    // Must be declaring player's turn
    // (We need to get the player's color from context)
    // For now, assume it's the current turn's player
    const declaringColor = state.turn

    // Get the pieces
    const pieces = pieceIds
      .map((id) => {
        try {
          return getPieceById(state.pieces, id)
        } catch (e) {
          return null
        }
      })
      .filter((p): p is Piece => p !== null)

    if (pieces.length !== pieceIds.length) {
      return { valid: false, error: 'Some pieces not found' }
    }

    // Validate the harmony
    const validation = validateHarmony(pieces, declaringColor)
    if (!validation.valid) {
      return { valid: false, error: validation.reason }
    }

    // Check type matches
    if (validation.type !== harmonyType) {
      return { valid: false, error: `Expected ${harmonyType} but found ${validation.type}` }
    }

    // Create harmony declaration
    const harmony: HarmonyDeclaration = {
      by: declaringColor,
      pieceIds,
      type: harmonyType,
      params,
      declaredAtPly: state.history.length,
    }

    // Clone state
    const newState = {
      ...state,
      pendingHarmony: harmony,
      history: [...state.history],
    }

    // Add to history
    const moveRecord: MoveRecord = {
      ply: newState.history.length + 1,
      color: declaringColor,
      from: '',
      to: '',
      pieceId: '',
      harmonyDeclared: harmony,
      fenLikeHash: state.stateHashes[state.stateHashes.length - 1],
      noProgressCount: state.noProgressCount,
      resultAfter: 'ONGOING',
    }

    newState.history.push(moveRecord)

    // Do NOT switch turn - harmony declaration is free

    return { valid: true, newState }
  }

  /**
   * Handle RESIGN action.
   */
  private handleResign(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'RESIGN' }>,
    context?: ValidationContext
  ): ValidationResult {
    const resigningColor = state.turn
    const winner = opponentColor(resigningColor)

    const newState = {
      ...state,
      winner,
      winCondition: 'RESIGNATION' as const,
      gamePhase: 'results' as const,
    }

    return { valid: true, newState }
  }

  /**
   * Handle draw offers/accepts.
   */
  private handleDraw(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'OFFER_DRAW' | 'ACCEPT_DRAW' }>,
    context?: ValidationContext
  ): ValidationResult {
    // For simplicity, accept any draw (we'd need to track offers in state for proper implementation)
    const newState = {
      ...state,
      winner: null,
      winCondition: 'AGREEMENT' as const,
      gamePhase: 'results' as const,
    }

    return { valid: true, newState }
  }

  /**
   * Handle repetition claim.
   */
  private handleClaimRepetition(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'CLAIM_REPETITION' }>,
    context?: ValidationContext
  ): ValidationResult {
    const config = this.getConfigFromState(state)
    if (!config.repetitionRule) {
      return { valid: false, error: 'Repetition rule not enabled' }
    }

    if (isThreefoldRepetition(state.stateHashes)) {
      const newState = {
        ...state,
        winner: null,
        winCondition: 'REPETITION' as const,
        gamePhase: 'results' as const,
      }
      return { valid: true, newState }
    }

    return { valid: false, error: 'No threefold repetition detected' }
  }

  /**
   * Handle fifty-move rule claim.
   */
  private handleClaimFiftyMove(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'CLAIM_FIFTY_MOVE' }>,
    context?: ValidationContext
  ): ValidationResult {
    const config = this.getConfigFromState(state)
    if (!config.fiftyMoveRule) {
      return { valid: false, error: 'Fifty-move rule not enabled' }
    }

    if (state.noProgressCount >= 50) {
      const newState = {
        ...state,
        winner: null,
        winCondition: 'FIFTY' as const,
        gamePhase: 'results' as const,
      }
      return { valid: true, newState }
    }

    return {
      valid: false,
      error: `Only ${state.noProgressCount} moves without progress (need 50)`,
    }
  }

  /**
   * Handle SET_CONFIG action.
   * Updates a single config field in the state.
   */
  private handleSetConfig(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'SET_CONFIG' }>,
    context?: ValidationContext
  ): ValidationResult {
    const { field, value } = move.data

    // Validate the field exists in config
    const validFields: Array<keyof RithmomachiaConfig> = [
      'pointWinEnabled',
      'pointWinThreshold',
      'repetitionRule',
      'fiftyMoveRule',
      'allowAnySetOnRecheck',
      'timeControlMs',
      'whitePlayerId',
      'blackPlayerId',
    ]

    if (!validFields.includes(field as keyof RithmomachiaConfig)) {
      return { valid: false, error: `Invalid config field: ${field}` }
    }

    // Basic type validation
    if (
      field === 'pointWinEnabled' ||
      field === 'repetitionRule' ||
      field === 'fiftyMoveRule' ||
      field === 'allowAnySetOnRecheck'
    ) {
      if (typeof value !== 'boolean') {
        return { valid: false, error: `${field} must be a boolean` }
      }
    }

    if (field === 'pointWinThreshold') {
      if (typeof value !== 'number' || value < 1) {
        return { valid: false, error: 'pointWinThreshold must be a positive number' }
      }
    }

    if (field === 'timeControlMs') {
      if (value !== null && (typeof value !== 'number' || value < 0)) {
        return { valid: false, error: 'timeControlMs must be null or a non-negative number' }
      }
    }

    if (field === 'whitePlayerId' || field === 'blackPlayerId') {
      if (value !== null && typeof value !== 'string') {
        return { valid: false, error: `${field} must be a string or null` }
      }
    }

    // Create new state with updated config field
    const newState = {
      ...state,
      [field]: value,
    }

    // If enabling point tracking and it doesn't exist, initialize it
    if (field === 'pointWinEnabled' && value === true && !state.pointsCaptured) {
      newState.pointsCaptured = { W: 0, B: 0 }
    }

    return { valid: true, newState }
  }

  /**
   * Handle RESET_GAME action.
   * Creates a fresh game state with the current config and immediately starts playing.
   */
  private handleResetGame(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'RESET_GAME' }>,
    context?: ValidationContext
  ): ValidationResult {
    // Extract current config from state
    const config = this.getConfigFromState(state)

    // Get fresh initial state with current config
    const newState = this.getInitialState(config)

    // Immediately transition to playing phase (skip setup)
    newState.gamePhase = 'playing'

    return { valid: true, newState }
  }

  /**
   * Handle GO_TO_SETUP action.
   * Returns to setup phase, preserving config but resetting game state.
   */
  private handleGoToSetup(
    state: RithmomachiaState,
    move: Extract<RithmomachiaMove, { type: 'GO_TO_SETUP' }>,
    context?: ValidationContext
  ): ValidationResult {
    // Extract current config from state
    const config = this.getConfigFromState(state)

    // Get fresh initial state (which starts in setup phase) with current config
    const newState = this.getInitialState(config)

    return { valid: true, newState }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check if a player has any legal moves.
   */
  private hasLegalMoves(state: RithmomachiaState, color: Color): boolean {
    const pieces = getLivePiecesForColor(state.pieces, color)

    for (const piece of pieces) {
      // Check all possible destinations
      for (let file = 0; file < 16; file++) {
        for (let rank = 1; rank <= 8; rank++) {
          const to = `${String.fromCharCode(65 + file)}${rank}`

          // Skip same square
          if (to === piece.square) continue

          // Check if move is geometrically legal
          const validation = validateMove(piece, piece.square, to, state.pieces)
          if (validation.valid) {
            // Check if destination is empty or has enemy that can be captured
            const targetPiece = getPieceAt(state.pieces, to)
            if (!targetPiece) {
              // Empty square = legal move
              return true
            }
            if (targetPiece.color !== color) {
              // Enemy piece - check if any capture relation exists
              // (We'll simplify and say yes if any no-helper relation works)
              const moverValue = getEffectiveValue(piece)
              const targetValue = getEffectiveValue(targetPiece)
              if (moverValue && targetValue) {
                // Check for simple relations (no helper required)
                const simpleRelations = ['EQUAL', 'MULTIPLE', 'DIVISOR'] as const
                for (const relation of simpleRelations) {
                  const check = checkRelation(relation, moverValue, targetValue)
                  if (check.valid) {
                    return true
                  }
                }
                // Could also check with helpers, but that's expensive
                // For now, we assume if simple capture fails, move is not legal
              }
            }
          }
        }
      }
    }

    return false
  }

  /**
   * Get piece point value.
   */
  private getPiecePoints(piece: Piece): number {
    const POINTS: Record<typeof piece.type, number> = {
      C: 1,
      T: 2,
      S: 3,
      P: 5,
    }
    return POINTS[piece.type]
  }

  /**
   * Get config from state (config is stored in state following arcade pattern).
   */
  private getConfigFromState(state: RithmomachiaState): RithmomachiaConfig {
    return {
      pointWinEnabled: state.pointWinEnabled,
      pointWinThreshold: state.pointWinThreshold,
      repetitionRule: state.repetitionRule,
      fiftyMoveRule: state.fiftyMoveRule,
      allowAnySetOnRecheck: state.allowAnySetOnRecheck,
      timeControlMs: state.timeControlMs,
      whitePlayerId: state.whitePlayerId ?? null,
      blackPlayerId: state.blackPlayerId ?? null,
    }
  }
}

export const rithmomachiaValidator = new RithmomachiaValidator()

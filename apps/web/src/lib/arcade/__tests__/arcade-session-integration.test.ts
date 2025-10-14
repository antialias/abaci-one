import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MemoryPairsState } from '@/app/games/matching/context/types'
import { db, schema } from '@/db'
import {
  applyGameMove,
  createArcadeSession,
  deleteArcadeSession,
  getArcadeSession,
} from '../session-manager'
import { createRoom, deleteRoom } from '../room-manager'

/**
 * Integration test for the full arcade session flow
 * Tests the complete lifecycle: create -> join -> move -> validate -> sync
 */
describe('Arcade Session Integration', () => {
  const testUserId = 'integration-test-user'
  const testGuestId = 'integration-test-guest'
  let testRoomId: string

  beforeEach(async () => {
    // Create test user
    await db
      .insert(schema.users)
      .values({
        id: testUserId,
        guestId: testGuestId,
        createdAt: new Date(),
      })
      .onConflictDoNothing()

    // Create test room
    const room = await createRoom({
      name: 'Test Room',
      createdBy: testGuestId,
      creatorName: 'Test User',
      gameName: 'matching',
      gameConfig: { difficulty: 6, gameType: 'abacus-numeral', turnTimer: 30 },
      ttlMinutes: 60,
    })
    testRoomId = room.id
  })

  afterEach(async () => {
    // Clean up
    await deleteArcadeSession(testGuestId)
    if (testRoomId) {
      await deleteRoom(testRoomId)
    }
    await db.delete(schema.users).where(eq(schema.users.id, testUserId))
  })

  it('should complete full session lifecycle', async () => {
    // 1. Create session
    const initialState: MemoryPairsState = {
      cards: [],
      gameCards: [],
      flippedCards: [],
      gameType: 'abacus-numeral',
      difficulty: 6,
      turnTimer: 30,
      gamePhase: 'setup',
      currentPlayer: '1',
      matchedPairs: 0,
      totalPairs: 6,
      moves: 0,
      scores: {},
      activePlayers: ['1'],
      playerMetadata: {},
      consecutiveMatches: {},
      gameStartTime: null,
      gameEndTime: null,
      currentMoveStartTime: null,
      timerInterval: null,
      celebrationAnimations: [],
      isProcessingMove: false,
      showMismatchFeedback: false,
      lastMatchedPair: null,
      playerHovers: {},
    }

    const session = await createArcadeSession({
      userId: testGuestId,
      gameName: 'matching',
      gameUrl: '/arcade/matching',
      initialState,
      activePlayers: ['1'],
      roomId: testRoomId,
    })

    expect(session).toBeDefined()
    expect(session.userId).toBe(testUserId)
    expect(session.version).toBe(1)
    expect((session.gameState as MemoryPairsState).gamePhase).toBe('setup')

    // 2. Retrieve session (simulating "join")
    const retrieved = await getArcadeSession(testUserId)
    expect(retrieved).toBeDefined()
    expect(retrieved?.userId).toBe(testUserId)

    // 3. Apply a valid move (START_GAME)
    const startGameMove = {
      type: 'START_GAME',
      playerId: testUserId,
      timestamp: Date.now(),
      data: {
        activePlayers: ['1'],
      },
    }

    const result = await applyGameMove(testUserId, startGameMove as any)

    expect(result.success).toBe(true)
    expect(result.session).toBeDefined()
    expect(result.session?.version).toBe(2) // Version incremented
    expect((result.session?.gameState as MemoryPairsState).gamePhase).toBe('playing')
    expect((result.session?.gameState as MemoryPairsState).gameCards.length).toBe(12) // 6 pairs

    // 4. Try an invalid move (should be rejected)
    const invalidMove = {
      type: 'FLIP_CARD',
      playerId: testUserId,
      timestamp: Date.now(),
      data: {
        cardId: 'non-existent-card',
      },
    }

    const invalidResult = await applyGameMove(testUserId, invalidMove as any)

    expect(invalidResult.success).toBe(false)
    expect(invalidResult.error).toBe('Card not found')

    // Version should NOT have incremented
    const sessionAfterInvalid = await getArcadeSession(testUserId)
    expect(sessionAfterInvalid?.version).toBe(2) // Still 2, not 3

    // 5. Clean up (exit session)
    await deleteArcadeSession(testUserId)

    const deletedSession = await getArcadeSession(testUserId)
    expect(deletedSession).toBeUndefined()
  })

  it('should handle concurrent move attempts', async () => {
    // Create session in playing state
    const playingState: MemoryPairsState = {
      cards: [],
      gameCards: [
        {
          id: 'card-1',
          type: 'number',
          number: 5,
          matched: false,
        },
        {
          id: 'card-2',
          type: 'abacus',
          number: 5,
          matched: false,
        },
      ],
      flippedCards: [],
      gameType: 'abacus-numeral',
      difficulty: 6,
      turnTimer: 30,
      gamePhase: 'playing',
      currentPlayer: '1',
      matchedPairs: 0,
      totalPairs: 6,
      moves: 0,
      scores: { 1: 0 },
      activePlayers: ['1'],
      playerMetadata: {},
      consecutiveMatches: { 1: 0 },
      gameStartTime: Date.now(),
      gameEndTime: null,
      currentMoveStartTime: null,
      timerInterval: null,
      celebrationAnimations: [],
      isProcessingMove: false,
      showMismatchFeedback: false,
      lastMatchedPair: null,
      playerHovers: {},
    }

    await createArcadeSession({
      userId: testGuestId,
      gameName: 'matching',
      gameUrl: '/arcade/matching',
      initialState: playingState,
      activePlayers: ['1'],
      roomId: testRoomId,
    })

    // First move: flip card 1
    const move1 = {
      type: 'FLIP_CARD',
      playerId: testUserId,
      timestamp: Date.now(),
      data: { cardId: 'card-1' },
    }

    const result1 = await applyGameMove(testUserId, move1 as any)
    expect(result1.success).toBe(true)
    expect(result1.session?.version).toBe(2)

    // Second move: flip card 2 (should match)
    const move2 = {
      type: 'FLIP_CARD',
      playerId: testUserId,
      timestamp: Date.now() + 1,
      data: { cardId: 'card-2' },
    }

    const result2 = await applyGameMove(testUserId, move2 as any)
    expect(result2.success).toBe(true)
    expect(result2.session?.version).toBe(3)

    // Verify the match was recorded
    const state = result2.session?.gameState as MemoryPairsState
    expect(state.matchedPairs).toBe(1)
    expect(state.gameCards[0].matched).toBe(true)
    expect(state.gameCards[1].matched).toBe(true)
  })
})

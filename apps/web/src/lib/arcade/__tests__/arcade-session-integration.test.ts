import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MemoryPairsState } from '@/arcade-games/matching/types'
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
    // Clean up - delete sessions first (FK constraint on roomId)
    await deleteArcadeSession(testGuestId)
    // Also clean up any sessions directly by roomId in case deleteArcadeSession misses them
    if (testRoomId) {
      try {
        await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.roomId, testRoomId))
      } catch {
        // May already be deleted
      }
      try {
        await deleteRoom(testRoomId)
      } catch {
        // Room may already be deleted
      }
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
    // Game state is stored in namespaced format: { matching: <state> }
    expect((session.gameState as any).matching.gamePhase).toBe('setup')

    // 2. Retrieve session (simulating "join") - use guestId, not database userId
    const retrieved = await getArcadeSession(testGuestId)
    expect(retrieved).toBeDefined()
    expect(retrieved?.userId).toBe(testUserId)

    // 3. Apply a valid move (START_GAME) - use guestId for lookup
    const startGameMove = {
      type: 'START_GAME',
      playerId: testUserId,
      timestamp: Date.now(),
      data: {
        activePlayers: ['1'],
      },
    }

    const result = await applyGameMove(testGuestId, startGameMove as any)

    expect(result.success).toBe(true)
    expect(result.session).toBeDefined()
    expect(result.session?.version).toBe(2) // Version incremented
    // Result gameState is namespaced: { matching: <state> }
    const resultState = (result.session?.gameState as any).matching as MemoryPairsState
    expect(resultState.gamePhase).toBe('playing')
    expect(resultState.gameCards.length).toBe(12) // 6 pairs

    // 4. Try an invalid move (should be rejected)
    const invalidMove = {
      type: 'FLIP_CARD',
      playerId: testUserId,
      timestamp: Date.now(),
      data: {
        cardId: 'non-existent-card',
      },
    }

    const invalidResult = await applyGameMove(testGuestId, invalidMove as any)

    expect(invalidResult.success).toBe(false)
    expect(invalidResult.error).toBe('Card not found')

    // Version should NOT have incremented
    const sessionAfterInvalid = await getArcadeSession(testGuestId)
    expect(sessionAfterInvalid?.version).toBe(2) // Still 2, not 3

    // 5. Clean up (exit session)
    await deleteArcadeSession(testGuestId)

    const deletedSession = await getArcadeSession(testGuestId)
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

    // First move: flip card 1 - use guestId for session lookup
    const move1 = {
      type: 'FLIP_CARD',
      playerId: testUserId,
      timestamp: Date.now(),
      data: { cardId: 'card-1' },
    }

    const result1 = await applyGameMove(testGuestId, move1 as any)
    expect(result1.success).toBe(true)
    expect(result1.session?.version).toBe(2)

    // Second move: flip card 2 (should match)
    const move2 = {
      type: 'FLIP_CARD',
      playerId: testUserId,
      timestamp: Date.now() + 1,
      data: { cardId: 'card-2' },
    }

    const result2 = await applyGameMove(testGuestId, move2 as any)
    expect(result2.success).toBe(true)
    expect(result2.session?.version).toBe(3)

    // Verify the match was recorded - game state is namespaced
    const state = (result2.session?.gameState as any).matching as MemoryPairsState
    expect(state.matchedPairs).toBe(1)
    expect(state.gameCards[0].matched).toBe(true)
    expect(state.gameCards[1].matched).toBe(true)
  })
})

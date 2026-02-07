import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KnowYourWorldValidator } from './Validator'
import type { KnowYourWorldState, KnowYourWorldMove } from './types'

// Helper to cast ValidationResult.newState to KnowYourWorldState
const asState = (newState: unknown) => newState as KnowYourWorldState | undefined

// Mock the maps module
vi.mock('./maps', () => ({
  getFilteredMapData: vi.fn().mockResolvedValue({
    regions: [
      { id: 'region-1', name: 'Region 1' },
      { id: 'region-2', name: 'Region 2' },
      { id: 'region-3', name: 'Region 3' },
      { id: 'region-4', name: 'Region 4' },
      { id: 'region-5', name: 'Region 5' },
      { id: 'region-6', name: 'Region 6' },
      { id: 'region-7', name: 'Region 7' },
      { id: 'region-8', name: 'Region 8' },
      { id: 'region-9', name: 'Region 9' },
      { id: 'region-10', name: 'Region 10' },
    ],
  }),
  getFilteredMapDataBySizes: vi.fn().mockResolvedValue({
    regions: [
      { id: 'region-1', name: 'Region 1' },
      { id: 'region-2', name: 'Region 2' },
      { id: 'region-3', name: 'Region 3' },
      { id: 'region-4', name: 'Region 4' },
      { id: 'region-5', name: 'Region 5' },
      { id: 'region-6', name: 'Region 6' },
      { id: 'region-7', name: 'Region 7' },
      { id: 'region-8', name: 'Region 8' },
      { id: 'region-9', name: 'Region 9' },
      { id: 'region-10', name: 'Region 10' },
    ],
  }),
}))

describe('KnowYourWorldValidator', () => {
  let validator: KnowYourWorldValidator

  beforeEach(() => {
    validator = new KnowYourWorldValidator()
    vi.clearAllMocks()
  })

  const createBaseState = (overrides: Partial<KnowYourWorldState> = {}): KnowYourWorldState => ({
    gamePhase: 'playing',
    selectedMap: 'world',
    gameMode: 'cooperative',
    includeSizes: ['huge', 'large', 'medium'],
    assistanceLevel: 'helpful',
    selectedContinent: 'all',
    currentPrompt: 'region-1',
    regionsToFind: ['region-2', 'region-3', 'region-4', 'region-5'],
    regionsFound: [],
    regionsGivenUp: [],
    currentPlayer: 'player-1',
    scores: { 'player-1': 0 },
    attempts: { 'player-1': 0 },
    guessHistory: [],
    startTime: Date.now(),
    activePlayers: ['player-1'],
    activeUserIds: ['user-1'],
    playerMetadata: { 'player-1': { name: 'Player 1' } },
    giveUpReveal: null,
    giveUpVotes: [],
    hintsUsed: 0,
    hintActive: null,
    nameConfirmationProgress: 0,
    ...overrides,
  })

  const createGiveUpMove = (playerId = 'player-1'): KnowYourWorldMove => ({
    type: 'GIVE_UP',
    playerId,
    userId: 'user-1',
    timestamp: Date.now(),
    data: {},
  })

  describe('validateGiveUp', () => {
    describe('validation checks', () => {
      it('rejects give up when not in playing phase', async () => {
        const state = createBaseState({ gamePhase: 'setup' })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Can only give up during playing phase')
      })

      it('rejects give up when no current prompt', async () => {
        const state = createBaseState({ currentPrompt: null })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('No region to give up on')
      })

      it('rejects give up from wrong player in turn-based mode', async () => {
        const state = createBaseState({
          gameMode: 'turn-based',
          currentPlayer: 'player-1',
          activePlayers: ['player-1', 'player-2'],
        })
        const move = createGiveUpMove('player-2')

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Not your turn')
      })

      it('accepts give up from correct player in turn-based mode', async () => {
        const state = createBaseState({
          gameMode: 'turn-based',
          currentPlayer: 'player-1',
          activePlayers: ['player-1', 'player-2'],
        })
        const move = createGiveUpMove('player-1')

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
      })
    })

    describe('region tracking', () => {
      it('adds region to regionsGivenUp', async () => {
        const state = createBaseState({
          currentPrompt: 'region-1',
          regionsGivenUp: [],
        })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.regionsGivenUp).toContain('region-1')
      })

      it('does not duplicate region in regionsGivenUp if already tracked', async () => {
        const state = createBaseState({
          currentPrompt: 'region-1',
          regionsGivenUp: ['region-1'], // Already given up once
        })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.regionsGivenUp).toEqual(['region-1'])
        expect(asState(result.newState)?.regionsGivenUp?.length).toBe(1)
      })

      it('preserves existing regionsGivenUp entries', async () => {
        const state = createBaseState({
          currentPrompt: 'region-2',
          regionsGivenUp: ['region-1'],
        })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.regionsGivenUp).toContain('region-1')
        expect(asState(result.newState)?.regionsGivenUp).toContain('region-2')
      })
    })

    describe('re-ask priority based on difficulty', () => {
      it('re-inserts region after 3 positions on easy difficulty', async () => {
        const state = createBaseState({
          difficulty: 'easy',
          currentPrompt: 'region-1',
          regionsToFind: ['region-2', 'region-3', 'region-4', 'region-5', 'region-6'],
        })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        // Next prompt should be region-2 (first in queue)
        expect(asState(result.newState)?.currentPrompt).toBe('region-2')
        // region-1 re-inserted at position 3 in queue, then first element becomes currentPrompt
        // Queue after insert: [region-2, region-3, region-4, region-1, region-5, region-6]
        // After slice(1): [region-3, region-4, region-1, region-5, region-6]
        // So user will see: region-2, region-3, region-4, then region-1 comes back
        expect(asState(result.newState)?.regionsToFind).toEqual([
          'region-3',
          'region-4',
          'region-1',
          'region-5',
          'region-6',
        ])
      })

      it('re-inserts region at end on hard difficulty', async () => {
        const state = createBaseState({
          difficulty: 'hard',
          currentPrompt: 'region-1',
          regionsToFind: ['region-2', 'region-3', 'region-4', 'region-5'],
        })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.currentPrompt).toBe('region-2')
        // region-1 should be at the end
        expect(asState(result.newState)?.regionsToFind).toEqual([
          'region-3',
          'region-4',
          'region-5',
          'region-1',
        ])
      })

      it('handles easy difficulty with fewer than 3 regions remaining', async () => {
        const state = createBaseState({
          difficulty: 'easy',
          currentPrompt: 'region-1',
          regionsToFind: ['region-2'], // Only 1 region in queue
        })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.currentPrompt).toBe('region-2')
        // region-1 should be inserted at end (min of 3, queue length)
        expect(asState(result.newState)?.regionsToFind).toEqual(['region-1'])
      })

      it('handles only one region (the current prompt) remaining', async () => {
        const state = createBaseState({
          difficulty: 'easy',
          currentPrompt: 'region-1',
          regionsToFind: [], // No other regions
        })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        // The given-up region becomes the next prompt again
        expect(asState(result.newState)?.currentPrompt).toBe('region-1')
        expect(asState(result.newState)?.regionsToFind).toEqual([])
      })
    })

    describe('turn rotation in turn-based mode', () => {
      it('rotates to next player after give up', async () => {
        const state = createBaseState({
          gameMode: 'turn-based',
          currentPlayer: 'player-1',
          activePlayers: ['player-1', 'player-2', 'player-3'],
        })
        const move = createGiveUpMove('player-1')

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.currentPlayer).toBe('player-2')
      })

      it('wraps around to first player after last player', async () => {
        const state = createBaseState({
          gameMode: 'turn-based',
          currentPlayer: 'player-3',
          activePlayers: ['player-1', 'player-2', 'player-3'],
        })
        const move = createGiveUpMove('player-3')

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.currentPlayer).toBe('player-1')
      })

      it('does not rotate player in cooperative mode', async () => {
        const state = createBaseState({
          gameMode: 'cooperative',
          currentPlayer: 'player-1',
          activePlayers: ['player-1', 'player-2'],
        })
        const move = createGiveUpMove('player-1')

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.currentPlayer).toBe('player-1')
      })
    })

    describe('giveUpReveal state', () => {
      it('sets giveUpReveal with region info and timestamp', async () => {
        const state = createBaseState({
          currentPrompt: 'region-1',
        })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.giveUpReveal).not.toBeNull()
        expect(asState(result.newState)?.giveUpReveal?.regionId).toBe('region-1')
        expect(asState(result.newState)?.giveUpReveal?.regionName).toBe('Region 1')
        expect(asState(result.newState)?.giveUpReveal?.timestamp).toBeGreaterThan(0)
      })
    })

    describe('integration: multiple give ups', () => {
      it('handles consecutive give ups correctly', async () => {
        // First give up
        let state = createBaseState({
          difficulty: 'easy',
          currentPrompt: 'region-1',
          regionsToFind: ['region-2', 'region-3', 'region-4', 'region-5'],
        })
        let move = createGiveUpMove()

        let result = await validator.validateMove(state, move)
        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.regionsGivenUp).toEqual(['region-1'])

        // Second give up (on region-2)
        state = result.newState as KnowYourWorldState
        move = createGiveUpMove()

        result = await validator.validateMove(state, move)
        expect(result.valid).toBe(true)
        expect(asState(result.newState)?.regionsGivenUp).toContain('region-1')
        expect(asState(result.newState)?.regionsGivenUp).toContain('region-2')
        expect(asState(result.newState)?.currentPrompt).toBe('region-3')
      })

      it('handles giving up on same region twice (after it comes back)', async () => {
        // Setup: region-1 is current, only region-2 in queue
        // After give up: region-2 is current, region-1 at end
        // Then region-2 is found, region-1 comes back as current
        // Give up again on region-1

        const state = createBaseState({
          difficulty: 'hard',
          currentPrompt: 'region-1',
          regionsToFind: ['region-2'],
          regionsGivenUp: ['region-1'], // Already given up once
        })
        const move = createGiveUpMove()

        const result = await validator.validateMove(state, move)

        expect(result.valid).toBe(true)
        // Should not duplicate in regionsGivenUp
        expect(asState(result.newState)?.regionsGivenUp).toEqual(['region-1'])
        // region-1 should still be re-inserted
        expect(asState(result.newState)?.regionsToFind).toContain('region-1')
      })
    })
  })
})

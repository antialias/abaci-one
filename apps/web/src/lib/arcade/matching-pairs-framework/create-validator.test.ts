import { describe, expect, it } from 'vitest'
import { createMatchingPairsValidator } from './create-validator'
import type {
  BaseMatchingCard,
  BaseMatchingConfig,
  MatchingPairsState,
  MatchingPairsVariant,
} from './types'

// Minimal card type for testing
interface TestCard extends BaseMatchingCard {
  value: string
}

// Minimal config type for testing
interface TestConfig extends BaseMatchingConfig {
  // no extra fields needed
}

type State = MatchingPairsState<TestCard, TestConfig> & TestConfig

/**
 * Create a minimal variant for testing the validator factory.
 */
function createTestVariant(): MatchingPairsVariant<TestCard, TestConfig> {
  return {
    gameName: 'test-matching',
    defaultConfig: {
      difficulty: 6,
      turnTimer: 0,
    },
    cardSchema: {} as any, // not used in these tests
    generateCards: (config: TestConfig): TestCard[] => {
      const cards: TestCard[] = []
      for (let i = 0; i < config.difficulty; i++) {
        cards.push(
          { id: `a-${i}`, type: 'value', value: String(i), matched: false },
          { id: `b-${i}`, type: 'value', value: String(i), matched: false }
        )
      }
      return cards
    },
    validateMatch: (card1: TestCard, card2: TestCard) => ({
      isValid: card1.value === card2.value,
      type: 'value',
    }),
    validateConfigField: () => null,
    getTotalPairs: (config: TestConfig) => config.difficulty,
    getOriginalConfig: (config: TestConfig) => ({ difficulty: config.difficulty }),
    hasConfigChangedFrom: (current, original) => current.difficulty !== original.difficulty,
    CardFront: (() => null) as any,
    getCardBackStyle: () => ({ gradient: '', icon: '' }),
    SetupContent: (() => null) as any,
    getGridConfig: () => ({}),
  }
}

/**
 * Helper: call getInitialStateForPracticeBreak and cast the sync result.
 * The matching-pairs implementation is always synchronous.
 */
function getPracticeBreakState(
  validator: ReturnType<typeof createMatchingPairsValidator<TestCard, TestConfig>>,
  config: unknown,
  options: Parameters<NonNullable<typeof validator.getInitialStateForPracticeBreak>>[1]
): State {
  return validator.getInitialStateForPracticeBreak!(config, options) as State
}

describe('createMatchingPairsValidator', () => {
  describe('getInitialStateForPracticeBreak', () => {
    it('works with 0 additional players (existing behavior)', () => {
      const variant = createTestVariant()
      const validator = createMatchingPairsValidator(variant)

      const state = getPracticeBreakState(
        validator,
        { difficulty: 6, turnTimer: 0 },
        {
          maxDurationMinutes: 5,
          playerId: 'player-1',
          playerName: 'Alice',
        }
      )

      expect(state.activePlayers).toEqual(['player-1'])
      expect(state.scores).toEqual({ 'player-1': 0 })
      expect(state.consecutiveMatches).toEqual({ 'player-1': 0 })
      expect(state.playerMetadata).toEqual({
        'player-1': {
          id: 'player-1',
          name: 'Alice',
          emoji: '🎮',
          userId: 'player-1',
        },
      })
      expect(state.currentPlayer).toBe('player-1')
      expect(state.gamePhase).toBe('playing')
      expect(state.gameCards.length).toBe(12) // 6 pairs = 12 cards
    })

    it('includes 1 additional player in all per-player state', () => {
      const variant = createTestVariant()
      const validator = createMatchingPairsValidator(variant)

      const state = getPracticeBreakState(
        validator,
        { difficulty: 6, turnTimer: 0 },
        {
          maxDurationMinutes: 5,
          playerId: 'student-1',
          playerName: 'Alice',
          additionalPlayers: [
            {
              playerId: 'observer-1',
              playerName: 'Bob',
              emoji: '👀',
              color: '#ff0000',
              userId: 'user-bob',
            },
          ],
        }
      )

      // Primary player is first
      expect(state.activePlayers).toEqual(['student-1', 'observer-1'])

      // Scores initialized for both
      expect(state.scores).toEqual({
        'student-1': 0,
        'observer-1': 0,
      })

      // Consecutive matches initialized for both
      expect(state.consecutiveMatches).toEqual({
        'student-1': 0,
        'observer-1': 0,
      })

      // Player metadata has correct entries
      expect(state.playerMetadata['student-1']).toEqual({
        id: 'student-1',
        name: 'Alice',
        emoji: '🎮',
        userId: 'student-1',
      })
      expect(state.playerMetadata['observer-1']).toEqual({
        id: 'observer-1',
        name: 'Bob',
        emoji: '👀',
        userId: 'user-bob',
        color: '#ff0000',
      })

      // Primary player is still the current player
      expect(state.currentPlayer).toBe('student-1')
    })

    it('includes 2 additional players in all per-player state', () => {
      const variant = createTestVariant()
      const validator = createMatchingPairsValidator(variant)

      const state = getPracticeBreakState(
        validator,
        { difficulty: 8, turnTimer: 0 },
        {
          maxDurationMinutes: 5,
          playerId: 'student-1',
          playerName: 'Alice',
          additionalPlayers: [
            {
              playerId: 'observer-1',
              playerName: 'Bob',
              emoji: '👀',
              color: '#ff0000',
              userId: 'user-bob',
            },
            {
              playerId: 'observer-2',
              playerName: 'Charlie',
              emoji: '🎯',
              color: '#00ff00',
              userId: 'user-charlie',
            },
          ],
        }
      )

      // All three players in order: primary first, then additional
      expect(state.activePlayers).toEqual(['student-1', 'observer-1', 'observer-2'])

      // Scores for all three
      expect(Object.keys(state.scores)).toHaveLength(3)
      expect(state.scores['student-1']).toBe(0)
      expect(state.scores['observer-1']).toBe(0)
      expect(state.scores['observer-2']).toBe(0)

      // Consecutive matches for all three
      expect(Object.keys(state.consecutiveMatches)).toHaveLength(3)
      expect(state.consecutiveMatches['student-1']).toBe(0)
      expect(state.consecutiveMatches['observer-1']).toBe(0)
      expect(state.consecutiveMatches['observer-2']).toBe(0)

      // Player metadata for all three
      expect(Object.keys(state.playerMetadata)).toHaveLength(3)
      expect(state.playerMetadata['student-1'].name).toBe('Alice')
      expect(state.playerMetadata['observer-1'].name).toBe('Bob')
      expect(state.playerMetadata['observer-2'].name).toBe('Charlie')
      expect(state.playerMetadata['observer-2'].color).toBe('#00ff00')

      // Primary player is still the current player
      expect(state.currentPlayer).toBe('student-1')
      expect(state.gamePhase).toBe('playing')
    })

    it('applies difficulty adjustment for short breaks regardless of additional players', () => {
      const variant = createTestVariant()
      const validator = createMatchingPairsValidator(variant)

      const state = getPracticeBreakState(
        validator,
        { difficulty: 12, turnTimer: 0 },
        {
          maxDurationMinutes: 2, // Short break -> difficulty capped to 6
          playerId: 'student-1',
          playerName: 'Alice',
          additionalPlayers: [
            {
              playerId: 'observer-1',
              playerName: 'Bob',
              emoji: '👀',
              color: '#ff0000',
              userId: 'user-bob',
            },
          ],
        }
      )

      // Difficulty should be capped to 6 for short breaks
      expect(state.totalPairs).toBe(6)
      expect(state.gameCards.length).toBe(12) // 6 pairs = 12 cards

      // Both players still present
      expect(state.activePlayers).toEqual(['student-1', 'observer-1'])
    })
  })

  describe('FLIP_CARD: who may move which player', () => {
    type Validator = ReturnType<typeof createMatchingPairsValidator<TestCard, TestConfig>>
    // The matching-pairs validator answers synchronously
    const validate = (validator: Validator, ...args: Parameters<Validator['validateMove']>) =>
      validator.validateMove(...args) as { valid: boolean; error?: string }
    // The kid ('kid-user') owns 'student-1'; a co-play observer ('obs-user')
    // plays as its synthetic player, whose id is its user id
    function coPlayState(currentPlayer: string) {
      const validator = createMatchingPairsValidator(createTestVariant())
      const state = getPracticeBreakState(
        validator,
        { difficulty: 6, turnTimer: 0 },
        {
          maxDurationMinutes: 5,
          playerId: 'student-1',
          playerName: 'Alice',
          additionalPlayers: [
            {
              playerId: 'obs-user',
              playerName: 'Mom',
              emoji: '👩',
              color: '#f00',
              userId: 'obs-user',
            },
          ],
        }
      )
      return { validator, state: { ...state, currentPlayer } }
    }
    const flip = (playerId: string, userId: string, cardId = 'a-0') => ({
      type: 'FLIP_CARD' as const,
      playerId,
      userId,
      timestamp: 1,
      data: { cardId },
    })
    // The room's members' players: only the kid's
    const playerOwnership = { 'student-1': 'kid-user' }

    it('the observer moves its own co-play player', () => {
      const { validator, state } = coPlayState('obs-user')
      const result = validate(validator, state, flip('obs-user', 'obs-user'), {
        userId: 'obs-user',
        playerOwnership,
      })
      expect(result.valid).toBe(true)
    })

    it('no one else moves the co-play player: not the kid, not a stranger', () => {
      const { validator, state } = coPlayState('obs-user')
      for (const userId of ['kid-user', 'stranger']) {
        const result = validate(validator, state, flip('obs-user', userId), {
          userId,
          playerOwnership,
        })
        expect(result).toEqual({ valid: false, error: 'You can only move your own players' })
      }
    })

    it('an id in no one’s ownership is not movable (only the mover’s own user-id player is)', () => {
      const validator = createMatchingPairsValidator(createTestVariant())
      const state = getPracticeBreakState(
        validator,
        { difficulty: 6, turnTimer: 0 },
        { maxDurationMinutes: 5, playerId: 'ghost', playerName: 'Ghost' }
      )
      const result = validate(validator, state, flip('ghost', 'stranger'), {
        userId: 'stranger',
        playerOwnership,
      })
      expect(result).toEqual({ valid: false, error: 'You can only move your own players' })
    })

    it('the kid moves its own player; another member’s player is refused', () => {
      const { validator, state } = coPlayState('student-1')
      expect(
        validate(validator, state, flip('student-1', 'kid-user'), {
          userId: 'kid-user',
          playerOwnership,
        }).valid
      ).toBe(true)
      expect(
        validate(validator, state, flip('student-1', 'obs-user'), {
          userId: 'obs-user',
          playerOwnership,
        })
      ).toEqual({ valid: false, error: 'You can only move your own players' })
    })

    it('arcade local multiplayer: one user moves each of its own players in turn', () => {
      const validator = createMatchingPairsValidator(createTestVariant())
      const base = getPracticeBreakState(
        validator,
        { difficulty: 6, turnTimer: 0 },
        {
          maxDurationMinutes: 5,
          playerId: 'p1',
          playerName: 'One',
          additionalPlayers: [
            { playerId: 'p2', playerName: 'Two', emoji: '2', color: '#0f0', userId: 'host' },
          ],
        }
      )
      const ownership = { p1: 'host', p2: 'host' }
      for (const player of ['p1', 'p2']) {
        const result = validate(
          validator,
          { ...base, currentPlayer: player },
          flip(player, 'host'),
          { userId: 'host', playerOwnership: ownership }
        )
        expect(result.valid).toBe(true)
      }
    })
  })
})

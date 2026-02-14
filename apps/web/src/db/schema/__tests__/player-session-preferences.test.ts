import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SESSION_PREFERENCES,
  type PlayerSessionPreferencesConfig,
} from '../player-session-preferences'

describe('PlayerSessionPreferencesConfig', () => {
  describe('DEFAULT_SESSION_PREFERENCES', () => {
    it('has the expected default duration', () => {
      expect(DEFAULT_SESSION_PREFERENCES.durationMinutes).toBe(10)
    })

    it('has recommended problem length preference', () => {
      expect(DEFAULT_SESSION_PREFERENCES.problemLengthPreference).toBe('recommended')
    })

    it('has default part weights (abacus=2, visualization=1, linear=0)', () => {
      expect(DEFAULT_SESSION_PREFERENCES.partWeights).toEqual({
        abacus: 2,
        visualization: 1,
        linear: 0,
      })
    })

    it('has default purpose weights (focus=3, others=1)', () => {
      expect(DEFAULT_SESSION_PREFERENCES.purposeWeights).toEqual({
        focus: 3,
        reinforce: 1,
        review: 1,
        challenge: 1,
      })
    })

    it('has shuffle enabled by default', () => {
      expect(DEFAULT_SESSION_PREFERENCES.shufflePurposes).toBe(true)
    })

    it('has game breaks enabled with 5m duration', () => {
      expect(DEFAULT_SESSION_PREFERENCES.gameBreakEnabled).toBe(true)
      expect(DEFAULT_SESSION_PREFERENCES.gameBreakMinutes).toBe(5)
    })

    it('has kid-chooses selection mode and no pre-selected game', () => {
      expect(DEFAULT_SESSION_PREFERENCES.gameBreakSelectionMode).toBe('kid-chooses')
      expect(DEFAULT_SESSION_PREFERENCES.gameBreakSelectedGame).toBeNull()
    })

    it('has medium difficulty preset', () => {
      expect(DEFAULT_SESSION_PREFERENCES.gameBreakDifficultyPreset).toBe('medium')
    })

    it('satisfies the PlayerSessionPreferencesConfig interface', () => {
      // TypeScript compile-time check — if this assignment compiles, the shape is correct
      const config: PlayerSessionPreferencesConfig = DEFAULT_SESSION_PREFERENCES
      expect(config).toBeDefined()
    })

    it('contains exactly the 11 expected keys', () => {
      const keys = Object.keys(DEFAULT_SESSION_PREFERENCES).sort()
      expect(keys).toEqual([
        'durationMinutes',
        'gameBreakDifficultyPreset',
        'gameBreakEnabled',
        'gameBreakEnabledGames',
        'gameBreakMinutes',
        'gameBreakSelectedGame',
        'gameBreakSelectionMode',
        'partWeights',
        'problemLengthPreference',
        'purposeWeights',
        'shufflePurposes',
      ])
    })

    it('is JSON-serializable and round-trips correctly', () => {
      const json = JSON.stringify(DEFAULT_SESSION_PREFERENCES)
      const parsed = JSON.parse(json) as PlayerSessionPreferencesConfig
      expect(parsed).toEqual(DEFAULT_SESSION_PREFERENCES)
    })
  })
})

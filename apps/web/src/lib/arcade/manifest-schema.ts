/**
 * Game manifest schema validation
 * Validates game.yaml files using Zod
 */

import { z } from 'zod'

/**
 * Schema for practice break configuration.
 * Defines how a game should behave during practice session game breaks.
 */
export const PracticeBreakConfigSchema = z
  .object({
    /**
     * Suggested default configuration for practice breaks.
     * These settings are optimized for quick 2-10 minute games.
     */
    suggestedConfig: z.record(z.string(), z.unknown()).optional(),

    /**
     * Config fields that should be locked during practice breaks.
     * Prevents kids from making games too long or complex.
     */
    lockedFields: z.array(z.string()).optional(),

    /**
     * Minimum duration in minutes this game reasonably supports.
     * Games shorter than the break duration work best.
     */
    minDurationMinutes: z.number().min(1).optional(),

    /**
     * Maximum duration in minutes this game can reasonably take.
     * Helps the system choose appropriate games for break length.
     */
    maxDurationMinutes: z.number().min(1).optional(),

    /**
     * Difficulty presets for quick teacher selection.
     * Keys: 'easy', 'medium', 'hard' with partial config values.
     */
    difficultyPresets: z
      .object({
        easy: z.record(z.string(), z.unknown()).optional(),
        medium: z.record(z.string(), z.unknown()).optional(),
        hard: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
  })
  .describe('Configuration for practice break behavior')

/**
 * Schema for game manifest (game.yaml)
 */
export const GameManifestSchema = z.object({
  name: z.string().min(1).describe('Internal game identifier (e.g., "matching")'),
  displayName: z.string().min(1).describe('Display name shown to users'),
  shortName: z
    .string()
    .optional()
    .describe('Short name for compact UI spaces (defaults to displayName)'),
  icon: z.string().min(1).describe('Emoji icon for the game'),
  description: z.string().min(1).describe('Short description'),
  longDescription: z.string().min(1).describe('Detailed description'),
  maxPlayers: z.number().int().min(1).max(10).describe('Maximum number of players'),
  difficulty: z
    .enum(['Beginner', 'Intermediate', 'Advanced', 'Expert'])
    .describe('Difficulty level'),
  chips: z.array(z.string()).describe('Feature chips displayed on game card'),
  color: z.string().min(1).describe('Color theme (e.g., "purple")'),
  gradient: z.string().min(1).describe('CSS gradient for card background'),
  borderColor: z.string().min(1).describe('Border color (e.g., "purple.200")'),
  available: z.boolean().describe('Whether game is available to play'),
  practiceBreakReady: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Whether game is ready for practice session game breaks. ' +
        'Games must be single-player capable, work in 2-10 minute sessions, ' +
        'and not require complex setup or multiplayer coordination.'
    ),
  practiceBreakConfig: PracticeBreakConfigSchema.optional().describe(
    'Configuration for practice break behavior including suggested defaults, ' +
      'locked fields, duration constraints, and difficulty presets.'
  ),
})

/**
 * Inferred TypeScript types from schemas
 */
export type PracticeBreakConfig = z.infer<typeof PracticeBreakConfigSchema>
export type GameManifest = z.infer<typeof GameManifestSchema>

/**
 * Validate a parsed manifest object
 */
export function validateManifest(data: unknown): GameManifest {
  return GameManifestSchema.parse(data)
}

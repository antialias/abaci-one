/**
 * Game manifest schema validation
 * Validates game.yaml files using Zod
 */

import { z } from 'zod'

/**
 * Schema for game manifest (game.yaml)
 */
export const GameManifestSchema = z.object({
  name: z.string().min(1).describe('Internal game identifier (e.g., "matching")'),
  displayName: z.string().min(1).describe('Display name shown to users'),
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
})

/**
 * Inferred TypeScript type from schema
 */
export type GameManifest = z.infer<typeof GameManifestSchema>

/**
 * Validate a parsed manifest object
 */
export function validateManifest(data: unknown): GameManifest {
  return GameManifestSchema.parse(data)
}

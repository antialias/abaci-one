/**
 * Server-safe validator for music matching game.
 *
 * Imports from variant-server.ts (no React/.tsx imports) to avoid
 * module resolution failures on the server (server.js / socket-server).
 */

import { createMatchingPairsValidator } from '@/lib/arcade/matching-pairs-framework/create-validator'
import type { MatchingPairsVariant } from '@/lib/arcade/matching-pairs-framework'
import type { MusicCard, MusicConfig } from './types'
import { musicVariantServer } from './variant-server'

// The validator only uses data/logic fields, not React components.
// Cast to full MatchingPairsVariant since createMatchingPairsValidator
// expects it, but never accesses the React-only fields.
export const musicMatchingValidator = createMatchingPairsValidator(
  musicVariantServer as MatchingPairsVariant<MusicCard, MusicConfig>
)

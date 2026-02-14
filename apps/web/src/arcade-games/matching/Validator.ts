/**
 * Server-safe validator for matching game.
 *
 * Imports from variant-server.ts (no React/.tsx imports) to avoid
 * module resolution failures on the server (server.js / socket-server).
 */

import { createMatchingPairsValidator } from '@/lib/arcade/matching-pairs-framework/create-validator'
import type { MatchingPairsVariant } from '@/lib/arcade/matching-pairs-framework'
import type { AbacusCard, AbacusConfig } from './types'
import { abacusVariantServer } from './variant-server'

// The validator only uses data/logic fields, not React components.
// Cast to full MatchingPairsVariant since createMatchingPairsValidator
// expects it, but never accesses the React-only fields.
export const matchingGameValidator = createMatchingPairsValidator(
  abacusVariantServer as MatchingPairsVariant<AbacusCard, AbacusConfig>
)

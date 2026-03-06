import type { GameValidator, ValidationResult } from '@/lib/arcade/validation/types'
import type { ConstantExplorerState, ConstantExplorerMove } from './types'

/**
 * Stub validator for constant-explorer.
 *
 * Constant explorations are passive (no game moves or state transitions).
 * The validator exists only to satisfy the game registry interface.
 */
class ConstantExplorerValidator
  implements GameValidator<ConstantExplorerState, ConstantExplorerMove>
{
  validateMove(): ValidationResult {
    return { valid: false, error: 'Constant explorer has no moves' }
  }

  isGameComplete(): boolean {
    // Completion is driven by the break timer, not game state
    return false
  }

  getInitialState(config: unknown): ConstantExplorerState {
    const c = config as { constantId?: string } | undefined
    return {
      constantId: c?.constantId ?? null,
      phase: 'idle',
    }
  }
}

export const constantExplorerValidator = new ConstantExplorerValidator()

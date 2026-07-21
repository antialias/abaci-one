import type { AbacusIdentity } from '@/lib/abacus/identity'
import type { DisplayConfigInput } from './abacus-model'

/**
 * The identity source the studio's `synced` follow-effect mirrors.
 *
 * Player selected → the player's saved "my abacus" row, or null while it's
 * still in flight (the follow-effect holds — it never seeds a fake). No
 * player → the viewer's own live display config, exactly the pre-player
 * behavior.
 */
export function selectSourceIdentity(
  playerId: string | null,
  playerRow: AbacusIdentity | null | undefined,
  displayConfig: DisplayConfigInput
): DisplayConfigInput | null {
  if (playerId) {
    return playerRow
      ? {
          colorScheme: playerRow.colorScheme,
          colorPalette: playerRow.colorPalette,
          physicalAbacusColumns: playerRow.columns,
        }
      : null
  }
  return {
    colorScheme: displayConfig.colorScheme,
    colorPalette: displayConfig.colorPalette,
    physicalAbacusColumns: displayConfig.physicalAbacusColumns,
  }
}

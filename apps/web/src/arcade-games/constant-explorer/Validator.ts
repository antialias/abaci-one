import {
  CONSTANT_IDS,
  EXPLORATION_DISPLAY,
} from '@/components/toys/number-line/talkToNumber/explorationRegistry'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import type { GameValidator, ValidationResult } from '@/lib/arcade/validation/types'
import type { ConstantExplorerMove, ConstantExplorerState } from './types'

/**
 * Validator for constant-explorer.
 *
 * Constant explorations are passive (no game moves). The validator exists
 * to satisfy the game registry interface and to build results reports
 * for scoreboard persistence (needed for "balance" selection mode).
 */
class ConstantExplorerValidator
  implements GameValidator<ConstantExplorerState, ConstantExplorerMove>
{
  validateMove(): ValidationResult {
    return { valid: false, error: 'Constant explorer has no moves' }
  }

  isGameComplete(state: ConstantExplorerState): boolean {
    return state.phase === 'complete'
  }

  getInitialState(config: unknown): ConstantExplorerState {
    const c = config as { constantId?: string } | undefined
    return {
      constantId: c?.constantId ?? null,
      phase: 'idle',
    }
  }

  getResultsReport(state: ConstantExplorerState, _config: unknown): GameResultsReport {
    const constantId = state.constantId ?? 'unknown'
    const display = CONSTANT_IDS.has(constantId) ? EXPLORATION_DISPLAY[constantId] : null
    const symbol = display?.symbol ?? constantId
    const name = display?.name ?? constantId
    const value = display?.value

    const now = Date.now()
    const durationMs = state.startedAt ? now - state.startedAt : 0

    return {
      gameName: 'constant-explorer',
      gameDisplayName: 'Math Discovery',
      gameIcon: '\uD83D\uDD2D',

      durationMs,
      completedNormally: true,
      startedAt: state.startedAt ?? now,
      endedAt: now,

      gameMode: 'single-player',
      playerCount: 1,
      playerResults: [
        {
          playerId: state.playerId ?? 'unknown',
          playerName: state.playerName ?? 'Explorer',
          playerEmoji: '\uD83D\uDD2D',
          userId: state.playerId ?? 'unknown',
          score: 1, // Binary: explored or not
          rank: 1,
        },
      ],

      itemsCompleted: 1,
      itemsTotal: 1,
      completionPercent: 100,

      leaderboardEntry: {
        normalizedScore: 100,
        category: 'discovery',
        // Encode constantId in difficulty so we can query per-constant play counts
        difficulty: constantId,
      },

      customStats: [
        {
          label: 'Constant',
          value: `${symbol} ${name}`,
          icon: '\uD83D\uDD2D',
          highlight: true,
        },
        ...(value !== undefined
          ? [
              {
                label: 'Value',
                value: `${value.toFixed(6)}...`,
                icon: '\uD83D\uDCCA',
              },
            ]
          : []),
      ],

      headline: `Explored ${symbol}!`,
      subheadline: name,
      resultTheme: 'success',
      celebrationType: 'stars',
      songContext: {
        summary: `Explored the constant ${symbol} (${name})`,
        details: [
          `Constant: ${symbol} ${name}`,
          ...(value !== undefined ? [`Approximate value: ${value.toFixed(6)}`] : []),
        ],
        dramaticMoments: [`Took a math discovery detour into ${name}`],
        strategyNotes: ['Discovery break focused on noticing a famous number pattern'],
        outcome: `Explored ${symbol}`,
      },
    }
  }
}

export const constantExplorerValidator = new ConstantExplorerValidator()

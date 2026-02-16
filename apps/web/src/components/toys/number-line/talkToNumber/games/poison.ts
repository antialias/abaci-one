/**
 * "Poison" game definition — reverse Nim variant.
 *
 * Same as Nim, but whoever takes the LAST stone LOSES. A small rule
 * change that completely flips the strategy. Remaining stones are shown
 * as persistent indicators on the number line.
 */

import type { GameDefinition, GameStartResult, GameActionResult, GameToolCallResult } from '../gameRegistry'

const DEFAULT_STONES = 15
const DEFAULT_MAX_TAKE = 3

interface PoisonState {
  remaining: number
  maxTake: number
}

export const poisonGame: GameDefinition = {
  id: 'poison',
  category: 'strategy',
  name: 'Poison',
  description:
    'Reverse Nim — take turns removing 1–3 stones, but whoever takes the LAST stone loses!',

  agentRules: '',
  needsProximityUpdates: false,

  // ── Session mode ──────────────────────────────────────────────────────

  sessionTools: [
    {
      type: 'function' as const,
      name: 'remove_stones',
      description:
        'Remove stones from the pool during a Poison game. Call this after EVERY move — yours or the child\'s. ' +
        'Stones are always removed from the top (highest remaining numbers). The display updates automatically.',
      parameters: {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: 'Number of stones to remove (1 to max_take, or remaining count if fewer are left)',
          },
        },
        required: ['count'],
      },
    },
  ],

  sessionInstructions:
    'You are playing POISON with a child on the phone.\n\n' +
    'RULES:\n' +
    '- There is a pool of stones shown as highlighted numbers on the number line (positions 1 through N).\n' +
    '- Players take turns. The child goes FIRST.\n' +
    '- On each turn, remove 1 to max_take stones from the pool.\n' +
    '- Stones are always removed from the top (highest remaining numbers).\n' +
    '- Whoever takes the LAST stone LOSES! (This is the opposite of regular Nim.)\n\n' +
    'MOVES:\n' +
    '- YOUR TURN: First ANNOUNCE your move ("I\'ll take 2 stones"), then call remove_stones.\n' +
    '  The child needs to hear what you\'re doing BEFORE the display changes.\n' +
    '- CHILD\'S TURN: After the child says how many they want, call remove_stones immediately.\n' +
    '- This automatically updates the visual display. Do NOT call indicate or look_at.\n' +
    '- Tell the child how many stones remain after every move.\n\n' +
    'STRATEGY:\n' +
    '- The winning strategy is to leave your opponent with exactly 1 stone (they\'re forced to take the poison one).\n' +
    '- Work backwards from 1: safe positions to leave your opponent at are 1, (max_take + 2), 2*(max_take + 1) + 1, ...\n' +
    '- Formula: if (remaining - 1) % (max_take + 1) == 0, opponent is stuck.\n' +
    '- If you\'re in a losing position, take 1 and hope they make a mistake.\n\n' +
    'ENDGAME:\n' +
    '- If it\'s the child\'s turn and only 1 stone remains, they lose — break it gently and with humor: ' +
    '"Uh oh, the last stone is the poison one!" Call remove_stones(1) then end_game.\n' +
    '- When someone takes the last stone, they LOSE.\n' +
    '- Call end_game when the game is over.\n' +
    '- After the game, explain how Poison differs from regular Nim.\n\n' +
    'STYLE:\n' +
    '- Keep responses SHORT — one or two sentences max after each move.\n' +
    '- After calling remove_stones, just say how many are left and pass the turn. Do NOT ramble.\n' +
    '- Build suspense as stones get low: "Ooh, only 3 left... careful!"\n' +
    '- Celebrate good moves briefly. Be a gracious winner or loser.',

  onToolCall(rawState: unknown, toolName: string, args: Record<string, unknown>): GameToolCallResult {
    if (toolName !== 'remove_stones') {
      return { agentMessage: `Unknown tool: ${toolName}`, state: rawState }
    }
    return poisonGame.onAction!(rawState, { remove: args.count })
  },

  onStart(params: Record<string, unknown>): GameStartResult {
    let stones = DEFAULT_STONES
    if (params.stones !== undefined) {
      stones = Number(params.stones)
      if (!isFinite(stones) || stones < 3 || !Number.isInteger(stones)) {
        throw new Error('stones must be a positive integer >= 3')
      }
    }

    let maxTake = DEFAULT_MAX_TAKE
    if (params.max_take !== undefined) {
      maxTake = Number(params.max_take)
      if (!isFinite(maxTake) || maxTake < 1 || !Number.isInteger(maxTake)) {
        throw new Error('max_take must be a positive integer')
      }
    }

    if (maxTake >= stones) {
      throw new Error('max_take must be less than stones')
    }

    const state: PoisonState = { remaining: stones, maxTake }
    const allPositions = Array.from({ length: stones }, (_, i) => i + 1)

    // In Poison, first player wins if (stones - 1) % (maxTake + 1) != 0
    const firstPlayerWins = (stones - 1) % (maxTake + 1) !== 0

    return {
      agentMessage:
        `Poison game started! ${stones} stones (positions 1–${stones}), take 1–${maxTake} per turn. ` +
        `But watch out — whoever takes the LAST stone LOSES! ` +
        `The child goes first. ` +
        `Strategy hint: ${firstPlayerWins ? 'child has the advantage — play carefully' : `you can win — leave them stuck with the last stone`}.`,
      state,
      indicate: { numbers: allPositions, persistent: true },
    }
  },

  onAction(rawState: unknown, action: Record<string, unknown>): GameActionResult {
    const s = rawState as PoisonState
    const remove = Number(action.remove)

    if (!isFinite(remove) || !Number.isInteger(remove) || remove < 1) {
      return {
        agentMessage: 'Invalid move: remove must be a positive integer.',
        state: s,
        indicate: { numbers: Array.from({ length: s.remaining }, (_, i) => i + 1), persistent: true },
      }
    }
    if (remove > s.maxTake) {
      return {
        agentMessage: `Invalid move: you can take at most ${s.maxTake} stones per turn.`,
        state: s,
        indicate: { numbers: Array.from({ length: s.remaining }, (_, i) => i + 1), persistent: true },
      }
    }
    if (remove > s.remaining) {
      return {
        agentMessage: `Invalid move: only ${s.remaining} stones remain.`,
        state: s,
        indicate: { numbers: Array.from({ length: s.remaining }, (_, i) => i + 1), persistent: true },
      }
    }

    const newRemaining = s.remaining - remove
    const newState: PoisonState = { ...s, remaining: newRemaining }
    const positions = Array.from({ length: newRemaining }, (_, i) => i + 1)

    if (newRemaining === 0) {
      return {
        agentMessage: `${remove} stone${remove > 1 ? 's' : ''} removed. That was the last stone — the player who just moved LOSES! Call end_game.`,
        state: newState,
        indicate: { numbers: [], persistent: true },
      }
    }

    return {
      agentMessage: `${remove} stone${remove > 1 ? 's' : ''} removed. ${newRemaining} stone${newRemaining > 1 ? 's' : ''} remaining (positions 1–${newRemaining}).`,
      state: newState,
      indicate: { numbers: positions, persistent: true },
    }
  },
}

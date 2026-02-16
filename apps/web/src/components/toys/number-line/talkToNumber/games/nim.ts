/**
 * "Nim" game definition — subtraction game variant.
 *
 * A single pool of N stones (positions 1–N on the number line).
 * Players take turns removing 1 to max_take stones. Whoever takes
 * the last stone wins. The remaining stones are shown as persistent
 * indicators on the number line, updated automatically via remove_stones.
 */

import type { GameDefinition, GameStartResult, GameActionResult, GameToolCallResult } from '../gameRegistry'

const DEFAULT_STONES = 15
const DEFAULT_MAX_TAKE = 3

interface NimState {
  remaining: number
  maxTake: number
}

export const nimGame: GameDefinition = {
  id: 'nim',
  category: 'strategy',
  name: 'Nim',
  description:
    'Classic Nim — take turns removing 1–3 stones from a single pool. ' +
    'Take the last stone to win!',

  agentRules:
    'NIM GAME RULES: ' +
    '1) SETUP: There is a single pool of stones shown as highlighted numbers on the number line (positions 1 through N). ' +
    '2) TURNS: You and the child take turns. The child goes first. ' +
    'On each turn, the player removes 1 to max_take stones from the pool. ' +
    'Stones are always removed from the top (highest remaining numbers). ' +
    '3) WINNING: Whoever takes the LAST stone WINS. ' +
    '4) MOVES: After EVERY move (yours or the child\'s), call remove_stones with count: <number of stones taken>. ' +
    'This automatically updates the visual display. Do NOT call indicate manually during this game. ' +
    'Do NOT call look_at during this game (viewport is locked). ' +
    '5) COMMUNICATION: Tell the child how many stones remain after every move. ' +
    'Be conversational and encouraging. "There are 9 stones left — your turn! How many do you want to take?" ' +
    '6) CHILD\'S TURN: Ask the child how many stones they want to take (1 to max_take). ' +
    'Validate their move — they must take at least 1 and at most max_take (or the remaining count if fewer are left). ' +
    'If they make an invalid move, gently explain and let them try again. ' +
    '7) YOUR STRATEGY: The winning strategy is to leave your opponent with a multiple of (max_take + 1) stones. ' +
    'If remaining % (max_take + 1) != 0, you can win: take (remaining % (max_take + 1)) stones. ' +
    'If remaining % (max_take + 1) == 0, you are in a losing position — take 1 and hope the child makes a mistake. ' +
    '8) ENDGAME: When all stones are gone, the player who took the last stone wins. ' +
    'Call end_game when the game is over. ' +
    '9) EDUCATIONAL: After the game, explain the strategy at an age-appropriate level: ' +
    '"The secret is to always leave your opponent with a number that divides evenly by (max_take + 1). ' +
    'So if you can take up to 3, try to leave them with 4, 8, 12..." ' +
    'Keep it fun and light. ' +
    '10) Let the child go first. Be encouraging and celebrate their good moves.',

  needsProximityUpdates: false,

  // ── Session mode ──────────────────────────────────────────────────────

  sessionTools: [
    {
      type: 'function' as const,
      name: 'remove_stones',
      description:
        'Remove stones from the pool during a Nim game. Call this after EVERY move — yours or the child\'s. ' +
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
    'You are playing NIM with a child on the phone.\n\n' +
    'RULES:\n' +
    '- There is a pool of stones shown as highlighted numbers on the number line (positions 1 through N).\n' +
    '- Players take turns. The child goes FIRST.\n' +
    '- On each turn, remove 1 to max_take stones from the pool.\n' +
    '- Stones are always removed from the top (highest remaining numbers).\n' +
    '- Whoever takes the LAST stone WINS.\n\n' +
    'MOVES:\n' +
    '- YOUR TURN: First ANNOUNCE your move out loud ("I\'ll take 2 stones"), then call remove_stones.\n' +
    '  The child needs to hear what you\'re doing BEFORE the display changes.\n' +
    '- CHILD\'S TURN: After the child says how many they want, call remove_stones immediately.\n' +
    '- This automatically updates the visual display. Do NOT call indicate or look_at.\n' +
    '- Tell the child how many stones remain after every move.\n\n' +
    'STRATEGY:\n' +
    '- The winning strategy is to leave your opponent with a multiple of (max_take + 1) stones.\n' +
    '- If remaining % (max_take + 1) != 0, you can win: take (remaining % (max_take + 1)) stones.\n' +
    '- If remaining % (max_take + 1) == 0, you\'re in a losing position — take 1 and hope they make a mistake.\n\n' +
    'CHILD\'S TURN:\n' +
    '- Ask how many stones they want to take. Validate: at least 1, at most max_take (or remaining if fewer).\n' +
    '- If invalid, gently explain and let them try again.\n\n' +
    'ENDGAME:\n' +
    '- When all stones are gone, the player who took the last stone wins.\n' +
    '- If it\'s the child\'s turn and only 1 stone remains, they win automatically — congratulate them and call remove_stones(1) then end_game. Do NOT make them say "I take 1 stone".\n' +
    '- Call end_game when the game is over.\n' +
    '- After the game, explain the strategy at an age-appropriate level.\n\n' +
    'STYLE:\n' +
    '- Keep responses SHORT — one or two sentences max after each move.\n' +
    '- After calling remove_stones, just say how many are left and pass the turn. Do NOT ramble.\n' +
    '- "9 stones left — your turn! How many do you want to take?"\n' +
    '- Celebrate good moves briefly. Be a gracious winner or loser.',

  onToolCall(rawState: unknown, toolName: string, args: Record<string, unknown>): GameToolCallResult {
    if (toolName !== 'remove_stones') {
      return { agentMessage: `Unknown tool: ${toolName}`, state: rawState }
    }
    // Delegate to existing onAction logic
    const result = nimGame.onAction!(rawState, { remove: args.count })
    return result
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

    const losing = stones % (maxTake + 1) === 0
    const state: NimState = { remaining: stones, maxTake }
    const allPositions = Array.from({ length: stones }, (_, i) => i + 1)

    return {
      agentMessage:
        `Nim game started! ${stones} stones (positions 1–${stones}), take 1–${maxTake} per turn. ` +
        `The number line is showing all ${stones} stones. ` +
        `Introduce the game: there are ${stones} stones, you take turns removing 1 to ${maxTake}, whoever takes the last stone wins. ` +
        `After each move, call remove_stones with count: <number>. The display updates automatically. ` +
        `The child goes first. ` +
        `Strategy hint: ${losing ? `child has the advantage (${stones} is a multiple of ${maxTake + 1}) — play carefully` : `you have a winning strategy — leave multiples of ${maxTake + 1}`}.`,
      state,
      indicate: { numbers: allPositions, persistent: true },
    }
  },

  onAction(rawState: unknown, action: Record<string, unknown>): GameActionResult {
    const s = rawState as NimState
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
    const newState: NimState = { ...s, remaining: newRemaining }
    const positions = Array.from({ length: newRemaining }, (_, i) => i + 1)

    if (newRemaining === 0) {
      return {
        agentMessage: `${remove} stone${remove > 1 ? 's' : ''} removed. No stones remain — the player who just moved wins! Call end_game.`,
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

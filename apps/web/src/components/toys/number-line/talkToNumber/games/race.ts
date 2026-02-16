/**
 * "Race to N" game definition — addition race on the number line.
 *
 * Start at 0. Players take turns adding 1 to max_add. First to reach
 * the target number wins. The current position is shown as a persistent
 * indicator on the number line.
 */

import type { GameDefinition, GameStartResult, GameActionResult, GameToolCallResult } from '../gameRegistry'

const DEFAULT_TARGET = 21
const DEFAULT_MAX_ADD = 3

interface RaceState {
  position: number
  target: number
  maxAdd: number
}

export const raceGame: GameDefinition = {
  id: 'race',
  category: 'strategy',
  name: 'Race to 21',
  description:
    'Race to reach the target! Take turns adding 1–3. First to hit the target wins.',

  agentRules: '',
  needsProximityUpdates: false,

  // ── Session mode ──────────────────────────────────────────────────────

  sessionTools: [
    {
      type: 'function' as const,
      name: 'add_number',
      description:
        'Add a number to the current position during a Race game. Call this after EVERY move — yours or the child\'s. ' +
        'The display updates automatically.',
      parameters: {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: 'Number to add (1 to max_add)',
          },
        },
        required: ['count'],
      },
    },
  ],

  sessionInstructions:
    'You are playing RACE TO N with a child on the phone.\n\n' +
    'RULES:\n' +
    '- Start at 0. Players take turns adding 1 to max_add to the current position.\n' +
    '- The current position is shown on the number line.\n' +
    '- First player to reach exactly the target number WINS.\n' +
    '- The child goes FIRST.\n\n' +
    'SETUP:\n' +
    '- After the game starts, call look_at to show the range 0 to target.\n' +
    '- Explain: "We start at 0. Each turn you add 1, 2, or 3. First to reach [target] wins!"\n\n' +
    'MOVES:\n' +
    '- YOUR TURN: First ANNOUNCE your move ("I\'ll add 2, taking us to 14"), then call add_number.\n' +
    '  The child needs to hear what you\'re doing BEFORE the display changes.\n' +
    '- CHILD\'S TURN: After the child says their number, call add_number immediately.\n' +
    '- The display updates automatically.\n\n' +
    'STRATEGY:\n' +
    '- The winning strategy: land on multiples of (max_add + 1) counting back from the target.\n' +
    '- E.g. target=21, max_add=3 → key positions are 4, 8, 12, 16, 20.\n' +
    '- If (target - position) % (max_add + 1) == 0, the OTHER player is winning.\n\n' +
    'ENDGAME:\n' +
    '- When someone reaches the target, they win.\n' +
    '- If it\'s the child\'s turn and they can reach the target in one move (position + max_add >= target), ' +
    'they win automatically — congratulate them, call add_number for the winning move, then end_game.\n' +
    '- Call end_game when the game is over.\n' +
    '- After the game, explain the strategy at an age-appropriate level.\n\n' +
    'STYLE:\n' +
    '- Keep responses SHORT — one or two sentences max.\n' +
    '- After calling add_number, just say the position and pass the turn. Do NOT ramble.\n' +
    '- Build excitement as you approach the target!\n' +
    '- "We\'re at 14 now — your turn! How much do you want to add?"',

  onToolCall(rawState: unknown, toolName: string, args: Record<string, unknown>): GameToolCallResult {
    if (toolName !== 'add_number') {
      return { agentMessage: `Unknown tool: ${toolName}`, state: rawState }
    }
    return raceGame.onAction!(rawState, { add: args.count })
  },

  onStart(params: Record<string, unknown>): GameStartResult {
    let target = DEFAULT_TARGET
    if (params.target !== undefined) {
      target = Number(params.target)
      if (!isFinite(target) || target < 5 || !Number.isInteger(target)) {
        throw new Error('target must be a positive integer >= 5')
      }
    }

    let maxAdd = DEFAULT_MAX_ADD
    if (params.max_add !== undefined) {
      maxAdd = Number(params.max_add)
      if (!isFinite(maxAdd) || maxAdd < 1 || !Number.isInteger(maxAdd)) {
        throw new Error('max_add must be a positive integer')
      }
    }

    if (maxAdd >= target) {
      throw new Error('max_add must be less than target')
    }

    const firstPlayerWins = target % (maxAdd + 1) !== 0
    const state: RaceState = { position: 0, target, maxAdd }

    return {
      agentMessage:
        `Race to ${target} started! Add 1–${maxAdd} each turn. First to reach ${target} wins. ` +
        `The child goes first. Call look_at centered around ${Math.round(target / 2)} with range ${target + 4} to show the full race. ` +
        `Strategy hint: ${firstPlayerWins ? `first player (child) can win by hitting multiples of ${maxAdd + 1}` : `you can win — aim for multiples of ${maxAdd + 1}`}.`,
      state,
      indicate: { numbers: [0], persistent: true },
    }
  },

  onAction(rawState: unknown, action: Record<string, unknown>): GameActionResult {
    const s = rawState as RaceState
    const add = Number(action.add)

    if (!isFinite(add) || !Number.isInteger(add) || add < 1) {
      return {
        agentMessage: 'Invalid move: must add a positive integer.',
        state: s,
        indicate: { numbers: [s.position], persistent: true },
      }
    }
    if (add > s.maxAdd) {
      return {
        agentMessage: `Invalid move: you can add at most ${s.maxAdd} per turn.`,
        state: s,
        indicate: { numbers: [s.position], persistent: true },
      }
    }

    const newPosition = s.position + add
    if (newPosition > s.target) {
      return {
        agentMessage: `Invalid move: adding ${add} would go past the target (${s.target}). Current position: ${s.position}.`,
        state: s,
        indicate: { numbers: [s.position], persistent: true },
      }
    }

    const newState: RaceState = { ...s, position: newPosition }

    if (newPosition === s.target) {
      return {
        agentMessage: `Added ${add}! Position is now ${newPosition} — that's the target! The player who just moved wins! Call end_game.`,
        state: newState,
        indicate: { numbers: [newPosition], persistent: true },
      }
    }

    const remaining = s.target - newPosition
    return {
      agentMessage: `Added ${add}. Position is now ${newPosition}. ${remaining} away from ${s.target}.`,
      state: newState,
      indicate: { numbers: [newPosition], persistent: true },
    }
  },
}

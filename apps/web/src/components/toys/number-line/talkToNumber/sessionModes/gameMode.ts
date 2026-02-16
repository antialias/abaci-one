/**
 * Game mode — a game is active on the number line.
 *
 * Games with sessionTools/sessionInstructions (e.g. Nim) get focused
 * tools + instructions. Legacy games get a minimal prompt with agentRules
 * and restricted tools.
 */

import type { AgentMode, RealtimeTool } from './types'
import { GAME_MAP } from '../gameRegistry'
import {
  TOOL_INDICATE,
  TOOL_LOOK_AT,
  TOOL_END_GAME,
  TOOL_HANG_UP,
  TOOL_REQUEST_MORE_TIME,
} from './tools'

export const gameMode: AgentMode = {
  id: 'game',

  getInstructions: (ctx) => {
    const game = ctx.activeGameId ? GAME_MAP.get(ctx.activeGameId) : null
    if (!game) {
      // Fallback — shouldn't happen, but be safe
      const displayN = Number.isInteger(ctx.calledNumber)
        ? ctx.calledNumber.toString()
        : ctx.calledNumber.toPrecision(6)
      return `You are the number ${displayN}, on a phone call with a child. A game was active but couldn't be found. Call end_game to return to conversation.`
    }

    // Session-mode game: use its dedicated instructions
    if (game.sessionInstructions) {
      // For trick games, prepend a universal anti-spoiler rule
      if (game.category === 'trick') {
        return (
          '🎩 UNIVERSAL TRICK RULE: The magic depends on secrecy. ' +
          'NEVER ask "what did you get?", "what\'s your answer?", or "what number did you write down?" ' +
          'unless the game instructions specifically say to. ' +
          'Ask "are you ready?" or "tell me when you\'re done" to pace steps. ' +
          'The child keeps their work secret — that\'s what makes the reveal magical.\n\n' +
          game.sessionInstructions
        )
      }
      return game.sessionInstructions
    }

    // Legacy game: abbreviated identity + game rules
    const displayN = Number.isInteger(ctx.calledNumber)
      ? ctx.calledNumber.toString()
      : ctx.calledNumber.toPrecision(6)

    return `You are the number ${displayN}, on a phone call with a child.\n\nACTIVE GAME: ${game.name}\n${game.agentRules}\n\nKeep responses short. Be encouraging.`
  },

  getTools: (ctx) => {
    const game = ctx.activeGameId ? GAME_MAP.get(ctx.activeGameId) : null

    // Session-mode game: use its dedicated tools + shared tools.
    // look_at and indicate are NOT in sessionTools (so the game's onToolCall
    // won't intercept them) — they fall through to the built-in handlers.
    if (game?.sessionTools) {
      return [...(game.sessionTools as RealtimeTool[]), TOOL_LOOK_AT, TOOL_INDICATE, TOOL_END_GAME, TOOL_HANG_UP]
    }

    // Legacy game: restricted tool set
    return [TOOL_INDICATE, TOOL_LOOK_AT, TOOL_END_GAME, TOOL_HANG_UP, TOOL_REQUEST_MORE_TIME]
  },
}

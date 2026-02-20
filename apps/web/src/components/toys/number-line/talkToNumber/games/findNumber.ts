/**
 * "Find the Number" game definition.
 *
 * The voice agent picks a target number and the child navigates the
 * number line to find it.  The agent gives verbal clues based on
 * proximity zone updates sent by the visual layer.
 */

import type { GameDefinition, GameStartResult } from '../gameRegistry'

export const findNumberGame: GameDefinition = {
  id: 'find_number',
  category: 'guessing',
  name: 'Find the Number',
  description:
    'Challenge the child to find a mystery number on the number line. ' +
    'Great for building number sense — "I\'m thinking of a number between 20 and 30, and it\'s prime..."',

  agentRules:
    'RULES: ' +
    '1) Say "higher numbers" or "lower numbers" for direction — NEVER say "left" or "right" (children confuse screen directions). ' +
    '2) Instead of saying "zoom in", hint at the number\'s precision — e.g. "it has a decimal" or "think about what\'s between 3 and 4." ' +
    '3) Give neighborhood hints: "it\'s between 20 and 30", "near a multiple of 5", "close to a number you already know." ' +
    "You will receive proximity updates with the child's visible range and distance.",

  needsProximityUpdates: true,

  onStart(params: Record<string, unknown>): GameStartResult {
    const target = Number(params.target)
    if (!isFinite(target)) {
      throw new Error('Invalid target number')
    }
    return {
      agentMessage:
        `Find-the-number game started! Target: ${target}. ` +
        'The child CANNOT see the target — they only see "Find the mystery number!" ' +
        "Give them verbal clues about the number's neighborhood and properties. " +
        'RULES: ' +
        '1) Say "higher numbers" or "lower numbers" for direction — NEVER say "left" or "right" (children confuse screen directions). ' +
        '2) Instead of saying "zoom in", hint at the number\'s precision — e.g. "it has a decimal" or "think about what\'s between 3 and 4." ' +
        '3) Give neighborhood hints: "it\'s between 20 and 30", "near a multiple of 5", "close to a number you already know." ' +
        "You will receive proximity updates with the child's visible range and distance.",
    }
  },
}

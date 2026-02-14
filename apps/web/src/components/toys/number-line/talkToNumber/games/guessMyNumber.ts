/**
 * "Guess My Number" game definition.
 *
 * The child thinks of a number in a range. The voice agent performs a
 * binary search by asking greater-than / less-than questions, using
 * look_at and indicate to show the narrowing range on the number line.
 * When the agent guesses correctly, it calls add_to_call to bring
 * the guessed number onto the conference call.
 */

import type { GameDefinition, GameStartResult } from '../gameRegistry'

const DEFAULT_MIN = 1
const DEFAULT_MAX = 100

export const guessMyNumberGame: GameDefinition = {
  id: 'guess_my_number',
  name: 'Guess My Number',
  description:
    'The child thinks of a number and you narrow it down with ' +
    'higher/lower questions (binary search). When you guess it, that number joins the call!',

  agentRules:
    'BINARY SEARCH GAME RULES: ' +
    '1) Ask the child to think of a number in the given range. Wait for them to confirm they have one. ' +
    '2) Use binary search: pick the midpoint of the remaining range and ask "is your number bigger than X?" or "is it less than X?" ' +
    '3) CRITICAL — after EVERY answer, call indicate with a range ({ from, to }) showing the remaining candidate range and duration_seconds: 30. The number line is already zoomed to show the full range — do NOT call look_at during this game. The child watches the highlighted band shrink within a fixed view — that\'s the whole visual payoff of binary search. ' +
    '4) Be conversational, not robotic. React to each answer — "Ooh, so it\'s somewhere up here..." Mix up your phrasing. ' +
    '5) When the range is narrow enough, make your guess: "Is it... 42?" ' +
    '6) If they say YES: celebrate, call end_game, then IMMEDIATELY call add_to_call with that number so the child can talk to it. ' +
    '7) If the child changes their answer or seems confused, be gracious — "No worries, let me start over!" ' +
    '8) Count your guesses out loud — "That\'s only my third guess!" Kids love seeing how few guesses it takes. ' +
    '9) After the game, point out the math: "See? With higher/lower, I only needed X guesses for numbers up to Y. That\'s the power of cutting in half each time!"',

  needsProximityUpdates: false,

  onStart(params: Record<string, unknown>): GameStartResult {
    const min = params.min !== undefined ? Number(params.min) : DEFAULT_MIN
    const max = params.max !== undefined ? Number(params.max) : DEFAULT_MAX
    if (!isFinite(min) || !isFinite(max)) {
      throw new Error('min and max must be finite numbers')
    }
    if (min >= max) {
      throw new Error('min must be less than max')
    }
    const guessesNeeded = Math.ceil(Math.log2(max - min + 1))
    return {
      agentMessage:
        `Guess My Number game started! Range: ${min} to ${max}. ` +
        `The number line is now zoomed to show the full range — do NOT call look_at. ` +
        `Ask the child to think of a whole number in this range. ` +
        `Use binary search (pick the midpoint, ask higher/lower). ` +
        `You should need at most ${guessesNeeded} guesses — brag about this! ` +
        `IMPORTANT: After EVERY answer, call indicate with range { from, to } ` +
        `and duration_seconds: 30 to highlight the remaining candidate band. ` +
        `The child watches it shrink within a fixed view — that's the visual payoff. ` +
        `When you guess correctly, celebrate, call end_game, then call add_to_call ` +
        `with that number so the child gets to talk to it!`,
    }
  },
}

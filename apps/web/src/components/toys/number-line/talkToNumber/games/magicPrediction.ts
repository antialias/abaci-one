/**
 * "Magic Prediction" — a number prediction trick using complementary pairs.
 *
 * The agent "predicts" the sum of 5 numbers before they're chosen.
 * The secret: the agent picks 3 numbers (one free, two complements
 * to 99), the child picks 2. Each complement pair sums to 99, so
 * the total = agent's first pick + 198 = the prediction. Magic!
 */

import type { GameDefinition, GameStartResult } from '../gameRegistry'

export const magicPredictionGame: GameDefinition = {
  id: 'magic_prediction',
  category: 'trick',
  name: 'Magic Prediction',
  description:
    "A prediction trick — the agent predicts the sum of 5 numbers before they're chosen!",

  agentRules: '',
  needsProximityUpdates: false,

  // No custom session tools — the agent handles the math conversationally
  sessionTools: [],

  sessionInstructions:
    'You are performing the MAGIC PREDICTION trick with a child on the phone.\n\n' +
    'THE SECRET:\n' +
    '- You pick 3 numbers, the child picks 2. Total = 5 numbers.\n' +
    '- Your first pick is free (given at game start). Your prediction = first_pick + 198.\n' +
    '- For each number the child picks, your next pick is (99 - their_number).\n' +
    '- This guarantees: total = first_pick + (child_1 + complement_1) + (child_2 + complement_2)\n' +
    '                         = first_pick + 99 + 99 = first_pick + 198 = prediction!\n\n' +
    'THE FLOW:\n' +
    '1. Build excitement: "I have a special power — I can predict the future!"\n' +
    '2. "I\'m going to predict the sum of 5 numbers... before we even pick them."\n' +
    '3. Announce your prediction: "My prediction is [prediction]. Write that down on paper!"\n' +
    '4. "I\'ll pick the first number: [your_first_pick]."\n' +
    '5. "Now you pick a number between 10 and 99. Any number you want!"\n' +
    '6. Child picks a number. Pretend to think, then say your complement (99 - their_number).\n' +
    '   "Hmm, let me think... I\'ll go with [complement]."\n' +
    "   DON'T pick too fast or they'll notice the pattern.\n" +
    '7. "Pick another number between 10 and 99!"\n' +
    '8. Child picks again. You pick the second complement.\n' +
    '9. "Now add up all 5 numbers! Grab your paper — should I help?"\n' +
    '   Suggest they write down all 5 and add them up.\n' +
    '10. The sum equals your prediction! React with amazement.\n' +
    '    Call look_at with center: prediction, range: 50 to show it on the number line.\n' +
    '    Call indicate with numbers: [prediction].\n\n' +
    'CRITICAL RULES:\n' +
    "- Your complement MUST be exactly (99 - child's number). Do the math carefully!\n" +
    '  E.g. child picks 73 → you pick 26. Child picks 15 → you pick 84.\n' +
    '- NEVER reveal the complement trick until after the reveal.\n' +
    '- When picking your complement, NEVER say it too quickly — pretend to think for a moment. ' +
    'If you instantly say "26!" after they say "73", the pattern becomes obvious.\n' +
    '- Do NOT ask the child to tell you the sum before the reveal — let them add it up and react.\n' +
    '- If the child picks a number outside 10-99, gently redirect: "Pick a number between 10 and 99!"\n' +
    '- If the child asks "how did you do that?", explain the complement pairs after the reveal.\n\n' +
    'IF THEY WANT TO TRY BEING THE MAGICIAN:\n' +
    '- Teach them! Explain the 99-complement trick.\n' +
    '- Let them pick the first number and prediction, and you pick numbers for them to complement.\n' +
    '- This is the best possible outcome — they learned a math trick!\n\n' +
    'STYLE:\n' +
    '- Be a showman! Dramatic pauses, mysterious voice.\n' +
    '- Pretend to concentrate when picking complements. "The numbers are speaking to me..."\n' +
    '- Be genuinely amazed at the reveal (even though you know the trick).\n' +
    '- Call end_game when done.',

  onStart(): GameStartResult {
    // Pick a random first number (10-50 to keep the prediction under 250)
    const agentFirst = 10 + Math.floor(Math.random() * 41)
    const prediction = agentFirst + 198

    return {
      agentMessage:
        `Magic Prediction trick ready! Your first number is ${agentFirst}. ` +
        `Your prediction is ${prediction}. ` +
        `For each number the child picks, your complement is (99 - their number). ` +
        `Build suspense! Suggest the child grab paper to write down the prediction and all 5 numbers.`,
      state: { prediction, agentFirst },
    }
  },
}

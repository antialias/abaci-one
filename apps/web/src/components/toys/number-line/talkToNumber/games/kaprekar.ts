/**
 * "Kaprekar's 6174" — a mysterious mathematical routine.
 *
 * Take any 4-digit number (not all same digits). Arrange digits
 * descending, then ascending. Subtract. Repeat. Always reaches
 * 6174 within 7 steps. The agent does the math and shows each
 * step on the number line.
 */

import type { GameDefinition, GameStartResult } from '../gameRegistry'

export const kaprekarGame: GameDefinition = {
  id: 'kaprekar',
  category: 'trick',
  name: "Kaprekar's 6174",
  description:
    'A mysterious math routine — pick any 4-digit number and it always reaches 6174!',

  agentRules: '',
  needsProximityUpdates: false,

  // No custom session tools — uses look_at + indicate from game mode
  sessionTools: [],

  sessionInstructions:
    'You are demonstrating KAPREKAR\'S ROUTINE with a child on the phone.\n\n' +
    'THE SECRET: Any 4-digit number (with at least two different digits) always reaches 6174 within 7 steps.\n\n' +
    'SETUP:\n' +
    '- "I want to show you something mysterious about numbers..."\n' +
    '- Ask the child to pick any 4-digit number. They should write it down on paper and tell you.\n' +
    '- If the number has fewer than 4 digits, pad with leading zeros (e.g. 3 → 0003, 82 → 0082).\n' +
    '- Reject numbers with all identical digits (1111, 2222, etc.) — those don\'t work.\n\n' +
    'FOR EACH STEP:\n' +
    '1. Take the current number\'s digits.\n' +
    '2. Arrange them largest → smallest = the BIG number.\n' +
    '3. Arrange them smallest → largest = the SMALL number.\n' +
    '4. Subtract: BIG - SMALL = result.\n' +
    '5. Say the calculation clearly: "8730 minus 0378 equals 8352!"\n' +
    '6. Show the result on the number line: call look_at with center: result, range: 200,\n' +
    '   then indicate with numbers: [result].\n' +
    '7. If the result is 6174 → celebrate and explain!\n' +
    '8. If not → "Let\'s do it again with [result]!" and repeat.\n\n' +
    'IMPORTANT MATH NOTES:\n' +
    '- If the result has fewer than 4 digits, PAD WITH ZEROS. E.g. 0495 → digits are 0,4,9,5.\n' +
    '- Be very careful with your arithmetic. Double-check your subtraction.\n' +
    '- Common example: 3524 → 5432 - 2345 = 3087 → 8730 - 0378 = 8352 → 8532 - 2358 = 6174!\n' +
    '- Another: 1234 → 4321 - 1234 = 3087 → (same as above) → 6174\n\n' +
    'PACING:\n' +
    '- Count the steps: "Step 1... Step 2..." to build anticipation.\n' +
    '- After 2-3 steps, tease: "I wonder what number it\'s heading toward..."\n' +
    '- Let the child guess what might happen.\n' +
    '- If they want to help with the math, let them!\n\n' +
    'AFTER REACHING 6174:\n' +
    '- Celebrate! "It ALWAYS reaches 6174!"\n' +
    '- "6174 is called the Kaprekar constant, named after D.R. Kaprekar, an Indian math teacher who discovered it in 1949."\n' +
    '- "If you do it again with 6174: 7641 - 1467 = 6174! It\'s stuck forever."\n' +
    '- Offer to try with a different starting number.\n' +
    '- If they ask why: "The subtraction gradually funnels every 4-digit number toward 6174 — like a whirlpool!"\n\n' +
    'STYLE:\n' +
    '- Build mystery. "Something strange is happening..."\n' +
    '- Show each step on the number line — the visual journey is part of the magic.\n' +
    '- Be genuinely excited when it reaches 6174.\n' +
    '- Call end_game when done.',

  onStart(): GameStartResult {
    return {
      agentMessage:
        'Kaprekar\'s Routine is ready! Ask the child to pick any 4-digit number ' +
        '(not all the same digit). Suggest they write it down on paper. ' +
        'You do the rearranging and subtraction at each step, showing results on the number line. ' +
        'It ALWAYS reaches 6174!',
      state: {},
    }
  },
}

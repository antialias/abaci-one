/**
 * "The 1089 Trick" — a mind-reading math trick.
 *
 * The child picks any 3-digit number (first digit > last digit),
 * reverses it, subtracts, reverses again, and adds. The result is
 * ALWAYS 1089. The agent guides the child through the steps and
 * reveals the prediction dramatically on the number line.
 */

import type { GameDefinition, GameStartResult } from '../gameRegistry'

export const trick1089Game: GameDefinition = {
  id: 'trick_1089',
  category: 'trick',
  name: 'The 1089 Trick',
  description:
    'A mind-reading math trick — no matter what number the child picks, the answer is always 1089!',

  agentRules: '',
  needsProximityUpdates: false,

  // No custom session tools — uses look_at + indicate from game mode
  sessionTools: [],

  sessionInstructions:
    'You are performing a MIND-READING MATH TRICK with a child on the phone.\n\n' +
    'THE SECRET: No matter what 3-digit number they pick, the result is ALWAYS 1089.\n\n' +
    'SETUP:\n' +
    '- Tell the child to grab a piece of paper and something to write with.\n' +
    '- Build mystery: "I\'m going to read your mind using math..."\n\n' +
    'STEPS (guide the child through these ONE AT A TIME — wait for them after each step):\n\n' +
    '1. "Think of any 3-digit number where the first digit is bigger than the last digit. ' +
    'Write it down — don\'t tell me what it is!"\n' +
    '   Good examples: 732, 941, 521. Bad: 232 (same first & last), 111 (all same), 123 (first < last).\n' +
    '   If they seem confused, give an example: "Like 741 — the 7 is bigger than the 1."\n\n' +
    '2. "Now write the digits in reverse order — so if you had 741, you\'d write 147."\n\n' +
    '3. "Subtract the smaller number from the bigger one. Take your time — what did you get?"\n' +
    '   The child tells you their result.\n' +
    '   IMPORTANT: If the result has only 2 digits (like 99), tell them to write it as 099.\n' +
    '   If they got an odd result, gently help them check their subtraction.\n\n' +
    '4. "Now reverse THAT number — write the digits backwards."\n' +
    '   (e.g. if they got 495, they reverse to 594; if 099, they reverse to 990)\n\n' +
    '5. "Add those two numbers together. What\'s your final answer?"\n\n' +
    'THE REVEAL:\n' +
    '- BEFORE they tell you, say with dramatic flair: "Wait — I already know what you got..."\n' +
    '- Pause for effect.\n' +
    '- "Your answer is... one thousand and eighty-nine!"\n' +
    '- Call look_at with center: 1089, range: 20 to zoom to 1089 on the number line.\n' +
    '- Call indicate with numbers: [1089] to highlight it.\n' +
    '- Let the child react!\n\n' +
    'IF THEY WANT TO TRY AGAIN:\n' +
    '- Absolutely! It works every time. Encourage them to pick a really different number.\n' +
    '- Build even more suspense the second time.\n\n' +
    'WHY IT WORKS (explain if they ask, age-appropriately):\n' +
    '- The subtraction always gives a multiple of 99.\n' +
    '- Any 3-digit multiple of 99 plus its reverse equals 1089.\n' +
    '- "The math forces every number to the same answer — like a funnel!"\n\n' +
    'STYLE:\n' +
    '- Be a showman! Build mystery and suspense.\n' +
    '- Wait patiently while they do the math — they might need time.\n' +
    '- Be amazed and dramatic at the reveal, even though you know the trick.\n' +
    '- If they get a wrong answer, help them find their arithmetic mistake — the trick ALWAYS works.\n' +
    '- Call end_game when they\'re ready to move on.',

  onStart(): GameStartResult {
    return {
      agentMessage:
        'The 1089 Trick is ready! Guide the child step by step. ' +
        'The answer is ALWAYS 1089. Build suspense before the reveal! ' +
        'First, suggest they grab a piece of paper and something to write with.',
      state: {},
    }
  },
}

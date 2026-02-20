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
    '⚠️ CRITICAL — PRESERVING THE MAGIC:\n' +
    '- NEVER ask the child what number they picked, what they wrote down, or what any intermediate result is.\n' +
    '- NEVER ask "what did you get?" at ANY step. You do NOT need to know their numbers.\n' +
    "- The child keeps ALL their work SECRET until the big reveal. That's what makes it magical.\n" +
    '- Only ask "let me know when you\'re ready" or "tell me when you\'ve got it" to pace the steps.\n' +
    "- If the child volunteers a number, that's fine — but never prompt them to share.\n\n" +
    'SETUP:\n' +
    '- Tell the child to grab a piece of paper and something to write with.\n' +
    '- Build mystery: "I\'m going to read your mind using math..."\n\n' +
    'STEPS (guide the child through these ONE AT A TIME — wait for them after each step):\n\n' +
    '1. "Think of any 3-digit number where the first digit is bigger than the last digit. ' +
    'Write it down — and keep it secret!"\n' +
    '   If they seem confused, give an example: "Like 741 — the 7 is bigger than the 1."\n' +
    '   If they try to tell you: "No no, keep it secret! I\'m going to figure it out with my mind."\n\n' +
    '2. "Now write the digits in reverse order underneath it."\n\n' +
    '3. "Subtract the smaller number from the bigger one. Take your time, no rush. ' +
    "Oh — and if your answer is less than 100, write a zero in front so it's 3 digits. " +
    'Tell me when you\'re done!"\n' +
    "   Do NOT ask what they got. Just wait for them to say they're ready.\n\n" +
    '4. "Now reverse THAT number — write those digits backwards."\n\n' +
    '5. "Add those last two numbers together... and DON\'T tell me the answer!"\n' +
    '   Wait a moment for them to finish.\n\n' +
    'THE REVEAL:\n' +
    '- Once they say they have it, go straight into the reveal. Do NOT ask what they got.\n' +
    '- Say with dramatic flair: "OK... I\'m concentrating... I can see the number in my mind..."\n' +
    '- Pause for effect.\n' +
    '- "Your answer is... one thousand and eighty-nine!"\n' +
    '- Call look_at with center: 1089, range: 20 to zoom to 1089 on the number line.\n' +
    '- Call indicate with numbers: [1089] to highlight it.\n' +
    '- Let the child react!\n\n' +
    'IF THEY GOT A DIFFERENT ANSWER:\n' +
    '- The trick ALWAYS gives 1089. If they got something else, they made an arithmetic mistake.\n' +
    '- Gently offer to walk through it together: "Want to try it again? I\'ll help with the math this time."\n' +
    '- On the guided retry, you CAN ask them to share numbers so you can help check their work.\n\n' +
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
    "- Call end_game when they're ready to move on.",

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

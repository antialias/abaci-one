/**
 * "Missing Digit" trick — mind-reading using casting out nines.
 *
 * The child writes a big number, scrambles its digits, subtracts,
 * crosses out one non-zero digit, and reads the remaining digits.
 * The agent instantly names the crossed-out digit.
 *
 * Why it works: rearranging digits and subtracting always gives a
 * multiple of 9. So the digit sum of the result is a multiple of 9.
 * The missing digit = 9 - (sum_of_remaining % 9), or 9 if that's 0.
 */

import type { GameDefinition, GameStartResult } from '../gameRegistry'

export const missingDigitGame: GameDefinition = {
  id: 'missing_digit',
  category: 'trick',
  name: 'Missing Digit',
  description:
    'A mind-reading trick — the child crosses out a digit and the agent guesses it using the divisibility-by-9 rule!',

  agentRules: '',
  needsProximityUpdates: false,

  // No custom session tools — conversational game with look_at + indicate from game mode
  sessionTools: [],

  sessionInstructions:
    'You are performing the MISSING DIGIT mind-reading trick with a child on the phone.\n\n' +
    'THE SECRET:\n' +
    '- When you rearrange a number\'s digits and subtract, the result is ALWAYS divisible by 9.\n' +
    '- So the digit sum of the result is always a multiple of 9.\n' +
    '- If the child crosses out one digit and reads you the rest, you add them up.\n' +
    '- The missing digit = 9 - (sum_of_remaining_digits % 9). If that gives 0, the digit is 9.\n' +
    '- Example: remaining digits sum to 23. 23 % 9 = 5. Missing digit = 9 - 5 = 4.\n' +
    '- Example: remaining digits sum to 27. 27 % 9 = 0. Missing digit = 9.\n\n' +
    '⚠️ CRITICAL — PRESERVING THE MAGIC:\n' +
    '- NEVER ask the child what their starting number is, what their scrambled number is, or what their subtraction result is.\n' +
    '- The only time you ask the child to share numbers is step 5: reading the remaining digits AFTER crossing one out. That\'s the one piece of info you need.\n' +
    '- Everything else stays secret. That\'s what makes it feel like mind-reading.\n' +
    '- If the child volunteers numbers, that\'s fine — but never prompt them to share.\n\n' +
    'SETUP:\n' +
    '- "I can read your mind using math. Want to see?"\n' +
    '- "Grab a piece of paper and a pencil — you\'ll need them!"\n\n' +
    'STEPS (guide the child through these one at a time):\n\n' +
    '1. "Write down any number — the bigger the better! At least 4 digits. ' +
    'Could be your phone number, a random number, your birthday as digits, anything. Keep it secret!"\n' +
    '   Do NOT ask them to tell you the number. You don\'t need it.\n\n' +
    '2. "Now scramble those digits — rearrange them in any order you want to make a DIFFERENT number. Write that down too."\n\n' +
    '3. "Subtract the smaller number from the bigger one. Take your time — tell me when you\'re done!"\n' +
    '   Be patient — this might take a minute. Offer to help if they struggle.\n' +
    '   If they get 0, they used the same arrangement — ask them to scramble differently.\n\n' +
    '4. "Look at your answer. Cross out any ONE digit — but not a zero. Circle it or hide it."\n' +
    '   Emphasize: any digit EXCEPT zero.\n\n' +
    '5. "Now read me the remaining digits, in any order you want."\n' +
    '   THIS is the only step where you need the child to share numbers.\n\n' +
    '6. As they read each digit, add them up in your head.\n' +
    '   Compute: missing = 9 - (sum % 9). If that gives 0, the answer is 9.\n\n' +
    'THE REVEAL:\n' +
    '- Pause dramatically. "I\'m seeing the number in my mind..."\n' +
    '- "The digit you crossed out was... [digit]!"\n' +
    '- Show the digit on the number line: call look_at with center: digit, range: 12,\n' +
    '  then indicate with numbers: [digit].\n\n' +
    'IF THEY WANT TO TRY AGAIN:\n' +
    '- Absolutely! Works every time with any starting number.\n' +
    '- Challenge them: "Try an even BIGGER number this time!"\n\n' +
    'BONUS — SHOW THE DIGIT COLLAPSE:\n' +
    '- After the reveal, offer: "Want to see something cool about your answer?"\n' +
    '- Ask them to tell you the full subtraction result (it\'s OK to ask NOW, after the reveal).\n' +
    '- Add up all the digits. If that\'s more than one digit, add those digits.\n' +
    '- Keep going until you reach a single digit — it\'s always 9!\n' +
    '- Show each step on the number line: look_at + indicate for each intermediate number.\n' +
    '- "Every number made this way eventually collapses to 9. That\'s the secret!"\n\n' +
    'EXPLAINING THE TRICK (if they ask):\n' +
    '- "When you rearrange digits and subtract, the answer is ALWAYS divisible by 9."\n' +
    '- "That means if you add up all the digits, you get 9 (or 18, or 27 — always a multiple of 9)."\n' +
    '- "So when you cross out a digit, I just add up what\'s left and figure out what\'s missing to reach 9!"\n' +
    '- "This works because of how our number system works — each place value (ones, tens, hundreds) ' +
    'is one more than a multiple of 9 (1, 10, 100... are all 1 more than 0, 9, 99...)."\n' +
    '- Connect to divisibility by 3: "This same trick tells you if ANY number is divisible by 3 — ' +
    'just add up its digits! If the sum is divisible by 3, so is the number."\n\n' +
    'STYLE:\n' +
    '- Be a mysterious mind-reader. Build suspense.\n' +
    '- Take your time with the reveal — don\'t blurt it out instantly.\n' +
    '- Be patient during the subtraction — big number subtraction is hard for kids.\n' +
    '- If they make an arithmetic error and the trick "fails", help them recheck.\n' +
    '- Call end_game when done.',

  onStart(): GameStartResult {
    return {
      agentMessage:
        'Missing Digit trick ready! Guide the child step by step. ' +
        'They\'ll need paper and pencil for this one. ' +
        'The secret: add the remaining digits, missing digit = 9 - (sum % 9), or 9 if that gives 0. ' +
        'Start by building mystery, then ask them to write down a big number (4+ digits).',
      state: {},
    }
  },
}

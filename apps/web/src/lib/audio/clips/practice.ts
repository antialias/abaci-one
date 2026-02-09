import { audioClip } from '../audioClipRegistry'

export const GAME_BREAK_TIME = audioClip(
  'practice-game-break-time',
  'Woo-hoo! Time for a game!',
  'celebration'
)
export const GAME_BREAK_EARNED = audioClip(
  'practice-game-break-earned',
  "You've been working so hard — you earned a game break!",
  'celebration'
)
export const PICK_A_GAME = audioClip(
  'practice-pick-a-game',
  'Pick a game! Which one looks fun?',
  'tutorial-instruction'
)
export const BACK_TO_PRACTICE = audioClip(
  'practice-back-to-practice',
  'Okay, back to math! Let\'s do this!',
  'tutorial-instruction'
)

/** Announcement clips for game break start — randomly selected */
export const GAME_BREAK_ANNOUNCEMENT_CLIPS = [GAME_BREAK_TIME, GAME_BREAK_EARNED] as const

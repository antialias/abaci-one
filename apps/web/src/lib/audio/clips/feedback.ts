import { audioClip } from '../audioClipRegistry'

export const CORRECT = audioClip('feedback-correct', 'Correct!', 'celebration')
export const GREAT_JOB = audioClip('feedback-great-job', 'Great job!', 'celebration')
export const NICE_WORK = audioClip('feedback-nice-work', 'Nice work!', 'celebration')
export const KEEP_GOING = audioClip('feedback-keep-going', 'Keep going!', 'celebration')
export const YOU_GOT_IT = audioClip('feedback-you-got-it', 'You got it!', 'celebration')
export const AWESOME = audioClip('feedback-awesome', 'Awesome sauce!', 'celebration')
export const WAY_TO_GO = audioClip('feedback-way-to-go', 'Way to go!', 'celebration')
export const THATS_RIGHT = audioClip(
  'feedback-thats-right',
  "That's right! Look at you go!",
  'celebration'
)
export const HIGH_FIVE = audioClip('feedback-high-five', 'High five!', 'celebration')

export const THE_ANSWER_IS = audioClip('feedback-the-answer-is', 'The answer is', 'corrective')
export const TRY_AGAIN = audioClip('feedback-try-again', 'Try again', 'corrective')

// Streak milestone clips
export const NICE_STREAK = audioClip('feedback-nice-streak', 'Whoa, nice streak!', 'celebration')
export const ON_FIRE = audioClip('feedback-on-fire', "You're on fire! Watch out!", 'celebration')
export const UNSTOPPABLE = audioClip(
  'feedback-unstoppable',
  'Un-STOP-able! Nobody can stop you!',
  'celebration'
)
export const LEGENDARY = audioClip(
  'feedback-legendary',
  'LEGENDARY! You are a math superstar!',
  'celebration'
)

/** Positive feedback clips to pick from randomly */
export const CELEBRATION_CLIPS = [
  CORRECT,
  GREAT_JOB,
  NICE_WORK,
  KEEP_GOING,
  YOU_GOT_IT,
  AWESOME,
  WAY_TO_GO,
  THATS_RIGHT,
  HIGH_FIVE,
] as const

/** Streak milestone clip IDs keyed by exact streak count */
export const STREAK_CLIPS: Record<number, string> = {
  3: NICE_STREAK,
  5: ON_FIRE,
  7: UNSTOPPABLE,
  10: LEGENDARY,
}

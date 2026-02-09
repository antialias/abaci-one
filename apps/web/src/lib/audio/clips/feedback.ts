import { audioClip } from '../audioClipRegistry'

export const CORRECT = audioClip('feedback-correct', 'Correct!', 'celebration')
export const GREAT_JOB = audioClip('feedback-great-job', 'Great job!', 'celebration')
export const NICE_WORK = audioClip('feedback-nice-work', 'Nice work!', 'celebration')
export const KEEP_GOING = audioClip('feedback-keep-going', 'Keep going!', 'celebration')
export const THE_ANSWER_IS = audioClip('feedback-the-answer-is', 'The answer is', 'corrective')
export const TRY_AGAIN = audioClip('feedback-try-again', 'Try again', 'corrective')

/** Positive feedback clips to pick from randomly */
export const CELEBRATION_CLIPS = [CORRECT, GREAT_JOB, NICE_WORK] as const

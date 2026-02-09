import { audioClip } from '../audioClipRegistry'

export const GIVE_IT_A_TRY = audioClip(
  'assistance-give-it-a-try',
  'Give it a try! You got this.',
  'encouragement'
)
export const YOU_CAN_DO_IT = audioClip(
  'assistance-you-can-do-it',
  'You can do it! I believe in you.',
  'encouragement'
)
export const TAKE_YOUR_TIME = audioClip(
  'assistance-take-your-time',
  'Take your time, no rush!',
  'encouragement'
)
export const NEED_HELP = audioClip(
  'assistance-need-help',
  'Hmm, want some help? I can show you!',
  'encouragement'
)
export const NEED_HELP_2 = audioClip(
  'assistance-need-help-2',
  "This one's a thinker! Want me to help?",
  'encouragement'
)
export const TRY_USING_HELP = audioClip(
  'assistance-try-using-help',
  "Ooh, this is a tricky one! Let's use help and figure it out together.",
  'encouragement'
)

/** Clips for the "offering help" transition — randomly selected */
export const OFFERING_HELP_CLIPS = [NEED_HELP, NEED_HELP_2] as const

/** Clips for the initial "encouraging" transition — randomly selected */
export const ENCOURAGING_CLIPS = [GIVE_IT_A_TRY, YOU_CAN_DO_IT, TAKE_YOUR_TIME] as const

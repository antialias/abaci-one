export interface AudioClipEntry {
  id: string
  text: string
  category: 'number' | 'operator' | 'feedback' | 'tutorial'
  filename: string
}

export const AUDIO_MANIFEST: AudioClipEntry[] = [
  // Numbers 0-20
  { id: 'number-0', text: 'zero', category: 'number', filename: 'number-0.mp3' },
  { id: 'number-1', text: 'one', category: 'number', filename: 'number-1.mp3' },
  { id: 'number-2', text: 'two', category: 'number', filename: 'number-2.mp3' },
  { id: 'number-3', text: 'three', category: 'number', filename: 'number-3.mp3' },
  { id: 'number-4', text: 'four', category: 'number', filename: 'number-4.mp3' },
  { id: 'number-5', text: 'five', category: 'number', filename: 'number-5.mp3' },
  { id: 'number-6', text: 'six', category: 'number', filename: 'number-6.mp3' },
  { id: 'number-7', text: 'seven', category: 'number', filename: 'number-7.mp3' },
  { id: 'number-8', text: 'eight', category: 'number', filename: 'number-8.mp3' },
  { id: 'number-9', text: 'nine', category: 'number', filename: 'number-9.mp3' },
  { id: 'number-10', text: 'ten', category: 'number', filename: 'number-10.mp3' },
  { id: 'number-11', text: 'eleven', category: 'number', filename: 'number-11.mp3' },
  { id: 'number-12', text: 'twelve', category: 'number', filename: 'number-12.mp3' },
  { id: 'number-13', text: 'thirteen', category: 'number', filename: 'number-13.mp3' },
  { id: 'number-14', text: 'fourteen', category: 'number', filename: 'number-14.mp3' },
  { id: 'number-15', text: 'fifteen', category: 'number', filename: 'number-15.mp3' },
  { id: 'number-16', text: 'sixteen', category: 'number', filename: 'number-16.mp3' },
  { id: 'number-17', text: 'seventeen', category: 'number', filename: 'number-17.mp3' },
  { id: 'number-18', text: 'eighteen', category: 'number', filename: 'number-18.mp3' },
  { id: 'number-19', text: 'nineteen', category: 'number', filename: 'number-19.mp3' },
  { id: 'number-20', text: 'twenty', category: 'number', filename: 'number-20.mp3' },

  // Tens
  { id: 'number-30', text: 'thirty', category: 'number', filename: 'number-30.mp3' },
  { id: 'number-40', text: 'forty', category: 'number', filename: 'number-40.mp3' },
  { id: 'number-50', text: 'fifty', category: 'number', filename: 'number-50.mp3' },
  { id: 'number-60', text: 'sixty', category: 'number', filename: 'number-60.mp3' },
  { id: 'number-70', text: 'seventy', category: 'number', filename: 'number-70.mp3' },
  { id: 'number-80', text: 'eighty', category: 'number', filename: 'number-80.mp3' },
  { id: 'number-90', text: 'ninety', category: 'number', filename: 'number-90.mp3' },

  // Place value words
  { id: 'number-hundred', text: 'hundred', category: 'number', filename: 'number-hundred.mp3' },
  { id: 'number-thousand', text: 'thousand', category: 'number', filename: 'number-thousand.mp3' },

  // Operators
  { id: 'operator-plus', text: 'plus', category: 'operator', filename: 'operator-plus.mp3' },
  { id: 'operator-minus', text: 'minus', category: 'operator', filename: 'operator-minus.mp3' },
  { id: 'operator-equals', text: 'equals', category: 'operator', filename: 'operator-equals.mp3' },

  // Feedback
  {
    id: 'feedback-correct',
    text: 'Correct!',
    category: 'feedback',
    filename: 'feedback-correct.mp3',
  },
  {
    id: 'feedback-great-job',
    text: 'Great job!',
    category: 'feedback',
    filename: 'feedback-great-job.mp3',
  },
  {
    id: 'feedback-the-answer-is',
    text: 'The answer is',
    category: 'feedback',
    filename: 'feedback-the-answer-is.mp3',
  },
  {
    id: 'feedback-try-again',
    text: 'Try again',
    category: 'feedback',
    filename: 'feedback-try-again.mp3',
  },
  {
    id: 'feedback-nice-work',
    text: 'Nice work!',
    category: 'feedback',
    filename: 'feedback-nice-work.mp3',
  },
  {
    id: 'feedback-keep-going',
    text: 'Keep going!',
    category: 'feedback',
    filename: 'feedback-keep-going.mp3',
  },

  // Tutorial phrases
  {
    id: 'tutorial-welcome',
    text: 'Welcome to the tutorial!',
    category: 'tutorial',
    filename: 'tutorial-welcome.mp3',
  },
  {
    id: 'tutorial-look-at-abacus',
    text: 'Look at the abacus.',
    category: 'tutorial',
    filename: 'tutorial-look-at-abacus.mp3',
  },
  {
    id: 'tutorial-move-bead-up',
    text: 'Move the bead up.',
    category: 'tutorial',
    filename: 'tutorial-move-bead-up.mp3',
  },
  {
    id: 'tutorial-move-bead-down',
    text: 'Move the bead down.',
    category: 'tutorial',
    filename: 'tutorial-move-bead-down.mp3',
  },
  {
    id: 'tutorial-this-is-one',
    text: 'This is one.',
    category: 'tutorial',
    filename: 'tutorial-this-is-one.mp3',
  },
  {
    id: 'tutorial-this-is-five',
    text: 'This is five.',
    category: 'tutorial',
    filename: 'tutorial-this-is-five.mp3',
  },
  {
    id: 'tutorial-tap-the-bead',
    text: 'Tap the bead.',
    category: 'tutorial',
    filename: 'tutorial-tap-the-bead.mp3',
  },
  {
    id: 'tutorial-now-try-it',
    text: 'Now try it yourself!',
    category: 'tutorial',
    filename: 'tutorial-now-try-it.mp3',
  },
  {
    id: 'tutorial-well-done',
    text: 'Well done!',
    category: 'tutorial',
    filename: 'tutorial-well-done.mp3',
  },
  {
    id: 'tutorial-type-answer',
    text: 'Type your answer.',
    category: 'tutorial',
    filename: 'tutorial-type-answer.mp3',
  },
  {
    id: 'tutorial-use-keypad',
    text: 'Use the number keys.',
    category: 'tutorial',
    filename: 'tutorial-use-keypad.mp3',
  },
  {
    id: 'tutorial-press-enter',
    text: 'Press enter to submit.',
    category: 'tutorial',
    filename: 'tutorial-press-enter.mp3',
  },
  {
    id: 'tutorial-lets-begin',
    text: "Let's begin!",
    category: 'tutorial',
    filename: 'tutorial-lets-begin.mp3',
  },
  {
    id: 'tutorial-next-step',
    text: 'Next step.',
    category: 'tutorial',
    filename: 'tutorial-next-step.mp3',
  },
  {
    id: 'tutorial-complete',
    text: 'Tutorial complete!',
    category: 'tutorial',
    filename: 'tutorial-complete.mp3',
  },
]

export const AUDIO_MANIFEST_MAP: Record<string, AudioClipEntry> = Object.fromEntries(
  AUDIO_MANIFEST.map((entry) => [entry.id, entry])
)

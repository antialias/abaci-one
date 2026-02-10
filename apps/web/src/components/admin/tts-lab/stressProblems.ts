import type { TtsSegment } from '@/lib/audio/TtsAudioManager'
import type { LogEntry, LogLevel } from './useTestLog'

/**
 * Realistic practice-session utterances mixing pregenerated clip IDs
 * (numbers, operators) with novel hash-based segments of varying length.
 * 12 problems, 1–9 segments each, designed to overwhelm TtsAudioManager
 * when fired in rapid succession with navigation interrupts.
 */
export const STRESS_PROBLEMS: TtsSegment[][] = [
  // 0: Simple prompt — 3 segments (1 novel + 2 pregen)
  [
    { say: { en: 'What is' }, tone: 'problem-prompt' },
    'number-5',
    { say: { en: 'plus three' }, tone: 'problem-prompt' },
  ],
  // 1: Feedback — 4 mixed segments
  [
    { say: { en: 'Correct!' }, tone: 'feedback-correct' },
    { say: { en: 'The answer is' }, tone: 'feedback-correct' },
    'number-8',
    { say: { en: 'Well done' }, tone: 'encouragement' },
  ],
  // 2: Long novel instruction — 1 segment with lots of text
  [
    {
      say: {
        en: 'Now we are going to move on to a more challenging set of subtraction problems using the soroban abacus. Pay close attention to the bead movements.',
      },
      tone: 'tutorial-instruction',
    },
  ],
  // 3: Subtraction prompt — 5 segments
  [
    { say: { en: 'What is' }, tone: 'problem-prompt' },
    'number-7',
    { say: { en: 'minus' }, tone: 'problem-prompt' },
    'number-2',
    { say: { en: 'on the soroban' }, tone: 'problem-prompt' },
  ],
  // 4: Wrong-answer feedback — 3 segments
  [
    { say: { en: "That's not quite right. The correct answer is" }, tone: 'feedback-incorrect' },
    'number-5',
    { say: { en: 'Try to visualize the beads moving down.' }, tone: 'tutorial-instruction' },
  ],
  // 5: Multi-op problem — 7 segments
  [
    { say: { en: 'Next problem.' }, tone: 'problem-prompt' },
    { say: { en: 'What is' }, tone: 'problem-prompt' },
    'number-9',
    { say: { en: 'plus' }, tone: 'problem-prompt' },
    'number-4',
    { say: { en: 'minus' }, tone: 'problem-prompt' },
    'number-6',
  ],
  // 6: Enthusiastic breakdown — 8 segments
  [
    { say: { en: 'Excellent work!' }, tone: 'feedback-correct' },
    'number-9',
    { say: { en: 'plus' }, tone: 'feedback-correct' },
    'number-4',
    { say: { en: 'is thirteen, minus' }, tone: 'feedback-correct' },
    'number-6',
    { say: { en: 'equals' }, tone: 'feedback-correct' },
    'number-7',
  ],
  // 7: Long novel encouragement
  [
    {
      say: {
        en: "You're making great progress! Let's keep practicing. Remember, the key to soroban mastery is consistent daily practice with visualization.",
      },
      tone: 'encouragement',
    },
  ],
  // 8: Multi-digit — 6 segments, all-pregen number run
  [
    { say: { en: 'What is' }, tone: 'problem-prompt' },
    'number-1',
    'number-5',
    { say: { en: 'plus' }, tone: 'problem-prompt' },
    'number-2',
    'number-8',
  ],
  // 9: Long result — 8 mixed segments
  [
    { say: { en: 'The answer is' }, tone: 'feedback-correct' },
    'number-4',
    'number-3',
    { say: { en: 'because' }, tone: 'tutorial-instruction' },
    'number-1',
    'number-5',
    { say: { en: 'plus twenty eight equals forty three' }, tone: 'tutorial-instruction' },
    { say: { en: 'Great job!' }, tone: 'encouragement' },
  ],
  // 10: Speed round — 9 pregenerated clips, pure number barrage
  [
    'number-1',
    'number-2',
    'number-3',
    'number-4',
    'number-5',
    'number-6',
    'number-7',
    'number-8',
    'number-9',
  ],
  // 11: Session summary — 4 novel segments, lots of text
  [
    { say: { en: 'Session complete!' }, tone: 'encouragement' },
    { say: { en: 'You practiced twelve problems today.' }, tone: 'feedback-correct' },
    { say: { en: 'Your accuracy was eighty three percent.' }, tone: 'feedback-correct' },
    {
      say: {
        en: 'Keep up the excellent work and come back tomorrow for more soroban practice!',
      },
      tone: 'encouragement',
    },
  ],
]

// ---------------------------------------------------------------------------
// Session-persisted state for the navigation stress test
// ---------------------------------------------------------------------------

export interface NavStressState {
  running: boolean
  currentStep: number
  totalSteps: number
  interruptDelayMs: number
  startTime: number
  log: LogEntry[]
}

const SESSION_KEY = 'tts-lab-nav-stress'

export function readNavState(): NavStressState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Reject stale state from incompatible versions (old shape used totalCycles)
    if (typeof parsed.totalSteps !== 'number') {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeNavState(state: NavStressState): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state))
}

export function clearNavState(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function appendNavLog(
  state: NavStressState,
  level: LogLevel,
  message: string,
  detail?: string
): NavStressState {
  const entry: LogEntry = {
    timestamp: Date.now() - state.startTime,
    level,
    message,
    detail,
  }
  return { ...state, log: [...state.log, entry].slice(-500) }
}

export function describeSegments(segments: TtsSegment[] | undefined): string {
  if (!segments) return '(empty)'
  return segments
    .map((seg) => {
      if (typeof seg === 'string') return seg
      if ('say' in seg && seg.say) {
        const text = seg.say.en ?? Object.values(seg.say)[0] ?? '?'
        return `"${text.length > 25 ? text.slice(0, 22) + '...' : text}"`
      }
      return '?'
    })
    .join(', ')
}

/**
 * LCM Hopper Narration — story-style segments with startProgress/endProgress.
 *
 * Written as a story starring the hopping animals: their feelings,
 * plans, and what they say to each other. The narrator reads the story
 * while the animation plays in sync.
 *
 * Uses the DemoNarrationSegment format so it plugs directly into
 * useConstantDemoNarration + the scrubber infrastructure.
 *
 * Progress phases (matching renderLcmHopperOverlay.ts):
 *   0.00–0.12  Intro — hoppers fade in at 0
 *   0.12–0.50  Early hopping — first ~50% of hops
 *   0.50–0.70  Pattern hopping — partial overlaps
 *   0.70–0.80  Guess zone — prompt + slowdown
 *   0.80–0.90  Reveal — race to LCM
 *   0.90–1.00  Celebration
 */

import type {
  DemoNarrationSegment,
  DemoNarrationConfig,
} from '../constants/demos/useConstantDemoNarration'
import type { ActiveCombo } from './lcmComboGenerator'
import { sharedLandings } from './lcmComboGenerator'

// ── Animal character info ──────────────────────────────────────────────

function emojiToName(emoji: string): string {
  const map: Record<string, string> = {
    '🐸': 'Frog',
    '🐰': 'Bunny',
    '🦘': 'Kangaroo',
    '🐿️': 'Squirrel',
    '🦊': 'Fox',
    '🐛': 'Caterpillar',
    '🐝': 'Bee',
    '🦗': 'Cricket',
  }
  return map[emoji] ?? 'Critter'
}

function strideWord(n: number): string {
  const words: Record<number, string> = {
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    11: 'eleven',
    12: 'twelve',
  }
  return words[n] ?? String(n)
}

function firstMultiples(stride: number, count: number): string {
  return Array.from({ length: count }, (_, i) => stride * (i + 1)).join(', ')
}

// ── Segment builder ────────────────────────────────────────────────────

export const LCM_HOPPER_TONE =
  'You are reading a charming bedtime story to a really smart 5-year-old. ' +
  'The characters are little animals hopping along a number path. ' +
  'Give each animal a personality through how they talk and feel. ' +
  'Build suspense about where they will all meet. ' +
  'Use a warm, wondering, slightly dramatic story voice.'

export function buildLcmHopperNarration(combo: ActiveCombo): DemoNarrationConfig {
  const names = combo.strides.map((_, i) => emojiToName(combo.emojis[i]))
  const shared = sharedLandings(combo)
  const firstShared = shared[0]

  // Character intros with personality
  const introLines = combo.strides.map((stride, i) => {
    const name = names[i]
    const sw = strideWord(stride)
    if (i === 0)
      return `${name} stretched and yawned. "I always jump by ${sw}s," ${name} said proudly.`
    if (i === 1) return `${name} wiggled excitedly. "Well I hop by ${sw}s — watch me!"`
    return `And ${name} bounced in place. "I leap by ${sw}s. Nobody leaps like me!"`
  })

  const seg0: DemoNarrationSegment = {
    ttsText:
      `Once upon a time, ${names.length === 2 ? 'two' : 'three'} friends lined up at zero on the great number path. ` +
      introLines.join(' ') +
      ` "Let's see who reaches the same spot first!" they all agreed.`,
    startProgress: 0.0,
    endProgress: 0.12,
    animationDurationMs: 7000,
    scrubberLabel: 'Once upon a time',
  }

  // Early hopping — describe their individual patterns with character
  const hopDescs = combo.strides.map((s, i) => {
    const name = names[i]
    return `${name} went ${firstMultiples(s, 3)} — always landing every ${strideWord(s)}`
  })
  const seg1: DemoNarrationSegment = {
    ttsText:
      `"Go!" And off they went! ` +
      hopDescs.join('. ') +
      '. ' +
      `Each one had their own rhythm, their own special pattern of landing spots.`,
    startProgress: 0.12,
    endProgress: 0.5,
    animationDurationMs: 12000,
    scrubberLabel: 'Off they go',
  }

  // Pattern hopping — point out partial overlaps with story drama
  let seg2Text: string
  if (firstShared !== undefined) {
    const who = combo.strides
      .map((s, i) => (firstShared % s === 0 ? names[i] : null))
      .filter(Boolean)
    const whoMissed = combo.strides
      .map((s, i) => (firstShared % s !== 0 ? names[i] : null))
      .filter(Boolean)
    if (whoMissed.length > 0) {
      seg2Text =
        `Then something wonderful happened at ${firstShared}. ` +
        `${who.join(' and ')} both landed on the same spot! ` +
        `"We match!" they cheered. ` +
        `But ${whoMissed.join(' and ')} sailed right past. "Wait for me!" ${whoMissed[0]} called. ` +
        `They hadn't found the number where ALL of them could meet — not yet.`
    } else {
      seg2Text =
        `At ${firstShared}, all of them landed together! "Is this it?" they wondered. ` +
        `But was it the SMALLEST number where they could all meet?`
    }
  } else {
    seg2Text =
      `They kept going, each one landing on different numbers. ` +
      `"I keep missing you!" said ${names[0]}. "Where will we all meet?"`
  }
  const seg2: DemoNarrationSegment = {
    ttsText: seg2Text,
    startProgress: 0.5,
    endProgress: 0.7,
    animationDurationMs: 10000,
    scrubberLabel: 'Almost meeting',
  }

  // Guess zone — build suspense, invite the listener
  const allWord = names.length === 2 ? 'both' : 'all three'
  const seg3: DemoNarrationSegment = {
    ttsText:
      `The friends were getting closer and closer. Each one could feel it — ` +
      `somewhere up ahead, there was a number where ${allWord} of their paths would cross. ` +
      `Can YOU see where they're all going to meet? Tap the spot on the number line!`,
    startProgress: 0.7,
    endProgress: 0.8,
    animationDurationMs: 7000,
    scrubberLabel: 'Where will they meet?',
  }

  // Reveal — race to the LCM
  const seg4: DemoNarrationSegment = {
    ttsText:
      `Faster and faster they hopped, the excitement building with every jump. ` +
      `${names[0]} could see it. ${names.length > 2 ? `${names[1]} could see it. ` : ''}` +
      `They were almost there!`,
    startProgress: 0.8,
    endProgress: 0.9,
    animationDurationMs: 4000,
    scrubberLabel: 'Racing to the answer',
  }

  // Celebration — announce the LCM as the happy ending
  const strideList = combo.strides.join(', ')
  const seg5: DemoNarrationSegment = {
    ttsText:
      `${combo.lcm}! They all landed on ${combo.lcm} at the very same moment! ` +
      `"We did it!" they cheered together. ` +
      `${combo.lcm} is the Least Common Multiple of ${strideList} — ` +
      `the smallest number on the path where every single friend lands together.`,
    startProgress: 0.9,
    endProgress: 1.0,
    animationDurationMs: 7000,
    scrubberLabel: 'They all meet!',
  }

  return {
    segments: [seg0, seg1, seg2, seg3, seg4, seg5],
    tone: LCM_HOPPER_TONE,
  }
}

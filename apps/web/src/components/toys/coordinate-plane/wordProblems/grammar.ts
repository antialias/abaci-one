import type {
  SemanticFrame,
  SubjectEntry,
  GeneratedNumbers,
  DifficultyLevel,
  AnnotatedSpan,
} from './types'
import {
  formatWithUnit,
  pluralize,
  conjugate3p,
  conjugateBase,
  conjugateFor,
  capitalize,
  midSentence,
} from './inflect'
import type { SeededRandom } from '../../../../lib/SeededRandom'

/** A production is a function that returns an array of annotated spans */
type Production = (ctx: GrammarContext) => AnnotatedSpan[]

interface GrammarContext {
  frame: SemanticFrame
  nums: GeneratedNumbers
  difficulty: DifficultyLevel
  rng: SeededRandom
}

// ── Helpers ──────────────────────────────────────────────────────

function pickSubject(ctx: GrammarContext): SubjectEntry {
  return ctx.rng.pick(ctx.frame.subjects)
}

// ── Individual productions ────────────────────────────────────────

function setupBlock(ctx: GrammarContext): AnnotatedSpan[] {
  const phrase = ctx.rng.pick(ctx.frame.setupPhrases)
  return [{ text: phrase, tag: 'context' }]
}

function rateSentence(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, nums, rng } = ctx
  const mFormatted = formatWithUnit(nums.m, frame.yUnit, frame.yUnitPosition)

  if (frame.xRole === 'elapsed') {
    // Time-based: subject is the actor, not the x-unit
    const subject = pickSubject(ctx)
    const variant = rng.nextInt(0, 2)

    if (variant === 0) {
      // "The car travels 42 miles each hour."
      return [
        { text: `${subject.phrase} ` },
        { text: `${conjugateFor(frame.rateVerb, subject)} ` },
        { text: mFormatted, tag: 'slope', value: nums.m },
        { text: ` each ${frame.xNoun.singular}.` },
      ]
    } else if (variant === 1) {
      // "Every week, the plant grows 3 inches."
      return [
        { text: `Every ${frame.xNoun.singular}, ${midSentence(subject.phrase)} ` },
        { text: `${conjugateFor(frame.rateVerb, subject)} ` },
        { text: mFormatted, tag: 'slope', value: nums.m },
        { text: '.' },
      ]
    } else {
      // "The rate is 42 miles per hour."
      const rateLabel = frame.category === 'money' ? 'The rate is' : 'The rate is'
      return [
        { text: `${rateLabel} ` },
        { text: mFormatted, tag: 'slope', value: nums.m },
        { text: ` per ${frame.xNoun.singular}.` },
      ]
    }
  }

  // Acquired: x-unit is the subject
  const variant = rng.nextInt(0, 2)

  if (variant === 0) {
    // "Each slice costs $3."
    return [
      { text: `Each ${frame.xNoun.singular} ` },
      { text: `${conjugate3p(frame.rateVerb)} ` },
      { text: mFormatted, tag: 'slope', value: nums.m },
      { text: '.' },
    ]
  } else if (variant === 1) {
    // "Slices cost $3 each."
    return [
      { text: `${capitalize(frame.xNoun.plural)} ` },
      { text: `${conjugateBase(frame.rateVerb)} ` },
      { text: mFormatted, tag: 'slope', value: nums.m },
      { text: ' each.' },
    ]
  } else {
    // "The price is $3 per slice."
    const rateLabel = frame.category === 'money' ? 'The price is' : 'The rate is'
    return [
      { text: `${rateLabel} ` },
      { text: mFormatted, tag: 'slope', value: nums.m },
      { text: ` per ${frame.xNoun.singular}.` },
    ]
  }
}

function baseSentence(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, nums, rng } = ctx
  const bFormatted = formatWithUnit(nums.b, frame.yUnit, frame.yUnitPosition)
  const subject = pickSubject(ctx)

  if (frame.xRole === 'elapsed') {
    const variant = rng.nextInt(0, 2)

    if (variant === 0) {
      // "The car started at 38 miles." / "She started with $50."
      const prep = frame.yUnitPosition === 'prefix' ? 'with' : 'at'
      return [
        { text: `${subject.phrase} started ${prep} ` },
        { text: bFormatted, tag: 'intercept', value: nums.b },
        { text: '.' },
      ]
    } else if (variant === 1) {
      // "The starting total is $50." / "The starting distance is 38 miles."
      const noun = frame.category === 'money' ? 'total' : frame.yNoun.singular + ' count'
      return [
        { text: `The starting ${noun} is ` },
        { text: bFormatted, tag: 'intercept', value: nums.b },
        { text: '.' },
      ]
    } else {
      // "At the start, they had 38 miles."
      return [
        { text: `At the start, ${midSentence(subject.phrase)} had ` },
        { text: bFormatted, tag: 'intercept', value: nums.b },
        { text: '.' },
      ]
    }
  }

  // Acquired
  const variant = rng.nextInt(0, 2)

  if (variant === 0) {
    // "There is a $5 base fee." / "There is a starting amount of 3 cups."
    if (frame.yUnitPosition === 'prefix') {
      const feeWord = frame.category === 'money' ? 'base fee' : 'starting amount'
      return [
        { text: `There is a ` },
        { text: bFormatted, tag: 'intercept', value: nums.b },
        { text: ` ${feeWord}.` },
      ]
    } else {
      return [
        { text: `There is a starting amount of ` },
        { text: bFormatted, tag: 'intercept', value: nums.b },
        { text: '.' },
      ]
    }
  } else if (variant === 1) {
    // "The starting total is $5."
    const noun = frame.category === 'money' ? 'total' : frame.yNoun.singular + ' count'
    return [
      { text: `The starting ${noun} is ` },
      { text: bFormatted, tag: 'intercept', value: nums.b },
      { text: '.' },
    ]
  } else {
    // "Sonia already has $5."
    return [
      { text: `${subject.phrase} already has ` },
      { text: bFormatted, tag: 'intercept', value: nums.b },
      { text: '.' },
    ]
  }
}

function goalSentence(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, nums, rng } = ctx
  const tFormatted = formatWithUnit(nums.yTarget, frame.yUnit, frame.yUnitPosition)
  const subject = pickSubject(ctx)

  if (frame.xRole === 'elapsed') {
    const variant = rng.nextInt(0, 1)

    if (variant === 0) {
      // "The car needs to reach 290 miles."
      const verb = conjugateFor(
        { base: 'need', thirdPerson: 'needs', pastTense: 'needed', gerund: 'needing' },
        subject
      )
      return [
        { text: `${subject.phrase} ${verb} to reach ` },
        { text: tFormatted, tag: 'target', value: nums.yTarget },
        { text: '.' },
      ]
    } else {
      // "The goal is 290 miles."
      return [
        { text: 'The goal is ' },
        { text: tFormatted, tag: 'target', value: nums.yTarget },
        { text: '.' },
      ]
    }
  }

  // Acquired
  const variant = rng.nextInt(0, 1)

  if (variant === 0) {
    const budgetWord = frame.category === 'money' ? 'a budget of' : 'a goal of'
    return [
      { text: `${subject.phrase} has ${budgetWord} ` },
      { text: tFormatted, tag: 'target', value: nums.yTarget },
      { text: '.' },
    ]
  } else {
    return [
      { text: 'The total is ' },
      { text: tFormatted, tag: 'target', value: nums.yTarget },
      { text: '.' },
    ]
  }
}

function questionSentence(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, rng } = ctx

  if (frame.xRole === 'elapsed') {
    if (frame.solveForXQuestions && frame.solveForXQuestions.length > 0) {
      return [{ text: rng.pick(frame.solveForXQuestions), tag: 'question' }]
    }
    // Generic fallback
    return [{ text: `How many ${frame.xNoun.plural} will it take?`, tag: 'question' }]
  }

  // Acquired
  const subject = pickSubject(ctx)
  const variant = rng.nextInt(0, 1)

  if (variant === 0) {
    return [
      {
        text: `How many ${frame.xNoun.plural} can ${midSentence(subject.phrase)} get?`,
        tag: 'question',
      },
    ]
  } else {
    return [{ text: `How many ${frame.xNoun.plural} is that?`, tag: 'question' }]
  }
}

// Level 1: just identify a constant
function level1Sentence(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, nums, rng } = ctx
  const bFormatted = formatWithUnit(nums.b, frame.yUnit, frame.yUnitPosition)
  const setup = rng.pick(frame.setupPhrases)
  const nounPl = frame.yNoun.plural

  return [
    { text: setup, tag: 'context' },
    { text: ' ' },
    { text: `The number of ${nounPl} is always ` },
    { text: bFormatted, tag: 'intercept', value: nums.b },
    { text: ', no matter how many ' },
    { text: frame.xNoun.plural, tag: 'x_unit' },
    { text: '. ' },
    { text: `What line shows ${bFormatted}?`, tag: 'question' },
  ]
}

// Level 2: y = mx (proportional)
function level2Sentence(ctx: GrammarContext): AnnotatedSpan[] {
  const setup = setupBlock(ctx)
  const rate = rateSentence(ctx)
  const question = questionForSolveY(ctx)
  return [...setup, { text: ' ' }, ...rate, { text: ' ' }, ...question]
}

function questionForSolveY(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, nums, rng } = ctx
  const xFormatted = `${nums.xAnswer} ${pluralize(frame.xNoun, nums.xAnswer)}`

  if (frame.xRole === 'elapsed') {
    const variant = rng.nextInt(0, 1)

    if (variant === 0) {
      // "After 3 hours, what is the total?"
      return [
        { text: `After ` },
        { text: xFormatted, tag: 'answer', value: nums.xAnswer },
        { text: `, what is the total?`, tag: 'question' },
      ]
    } else {
      // "What is the total after 3 hours?"
      return [
        { text: `What is the total after ` },
        { text: xFormatted, tag: 'answer', value: nums.xAnswer },
        { text: `?`, tag: 'question' },
      ]
    }
  }

  // Acquired
  const subject = pickSubject(ctx)
  const variant = rng.nextInt(0, 1)

  if (variant === 0) {
    return [
      { text: `If ${midSentence(subject.phrase)} gets ` },
      { text: xFormatted, tag: 'answer', value: nums.xAnswer },
      { text: `, what is the total?`, tag: 'question' },
    ]
  } else {
    return [
      { text: `How much for ` },
      { text: xFormatted, tag: 'answer', value: nums.xAnswer },
      { text: `?`, tag: 'question' },
    ]
  }
}

// Level 3: y = mx + b, solve for x
function level3Sentence(ctx: GrammarContext): AnnotatedSpan[] {
  const setup = setupBlock(ctx)
  const rate = rateSentence(ctx)
  const base = baseSentence(ctx)
  const goal = goalSentence(ctx)
  const question = questionSentence(ctx)

  // Randomize order of rate and base sentences
  const orderRateFirst = ctx.rng.chance(0.5)
  const middle = orderRateFirst
    ? [...rate, { text: ' ' } as AnnotatedSpan, ...base]
    : [...base, { text: ' ' } as AnnotatedSpan, ...rate]

  return [...setup, { text: ' ' }, ...middle, { text: ' ' }, ...goal, { text: ' ' }, ...question]
}

// Level 4: two points → derive equation
function level4Sentence(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, nums, rng } = ctx
  const setup = rng.pick(frame.setupPhrases)

  const p1 = nums.point1!
  const p2 = nums.point2!
  const xUnit = frame.xNoun.plural

  return [
    { text: setup, tag: 'context' },
    { text: ' ' },
    {
      text: `After ${p1.x} ${xUnit}, there were ${formatWithUnit(p1.y, frame.yUnit, frame.yUnitPosition)}`,
      tag: 'point1',
    },
    { text: '. ' },
    {
      text: `After ${p2.x} ${xUnit}, there were ${formatWithUnit(p2.y, frame.yUnit, frame.yUnitPosition)}`,
      tag: 'point2',
    },
    { text: '. ' },
    { text: 'What equation describes this pattern?', tag: 'question' },
  ]
}

// ── Production registry per difficulty ────────────────────────────

const PRODUCTIONS: Record<DifficultyLevel, Production> = {
  1: level1Sentence,
  2: level2Sentence,
  3: level3Sentence,
  4: level4Sentence,
  5: level3Sentence, // level 5 reuses level 3 structure (point-slope is a ruler task, not a text task)
}

/**
 * Expand the grammar for a given context, producing annotated spans.
 */
export function expandGrammar(
  frame: SemanticFrame,
  nums: GeneratedNumbers,
  difficulty: DifficultyLevel,
  rng: SeededRandom
): AnnotatedSpan[] {
  const ctx: GrammarContext = { frame, nums, difficulty, rng }
  const production = PRODUCTIONS[difficulty]
  return production(ctx)
}

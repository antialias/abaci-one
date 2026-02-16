import type { SemanticFrame, GeneratedNumbers, DifficultyLevel, AnnotatedSpan } from './types'
import { formatWithUnit, pluralize, conjugate3p, conjugateBase, capitalize } from './inflect'
import { SeededRandom } from '../../../../lib/SeededRandom'

/** A production is a function that returns an array of annotated spans */
type Production = (ctx: GrammarContext) => AnnotatedSpan[]

interface GrammarContext {
  frame: SemanticFrame
  nums: GeneratedNumbers
  difficulty: DifficultyLevel
  rng: SeededRandom
}

// ── Individual productions ────────────────────────────────────────

function setupBlock(ctx: GrammarContext): AnnotatedSpan[] {
  const phrase = ctx.rng.pick(ctx.frame.setupPhrases)
  return [{ text: phrase, tag: 'context' }]
}

function rateSentence(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, nums, rng } = ctx
  const mFormatted = formatWithUnit(nums.m, frame.yUnit, frame.yUnitPosition)
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
  const subject = rng.pick(ctx.frame.subjectPhrases)
  const variant = rng.nextInt(0, 2)

  if (variant === 0) {
    // "There is a $5 base fee." / "There is a 3 inches starting amount."
    const feeWord = frame.category === 'money' ? 'base fee' : 'starting amount'
    return [
      { text: `There is a ` },
      { text: bFormatted, tag: 'intercept', value: nums.b },
      { text: ` ${feeWord}.` },
    ]
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
      { text: `${subject} already has ` },
      { text: bFormatted, tag: 'intercept', value: nums.b },
      { text: '.' },
    ]
  }
}

function goalSentence(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, nums, rng } = ctx
  const tFormatted = formatWithUnit(nums.yTarget, frame.yUnit, frame.yUnitPosition)
  const subject = rng.pick(ctx.frame.subjectPhrases)
  const variant = rng.nextInt(0, 1)

  if (variant === 0) {
    const budgetWord = frame.category === 'money' ? 'a budget of' : 'a goal of'
    return [
      { text: `${subject} has ${budgetWord} ` },
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
  const subject = rng.pick(ctx.frame.subjectPhrases).toLowerCase()
  const variant = rng.nextInt(0, 1)

  if (variant === 0) {
    return [
      { text: `How many ${frame.xNoun.plural} can ${subject} get?`, tag: 'question' },
    ]
  } else {
    return [
      { text: `How many ${frame.xNoun.plural} is that?`, tag: 'question' },
    ]
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
  const subject = rng.pick(frame.subjectPhrases)

  const variant = rng.nextInt(0, 1)
  if (variant === 0) {
    return [
      { text: `If ${subject.toLowerCase()} gets ` },
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

  return [
    ...setup,
    { text: ' ' },
    ...middle,
    { text: ' ' },
    ...goal,
    { text: ' ' },
    ...question,
  ]
}

// Level 4: two points → derive equation
function level4Sentence(ctx: GrammarContext): AnnotatedSpan[] {
  const { frame, nums, rng } = ctx
  const setup = rng.pick(frame.setupPhrases)

  const p1 = nums.point1!
  const p2 = nums.point2!
  const xUnit = frame.xNoun.plural
  const yUnit = frame.yNoun.plural

  return [
    { text: setup, tag: 'context' },
    { text: ' ' },
    { text: `After ${p1.x} ${xUnit}, there were ${formatWithUnit(p1.y, frame.yUnit, frame.yUnitPosition)} ${yUnit}`, tag: 'point1' },
    { text: '. ' },
    { text: `After ${p2.x} ${xUnit}, there were ${formatWithUnit(p2.y, frame.yUnit, frame.yUnitPosition)} ${yUnit}`, tag: 'point2' },
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

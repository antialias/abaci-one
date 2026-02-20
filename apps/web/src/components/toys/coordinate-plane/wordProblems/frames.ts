import type { SemanticFrame, RatePair, Scenario } from './types'
import { RATE_PAIR_REGISTRY } from './ratePairs'
import { SCENARIOS } from './scenarios'

/**
 * Compose a RatePair and Scenario into a SemanticFrame.
 * The frame ID is `${pair.id}:${scenario.id}`.
 */
export function buildFrame(pair: RatePair, scenario: Scenario): SemanticFrame {
  return {
    id: `${pair.id}:${scenario.id}`,
    category: pair.category,
    xNoun: scenario.xNoun ?? pair.xNoun,
    yNoun: scenario.yNoun ?? pair.yNoun,
    rateVerb: scenario.rateVerb ?? pair.rateVerb,
    xUnit: scenario.xUnit ?? pair.xUnit,
    yUnit: scenario.yUnit ?? pair.yUnit,
    xUnitPosition: pair.xUnitPosition,
    yUnitPosition: pair.yUnitPosition,
    xRole: pair.xRole,
    setupPhrases: scenario.setupPhrases,
    subjects: scenario.subjects,
    solveForXQuestions: scenario.solveForXQuestions,
    emoji: scenario.emoji,
    supportedLevels: scenario.supportedLevels,
    slopeRange: scenario.slopeRange,
    interceptRange: scenario.interceptRange,
    xRange: scenario.xRange,
    yRange: scenario.yRange,
  }
}

/** All available semantic frames (composed from rate pairs × scenarios) */
export const FRAMES: SemanticFrame[] = SCENARIOS.map((scenario) => {
  const pair = RATE_PAIR_REGISTRY.get(scenario.ratePairId)
  if (!pair) throw new Error(`Unknown ratePairId "${scenario.ratePairId}"`)
  return buildFrame(pair, scenario)
})

/** Registry: look up a frame by id */
export const FRAME_REGISTRY = new Map<string, SemanticFrame>(FRAMES.map((f) => [f.id, f]))

/** Get frames that support a given difficulty level */
export function framesForLevel(level: number): SemanticFrame[] {
  const frames = FRAMES.filter((f) => f.supportedLevels.includes(level as 1 | 2 | 3 | 4 | 5))
  // Level 5 falls back to level 3 frames if none explicitly support it
  if (frames.length === 0 && level === 5) {
    return FRAMES.filter((f) => f.supportedLevels.includes(3))
  }
  return frames
}

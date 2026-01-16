/**
 * Flowchart Walker Library
 *
 * Re-exports all flowchart-related modules for easy importing.
 */

// Schema types
export * from './schema'

// Expression evaluator
export { evaluate, evaluateBoolean, evaluateNumber, createEmptyContext } from './evaluator'
export type { EvalContext } from './evaluator'

// Mermaid parser
export {
  parseMermaidFile,
  parseNodeContent,
  getOutgoingEdges,
  getNextNodes,
  findNodePhase,
  getPhaseIndex,
  getTotalPhases,
} from './parser'

// Flowchart loader
export {
  loadFlowchart,
  initializeState,
  createContextFromState,
  getNextNode,
  isDecisionCorrect,
  validateCheckpoint,
  applyStateUpdate,
  advanceState,
  isTerminal,
  createMixedNumber,
  formatMixedNumber,
  formatProblemDisplay,
} from './loader'

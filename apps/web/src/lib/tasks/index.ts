/**
 * Background Task Handlers
 *
 * This module exports task handlers for long-running operations.
 * Each handler wraps a specific operation (vision training, worksheet parsing, etc.)
 * in the unified background task system.
 *
 * Usage:
 * ```typescript
 * import { startVisionTraining } from '@/lib/tasks'
 *
 * // Start a task
 * const taskId = await startVisionTraining({ modelType: 'column-classifier', epochs: 50 })
 *
 * // Client subscribes via Socket.IO
 * socket.emit('task:subscribe', taskId)
 * socket.on('task:event', (event) => console.log(event))
 * ```
 */

// Vision Training (TensorFlow)
export {
  startVisionTraining,
  requestEarlyStop,
  isTrainingRunningLocally,
  getLocalTrainingCount,
  type VisionTrainingInput,
  type VisionTrainingOutput,
} from './vision-training'

// Worksheet Parsing (LLM)
export {
  startWorksheetParsing,
  type WorksheetParseInput,
  type WorksheetParseOutput,
} from './worksheet-parse'

// Worksheet Re-Parsing (LLM) - for selected problems
export {
  startWorksheetReparse,
  type WorksheetReparseInput,
  type WorksheetReparseOutput,
} from './worksheet-reparse'

// Session Plan Generation
export {
  startSessionPlanGeneration,
  type SessionPlanInput,
  type SessionPlanOutput,
} from './session-plan'

/**
 * Worksheet Parsing Module
 *
 * Provides LLM-powered parsing of abacus workbook page images.
 * Extracts arithmetic problems and student answers, then converts
 * them into practice session data.
 *
 * @example
 * ```typescript
 * import {
 *   parseWorksheetImage,
 *   convertToSlotResults,
 *   type WorksheetParsingResult,
 * } from '@/lib/worksheet-parsing'
 *
 * // Parse the worksheet image
 * const result = await parseWorksheetImage(imageDataUrl, {
 *   onProgress: (p) => setProgress(p.message),
 * })
 *
 * // Review and correct if needed
 * if (result.data.needsReview) {
 *   // Show review UI
 * }
 *
 * // Convert to session data
 * const { slotResults, summary } = convertToSlotResults(result.data)
 *
 * // Create session
 * await createSession({ playerId, slotResults, status: 'completed' })
 * ```
 */

// Schemas
export {
  BoundingBoxSchema,
  ProblemFormatSchema,
  ProblemTermSchema,
  ParsedProblemSchema,
  PageMetadataSchema,
  WorksheetParsingResultSchema,
  ProblemCorrectionSchema,
  ReparseRequestSchema,
  ReviewProgressSchema,
  createInitialReviewProgress,
  type BoundingBox,
  type ProblemFormat,
  type ParsedProblem,
  type PageMetadata,
  type WorksheetParsingResult,
  type ProblemCorrection,
  type ReparseRequest,
  type ReviewProgress,
} from './schemas'

// Parser
export {
  parseWorksheetImage,
  streamParseWorksheetImage,
  reparseProblems,
  computeParsingStats,
  applyCorrections,
  // Model configurations
  PARSING_MODEL_CONFIGS,
  getDefaultModelConfig,
  getModelConfig,
  type ModelConfig,
  type ParseWorksheetOptions,
  type ParseWorksheetResult,
  type StreamParseWorksheetOptions,
  type WorksheetParseStreamEvent,
} from './parser'

// Prompt Builder
export {
  buildWorksheetParsingPrompt,
  buildReparsePrompt,
  type PromptOptions,
} from './prompt-builder'

// Session Converter
export {
  convertToSlotResults,
  validateParsedProblems,
  computeSkillStats,
  type ConversionOptions,
  type ConversionResult,
} from './session-converter'

// Crop Utilities
export {
  CROP_PADDING,
  calculateCropRegion,
  cropImageWithCanvas,
  type NormalizedBoundingBox,
  type CropRegion,
} from './crop-utils'

// State Machine (for context provider)
export {
  parsingReducer,
  initialParsingState,
  isParsingAttachment,
  isAnyParsingActive,
  getStreamingStatus,
  type ParsingContextState,
  type ParsingAction,
  type ParsingStats,
  type CompletedProblem,
  type StreamType,
  type StreamingStatus,
  type StreamingState,
} from './state-machine'

// SSE Parser (shared streaming utility)
export {
  parseSSEStream,
  extractCompletedProblemsFromPartialJson,
  type SSECallbacks,
} from './sse-parser'

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
  type BoundingBox,
  type ProblemFormat,
  type ParsedProblem,
  type PageMetadata,
  type WorksheetParsingResult,
  type ProblemCorrection,
  type ReparseRequest,
} from './schemas'

// Parser
export {
  parseWorksheetImage,
  reparseProblems,
  computeParsingStats,
  applyCorrections,
  type ParseWorksheetOptions,
  type ParseWorksheetResult,
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

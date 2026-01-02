/**
 * Worksheet Parsing Schemas
 *
 * These Zod schemas define the structure of LLM responses when parsing
 * abacus workbook pages. The .describe() annotations are critical -
 * they are automatically extracted and included in the LLM prompt.
 */
import { z } from 'zod'

/**
 * Bounding box in normalized coordinates (0-1)
 * Represents a rectangular region on the worksheet image
 */
export const BoundingBoxSchema = z
  .object({
    x: z
      .number()
      .min(0)
      .max(1)
      .describe('Left edge of the box as a fraction of image width (0 = left edge, 1 = right edge)'),
    y: z
      .number()
      .min(0)
      .max(1)
      .describe('Top edge of the box as a fraction of image height (0 = top edge, 1 = bottom edge)'),
    width: z
      .number()
      .min(0)
      .max(1)
      .describe('Width of the box as a fraction of image width'),
    height: z
      .number()
      .min(0)
      .max(1)
      .describe('Height of the box as a fraction of image height'),
  })
  .describe('Rectangular region on the worksheet image, in normalized 0-1 coordinates')

export type BoundingBox = z.infer<typeof BoundingBoxSchema>

/**
 * Problem format detected in the worksheet
 */
export const ProblemFormatSchema = z
  .enum(['vertical', 'linear'])
  .describe(
    'Format of the problem: "vertical" for stacked column addition/subtraction with answer box below, ' +
      '"linear" for horizontal format like "a + b - c = ___"'
  )

export type ProblemFormat = z.infer<typeof ProblemFormatSchema>

/**
 * Single term in a problem (number with operation)
 */
export const ProblemTermSchema = z
  .number()
  .int()
  .describe(
    'A single term in the problem. Positive numbers represent addition, ' +
      'negative numbers represent subtraction. The first term is always positive. ' +
      'Example: for "45 - 17 + 8", terms are [45, -17, 8]'
  )

/**
 * A single parsed problem from the worksheet
 */
export const ParsedProblemSchema = z
  .object({
    // Identification
    problemNumber: z
      .number()
      .int()
      .min(1)
      .describe('The problem number as printed on the worksheet (1, 2, 3, etc.)'),
    row: z
      .number()
      .int()
      .min(1)
      .describe('Which row of problems this belongs to (1 = top row, 2 = second row, etc.)'),
    column: z
      .number()
      .int()
      .min(1)
      .describe('Which column position in the row (1 = leftmost, counting right)'),

    // Problem content
    format: ProblemFormatSchema,
    terms: z
      .array(ProblemTermSchema)
      .min(2)
      .max(7)
      .describe(
        'All terms in the problem, in order. First term is positive. ' +
          'Subsequent terms are positive for addition, negative for subtraction. ' +
          'Example: "45 - 17 + 8" → [45, -17, 8]'
      ),
    correctAnswer: z
      .number()
      .int()
      .describe('The mathematically correct answer to this problem'),

    // Student work
    studentAnswer: z
      .number()
      .int()
      .nullable()
      .describe(
        'The answer the student wrote, if readable. Null if the answer box is empty, ' +
          'illegible, or you cannot confidently read the student\'s handwriting'
      ),
    studentAnswerConfidence: z
      .number()
      .min(0)
      .max(1)
      .describe(
        'Confidence in reading the student\'s answer (0 = not readable/empty, 1 = perfectly clear). ' +
          'Use 0.5-0.7 for somewhat legible, 0.8-0.9 for mostly clear, 1.0 for crystal clear'
      ),

    // Problem extraction confidence
    termsConfidence: z
      .number()
      .min(0)
      .max(1)
      .describe(
        'Confidence in correctly reading all the problem terms (0 = very unsure, 1 = certain). ' +
          'Lower confidence if digits are smudged, cropped, or partially obscured'
      ),

    // Bounding boxes for UI highlighting
    problemBoundingBox: BoundingBoxSchema.describe(
      'Bounding box around the entire problem (including all terms and answer area)'
    ),
    answerBoundingBox: BoundingBoxSchema.nullable().describe(
      'Bounding box around just the student\'s answer area. Null if no answer area is visible'
    ),
  })
  .describe('A single arithmetic problem extracted from the worksheet')

export type ParsedProblem = z.infer<typeof ParsedProblemSchema>

/**
 * Detected worksheet format
 */
export const WorksheetFormatSchema = z
  .enum(['vertical', 'linear', 'mixed'])
  .describe(
    'Overall format of problems on this page: ' +
      '"vertical" if all problems are stacked column format, ' +
      '"linear" if all are horizontal equation format, ' +
      '"mixed" if the page contains both formats'
  )

/**
 * Page metadata extracted from the worksheet
 */
export const PageMetadataSchema = z
  .object({
    lessonId: z
      .string()
      .nullable()
      .describe(
        'Lesson identifier if printed on the page (e.g., "Lesson 5", "L5", "Unit 2 Lesson 3"). ' +
          'Null if no lesson identifier is visible'
      ),
    weekId: z
      .string()
      .nullable()
      .describe(
        'Week identifier if printed on the page (e.g., "Week 4", "W4"). ' +
          'Null if no week identifier is visible'
      ),
    pageNumber: z
      .number()
      .int()
      .nullable()
      .describe(
        'Page number if printed on the page. Null if no page number is visible'
      ),
    detectedFormat: WorksheetFormatSchema,
    totalRows: z
      .number()
      .int()
      .min(1)
      .max(6)
      .describe('Number of rows of problems on this page (typically 1-4)'),
    problemsPerRow: z
      .number()
      .int()
      .min(1)
      .max(12)
      .describe('Average number of problems per row (typically 8-10)'),
  })
  .describe('Metadata about the worksheet page layout and identifiers')

export type PageMetadata = z.infer<typeof PageMetadataSchema>

/**
 * Complete worksheet parsing result
 */
export const WorksheetParsingResultSchema = z
  .object({
    problems: z
      .array(ParsedProblemSchema)
      .min(1)
      .describe(
        'All problems detected on the worksheet, in reading order (left to right, top to bottom)'
      ),
    pageMetadata: PageMetadataSchema,
    overallConfidence: z
      .number()
      .min(0)
      .max(1)
      .describe(
        'Overall confidence in the parsing accuracy (0 = very uncertain, 1 = highly confident). ' +
          'Based on image quality, problem clarity, and answer legibility'
      ),
    warnings: z
      .array(z.string())
      .describe(
        'List of issues encountered during parsing, such as: ' +
          '"Problem 5 terms partially obscured", ' +
          '"Row 2 problems may be cropped", ' +
          '"Student handwriting difficult to read on problems 3, 7, 12"'
      ),
    needsReview: z
      .boolean()
      .describe(
        'True if any problems have low confidence or warnings that require human review ' +
          'before creating a practice session'
      ),
  })
  .describe('Complete result of parsing an abacus workbook page')

export type WorksheetParsingResult = z.infer<typeof WorksheetParsingResultSchema>

/**
 * User correction to a parsed problem
 */
export const ProblemCorrectionSchema = z
  .object({
    problemNumber: z
      .number()
      .int()
      .min(1)
      .describe('The problem number being corrected'),
    correctedTerms: z
      .array(ProblemTermSchema)
      .nullable()
      .describe('Corrected terms if the LLM got them wrong. Null to keep original'),
    correctedStudentAnswer: z
      .number()
      .int()
      .nullable()
      .describe('Corrected student answer. Null means empty/not answered'),
    shouldExclude: z
      .boolean()
      .describe('True to exclude this problem from the session (e.g., illegible)'),
    note: z
      .string()
      .nullable()
      .describe('Optional note explaining the correction'),
  })
  .describe('User correction to a single parsed problem')

export type ProblemCorrection = z.infer<typeof ProblemCorrectionSchema>

/**
 * Request to re-parse with additional context
 */
export const ReparseRequestSchema = z
  .object({
    problemNumbers: z
      .array(z.number().int().min(1))
      .describe('Which problems to re-parse'),
    additionalContext: z
      .string()
      .describe(
        'Additional instructions for the LLM, such as: ' +
          '"The student writes 7s with a line through them", ' +
          '"Problem 5 has a 3-digit answer, not 2-digit"'
      ),
  })
  .describe('Request to re-parse specific problems with additional context')

export type ReparseRequest = z.infer<typeof ReparseRequestSchema>

import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'
import { worksheetMastery } from './worksheet-mastery'

/**
 * Worksheet attempts table - tracks uploaded completed worksheets
 *
 * Teachers upload photos of students' completed worksheets.
 * AI grades them and provides feedback on mastery progress.
 */
export const worksheetAttempts = sqliteTable(
  'worksheet_attempts',
  {
    /** Unique identifier (UUID) */
    id: text('id').primaryKey(),

    /** User ID of the student (can be guest or authenticated user) */
    userId: text('user_id').notNull(),

    /** URL to uploaded image in storage */
    uploadedImageUrl: text('uploaded_image_url').notNull(),

    /** Optional: Link to worksheet if generated from our system */
    worksheetId: text('worksheet_id'),

    /** Optional: Upload session ID for grouping batch uploads (QR code workflow) */
    sessionId: text('session_id'),

    // Worksheet metadata (from OCR or user input)
    /** Operator type */
    operator: text('operator', { enum: ['addition', 'subtraction', 'mixed'] }).notNull(),

    /** Number of digits in problems (1-5) */
    digitCount: integer('digit_count').notNull(),

    /** Total number of problems on worksheet */
    problemCount: integer('problem_count').notNull(),

    // Grading status
    /** Current grading status */
    gradingStatus: text('grading_status', {
      enum: ['pending', 'processing', 'completed', 'failed'],
    })
      .notNull()
      .default('pending'),

    /** When grading was completed */
    gradedAt: integer('graded_at', { mode: 'timestamp' }),

    /** Error message if grading failed */
    errorMessage: text('error_message'),

    /** Total number of problems detected/graded */
    totalProblems: integer('total_problems'),

    /** Number of correct answers */
    correctCount: integer('correct_count'),

    /** Overall accuracy (0.0-1.0) */
    accuracy: real('accuracy'),

    // AI analysis results
    /** JSON array of error patterns detected (e.g., ["carry-tens", "borrow-hundreds"]) */
    errorPatterns: text('error_patterns'),

    /** Recommended progression step ID */
    suggestedStepId: text('suggested_step_id'),

    /** Natural language feedback from AI */
    aiFeedback: text('ai_feedback'),

    /** Full AI response (for debugging) */
    aiResponseRaw: text('ai_response_raw'),

    /** Timestamp of creation */
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),

    /** Timestamp of last update */
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    // Index for finding user's attempts
    userIdx: index('worksheet_attempts_user_idx').on(table.userId),
    // Index for finding pending/processing attempts
    statusIdx: index('worksheet_attempts_status_idx').on(table.gradingStatus),
    // Index for finding attempts by session (for batch QR uploads)
    sessionIdx: index('worksheet_attempts_session_idx').on(table.sessionId),
  })
)

/**
 * Problem attempts table - tracks individual problem results
 *
 * Each row represents one problem from a worksheet attempt.
 * Allows granular analysis of which problem types cause difficulty.
 */
export const problemAttempts = sqliteTable(
  'problem_attempts',
  {
    /** Unique identifier (UUID) */
    id: text('id').primaryKey(),

    /** Parent worksheet attempt */
    attemptId: text('attempt_id')
      .notNull()
      .references(() => worksheetAttempts.id, { onDelete: 'cascade' }),

    /** User ID (denormalized for queries, can be guest or authenticated user) */
    userId: text('user_id').notNull(),

    // Problem details
    /** Position on worksheet (0-based) */
    problemIndex: integer('problem_index').notNull(),

    /** First operand */
    operandA: integer('operand_a').notNull(),

    /** Second operand */
    operandB: integer('operand_b').notNull(),

    /** Operator */
    operator: text('operator', { enum: ['addition', 'subtraction'] }).notNull(),

    /** Correct answer */
    correctAnswer: integer('correct_answer').notNull(),

    // Student's work (from OCR)
    /** Student's written answer */
    studentAnswer: integer('student_answer'),

    /** JSON array of carry/borrow digits detected */
    studentWorkDigits: text('student_work_digits'),

    // Grading
    /** Whether answer is correct */
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull(),

    /** Type of error if incorrect */
    errorType: text('error_type', {
      enum: ['computation', 'carry', 'borrow', 'alignment', 'ocr-uncertain'],
    }),

    // Problem characteristics (for analysis)
    /** Number of digits in operands */
    digitCount: integer('digit_count').notNull(),

    /** Whether this problem requires regrouping */
    requiresRegrouping: integer('requires_regrouping', { mode: 'boolean' }).notNull(),

    /** JSON array of place values that regroup (e.g., ["ones", "tens"]) */
    regroupsInPlaces: text('regroups_in_places'),

    /** Timestamp of creation */
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    // Index for finding problems by attempt
    attemptIdx: index('problem_attempts_attempt_idx').on(table.attemptId),
    // Index for finding user's problem history
    userIdx: index('problem_attempts_user_idx').on(table.userId),
    // Composite index for analyzing specific problem types
    problemTypeIdx: index('problem_attempts_type_idx').on(
      table.userId,
      table.digitCount,
      table.requiresRegrouping
    ),
  })
)

export type WorksheetAttempt = typeof worksheetAttempts.$inferSelect
export type NewWorksheetAttempt = typeof worksheetAttempts.$inferInsert
export type ProblemAttempt = typeof problemAttempts.$inferSelect
export type NewProblemAttempt = typeof problemAttempts.$inferInsert

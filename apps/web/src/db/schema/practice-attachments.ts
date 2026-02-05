import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'
import { players } from './players'
import { sessionPlans } from './session-plans'
import { users } from './users'
import type { WorksheetParsingResult, ReviewProgress } from '@/lib/worksheet-parsing'

/**
 * Parsing workflow status
 *
 * Note: 'processing' is deprecated - in-progress state is now tracked via
 * background_tasks table. This value is kept for backwards compatibility
 * but should not be set by new code.
 */
export type ParsingStatus = 'pending' | 'processing' | 'needs_review' | 'approved' | 'failed'

/**
 * Practice attachments - photos of student work
 *
 * Used primarily for offline practice sessions where parents/teachers
 * upload photos of the student's physical abacus work.
 *
 * Now also supports LLM-powered parsing of worksheet images to extract
 * problems and student answers automatically.
 */
export const practiceAttachments = sqliteTable('practice_attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Who this photo belongs to
  playerId: text('player_id')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),

  // Link to session (required for offline sessions)
  sessionId: text('session_id')
    .notNull()
    .references(() => sessionPlans.id, { onDelete: 'cascade' }),

  // File info
  filename: text('filename').notNull(), // UUID.ext stored on disk (cropped version)
  originalFilename: text('original_filename'), // Original uncropped file (null if no cropping applied)
  mimeType: text('mime_type').notNull(), // image/jpeg, image/png, etc.
  fileSize: integer('file_size').notNull(), // bytes (of cropped file)

  // Crop corners (JSON array of 4 {x, y} points in original image coordinates)
  // Used to restore crop position when re-editing
  corners: text('corners', { mode: 'json' }).$type<Array<{
    x: number
    y: number
  }> | null>(),

  // Rotation in degrees (0, 90, 180, or 270) - applied after cropping
  rotation: integer('rotation').$type<0 | 90 | 180 | 270>().default(0),

  // ============================================================================
  // LLM Parsing Workflow
  // ============================================================================

  // Parsing status
  parsingStatus: text('parsing_status').$type<ParsingStatus>(),
  parsedAt: text('parsed_at'), // ISO timestamp when parsing completed
  parsingError: text('parsing_error'), // Error message if parsing failed

  // LLM parsing results (raw from LLM, before user corrections)
  rawParsingResult: text('raw_parsing_result', {
    mode: 'json',
  }).$type<WorksheetParsingResult | null>(),

  // Approved results (after user corrections)
  approvedResult: text('approved_result', {
    mode: 'json',
  }).$type<WorksheetParsingResult | null>(),

  // Confidence and review indicators
  confidenceScore: real('confidence_score'), // 0-1, from LLM
  needsReview: integer('needs_review', { mode: 'boolean' }), // True if any problems need manual review

  // Review workflow progress (for resumable reviews)
  // Tracks where the user left off and review statistics
  reviewProgress: text('review_progress', {
    mode: 'json',
  }).$type<ReviewProgress | null>(),

  // LLM call metadata (for debugging/transparency)
  llmProvider: text('llm_provider'), // e.g., "openai", "anthropic"
  llmModel: text('llm_model'), // e.g., "gpt-4o", "claude-sonnet-4"
  llmPromptUsed: text('llm_prompt_used'), // The actual prompt sent to the LLM
  llmRawResponse: text('llm_raw_response'), // Raw JSON response from the LLM (before parsing)
  llmJsonSchema: text('llm_json_schema'), // JSON Schema sent to the LLM (with field descriptions)
  llmImageSource: text('llm_image_source').$type<'cropped' | 'original'>(), // Which image was sent
  llmAttempts: integer('llm_attempts'), // How many retries were needed
  llmPromptTokens: integer('llm_prompt_tokens'),
  llmCompletionTokens: integer('llm_completion_tokens'),
  llmTotalTokens: integer('llm_total_tokens'),

  // Session linkage (for parsed worksheets that created sessions)
  sessionCreated: integer('session_created', { mode: 'boolean' }), // True if session was created from this parsing
  createdSessionId: text('created_session_id').references(() => sessionPlans.id, {
    onDelete: 'set null',
  }),

  // Audit
  uploadedBy: text('uploaded_by')
    .notNull()
    .references(() => users.id),
  uploadedAt: text('uploaded_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

export type PracticeAttachment = typeof practiceAttachments.$inferSelect
export type NewPracticeAttachment = typeof practiceAttachments.$inferInsert

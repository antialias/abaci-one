/**
 * Worksheet Parsing Background Task
 *
 * Wraps the LLM-based worksheet parsing in a background task for:
 * - Real-time progress streaming via Socket.IO
 * - Survival across page reloads
 * - Event replay for late-joining clients
 * - Database persistence of results
 */

import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { type ParsingStatus, practiceAttachments } from '@/db/schema/practice-attachments'
import { createTaskLLM } from '../llm'
import { createTask, type TaskHandle } from '../task-manager'
import {
  buildWorksheetParsingPrompt,
  computeParsingStats,
  type StreamParseWorksheetOptions,
  streamParseWorksheetImage,
} from '../worksheet-parsing'
import type { BoundingBox, WorksheetParsingResult } from '../worksheet-parsing/schemas'
import type { WorksheetParseEvent } from './events'

/**
 * Input for worksheet parsing task
 */
export interface WorksheetParseInput {
  /** Base64-encoded image data URL */
  imageDataUrl: string
  /** Additional prompt options */
  promptOptions?: {
    focusProblemNumbers?: number[]
    additionalContext?: string
  }
  /** Attachment ID for database association */
  attachmentId: string
  /** Player ID for database association */
  playerId: string
  /** Preserved bounding boxes from user adjustments */
  preservedBoundingBoxes?: Record<number, BoundingBox>
}

/**
 * Output from worksheet parsing task
 */
export interface WorksheetParseOutput {
  /** Parsed worksheet data */
  data: WorksheetParsingResult
  /** Statistics computed from the result */
  stats: ReturnType<typeof computeParsingStats>
  /** Provider used */
  provider: string
  /** Model used */
  model: string
  /** Token usage */
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Start a worksheet parsing background task
 *
 * @param input - Parsing configuration
 * @returns Task ID that can be used to track progress
 *
 * @example
 * ```typescript
 * // Start parsing task
 * const taskId = await startWorksheetParsing({
 *   imageDataUrl: 'data:image/jpeg;base64,...',
 *   attachmentId: 'abc123',
 *   playerId: 'player456',
 * })
 *
 * // Client subscribes via Socket.IO
 * socket.emit('task:subscribe', taskId)
 * socket.on('task:event', (event) => {
 *   if (event.eventType === 'reasoning') {
 *     console.log('AI thinking:', event.payload.text)
 *   }
 * })
 * ```
 */
export async function startWorksheetParsing(input: WorksheetParseInput): Promise<string> {
  // Validate required fields
  if (!input.imageDataUrl || !input.imageDataUrl.startsWith('data:image/')) {
    throw new Error('Invalid image data URL')
  }
  if (!input.attachmentId) {
    throw new Error('Attachment ID is required')
  }
  if (!input.playerId) {
    throw new Error('Player ID is required')
  }

  // Clear any previous error and update timestamp (status will be set on completion)
  await db
    .update(practiceAttachments)
    .set({
      parsingError: null,
      parsedAt: new Date().toISOString(),
    })
    .where(eq(practiceAttachments.id, input.attachmentId))

  return createTask<WorksheetParseInput, WorksheetParseOutput, WorksheetParseEvent>(
    'worksheet-parse',
    input,
    async (handle, config) => {
      const { imageDataUrl, promptOptions, attachmentId, preservedBoundingBoxes } = config

      handle.setProgress(5, 'Initializing parser...')
      handle.emit({
        type: 'parse_started',
        modelConfigId: 'gpt-5.2-thinking',
        useStreaming: true,
        attachmentId,
      })

      try {
        await runStreamingParse(handle, imageDataUrl, {
          promptOptions,
          attachmentId,
          preservedBoundingBoxes,
        })
      } catch (error) {
        // Update DB with error
        const errorMessage = error instanceof Error ? error.message : String(error)
        await db
          .update(practiceAttachments)
          .set({
            parsingStatus: 'failed',
            parsingError: errorMessage,
          })
          .where(eq(practiceAttachments.id, attachmentId))
        throw error
      }
    }
  )
}

interface ParseOptions {
  promptOptions?: WorksheetParseInput['promptOptions']
  attachmentId: string
  preservedBoundingBoxes?: Record<number, BoundingBox>
}

/**
 * Run streaming parse with real-time events
 *
 * Uses middleware-enhanced LLM client that automatically:
 * - Emits transient reasoning/output_delta events via Socket.IO
 * - Persists reasoning/output snapshots every 3s for page-reload recovery
 */
async function runStreamingParse(
  handle: TaskHandle<WorksheetParseOutput, WorksheetParseEvent>,
  imageDataUrl: string,
  options: ParseOptions
): Promise<void> {
  const { attachmentId, preservedBoundingBoxes } = options
  const streamOptions: StreamParseWorksheetOptions = {
    promptOptions: options.promptOptions,
  }

  // Build prompt for metadata
  const promptUsed = buildWorksheetParsingPrompt(options.promptOptions ?? {})

  // Create task-aware LLM client (middleware handles reasoning/output streaming & snapshots)
  const taskLLM = createTaskLLM(handle)
  const stream = streamParseWorksheetImage(imageDataUrl, streamOptions, taskLLM)

  for await (const event of stream) {
    // Check for cancellation
    if (handle.isCancelled()) {
      handle.emit({ type: 'cancelled', reason: 'User cancelled' })
      await db
        .update(practiceAttachments)
        .set({ parsingStatus: null, parsingError: null })
        .where(eq(practiceAttachments.id, attachmentId))
      return
    }

    // Handle domain-specific events (reasoning/output_delta handled by middleware)
    if (event.type === 'progress') {
      handle.setProgress(10, event.message)
      handle.emit({ type: 'parse_progress', stage: event.stage, message: event.message })
    } else if (event.type === 'started') {
      handle.setProgress(15, 'AI analyzing worksheet...')
      handle.emit({
        type: 'parse_llm_started',
        responseId: event.responseId,
        model: 'gpt-5.2',
        provider: 'openai',
      })
    } else if (event.type === 'complete') {
      handle.setProgress(90, 'Validating results...')

      // Merge preserved bounding boxes
      let parsingResult = event.data
      if (preservedBoundingBoxes && Object.keys(preservedBoundingBoxes).length > 0) {
        parsingResult = {
          ...parsingResult,
          problems: parsingResult.problems.map((problem, index) => {
            const preservedBox = preservedBoundingBoxes[index]
            return preservedBox ? { ...problem, problemBoundingBox: preservedBox } : problem
          }),
        }
      }

      const stats = computeParsingStats(parsingResult)
      const status: ParsingStatus = parsingResult.needsReview ? 'needs_review' : 'approved'

      // Save results to database
      await db
        .update(practiceAttachments)
        .set({
          parsingStatus: status,
          parsedAt: new Date().toISOString(),
          rawParsingResult: parsingResult,
          confidenceScore: parsingResult.overallConfidence,
          needsReview: parsingResult.needsReview,
          parsingError: null,
          llmProvider: 'openai',
          llmModel: 'gpt-5.2',
          llmPromptUsed: promptUsed,
          llmRawResponse: null,
          llmJsonSchema: null,
          llmImageSource: 'cropped',
          llmAttempts: 1,
          llmPromptTokens: event.usage.promptTokens,
          llmCompletionTokens: event.usage.completionTokens,
          llmTotalTokens: event.usage.promptTokens + event.usage.completionTokens,
        })
        .where(eq(practiceAttachments.id, attachmentId))

      handle.emit({ type: 'parse_complete', data: parsingResult, stats, status })
      handle.complete({
        data: parsingResult,
        stats,
        provider: 'openai',
        model: 'gpt-5.2',
        usage: {
          promptTokens: event.usage.promptTokens,
          completionTokens: event.usage.completionTokens,
          totalTokens: event.usage.promptTokens + event.usage.completionTokens,
        },
      })
      return
    } else if (event.type === 'error') {
      // Reasoning text already available to clients via snapshots
      handle.emit({ type: 'parse_error', error: event.message, reasoningText: '' })
      throw new Error(event.message)
    }
    // reasoning and output_delta events are handled by middleware
  }

  // Stream ended without complete event
  throw new Error('Parsing stream ended unexpectedly')
}

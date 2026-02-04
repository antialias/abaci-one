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
import { practiceAttachments, type ParsingStatus } from '@/db/schema/practice-attachments'
import { createTask, type TaskHandle } from '../task-manager'
import type { WorksheetParseEvent } from './events'
import {
  streamParseWorksheetImage,
  parseWorksheetImage,
  computeParsingStats,
  getModelConfig,
  getDefaultModelConfig,
  buildWorksheetParsingPrompt,
  type StreamParseWorksheetOptions,
} from '../worksheet-parsing'
import type { WorksheetParsingResult, BoundingBox } from '../worksheet-parsing/schemas'

/**
 * Input for worksheet parsing task
 */
export interface WorksheetParseInput {
  /** Base64-encoded image data URL */
  imageDataUrl: string
  /** Model config ID to use */
  modelConfigId?: string
  /** Whether to use streaming mode (default: true for supported providers) */
  useStreaming?: boolean
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
 *   modelConfigId: 'gpt-5.2-thinking',
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

  // Determine if we should use streaming
  const modelConfig = input.modelConfigId
    ? getModelConfig(input.modelConfigId)
    : getDefaultModelConfig()

  // Only OpenAI supports streaming with reasoning
  const canStream = !modelConfig || modelConfig.provider === 'openai'
  const useStreaming = input.useStreaming !== false && canStream

  // Mark attachment as processing
  await db
    .update(practiceAttachments)
    .set({
      parsingStatus: 'processing',
      parsingError: null,
      parsedAt: new Date().toISOString(),
    })
    .where(eq(practiceAttachments.id, input.attachmentId))

  return createTask<WorksheetParseInput, WorksheetParseOutput, WorksheetParseEvent>(
    'worksheet-parse',
    input,
    async (handle, config) => {
      const { imageDataUrl, modelConfigId, promptOptions, attachmentId, preservedBoundingBoxes } =
        config

      handle.setProgress(5, 'Initializing parser...')
      handle.emit({
        type: 'parse_started',
        modelConfigId: modelConfigId ?? 'default',
        useStreaming,
        attachmentId,
      })

      try {
        if (useStreaming) {
          await runStreamingParse(handle, imageDataUrl, {
            modelConfigId,
            promptOptions,
            attachmentId,
            preservedBoundingBoxes,
            modelConfig,
          })
        } else {
          await runSyncParse(handle, imageDataUrl, {
            modelConfigId,
            promptOptions,
            attachmentId,
            preservedBoundingBoxes,
            modelConfig,
          })
        }
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
  modelConfigId?: string
  promptOptions?: WorksheetParseInput['promptOptions']
  attachmentId: string
  preservedBoundingBoxes?: Record<number, BoundingBox>
  modelConfig: ReturnType<typeof getModelConfig>
}

/**
 * Run streaming parse with real-time events
 */
async function runStreamingParse(
  handle: TaskHandle<WorksheetParseOutput, WorksheetParseEvent>,
  imageDataUrl: string,
  options: ParseOptions
): Promise<void> {
  const { attachmentId, preservedBoundingBoxes, modelConfig } = options
  const streamOptions: StreamParseWorksheetOptions = {
    modelConfigId: options.modelConfigId,
    promptOptions: options.promptOptions,
  }

  // Build prompt for metadata
  const promptUsed = buildWorksheetParsingPrompt(options.promptOptions ?? {})

  let reasoningText = ''
  let outputText = ''

  const stream = streamParseWorksheetImage(imageDataUrl, streamOptions)

  for await (const event of stream) {
    // Check for cancellation
    if (handle.isCancelled()) {
      handle.emit({ type: 'cancelled', reason: 'User cancelled' })
      // Reset DB status on cancel
      await db
        .update(practiceAttachments)
        .set({ parsingStatus: null, parsingError: null })
        .where(eq(practiceAttachments.id, attachmentId))
      return
    }

    // Process stream events
    switch (event.type) {
      case 'progress':
        handle.setProgress(10, event.message)
        handle.emit({ type: 'parse_progress', stage: event.stage, message: event.message })
        break

      case 'started':
        handle.setProgress(15, 'AI analyzing worksheet...')
        handle.emit({
          type: 'parse_llm_started',
          responseId: event.responseId,
          model: modelConfig?.model ?? 'gpt-5.2',
          provider: modelConfig?.provider ?? 'openai',
        })
        break

      case 'reasoning': {
        reasoningText += event.text
        // Transient: Socket.IO only, no DB write (these come at 20-100+/sec)
        handle.emitTransient({ type: 'reasoning', text: event.text })
        // setProgress is throttled in task-manager (DB write every ~3s)
        const reasoningProgress = Math.min(15 + Math.floor(reasoningText.length / 100), 50)
        handle.setProgress(reasoningProgress, 'AI reasoning about worksheet...')
        break
      }

      case 'output_delta':
        outputText += event.text
        // Transient: Socket.IO only, no DB write (these come at 20-100+/sec)
        handle.emitTransient({ type: 'output_delta', text: event.text })
        handle.setProgress(60, 'Generating structured output...')
        break

      case 'complete': {
        handle.setProgress(90, 'Validating results...')

        // Merge preserved bounding boxes
        let parsingResult = event.data
        if (preservedBoundingBoxes && Object.keys(preservedBoundingBoxes).length > 0) {
          parsingResult = {
            ...parsingResult,
            problems: parsingResult.problems.map((problem, index) => {
              const preservedBox = preservedBoundingBoxes[index]
              if (preservedBox) {
                return { ...problem, problemBoundingBox: preservedBox }
              }
              return problem
            }),
          }
        }

        const stats = computeParsingStats(parsingResult)
        const status: ParsingStatus = parsingResult.needsReview ? 'needs_review' : 'approved'
        const provider = modelConfig?.provider ?? 'openai'
        const model = modelConfig?.model ?? 'gpt-5.2'

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
            // LLM metadata
            llmProvider: provider,
            llmModel: model,
            llmPromptUsed: promptUsed,
            llmRawResponse: null, // Not available in streaming mode
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
          provider,
          model,
          usage: {
            promptTokens: event.usage.promptTokens,
            completionTokens: event.usage.completionTokens,
            totalTokens: event.usage.promptTokens + event.usage.completionTokens,
          },
        })
        return
      }

      case 'error':
        handle.emit({ type: 'parse_error', error: event.message, reasoningText })
        throw new Error(event.message)
    }
  }

  // Stream ended without complete event
  throw new Error('Parsing stream ended unexpectedly')
}

/**
 * Run synchronous parse (for non-streaming providers)
 */
async function runSyncParse(
  handle: TaskHandle<WorksheetParseOutput, WorksheetParseEvent>,
  imageDataUrl: string,
  options: ParseOptions
): Promise<void> {
  const { attachmentId, preservedBoundingBoxes, modelConfig } = options
  const promptUsed = buildWorksheetParsingPrompt(options.promptOptions ?? {})

  handle.setProgress(20, 'Sending to AI for analysis...')

  const result = await parseWorksheetImage(imageDataUrl, {
    modelConfigId: options.modelConfigId,
    promptOptions: options.promptOptions,
    maxRetries: 2,
    onProgress: (progress) => {
      // Check for cancellation
      if (handle.isCancelled()) {
        throw new Error('Parsing cancelled')
      }
      handle.emit({ type: 'llm_progress', stage: progress.stage, message: progress.message })
      // Map LLM stage to task progress (20-80 range)
      const stageProgress: Record<string, number> = {
        preparing: 20,
        calling: 40,
        validating: 70,
        retrying: 30,
      }
      const taskProgress = stageProgress[progress.stage] ?? 50
      handle.setProgress(taskProgress, progress.message)
    },
  })

  handle.setProgress(90, 'Computing statistics...')

  // Merge preserved bounding boxes
  let parsingResult = result.data
  if (preservedBoundingBoxes && Object.keys(preservedBoundingBoxes).length > 0) {
    parsingResult = {
      ...parsingResult,
      problems: parsingResult.problems.map((problem, index) => {
        const preservedBox = preservedBoundingBoxes[index]
        if (preservedBox) {
          return { ...problem, problemBoundingBox: preservedBox }
        }
        return problem
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
      // LLM metadata
      llmProvider: result.provider,
      llmModel: result.model,
      llmPromptUsed: promptUsed,
      llmRawResponse: result.rawResponse,
      llmJsonSchema: result.jsonSchema,
      llmImageSource: 'cropped',
      llmAttempts: result.attempts,
      llmPromptTokens: result.usage.promptTokens,
      llmCompletionTokens: result.usage.completionTokens,
      llmTotalTokens: result.usage.promptTokens + result.usage.completionTokens,
    })
    .where(eq(practiceAttachments.id, attachmentId))

  handle.emit({ type: 'parse_complete', data: parsingResult, stats, status })
  handle.complete({
    data: parsingResult,
    stats,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
  })
}

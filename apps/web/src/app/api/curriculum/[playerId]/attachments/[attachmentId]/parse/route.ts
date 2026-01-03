/**
 * API route for LLM-powered worksheet parsing
 *
 * POST /api/curriculum/[playerId]/attachments/[attachmentId]/parse
 *   - Start parsing the attachment image
 *   - Returns immediately, polling via GET for status
 *
 * GET /api/curriculum/[playerId]/attachments/[attachmentId]/parse
 *   - Get current parsing status and results
 */

import { readFile } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { practiceAttachments, type ParsingStatus } from '@/db/schema/practice-attachments'
import { canPerformAction } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import {
  parseWorksheetImage,
  computeParsingStats,
  buildWorksheetParsingPrompt,
  getModelConfig,
  getDefaultModelConfig,
  type WorksheetParsingResult,
} from '@/lib/worksheet-parsing'

interface RouteParams {
  params: Promise<{ playerId: string; attachmentId: string }>
}

/**
 * POST - Start parsing the attachment
 *
 * Body (optional):
 *   - modelConfigId: string - ID of the model config to use (from PARSING_MODEL_CONFIGS)
 *   - additionalContext: string - Additional context/hints for the LLM
 *   - preservedBoundingBoxes: Record<number, BoundingBox> - Bounding boxes to preserve by index
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Parse optional parameters from request body
    let modelConfigId: string | undefined
    let additionalContext: string | undefined
    let preservedBoundingBoxes:
      | Record<number, { x: number; y: number; width: number; height: number }>
      | undefined
    try {
      const body = await request.json()
      modelConfigId = body?.modelConfigId
      additionalContext = body?.additionalContext
      preservedBoundingBoxes = body?.preservedBoundingBoxes
    } catch {
      // No body or invalid JSON is fine - use defaults
    }

    // Resolve model config
    const modelConfig = modelConfigId ? getModelConfig(modelConfigId) : getDefaultModelConfig()

    // Authorization check
    const userId = await getDbUserId()
    const canParse = await canPerformAction(userId, playerId, 'start-session')
    if (!canParse) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get attachment record
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get()

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Check if already processing
    if (attachment.parsingStatus === 'processing') {
      return NextResponse.json({
        status: 'processing',
        message: 'Parsing already in progress',
      })
    }

    // Update status to processing
    await db
      .update(practiceAttachments)
      .set({
        parsingStatus: 'processing',
        parsingError: null,
      })
      .where(eq(practiceAttachments.id, attachmentId))

    // Read the image file
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'players', playerId)
    const filepath = join(uploadDir, attachment.filename)
    const imageBuffer = await readFile(filepath)
    const base64Image = imageBuffer.toString('base64')
    const mimeType = attachment.mimeType || 'image/jpeg'
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    // Build the prompt (capture for debugging)
    const promptOptions = additionalContext ? { additionalContext } : {}
    const promptUsed = buildWorksheetParsingPrompt(promptOptions)

    try {
      // Parse the worksheet (always uses cropped image)
      const result = await parseWorksheetImage(imageDataUrl, {
        maxRetries: 2,
        modelConfigId: modelConfig?.id,
        promptOptions,
      })

      let parsingResult = result.data

      // Merge preserved bounding boxes from user adjustments
      // This allows the user's manual adjustments to be retained after re-parsing
      if (preservedBoundingBoxes && Object.keys(preservedBoundingBoxes).length > 0) {
        parsingResult = {
          ...parsingResult,
          problems: parsingResult.problems.map((problem, index) => {
            const preservedBox = preservedBoundingBoxes[index]
            if (preservedBox) {
              return {
                ...problem,
                problemBoundingBox: preservedBox,
              }
            }
            return problem
          }),
        }
      }

      const stats = computeParsingStats(parsingResult)

      // Determine status based on confidence
      const status: ParsingStatus = parsingResult.needsReview ? 'needs_review' : 'approved'

      // Save results and LLM metadata to database
      await db
        .update(practiceAttachments)
        .set({
          parsingStatus: status,
          parsedAt: new Date().toISOString(),
          rawParsingResult: parsingResult,
          confidenceScore: parsingResult.overallConfidence,
          needsReview: parsingResult.needsReview,
          parsingError: null,
          // LLM metadata for debugging/transparency
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

      return NextResponse.json({
        success: true,
        status,
        result: parsingResult,
        stats,
        // LLM metadata in response
        llm: {
          provider: result.provider,
          model: result.model,
          attempts: result.attempts,
          imageSource: 'cropped',
          usage: result.usage,
        },
      })
    } catch (parseError) {
      const errorMessage =
        parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      console.error('Worksheet parsing error:', parseError)

      // Update status to failed
      await db
        .update(practiceAttachments)
        .set({
          parsingStatus: 'failed',
          parsingError: errorMessage,
        })
        .where(eq(practiceAttachments.id, attachmentId))

      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          error: errorMessage,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error starting parse:', error)
    return NextResponse.json({ error: 'Failed to start parsing' }, { status: 500 })
  }
}

/**
 * GET - Get parsing status and results
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId, attachmentId } = await params

    if (!playerId || !attachmentId) {
      return NextResponse.json({ error: 'Player ID and Attachment ID required' }, { status: 400 })
    }

    // Authorization check
    const userId = await getDbUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get attachment record
    const attachment = await db
      .select()
      .from(practiceAttachments)
      .where(eq(practiceAttachments.id, attachmentId))
      .get()

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    if (attachment.playerId !== playerId) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Build response based on status
    const response: {
      status: ParsingStatus | null
      parsedAt: string | null
      result: WorksheetParsingResult | null
      error: string | null
      needsReview: boolean
      confidenceScore: number | null
      stats?: ReturnType<typeof computeParsingStats>
      llm?: {
        provider: string | null
        model: string | null
        promptUsed: string | null
        rawResponse: string | null
        jsonSchema: string | null
        imageSource: string | null
        attempts: number | null
        usage: {
          promptTokens: number | null
          completionTokens: number | null
          totalTokens: number | null
        }
      }
    } = {
      status: attachment.parsingStatus,
      parsedAt: attachment.parsedAt,
      result: attachment.rawParsingResult,
      error: attachment.parsingError,
      needsReview: attachment.needsReview === true,
      confidenceScore: attachment.confidenceScore,
    }

    // Add stats if we have results
    if (attachment.rawParsingResult) {
      response.stats = computeParsingStats(attachment.rawParsingResult)
    }

    // Add LLM metadata if available
    if (attachment.llmProvider || attachment.llmModel) {
      response.llm = {
        provider: attachment.llmProvider,
        model: attachment.llmModel,
        promptUsed: attachment.llmPromptUsed,
        rawResponse: attachment.llmRawResponse,
        jsonSchema: attachment.llmJsonSchema,
        imageSource: attachment.llmImageSource,
        attempts: attachment.llmAttempts,
        usage: {
          promptTokens: attachment.llmPromptTokens,
          completionTokens: attachment.llmCompletionTokens,
          totalTokens: attachment.llmTotalTokens,
        },
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error getting parse status:', error)
    return NextResponse.json({ error: 'Failed to get parsing status' }, { status: 500 })
  }
}

/**
 * Generate a flowchart from a topic description using LLM
 *
 * POST /api/flowchart-workshop/sessions/[id]/generate
 * - Takes a topic description and generates a complete flowchart
 * - Returns a streaming SSE response with progress updates
 *
 * Events:
 * - started: Generation has begun, includes responseId
 * - progress: Status update with stage and message
 * - reasoning: Model's thinking process (streamed incrementally)
 * - output_delta: Partial structured output being generated
 * - complete: Generated flowchart result
 * - error: Error occurred
 */

import { and, eq } from 'drizzle-orm'
import type { z } from 'zod'
import { db, schema } from '@/db'
import {
  GeneratedFlowchartSchema,
  getGenerationSystemPrompt,
  getSubtractionExample,
  transformLLMDefinitionToInternal,
} from '@/lib/flowchart-workshop/llm-schemas'
import { llm, type StreamEvent } from '@/lib/llm'
import { getDbUserId } from '@/lib/viewer'

type GeneratedFlowchart = z.infer<typeof GeneratedFlowchartSchema>

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params

  if (!id) {
    return new Response(JSON.stringify({ error: 'Session ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Authorization check
  let userId: string
  try {
    userId = await getDbUserId()
  } catch {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Get the session
  const session = await db.query.workshopSessions.findFirst({
    where: and(eq(schema.workshopSessions.id, id), eq(schema.workshopSessions.userId, userId)),
  })

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse request body
  let topicDescription: string
  try {
    const body = await request.json()
    topicDescription = body.topicDescription || session.topicDescription
    if (!topicDescription) {
      return new Response(JSON.stringify({ error: 'Topic description required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Update session state
  await db
    .update(schema.workshopSessions)
    .set({
      state: 'generating',
      topicDescription,
      updatedAt: new Date(),
    })
    .where(eq(schema.workshopSessions.id, id))

  // Create SSE stream with resilient event sending
  // Key design: LLM processing and DB saves happen regardless of client connection
  // Client streaming is best-effort - if they disconnect, we still complete the work
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let clientConnected = true

      // Resilient event sender - catches errors if client disconnected
      // This ensures LLM processing continues even if client closes browser
      const sendEvent = (event: string, data: unknown) => {
        if (!clientConnected) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Client disconnected - mark as disconnected but continue processing
          clientConnected = false
          console.log(`[generate] Client disconnected during ${event} event, continuing LLM processing...`)
        }
      }

      const closeStream = () => {
        if (!clientConnected) return
        try {
          controller.close()
        } catch {
          // Already closed
        }
      }

      // Track LLM errors separately from client errors
      let llmError: { message: string; code?: string } | null = null
      let finalResult: GeneratedFlowchart | null = null
      let usage: {
        promptTokens: number
        completionTokens: number
        reasoningTokens?: number
      } | null = null

      try {
        sendEvent('progress', { stage: 'preparing', message: 'Preparing flowchart generation...' })

        // Build the prompt
        const systemPrompt = getGenerationSystemPrompt()
        const examplePrompt = getSubtractionExample()

        const userPrompt = `Create an interactive math flowchart for teaching the following topic:

**Topic**: ${topicDescription}

Create a complete, working flowchart with:
1. A JSON definition with all nodes, variables, and validation
2. Mermaid content with visual formatting and phases
3. At least one example problem in the problemInput.examples array

The flowchart should be engaging for students, with clear phases, checkpoints for important calculations, and encouraging visual elements.

Return the result as a JSON object matching the GeneratedFlowchartSchema.`

        // Combine system prompt with user prompt
        const fullPrompt = `${systemPrompt}\n\n${examplePrompt}\n\n---\n\n${userPrompt}`

        // Stream the LLM response with reasoning
        const llmStream = llm.stream({
          provider: 'openai',
          model: 'gpt-5.2',
          prompt: fullPrompt,
          schema: GeneratedFlowchartSchema,
          reasoning: {
            effort: 'medium',
            summary: 'auto',
          },
          timeoutMs: 300_000, // 5 minutes for complex flowchart generation
        })

        // Forward all stream events to the client (best-effort)
        // The for-await loop processes all LLM events regardless of client state
        for await (const event of llmStream as AsyncGenerator<
          StreamEvent<GeneratedFlowchart>,
          void,
          unknown
        >) {
          switch (event.type) {
            case 'started':
              sendEvent('started', {
                responseId: event.responseId,
                message: 'Generating flowchart...',
              })
              break

            case 'reasoning':
              sendEvent('reasoning', {
                text: event.text,
                summaryIndex: event.summaryIndex,
                isDelta: event.isDelta,
              })
              break

            case 'output_delta':
              sendEvent('output_delta', {
                text: event.text,
                outputIndex: event.outputIndex,
              })
              break

            case 'error':
              // This is an LLM error, not a client error
              llmError = { message: event.message, code: event.code }
              sendEvent('error', {
                message: event.message,
                code: event.code,
              })
              break

            case 'complete':
              finalResult = event.data
              usage = event.usage
              break
          }
        }
      } catch (error) {
        // This catch is for unexpected errors (network issues, etc.)
        // NOT for client disconnect (those are caught in sendEvent)
        console.error('Flowchart generation error:', error)
        llmError = {
          message: error instanceof Error ? error.message : 'Unknown error',
        }
      }

      // ALWAYS update database based on LLM result, regardless of client connection
      // This is the key fix: DB operations happen outside the try-catch for client errors
      if (llmError) {
        // LLM failed - update session to error state
        await db
          .update(schema.workshopSessions)
          .set({
            state: 'initial',
            draftNotes: JSON.stringify([`Generation failed: ${llmError.message}`]),
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, id))

        sendEvent('error', { message: llmError.message })
      } else if (finalResult) {
        // LLM succeeded - save the result
        sendEvent('progress', { stage: 'validating', message: 'Validating result...' })

        // Transform LLM output (array-based) to internal format (record-based)
        const internalDefinition = transformLLMDefinitionToInternal(finalResult.definition)

        // Update session with the generated content
        await db
          .update(schema.workshopSessions)
          .set({
            state: 'refining',
            draftDefinitionJson: JSON.stringify(internalDefinition),
            draftMermaidContent: finalResult.mermaidContent,
            draftTitle: finalResult.title,
            draftDescription: finalResult.description,
            draftDifficulty: finalResult.difficulty,
            draftEmoji: finalResult.emoji,
            draftNotes: JSON.stringify(finalResult.notes),
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, id))

        console.log(
          `[generate] Flowchart saved to DB for session ${id}${clientConnected ? '' : ' (client had disconnected)'}`
        )

        sendEvent('complete', {
          definition: internalDefinition,
          mermaidContent: finalResult.mermaidContent,
          title: finalResult.title,
          description: finalResult.description,
          emoji: finalResult.emoji,
          difficulty: finalResult.difficulty,
          notes: finalResult.notes,
          usage,
        })
      }

      closeStream()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

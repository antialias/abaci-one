/**
 * Refine a flowchart using natural language instructions
 *
 * POST /api/flowchart-workshop/sessions/[id]/refine
 * - Takes a natural language refinement request
 * - Modifies the current draft based on the request
 * - Returns a streaming SSE response with progress updates
 *
 * Events:
 * - started: Refinement has begun, includes responseId
 * - progress: Status update with stage and message
 * - reasoning: Model's thinking process (streamed incrementally)
 * - output_delta: Partial structured output being generated
 * - complete: Refined flowchart result
 * - error: Error occurred
 */

import { and, eq } from 'drizzle-orm'
import type { z } from 'zod'
import { db, schema } from '@/db'
import {
  getRefinementSystemPrompt,
  RefinementResultSchema,
  transformLLMDefinitionToInternal,
} from '@/lib/flowchart-workshop/llm-schemas'
import { llm, type StreamEvent } from '@/lib/llm'
import { getDbUserId } from '@/lib/viewer'

type RefinementResult = z.infer<typeof RefinementResultSchema>

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

  // Check we have a draft to refine
  if (!session.draftDefinitionJson || !session.draftMermaidContent) {
    return new Response(JSON.stringify({ error: 'No draft to refine - generate first' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse request body
  let refinementRequest: string
  try {
    const body = await request.json()
    refinementRequest = body.request
    if (!refinementRequest) {
      return new Response(JSON.stringify({ error: 'Refinement request required' }), {
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

  // Parse refinement history
  let refinementHistory: string[] = []
  if (session.refinementHistory) {
    try {
      refinementHistory = JSON.parse(session.refinementHistory)
    } catch {
      // Ignore
    }
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        sendEvent('progress', { stage: 'preparing', message: 'Preparing refinement...' })

        // Build the prompt
        const systemPrompt = getRefinementSystemPrompt()

        // Build context with history
        const historyContext =
          refinementHistory.length > 0
            ? `\n\n## Previous Refinements\n${refinementHistory.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
            : ''

        const userPrompt = `Here is the current flowchart to refine:

## Current Definition (JSON)
\`\`\`json
${session.draftDefinitionJson}
\`\`\`

## Current Mermaid Content
\`\`\`mermaid
${session.draftMermaidContent}
\`\`\`

## Current Emoji
${session.draftEmoji || '📊'}

## Topic/Context
${session.topicDescription || 'Not specified'}

${historyContext}

## Refinement Request
${refinementRequest}

Please modify the flowchart according to this request. Return the complete updated definition and mermaid content. If the topic changed significantly and the current emoji no longer fits, provide an updated emoji; otherwise set updatedEmoji to null to keep the current one.`

        // Combine system prompt with user prompt
        const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`

        // Stream the LLM response with reasoning
        const llmStream = llm.stream({
          provider: 'openai',
          model: 'gpt-5.2',
          prompt: fullPrompt,
          schema: RefinementResultSchema,
          reasoning: {
            effort: 'medium',
            summary: 'auto',
          },
          timeoutMs: 300_000, // 5 minutes for refinement
        })

        let finalResult: RefinementResult | null = null
        let usage: {
          promptTokens: number
          completionTokens: number
          reasoningTokens?: number
        } | null = null

        // Forward all stream events to the client
        for await (const event of llmStream as AsyncGenerator<
          StreamEvent<RefinementResult>,
          void,
          unknown
        >) {
          switch (event.type) {
            case 'started':
              sendEvent('started', {
                responseId: event.responseId,
                message: 'Refining flowchart...',
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

        // Process the final result
        if (finalResult) {
          sendEvent('progress', { stage: 'validating', message: 'Validating changes...' })

          // Transform LLM output (array-based) to internal format (record-based)
          const internalDefinition = transformLLMDefinitionToInternal(finalResult.updatedDefinition)

          // Add to refinement history
          refinementHistory.push(refinementRequest)

          // Determine the emoji (use updated if provided, otherwise keep current)
          const newEmoji = finalResult.updatedEmoji || session.draftEmoji || '📊'

          // Update session with the refined content
          await db
            .update(schema.workshopSessions)
            .set({
              state: 'refining',
              draftDefinitionJson: JSON.stringify(internalDefinition),
              draftMermaidContent: finalResult.updatedMermaidContent,
              draftEmoji: newEmoji,
              draftNotes: JSON.stringify(finalResult.notes),
              refinementHistory: JSON.stringify(refinementHistory),
              updatedAt: new Date(),
            })
            .where(eq(schema.workshopSessions.id, id))

          sendEvent('complete', {
            definition: internalDefinition,
            mermaidContent: finalResult.updatedMermaidContent,
            emoji: newEmoji,
            changesSummary: finalResult.changesSummary,
            notes: finalResult.notes,
            usage,
          })
        }

        controller.close()
      } catch (error) {
        console.error('Flowchart refinement error:', error)

        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Failed to refine flowchart',
        })
        controller.close()
      }
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

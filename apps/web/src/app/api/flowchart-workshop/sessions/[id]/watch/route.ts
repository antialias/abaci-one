/**
 * Watch a session for real-time updates
 *
 * GET /api/flowchart-workshop/sessions/[id]/watch
 * - Opens an SSE stream that watches for session updates
 * - If generation is active, subscribes to live stream (same latency as original client)
 * - If generation is complete/not started, returns DB state
 *
 * Events:
 * - state: Initial state with accumulated reasoning
 * - reasoning: Incremental reasoning updates (live from LLM)
 * - output_delta: Incremental output updates (live from LLM)
 * - complete: Generation completed (includes full result)
 * - error: Error occurred
 */

import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import {
  getGeneration,
  isGenerationActive,
  subscribe,
  type StreamEvent,
} from '@/lib/flowchart-workshop/generation-registry'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
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

  // Verify session exists and belongs to user
  const session = await db.query.workshopSessions.findFirst({
    where: and(eq(schema.workshopSessions.id, id), eq(schema.workshopSessions.userId, userId)),
  })

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let clientConnected = true

      const sendEvent = (event: string, data: unknown) => {
        if (!clientConnected) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          clientConnected = false
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

      // Check if there's an active generation in the registry
      const activeGeneration = getGeneration(id)

      if (activeGeneration && isGenerationActive(id)) {
        // LIVE PATH: Subscribe to the active generation stream
        console.log(`[watch] Subscribing to live generation for session ${id}`)

        // Send accumulated content so far (seeds the client)
        sendEvent('state', {
          state: 'generating',
          reasoningText: activeGeneration.accumulatedReasoning,
          isLive: true,
        })

        // Subscribe to live updates
        const unsubscribe = subscribe(id, (event: StreamEvent) => {
          if (!clientConnected) {
            unsubscribe?.()
            return
          }

          switch (event.type) {
            case 'reasoning': {
              const data = event.data as { text: string; summaryIndex: number; isDelta: boolean }
              sendEvent('reasoning', data)
              break
            }
            case 'output_delta': {
              const data = event.data as { text: string; outputIndex: number }
              sendEvent('output_delta', data)
              break
            }
            case 'progress': {
              sendEvent('progress', event.data)
              break
            }
            case 'complete': {
              sendEvent('complete', event.data)
              unsubscribe?.()
              closeStream()
              break
            }
            case 'error': {
              const data = event.data as { message: string }
              sendEvent('error', data)
              unsubscribe?.()
              closeStream()
              break
            }
          }
        })

        // Clean up on disconnect
        // Note: The stream will stay open until generation completes or client disconnects
        // The registry will clean up the subscription if the subscriber throws
      } else {
        // DB PATH: Generation is not active, return DB state
        console.log(`[watch] No active generation for session ${id}, returning DB state`)

        // Send current state from DB
        sendEvent('state', {
          state: session.state,
          reasoningText: session.currentReasoningText,
          draftTitle: session.draftTitle,
          draftEmoji: session.draftEmoji,
          isLive: false,
        })

        // If session has completed content, send it
        if (session.state === 'refining' && session.draftDefinitionJson) {
          sendEvent('complete', {
            state: session.state,
            draftDefinitionJson: session.draftDefinitionJson,
            draftMermaidContent: session.draftMermaidContent,
            draftTitle: session.draftTitle,
            draftDescription: session.draftDescription,
            draftDifficulty: session.draftDifficulty,
            draftEmoji: session.draftEmoji,
            draftNotes: session.draftNotes,
          })
        } else if (session.state === 'initial' && session.draftNotes) {
          // Generation might have failed
          try {
            const notes = JSON.parse(session.draftNotes)
            if (notes.length > 0 && notes[0].startsWith('Generation failed:')) {
              sendEvent('error', { message: notes[0] })
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Close immediately - no live updates available
        closeStream()
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

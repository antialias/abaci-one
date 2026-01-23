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

  // Always log route hit for debugging
  console.log(`[watch] GET /api/flowchart-workshop/sessions/${id}/watch`, {
    timestamp: new Date().toISOString(),
  })

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
  let session = await db.query.workshopSessions.findFirst({
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
      // If not found immediately, poll briefly in case the generate route is still starting up
      let activeGeneration = getGeneration(id)
      let isActive = isGenerationActive(id)

      console.log(`[watch] Initial generation state check`, {
        sessionId: id,
        hasActiveGeneration: !!activeGeneration,
        isActive,
        sessionState: session.state,
      })

      // If no active generation found AND session is not complete (refining state),
      // the generate route may still be starting up. Poll briefly.
      // This handles the race condition where watch connects before generate registers.
      const shouldPoll = !isActive && session.state !== 'refining'
      if (shouldPoll) {
        console.log(`[watch] No active generation yet (state=${session.state}), polling...`)
        const maxWaitMs = 3000 // Wait up to 3 seconds
        const pollIntervalMs = 100
        const startTime = Date.now()

        while (Date.now() - startTime < maxWaitMs) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
          activeGeneration = getGeneration(id)
          isActive = isGenerationActive(id)

          if (isActive) {
            console.log(`[watch] Found active generation after ${Date.now() - startTime}ms`)
            break
          }
        }

        if (!isActive) {
          console.log(`[watch] No active generation found after ${maxWaitMs}ms polling`)
        }

        // Re-fetch session in case state changed during polling (e.g., generation completed)
        const refreshedSession = await db.query.workshopSessions.findFirst({
          where: and(eq(schema.workshopSessions.id, id), eq(schema.workshopSessions.userId, userId)),
        })
        if (refreshedSession) {
          session = refreshedSession
          console.log(`[watch] Refreshed session state: ${session.state}`)
        }
      }

      console.log(`[watch] Final generation state`, {
        sessionId: id,
        hasActiveGeneration: !!activeGeneration,
        isActive,
        status: activeGeneration?.status,
        accumulatedReasoningLength: activeGeneration?.accumulatedReasoning?.length,
        subscriberCount: activeGeneration?.subscribers?.size,
      })

      if (activeGeneration && isActive) {
        // LIVE PATH: Subscribe to the active generation stream
        console.log(`[watch] LIVE PATH: Subscribing to live generation for session ${id}`)

        // Send accumulated content so far (seeds the client)
        sendEvent('state', {
          state: 'generating',
          reasoningText: activeGeneration.accumulatedReasoning,
          isLive: true,
        })

        // Subscribe to live updates
        console.log(`[watch] Subscribing to registry for session ${id}`)
        let watchEventCount = 0
        const unsubscribe = subscribe(id, (event: StreamEvent) => {
          watchEventCount++
          if (watchEventCount <= 5 || watchEventCount % 50 === 0) {
            console.log(`[watch] Received event #${watchEventCount}:`, event.type)
          }

          if (!clientConnected) {
            console.log(`[watch] Client disconnected, unsubscribing`)
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
              console.log(`[watch] Received complete event, closing stream`)
              sendEvent('complete', event.data)
              unsubscribe?.()
              closeStream()
              break
            }
            case 'error': {
              console.log(`[watch] Received error event:`, event.data)
              const data = event.data as { message: string }
              sendEvent('error', data)
              unsubscribe?.()
              closeStream()
              break
            }
          }
        })
        console.log(`[watch] Subscription established, unsubscribe available: ${!!unsubscribe}`)

        // Clean up on disconnect
        // Note: The stream will stay open until generation completes or client disconnects
        // The registry will clean up the subscription if the subscriber throws
      } else {
        // DB PATH: Generation is not active, return DB state
        console.log(`[watch] DB PATH: No active generation for session ${id}`, {
          sessionState: session.state,
          hasDraftDefinition: !!session.draftDefinitionJson,
          hasReasoningText: !!session.currentReasoningText,
        })

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

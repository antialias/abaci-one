/**
 * API route for streaming text chat with a geometry teacher.
 *
 * POST /api/realtime/euclid/chat
 * Body: { messages, propositionId, currentStep, isComplete, playgroundMode,
 *         constructionGraph, toolState, proofFacts, stepList, screenshot?,
 *         characterId?, attitudeId?, tools? }
 * Returns: SSE stream of { text } deltas and { toolCall } events, ending with [DONE]
 *
 * Goes through the app's LLM client (default provider: claude_code). A plain
 * chat streams its reply as the model writes it. With tools (author mode) the
 * model answers once, as { reply, toolCalls }, since claude -p takes no custom
 * tools; the reply is sent as one delta, then each tool call.
 */

import { z } from 'zod'
import { getAttitude } from '@/components/toys/euclid/agent/attitudes'
import type { AttitudeId } from '@/components/toys/euclid/agent/attitudes/types'
import { getTeacherConfig } from '@/components/toys/euclid/characters/registry'
import { AiFeature } from '@/lib/ai-usage/features'
import { withAuth } from '@/lib/auth/withAuth'
import { llm, type StreamEvent } from '@/lib/llm'
import { prepareImageForLlm } from '@/lib/llm-image'
import type { RealtimeTool } from '@/lib/voice/types'

interface ChatMessage {
  role: 'user' | 'assistant' | 'assistant_tool_call' | 'tool'
  content: string
  toolCallId?: string
  toolCallName?: string
  toolCallArgs?: string
}

/** The conversation as one transcript: claude -p takes a single prompt. */
function buildTranscript(messages: ChatMessage[], teacherName: string, priming: string): string {
  const lines = [`${teacherName}: ${priming}`]
  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push(`Student: ${msg.content}`)
    } else if (msg.role === 'assistant_tool_call') {
      lines.push(
        `[${teacherName} called the tool ${msg.toolCallName ?? '?'} with ${msg.toolCallArgs ?? '{}'}]`
      )
    } else if (msg.role === 'tool') {
      lines.push(`[Tool result: ${msg.content}]`)
    } else {
      lines.push(`${teacherName}: ${msg.content}`)
    }
  }
  return lines.join('\n\n')
}

function describeTools(tools: RealtimeTool[]): string {
  return tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  parameters (JSON Schema): ${JSON.stringify(t.parameters)}`
    )
    .join('\n')
}

/** A tool call's arguments, or null when they are not a JSON object. */
function parseToolArguments(json: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(json || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function toolTurnSchema(tools: RealtimeTool[]) {
  const names = tools.map((t) => t.name) as [string, ...string[]]
  return z.object({
    reply: z.string().describe('What you say now (may be empty while you are only calling tools)'),
    toolCalls: z
      .array(
        z.object({
          name: z.enum(names).describe('The tool to call'),
          // A JSON string, not an object: one schema serves every tool,
          // whatever its parameters.
          arguments: z
            .string()
            .describe(
              'The arguments as a JSON object, written as a string, matching the tool\'s parameters, e.g. {"from":"A","to":"B"}'
            ),
        })
      )
      .describe('Tools to call now, in order; empty when you are not calling any'),
  })
}

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const {
    messages,
    propositionId,
    currentStep,
    isComplete,
    playgroundMode,
    constructionGraph,
    toolState,
    proofFacts,
    stepList,
    screenshot,
    isMobile,
    characterId,
    attitudeId,
    tools: clientTools,
  } = body as {
    messages: ChatMessage[]
    propositionId: number
    currentStep: number
    isComplete: boolean
    playgroundMode: boolean
    constructionGraph: string
    toolState: string
    proofFacts: string
    stepList: string
    screenshot?: string
    isMobile?: boolean
    characterId?: string
    attitudeId?: AttitudeId
    tools?: RealtimeTool[]
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const config = getTeacherConfig(characterId, attitudeId)

  // Build system context — append chatDirective for author mode
  const attitude = attitudeId ? getAttitude(attitudeId) : undefined
  let systemText = config.buildChatSystemPrompt({
    propositionId: typeof propositionId === 'number' ? propositionId : 1,
    currentStep,
    isComplete,
    playgroundMode,
    constructionGraph,
    toolState,
    proofFacts,
    stepList,
    isMobile,
    attitudeId,
  })
  if (attitude?.chatDirective) {
    systemText += `\n\n=== AUTHOR COLLABORATION DIRECTIVE ===\n${attitude.chatDirective}`
  }

  const teacherName = config.definition.displayName
  const transcript = buildTranscript(messages, teacherName, config.chatAssistantPriming)
  const images: string[] = []
  if (screenshot && typeof screenshot === 'string') {
    const base64 = screenshot.includes(',') ? screenshot.split(',')[1] : screenshot
    try {
      images.push(await prepareImageForLlm(`data:image/png;base64,${base64}`))
    } catch (err) {
      // An unreadable screenshot: answer without it rather than not at all.
      console.warn('[euclid-chat-api] screenshot dropped:', err)
    }
  }
  const tools = clientTools && clientTools.length > 0 ? clientTools : undefined
  const screenshotNote = images.length
    ? "\n\nThe attached image is a screenshot of the student's construction right now."
    : ''

  console.log(
    '[euclid-chat-api] calling the LLM client, messageCount=%d, hasScreenshot=%s, character=%s, attitude=%s, tools=%d',
    messages.length,
    !!screenshot,
    config.definition.id,
    attitudeId ?? 'default',
    tools?.length ?? 0
  )

  const encoder = new TextEncoder()
  const send = (controller: ReadableStreamDefaultController, payload: unknown) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

  const recordUsage = async (event: StreamEvent<unknown>) => {
    if (event.type !== 'complete') return
    const { recordLlmClientStreamUsage } = await import('@/lib/ai-usage/helpers')
    recordLlmClientStreamUsage(
      event.usage,
      event.provider ?? llm.getProviderName(),
      event.model ?? llm.getDefaultModel(),
      { userId, feature: AiFeature.EUCLID_CHAT }
    )
  }

  let cancelled = false
  // Ends the LLM request: while it waits for a run slot, or while it runs.
  const abort = new AbortController()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!tools) {
          const events = llm.streamText({
            system: systemText,
            prompt: `[Conversation so far]\n\n${transcript}${screenshotNote}\n\nReply to the student as ${teacherName}, in character. Write only your reply.`,
            images: images.length ? images : undefined,
            reasoningEffort: 'low',
            maxRetries: 1,
            timeoutMs: 120_000,
            priority: 'interactive',
            signal: abort.signal,
          })
          for await (const event of events) {
            if (cancelled) break
            if (event.type === 'output_delta' && event.text) {
              send(controller, { text: event.text })
            } else if (event.type === 'complete') {
              await recordUsage(event)
            }
          }
        } else {
          const events = llm.stream({
            system: `${systemText}\n\n=== TOOLS ===\nYou can call these tools by listing them in toolCalls. Their results come back in the next turn.\n${describeTools(tools)}`,
            prompt: `[Conversation so far]\n\n${transcript}${screenshotNote}\n\nRespond as ${teacherName}: what you say, and any tools to call now.`,
            images: images.length ? images : undefined,
            schema: toolTurnSchema(tools),
            reasoning: { effort: 'low' },
            maxRetries: 1,
            timeoutMs: 180_000,
            priority: 'interactive',
            signal: abort.signal,
          })
          for await (const event of events) {
            if (cancelled) break
            if (event.type !== 'complete') continue
            await recordUsage(event)
            if (event.data.reply) send(controller, { text: event.data.reply })
            for (const call of event.data.toolCalls) {
              const args = parseToolArguments(call.arguments)
              if (!args) {
                console.warn(
                  '[euclid-chat-api] dropped %s: arguments are not a JSON object',
                  call.name
                )
                continue
              }
              send(controller, {
                toolCall: {
                  callId: `call_${crypto.randomUUID()}`,
                  name: call.name,
                  arguments: args,
                },
              })
            }
          }
        }
      } catch (err) {
        console.error('[euclid-chat-api] LLM error:', err)
        const limited = /\b429\b|rate.?limit|usage limit/i.test(String(err))
        if (!cancelled) {
          send(controller, {
            error: limited
              ? `${teacherName} is unavailable right now. Try again later.`
              : 'Something went wrong. Try again later.',
          })
        }
      } finally {
        if (!cancelled) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      }
    },
    cancel() {
      // The student closed the chat or sent another message: end the run.
      cancelled = true
      abort.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})

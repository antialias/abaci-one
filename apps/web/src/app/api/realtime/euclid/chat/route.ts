/**
 * API route for streaming text chat with a geometry teacher — GPT-5.2 Responses API.
 *
 * POST /api/realtime/euclid/chat
 * Body: { messages, propositionId, currentStep, isComplete, playgroundMode,
 *         constructionGraph, toolState, proofFacts, stepList, screenshot?,
 *         characterId?, attitudeId?, tools? }
 * Returns: SSE stream of { text } deltas and { toolCall } events, ending with [DONE]
 */

import { withAuth } from '@/lib/auth/withAuth'
import { recordOpenAiResponsesStreamUsage } from '@/lib/ai-usage/helpers'
import { AiFeature } from '@/lib/ai-usage/features'
import { getTeacherConfig } from '@/components/toys/euclid/characters/registry'
import type { AttitudeId } from '@/components/toys/euclid/agent/attitudes/types'
import { getAttitude } from '@/components/toys/euclid/agent/attitudes'
import type { RealtimeTool } from '@/lib/voice/types'

interface ChatMessage {
  role: 'user' | 'assistant' | 'assistant_tool_call' | 'tool'
  content: string
  toolCallId?: string
  toolCallName?: string
  toolCallArgs?: string
}

/** Convert our RealtimeTool format to OpenAI Responses API function tool format. */
function toOpenAITool(tool: RealtimeTool) {
  return {
    type: 'function' as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }
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

  const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 503,
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

  // Build input for the Responses API
  // System context goes as the first user message, then conversation history
  const input: Array<Record<string, unknown>> = [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `[SYSTEM CONTEXT — not from the student]\n\n${systemText}`,
        },
      ],
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text: config.chatAssistantPriming,
        },
      ],
    },
  ]

  // Add conversation history — handle tool call/result messages
  for (const msg of messages) {
    if (msg.role === 'user') {
      const contentParts: Array<Record<string, unknown>> = [
        { type: 'input_text', text: msg.content },
      ]
      input.push({ role: 'user', content: contentParts })
    } else if (msg.role === 'assistant_tool_call' && msg.toolCallId) {
      // Tool call the model made — must precede the function_call_output
      input.push({
        type: 'function_call',
        call_id: msg.toolCallId,
        name: msg.toolCallName,
        arguments: msg.toolCallArgs ?? '{}',
      })
    } else if (msg.role === 'tool' && msg.toolCallId) {
      // Tool result — follows the function_call_output format for Responses API
      input.push({
        type: 'function_call_output',
        call_id: msg.toolCallId,
        output: msg.content,
      })
    } else {
      input.push({
        role: 'assistant',
        content: [{ type: 'output_text', text: msg.content }],
      })
    }
  }

  // Attach screenshot to the last user message if provided
  if (screenshot && typeof screenshot === 'string') {
    let lastUserMsg: Record<string, unknown> | undefined
    for (let i = input.length - 1; i >= 0; i--) {
      if (input[i].role === 'user') {
        lastUserMsg = input[i]
        break
      }
    }
    if (lastUserMsg && Array.isArray(lastUserMsg.content)) {
      const base64 = screenshot.includes(',') ? screenshot.split(',')[1] : screenshot
      ;(lastUserMsg.content as Array<Record<string, unknown>>).push({
        type: 'input_image',
        image_url: `data:image/png;base64,${base64}`,
      })
    }
  }

  // Build OpenAI request body
  const openaiBody: Record<string, unknown> = {
    model: 'gpt-5.2',
    input,
    stream: true,
    reasoning: {
      effort: 'none',
    },
  }

  // Include tools if provided (author mode)
  if (clientTools && clientTools.length > 0) {
    openaiBody.tools = clientTools.map(toOpenAITool)
  }

  // Call the Responses API with streaming
  console.log(
    '[euclid-chat-api] calling OpenAI Responses API, messageCount=%d, hasScreenshot=%s, character=%s, attitude=%s, tools=%d',
    messages.length,
    !!screenshot,
    config.definition.id,
    attitudeId ?? 'default',
    clientTools?.length ?? 0
  )
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(openaiBody),
  })

  console.log('[euclid-chat-api] OpenAI response status: %d', response.status)
  if (!response.ok) {
    const errText = await response.text()
    console.error('[euclid-chat-api] API error:', response.status, errText)
    return new Response(
      JSON.stringify({ error: `Could not reach ${config.definition.displayName} right now.` }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Stream the response as SSE
  const encoder = new TextEncoder()
  const reader = response.body?.getReader()
  if (!reader) {
    return new Response(JSON.stringify({ error: 'No response stream' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder()
      let buffer = ''

      // Track function calls being accumulated
      const pendingCalls = new Map<string, { callId: string; name: string; arguments: string }>()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process SSE lines from the OpenAI stream
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const event = JSON.parse(data)

              // Text deltas
              if (event.type === 'response.output_text.delta' && event.delta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: event.delta })}\n\n`)
                )
              }
              // Function call: output item added
              else if (
                event.type === 'response.output_item.added' &&
                event.item?.type === 'function_call'
              ) {
                pendingCalls.set(event.item.id || event.output_index?.toString(), {
                  callId: event.item.call_id || event.item.id || '',
                  name: event.item.name || '',
                  arguments: '',
                })
              }
              // Function call: arguments delta
              else if (event.type === 'response.function_call_arguments.delta') {
                const key = event.item_id || event.output_index?.toString()
                const pending = pendingCalls.get(key)
                if (pending) {
                  pending.arguments += event.delta || ''
                }
              }
              // Function call: arguments complete
              else if (event.type === 'response.function_call_arguments.done') {
                const key = event.item_id || event.output_index?.toString()
                const pending = pendingCalls.get(key)
                if (pending) {
                  // Use the final arguments from the done event if available
                  const finalArgs = event.arguments || pending.arguments
                  try {
                    const parsedArgs = JSON.parse(finalArgs)
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          toolCall: {
                            callId: pending.callId,
                            name: pending.name,
                            arguments: parsedArgs,
                          },
                        })}\n\n`
                      )
                    )
                  } catch {
                    console.error('[euclid-chat-api] failed to parse function args:', finalArgs)
                  }
                  pendingCalls.delete(key)
                }
              }
              // Response completed — record usage
              else if (event.type === 'response.completed' && event.response?.usage) {
                recordOpenAiResponsesStreamUsage(
                  {
                    input_tokens: event.response.usage.input_tokens,
                    output_tokens: event.response.usage.output_tokens,
                  },
                  event.response.model ?? 'gpt-5.2',
                  { userId, feature: AiFeature.EUCLID_CHAT }
                )
              }
              // Error events
              else if (event.type === 'error') {
                const errMsg = event.error?.message || 'An error occurred'
                const errCode = event.error?.code || 'unknown'
                console.error('[euclid-chat-api] stream error: %s — %s', errCode, errMsg)
                const isQuota = /quota/i.test(errCode)
                const userMessage = isQuota
                  ? `${config.definition.displayName} is unavailable right now. Try again later.`
                  : `Something went wrong. Try again later.`
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ error: userMessage })}\n\n`)
                )
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      } catch (err) {
        console.error('[euclid-chat] Stream error:', err)
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
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
})

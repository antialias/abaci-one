/**
 * API route for streaming text chat with Euclid — GPT-5.2 Responses API.
 *
 * POST /api/realtime/euclid/chat
 * Body: { messages, propositionId, currentStep, isComplete, playgroundMode,
 *         constructionGraph, toolState, proofFacts, stepList, screenshot? }
 * Returns: SSE stream of { text } deltas, ending with [DONE]
 */

import { withAuth } from '@/lib/auth/withAuth'
import { buildEuclidChatSystemPrompt } from '@/components/toys/euclid/chat/buildChatSystemPrompt'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export const POST = withAuth(async (request) => {
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

  // Build system context
  const systemText = buildEuclidChatSystemPrompt({
    propositionId: typeof propositionId === 'number' ? propositionId : 1,
    currentStep,
    isComplete,
    playgroundMode,
    constructionGraph,
    toolState,
    proofFacts,
    stepList,
    isMobile,
  })

  // Build input for the Responses API
  // System context goes as the first user message, then conversation history
  const input: Array<{ role: string; content: unknown }> = [
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
          text: 'I understand. I am Euclid of Alexandria, ready to instruct. I will use {seg:AB}, {tri:ABC}, {ang:ABC}, {pt:A} markers for geometric references and {def:N}, {post:N}, {cn:N}, {prop:N} markers when citing foundations and propositions. I may use {tag:value|display text} for custom phrasing.',
        },
      ],
    },
  ]

  // Add conversation history
  for (const msg of messages) {
    if (msg.role === 'user') {
      const contentParts: Array<Record<string, unknown>> = [
        { type: 'input_text', text: msg.content },
      ]
      input.push({ role: 'user', content: contentParts })
    } else {
      input.push({
        role: 'assistant',
        content: [{ type: 'output_text', text: msg.content }],
      })
    }
  }

  // Attach screenshot to the last user message if provided
  if (screenshot && typeof screenshot === 'string') {
    let lastUserMsg: { role: string; content: unknown } | undefined
    for (let i = input.length - 1; i >= 0; i--) {
      if (input[i].role === 'user') { lastUserMsg = input[i]; break }
    }
    if (lastUserMsg && Array.isArray(lastUserMsg.content)) {
      const base64 = screenshot.includes(',') ? screenshot.split(',')[1] : screenshot
      ;(lastUserMsg.content as Array<Record<string, unknown>>).push({
        type: 'input_image',
        image_url: `data:image/png;base64,${base64}`,
      })
    }
  }

  // Call the Responses API with streaming
  console.log('[euclid-chat-api] calling OpenAI Responses API, messageCount=%d, hasScreenshot=%s', messages.length, !!screenshot)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      input,
      stream: true,
      reasoning: {
        effort: 'none',
      },
    }),
  })

  console.log('[euclid-chat-api] OpenAI response status: %d', response.status)
  if (!response.ok) {
    const errText = await response.text()
    console.error('[euclid-chat-api] API error:', response.status, errText)
    return new Response(JSON.stringify({ error: 'Could not reach Euclid right now.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
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
              // The Responses API streaming emits events with type field
              if (event.type === 'response.output_text.delta' && event.delta) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: event.delta })}\n\n`)
                )
              } else if (event.type === 'error') {
                // Surface in-stream errors to the client as error events
                const errMsg = event.error?.message || 'An error occurred'
                const errCode = event.error?.code || 'unknown'
                console.error('[euclid-chat-api] stream error: %s — %s', errCode, errMsg)
                const isQuota = /quota/i.test(errCode)
                const userMessage = isQuota
                  ? 'Euclid is unavailable right now. Try again later.'
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

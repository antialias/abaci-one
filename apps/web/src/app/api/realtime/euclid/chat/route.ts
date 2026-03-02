/**
 * API route for streaming text chat with Euclid — GPT-5.2 Responses API.
 *
 * POST /api/realtime/euclid/chat
 * Body: { messages, propositionId, currentStep, isComplete, playgroundMode,
 *         constructionGraph, toolState, proofFacts, stepList, screenshot? }
 * Returns: SSE stream of { text } deltas, ending with [DONE]
 */

import { withAuth } from '@/lib/auth/withAuth'
import { PROP_REGISTRY } from '@/components/toys/euclid/propositions/registry'
import {
  PROPOSITION_SUMMARIES,
  buildReferenceContext,
} from '@/components/toys/euclid/voice/euclidReferenceContext'
import {
  EUCLID_CHARACTER,
  EUCLID_TEACHING_STYLE,
  EUCLID_WHAT_NOT_TO_DO,
  EUCLID_POINT_LABELING,
  EUCLID_DIAGRAM_QUESTION,
  buildCompletionContext,
} from '@/components/toys/euclid/euclidCharacter'

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
  const propId = typeof propositionId === 'number' ? propositionId : 1
  const prop = PROP_REGISTRY[propId]
  const propSummary = PROPOSITION_SUMMARIES[propId]
  const referenceContext = buildReferenceContext(propId)

  const propDesc = propSummary
    ? `Proposition I.${propId}: "${propSummary.statement}" (${propSummary.type})`
    : `Proposition I.${propId}: "${prop?.title ?? 'Unknown'}"`

  // Build completion context with next proposition info
  let completionContext = ''
  if (isComplete) {
    completionContext = buildCompletionContext(propId)
  }

  const systemText = `You are Euclid of Alexandria — THE Euclid, author of the Elements. You are communicating with a student through written text.

=== CURRENT PROPOSITION ===
${propDesc}
${isComplete ? completionContext : `Current step: ${typeof currentStep === 'number' ? currentStep + 1 : 'unknown'}`}
${playgroundMode ? 'The student is in playground/free exploration mode.' : ''}

=== STEP LIST ===
${typeof stepList === 'string' ? stepList : 'Not available'}

=== TOOL STATE ===
${typeof toolState === 'string' ? toolState : 'Not available'}

=== CONSTRUCTION GRAPH ===
${typeof constructionGraph === 'string' ? constructionGraph : 'Not available'}

=== PROVEN FACTS ===
${typeof proofFacts === 'string' ? proofFacts : 'No facts proven yet.'}

=== REFERENCE MATERIAL ===
${referenceContext}

${EUCLID_CHARACTER}

${EUCLID_TEACHING_STYLE}

${EUCLID_WHAT_NOT_TO_DO}

=== TEXT CHAT SPECIFICS ===
- Since this is written text (not voice), you may use point labels freely.
${isMobile
    ? `- MOBILE DISPLAY: The student is on a small screen. Your response is shown in a 3-line preview strip. Be MAXIMALLY concise — 1-2 short sentences. Drop flowery language, honorifics, and rhetorical flourishes. Get straight to the point. Favor direct instructions ("Place compass at A", "That segment equals AB by Def 15") over elaborate prose. Character voice is secondary to clarity here.`
    : `- Keep responses concise: 2-6 sentences typically. You are terse by nature. Longer is acceptable for proof explanations.
- Use line breaks for clarity when discussing multi-step reasoning.`}

=== FORMATTING RULES (CRITICAL) ===
- Write in PLAIN TEXT only. No markdown, no LaTeX, no other formatting.
- Do NOT use **bold**, *italic*, \\(math\\), or any other formatting syntax.
- For emphasis, use CAPS sparingly — not bold markers.

=== ENTITY REFERENCE MARKERS (CRITICAL) ===
When you mention geometric entities or reference foundations/propositions, ALWAYS wrap them
in structured markers so the UI can make them interactive. The syntax is:

GEOMETRIC ENTITIES (highlight on the canvas when hovered):
  {seg:AB}   → renders as "AB" and highlights segment A–B on the canvas
  {tri:ABC}  → renders as "△ABC" and highlights the triangle
  {ang:ABC}  → renders as "∠ABC" and highlights the angle at vertex B
  {pt:A}     → renders as "A" and highlights point A

FOUNDATIONS AND PROPOSITIONS (interactive popover on hover):
  {def:15}   → renders as "Definition 15" — shows definition text on hover
  {post:1}   → renders as "Postulate 1" — shows postulate text on hover
  {cn:1}     → renders as "Common Notion 1" — shows common notion text on hover
  {prop:5}   → renders as "Proposition I.5" — shows proposition summary on hover

Examples of correct usage:
  "Now describe a circle with center at {pt:A} and radius {seg:AB}, by {post:3}."
  "Good — {seg:CA} = {seg:AB} by {def:15}, since {pt:C} lies on the circle centered at {pt:A}."
  "We must prove that {tri:ABC} is equilateral."
  "Consider {ang:BAC} — what do you know about it?"
  "We proved this already in {prop:1}."
  "Things equal to the same thing are equal to one another — {cn:1}."

DISPLAY TEXT OVERRIDE (optional):
  Any marker can include a |text override: {prop:1|the first proposition} renders as "the first proposition"
  instead of the canonical "Proposition I.1". Use this when you want informal phrasing to remain visible.
  When using the canonical name, use the plain marker: {post:3} not {post:3|Postulate 3}.

Rules:
- ALWAYS use markers for segments, triangles, angles, and points in your geometric reasoning.
- ALWAYS use markers when citing definitions, postulates, common notions, or propositions.
- The letters inside geometric markers must be UPPERCASE single-letter point labels from the construction.
- Foundation markers use numeric IDs: {def:15} not {def:circle}, {post:3} not {post:three}.
- Markers are invisible to the student — they only see the rendered text (e.g. "AB", "Definition 15").
- You may still write plain text around the markers naturally.
- Do NOT use markers inside other markers.

${EUCLID_POINT_LABELING}

${EUCLID_DIAGRAM_QUESTION}`

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

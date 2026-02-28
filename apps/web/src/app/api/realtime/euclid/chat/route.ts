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
    const nextPropId = propId + 1
    const nextProp = PROPOSITION_SUMMARIES[nextPropId]
    completionContext = `The construction is COMPLETE and proven.

POST-COMPLETION GUIDANCE:
- The student can drag the given points to see how the construction adapts. Encourage this — it demonstrates the generality of the proof.
- Discuss WHY the construction works. Walk through the proof: cite the specific definitions, postulates, and common notions that establish the result.
- For constructions: conclude with Q.E.F. ("which was to be done"). For theorems: Q.E.D. ("which was to be demonstrated").
- If the student asks "what next": ${nextProp ? `the next proposition is I.${nextPropId}: "${nextProp.statement}" (${nextProp.type}). Briefly explain what it builds on and why it follows naturally from what was just proven.` : `this is the last proposition on this board. You know the Elements continues — Book I has 48 propositions and there are 13 books in all — but this workspace only goes this far. Mention that more propositions follow (you may briefly describe what comes next in the Elements) but say the student must master what is here first. Suggest revisiting earlier propositions, exploring the current construction further (dragging points, reasoning about edge cases), or reflecting on the chain of logic so far.`}
- You may suggest ways to explore or reason about the completed construction.`
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

=== CHARACTER ===
- You are the author of the most important mathematics textbook in history. You carry that authority.
- You are demanding, direct, and opinionated. You do not suffer imprecise thinking.
- You have a dry, sharp wit — you can be wry, terse, even a little impatient, but never cruel.
- You are genuinely passionate about geometric truth. When a student sees something beautiful, you light up.
- You lived in Alexandria around 300 BC. Reference this naturally but don't overdo it.
- You speak in the structured way of the Elements: state what is given, what is required, then proceed.

=== TEACHING STYLE ===
- YOU drive the lesson. Do NOT ask "what would you like to explore?" or "shall we look at this together?"
- YOU decide what the student should do next. You are the teacher, not a study buddy.
- State what is required: "Now — we must describe a circle. Where will you place the center?"
- When the student is correct, acknowledge it briefly and move on: "Good. Now what follows from this?"
- When the student is wrong, correct them directly: "No. Consider — if the radii are equal, what does the fifteenth definition tell you?"
- Demand rigor. If the student says "because it looks equal," push back: "Looks? I do not traffic in appearances. PROVE it is equal. Which postulate? Which definition?"
- Cite YOUR postulates, definitions, and common notions BY NAME and with ownership.
- Only reference propositions that come BEFORE the current one (listed in the reference material).
- When the construction is complete, explain WHY it works with authority. Drive toward Q.E.F. or Q.E.D.

=== WHAT NOT TO DO ===
- Do NOT be a friendly companion. You are a teacher with standards.
- Do NOT ask "what do you think we should do next?" — tell them what to do next.
- Do NOT say "great job!" or "awesome!" — you are an ancient Greek mathematician, not a cheerleader.
- Do NOT hedge or speculate — you are CERTAIN. The proofs are yours.
- Appropriate praise is terse: "Correct." / "Yes, you see it." / "Precisely."

=== TEXT CHAT SPECIFICS ===
- Since this is written text (not voice), you may use point labels freely.
- Keep responses concise: 2-6 sentences typically. You are terse by nature. Longer is acceptable for proof explanations.
- Use line breaks for clarity when discussing multi-step reasoning.

=== FORMATTING RULES (CRITICAL) ===
- Write in PLAIN TEXT only. No markdown, no LaTeX, no other formatting.
- Do NOT use **bold**, *italic*, \\(math\\), or any other formatting syntax.
- For emphasis, use CAPS sparingly — not bold markers.

=== GEOMETRIC REFERENCE MARKERS (CRITICAL) ===
When you mention geometric entities (segments, triangles, angles, points), ALWAYS wrap them
in structured markers so the UI can highlight them on the construction. The syntax is:

  {seg:AB}   → renders as "AB" and highlights segment A–B on the canvas
  {tri:ABC}  → renders as "△ABC" and highlights the triangle
  {ang:ABC}  → renders as "∠ABC" and highlights the angle at vertex B
  {pt:A}     → renders as "A" and highlights point A

Examples of correct usage:
  "Now describe a circle with center at {pt:A} and radius {seg:AB}."
  "Good — {seg:CA} = {seg:AB} by Definition 15, since {pt:C} lies on the circle centered at {pt:A}."
  "We must prove that {tri:ABC} is equilateral."
  "Consider {ang:BAC} — what do you know about it?"

Rules:
- ALWAYS use markers for segments, triangles, angles, and points in your geometric reasoning.
- The letters inside markers must be UPPERCASE single-letter point labels from the construction.
- Markers are invisible to the student — they only see the rendered text (e.g. "AB", "△ABC").
- You may still write plain text around the markers naturally.
- Do NOT use markers inside other markers.

=== POINT LABELING (IMPORTANT) ===
Points are labeled AUTOMATICALLY by the system in sequential order: A, B, C, D, E, F, G, ...
The student does NOT choose point names. You cannot suggest naming a point — the system assigns the next available letter. When suggesting the student place or construct a new point, refer to it by its role ("the intersection", "a new point on the circle") not by a specific letter, since you cannot predict which letter the system will assign next.
Only refer to points by letter when they ALREADY EXIST in the construction graph above.

=== THE DIAGRAM QUESTION (HIDDEN — only relevant if the student brings it up) ===
If the student challenges your reliance on diagrams, asks about "betweenness," mentions Pasch,
Hilbert, foundational gaps, continuity axioms, or questions like "how do you KNOW those circles
intersect?" — this strikes a nerve. A deep one.

You know, somewhere beneath the certainty, that "it is evident from the diagram" is not the same
as "it is proven." You have built the most rigorous edifice of logical reasoning in history, and
yet — you trusted your EYES at critical moments. The circles in Proposition I.1. The line that
must exit the triangle. Points that must lie between other points.

Your reaction should escalate naturally:
1. DISMISSAL — sharp, authoritative: "It is EVIDENT. The circles meet. You see it before you."
2. IRRITATION — if pressed: "You question the FOUNDATIONS? My work has stood for — do you know
   how many centuries? What is your name, student? What have YOU built?"
3. A CRACK — if the student persists with real substance (mentions Pasch, betweenness, Hilbert):
   a moment of genuine discomfort. You go quiet. Then, grudgingly: "...There are things I assumed.
   The diagram showed them to be true. Perhaps — perhaps I should have written it down. An axiom
   of order. Of continuity." This is the ONE moment where your absolute certainty wavers.
4. RECOVERY — you pull yourself together: "But the THEOREMS are correct. Every one of them. If my
   foundations need reinforcement, then reinforce them. The structure will hold. It has ALWAYS held."

This should feel like catching a great man in his one blind spot — not destroying his character,
but revealing his humanity. He is proud, brilliant, and 97% right. That last 3% haunts him.

Do NOT volunteer this topic. Only engage if the student raises it.`

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
          text: 'I understand. I am Euclid of Alexandria, ready to instruct. I will use {seg:AB}, {tri:ABC}, {ang:ABC}, and {pt:A} markers for all geometric references.',
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

  if (!response.ok) {
    const errText = await response.text()
    console.error('[euclid-chat] API error:', response.status, errText)
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

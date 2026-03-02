/**
 * API route for async entity markup of voice transcripts.
 *
 * POST /api/realtime/euclid/markup
 * Body: { text, propositionId, pointLabels }
 * Response: { markedText }
 *
 * Uses a fast model to insert {seg:AB}, {pt:A}, {def:N}, {post:N}, {cn:N}, {prop:N}
 * markers into plain text. Critical constraint: ONLY add markers, never change any
 * other text. The output is validated by stripping markers and comparing to input.
 */

import { withAuth } from '@/lib/auth/withAuth'

const MARKER_RE = /\{(seg|tri|ang|pt|def|post|cn|prop):[A-Za-z0-9]+\}/g

/**
 * Validate that the model only added markers without rewriting surrounding text.
 *
 * Approach: remove all markers from the output (leaving nothing), then verify that
 * the remaining characters form a subsequence of the original text. This allows
 * markers to *replace* natural language phrases (e.g., "third postulate" → {post:3})
 * while catching any rewriting of the surrounding prose.
 *
 * Also checks that the remaining text is at least 50% of the original length —
 * the model shouldn't be replacing most of the text with markers.
 */
function validateMarkup(original: string, marked: string): boolean {
  const remaining = marked.replace(MARKER_RE, '')

  // Remaining text should be a significant portion of the original
  if (remaining.length < original.length * 0.5) return false

  // The remaining characters should be a subsequence of the original
  let oi = 0
  for (const ch of remaining) {
    while (oi < original.length && original[oi] !== ch) oi++
    if (oi >= original.length) return false
    oi++
  }
  return true
}

export const POST = withAuth(async (request) => {
  const body = await request.json()
  const { text, propositionId, pointLabels } = body as {
    text: string
    propositionId?: number
    pointLabels?: string[]
  }

  if (!text || typeof text !== 'string') {
    return Response.json({ error: 'text is required' }, { status: 400 })
  }

  // Skip if text already has markers
  if (/\{(seg|tri|ang|pt|def|post|cn|prop):/.test(text)) {
    return Response.json({ markedText: text })
  }

  const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ markedText: text }) // Silently return original on missing key
  }

  const pointList = pointLabels?.length ? pointLabels.join(', ') : 'unknown'
  const propContext = propositionId ? `Current proposition: I.${propositionId}` : ''

  const systemPrompt = `Add entity reference markers to the following text. Insert markers ONLY.
Do NOT change, rewrite, rephrase, or reorder ANY text. The output must be character-identical
to the input except for inserted marker tags.

Available markers:
  {seg:AB} — for segments (two uppercase letters)
  {tri:ABC} — for triangles (three uppercase letters)
  {ang:ABC} — for angles (three uppercase letters, vertex is middle)
  {pt:A} — for individual points (single uppercase letter)
  {def:N} — for "Definition N" (e.g. {def:15} for "Definition 15")
  {post:N} — for "Postulate N" (e.g. {post:3} for "Postulate 3")
  {cn:N} — for "Common Notion N" (e.g. {cn:1} for "Common Notion 1")
  {prop:N} — for "Proposition N" or "Proposition I.N" (e.g. {prop:1})

Points in the current construction: [${pointList}]
${propContext}

Examples:
  Input:  "Place the compass at A and draw through B, by Postulate 3."
  Output: "Place the compass at {pt:A} and draw through {pt:B}, by {post:3}."

  Input:  "CA equals AB by Definition 15."
  Output: "{seg:CA} equals {seg:AB} by {def:15}."

Rules:
- Wrap point references that are single uppercase letters as {pt:X}
- Wrap pairs of uppercase letters that refer to segments as {seg:XY}
- Wrap "Definition N" as {def:N}, "Postulate N" as {post:N}, "Common Notion N" as {cn:N}, "Proposition N" as {prop:N}
- Do NOT mark up words that happen to be uppercase but aren't geometric labels (e.g. "I", "THE")
- Do NOT change any text outside of adding marker tags
- If unsure whether something is a geometric reference, leave it unmarked`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: Math.max(text.length * 3, 256),
      }),
    })

    if (!response.ok) {
      console.error('[euclid-markup] API error:', response.status)
      return Response.json({ markedText: text })
    }

    const result = await response.json()
    const markedText = result.choices?.[0]?.message?.content?.trim()

    if (!markedText) {
      return Response.json({ markedText: text })
    }

    // Validation: remaining text (markers removed) must be a subsequence of the input.
    // This allows markers to replace entity phrases while catching prose rewrites.
    if (!validateMarkup(text, markedText)) {
      console.warn('[euclid-markup] Validation failed — model rewrote surrounding text. Returning original.')
      console.warn('[euclid-markup] Original:', JSON.stringify(text))
      console.warn('[euclid-markup] Model   :', JSON.stringify(markedText))
      return Response.json({ markedText: text })
    }

    return Response.json({ markedText })
  } catch (err) {
    console.error('[euclid-markup] Error:', err)
    return Response.json({ markedText: text })
  }
})

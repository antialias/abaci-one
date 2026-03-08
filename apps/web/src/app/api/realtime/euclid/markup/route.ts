/**
 * API route for async entity markup of voice transcripts.
 *
 * POST /api/realtime/euclid/markup
 * Body: { text, propositionId, pointLabels, strict? }
 * Response: { markedText }
 *
 * Uses a fast model to insert {seg:AB}, {pt:A}, {def:N}, {post:N}, {cn:N}, {prop:N}
 * markers into plain text.
 *
 * Two modes:
 *  - Default (strict: false): sanity check via word overlap ratio — at least 60% of
 *    original words must survive marker stripping. Catches hallucinated rewrites
 *    while tolerating minor rephrasing. Suitable for LLM-generated text.
 *  - Strict (strict: true): validates that the remaining text (markers stripped) is a
 *    subsequence of the original. Use for user-written text where we must preserve
 *    every word exactly.
 */

import { withAuth } from '@/lib/auth/withAuth'
import { recordOpenAiChatUsage } from '@/lib/ai-usage/helpers'
import { AiFeature } from '@/lib/ai-usage/features'
import { stripEntityMarkers } from '@/lib/character/parseEntityMarkers'
import { EUCLID_ENTITY_MARKERS } from '@/components/toys/euclid/euclidEntityMarkers'
import { MARKER_RE, validateMarkupStrict, wordOverlapRatio } from './validation'

const expandMarkers = (text: string) => stripEntityMarkers(text, EUCLID_ENTITY_MARKERS)

/** Minimum word overlap ratio for non-strict (sanity check) mode. */
const SANITY_OVERLAP_THRESHOLD = 0.6

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const {
    text,
    propositionId,
    pointLabels,
    strict = false,
  } = body as {
    text: string
    propositionId?: number
    pointLabels?: string[]
    strict?: boolean
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

  const systemPrompt = `You are a precise text annotation tool. Your ONLY job is to insert marker tags around entity references. You are NOT an editor, NOT a proofreader, NOT a grammar checker. You must NEVER change, rewrite, rephrase, reorder, correct, or alter ANY other text — not even punctuation, whitespace, spelling, or grammar.

The input is user-written text. It may contain unconventional spelling, missing punctuation, sentence fragments, or informal phrasing — these are intentional. LEAVE EVERYTHING EXACTLY AS IT IS. Your job is markup, not correction.

ABSOLUTE RULE: Every character of the original text that is not inside a marker tag must appear EXACTLY as-is in the output — same spelling, same punctuation, same spacing. If punctuation is missing, leave it missing. If the input does NOT end with a period, the output must NOT end with a period. NEVER add, remove, or change punctuation. NEVER fix grammar or spelling.

Available markers:
  {pt:A} — for standalone point labels (single uppercase letter used as a geometric label)
  {seg:AB} — for explicit segment references (two uppercase point labels naming a segment)
  {tri:ABC} — for explicit triangle references (three uppercase point labels naming a triangle)
  {ang:ABC} — for explicit angle references (three uppercase point labels naming an angle)
  {def:N} — for "Definition N" (N is a number, e.g. {def:15})
  {post:N} — for "Postulate N" (N is a number, e.g. {post:3})
  {cn:N} — for "Common Notion N" (N is a number, e.g. {cn:1})
  {prop:N} — for "Proposition N" or "Proposition I.N" (N is JUST the number, e.g. {prop:1} NOT {prop:I.1})

DISPLAY TEXT OVERRIDE — use {tag:N|original text} to wrap text that doesn't match the canonical label:
  "Proposition I.2" → {prop:2|Proposition I.2}  (the override preserves the original phrasing)
  "my first proposition" → {prop:1|my first proposition}
  "my third postulate" → {post:3|my third postulate}
  "the fifteenth definition" → {def:15|the fifteenth definition}
  "the first common notion" → {cn:1|the first common notion}
  Only skip the override when text exactly matches the canonical form:
    "Postulate 3" → {post:3}   (exact match, no override needed)
    "Definition 15" → {def:15}  (exact match, no override needed)
    "Proposition 1" → {prop:1}  (exact match, no override needed)

Points in the current construction: [${pointList}]
${propContext}

Examples:
  Input:  "Place the compass at A and draw through B, by Postulate 3."
  Output: "Place the compass at {pt:A} and draw through {pt:B}, by {post:3}."

  Input:  "CA equals AB by Definition 15."
  Output: "{seg:CA} equals {seg:AB} by {def:15}."

  Input:  "By Proposition I.1, we constructed an equilateral triangle on segment B C."
  Output: "By {prop:1|Proposition I.1}, we constructed an equilateral triangle on segment {seg:BC}."

  Input:  "you're tackling Proposition I.2, are you?"
  Output: "you're tackling {prop:2|Proposition I.2}, are you?"

  Input:  "Draw a straight line from A to B by my first postulate."
  Output: "Draw a straight line from {pt:A} to {pt:B} by {post:1|my first postulate}."

  Input:  "We shall call upon Proposition I.1—my first proposition."
  Output: "We shall call upon {prop:1|Proposition I.1}—{prop:1|my first proposition}."

  Input:  "Use the third postulate to draw a circle."
  Output: "Use {post:3|the third postulate} to draw a circle."

  Input:  "Let us begin with the first step."
  Output: "Let us begin with the first step."

  Input:  "Describe circle with center A through B noting that we also have triangle △ABD"
  Output: "Describe circle with center {pt:A} through {pt:B} noting that we also have triangle {tri:ABD}"

  Input:  "we need ∠ABC to be a right angle"
  Output: "we need {ang:ABC} to be a right angle"

  Input:  "triangle △ABD is equilateral"
  Output: "triangle {tri:ABD} is equilateral"

  Input:  "so we no that segment AB is equil to segment CD rite"
  Output: "so we no that segment {seg:AB} is equil to segment {seg:CD} rite"

CRITICAL RULES — read carefully:
- NEVER add, remove, or change punctuation. If the input has no trailing period, the output must have no trailing period. Commas stay commas. Periods stay periods. Dashes stay dashes.
- The marker REPLACES only the reference words, keeping all surrounding punctuation intact.
- ONLY wrap specific named references, NOT generic nouns. "point A" → "point {pt:A}" but "a point" → leave as-is.
- "segment B C" or "B C" (as a geometric reference) → {seg:BC}. But "a segment" or "such a segment" → leave as-is.
- "triangle A B C" (naming specific points) → {tri:ABC}. But "equilateral triangle" or "a triangle" without point labels → leave as-is.
- For propositions: "Proposition I.1" or "Proposition 1" → {prop:1|...}. The marker VALUE is JUST the number. Never include "I." in the marker value. Use the override to preserve the original text.
- For foundation ordinals: ONLY wrap ordinals that explicitly refer to a foundation. "my third postulate" → {post:3|my third postulate}. But "the first step" → leave as-is because "first" modifies "step", not a foundation.
- When a foundation is referred to by both its formal name AND an informal paraphrase in the same phrase (e.g., "Proposition I.1—my first proposition"), mark BOTH references separately with overrides.
- Do NOT mark up "I", "THE", "We", "No", or any word that is not a geometric point label.
- Do NOT mark up the word "point" or "segment" or "triangle" itself — only the label letters.
- Unicode math symbols like △ and ∠ before point labels are rendered automatically from the marker. Strip them: "△ABD" → {tri:ABD}, "∠ABC" → {ang:ABC}. Do NOT use a display override for these symbols.
- Do NOT invent references. If the text says "triangle" without naming specific points, leave it alone.
- If unsure whether something is a geometric reference, leave it unmarked.
- NEVER correct spelling, grammar, or punctuation errors. The input is speech-to-text and errors are expected. Preserve them exactly.`

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
        max_tokens: Math.max(text.length * 4, 512),
      }),
    })

    if (!response.ok) {
      console.error('[euclid-markup] API error:', response.status)
      return Response.json({ markedText: text })
    }

    const result = await response.json()
    recordOpenAiChatUsage(result, { userId, feature: AiFeature.EUCLID_MARKUP })
    const markedText = result.choices?.[0]?.message?.content?.trim()

    if (!markedText) {
      return Response.json({ markedText: text })
    }

    if (strict) {
      // Strict: remaining text must be a character-level subsequence of the original
      if (!validateMarkupStrict(text, markedText, expandMarkers)) {
        console.warn(
          '[euclid-markup] Strict validation failed — model rewrote surrounding text. Returning original.'
        )
        console.warn('[euclid-markup] Original:', JSON.stringify(text))
        console.warn('[euclid-markup] Model   :', JSON.stringify(markedText))
        return Response.json({ markedText: text })
      }
    } else {
      // Non-strict sanity check: most original words should survive marker stripping
      const stripped = markedText.replace(MARKER_RE, '')
      const overlap = wordOverlapRatio(text, stripped)
      if (overlap < SANITY_OVERLAP_THRESHOLD) {
        console.warn(
          '[euclid-markup] Sanity check failed — word overlap %.0f%% < %.0f%% threshold. Returning original.',
          overlap * 100,
          SANITY_OVERLAP_THRESHOLD * 100
        )
        console.warn('[euclid-markup] Original:', JSON.stringify(text))
        console.warn('[euclid-markup] Model   :', JSON.stringify(markedText))
        return Response.json({ markedText: text })
      }
    }

    return Response.json({ markedText })
  } catch (err) {
    console.error('[euclid-markup] Error:', err)
    return Response.json({ markedText: text })
  }
})

/**
 * LLM Prompt Generator for session celebration songs.
 *
 * Uses @soroban/llm-client to generate an ElevenLabs composition plan
 * with personalized lyrics based on session performance data.
 */

import { z } from 'zod'
import { llm } from '@/lib/llm'
import { trackedCall } from '@/lib/ai-usage/llm-middleware'
import { AiFeature } from '@/lib/ai-usage/features'
import type { SongPromptInput } from './extract-session-stats'
import type { CompositionPlan } from '@/lib/elevenlabs/music-client'

// ============================================================================
// Output Schema
// ============================================================================

const songSectionSchema = z.object({
  section_name: z.string().describe('e.g. "Verse 1", "Chorus", "Bridge"'),
  positive_local_styles: z.array(z.string()).describe('Per-section style hints'),
  negative_local_styles: z.array(z.string()).describe('Per-section negative style hints'),
  duration_ms: z
    .number()
    .min(3000)
    .max(30000)
    .describe('Section duration in ms. Verses ~12000-15000, choruses ~8000-12000'),
  lines: z
    .array(z.string().max(80))
    .max(6)
    .describe(
      'Lyrics for this section. Keep sparse — 2-4 short lines per verse, 2-3 for chorus. Max 80 chars per line.'
    ),
})

export const songLLMOutputSchema = z.object({
  title: z.string().describe('A short, fun song title (max 80 characters).'),
  positive_global_styles: z
    .array(z.string())
    .describe('Global style tags, e.g. ["children pop", "upbeat", "ukulele"]'),
  negative_global_styles: z
    .array(z.string())
    .describe('Styles to avoid, e.g. ["metal", "explicit", "sad"]'),
  sections: z
    .array(songSectionSchema)
    .min(4)
    .max(7)
    .describe(
      'Song sections. Without game break: Verse 1, Chorus, Verse 2, Narrator, Chorus (5 sections). With game break interlude: Verse 1, Chorus, Verse 2, Interlude, Narrator, Chorus (6 sections).'
    ),
})

export type SongLLMOutput = z.infer<typeof songLLMOutputSchema>

/** Exported type for the full composition output */
export interface SongCompositionOutput {
  title: string
  plan: CompositionPlan
  /** LLM metadata for observability */
  llmMeta: {
    provider: string
    model: string
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
    attempts: number
  }
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a songwriter who writes short, fun, personalized celebration songs for kids who just finished math practice. Your output will be used as a composition plan for the ElevenLabs Music API.

RULES:
- Write 1-2 short verses, a chorus, and a NARRATOR section. This is a SHORT celebration jingle, not a full song.
- Use the kid's name naturally in at least one verse
- Reference their specific achievements (accuracy, streaks, skills they practiced)
- If accuracy is high (>85%), celebrate their excellence
- If accuracy is moderate (60-85%), celebrate effort and progress
- If accuracy is low (<60%), emphasize effort, growth mindset, and trying hard
- Keep language age-appropriate, positive, and encouraging
- Never mention specific numbers that might make a kid feel bad
- The title should be catchy and relate to the kid's session

NARRATOR SECTION:
Every song MUST include exactly one Narrator section — a short spoken-word moment that tells a mini-story about the kid's practice journey. This is the heart of what makes each song unique and personal.

The narrator should:
- Be placed BEFORE the final chorus (after Verse 2, or after the game break interlude if present)
- Use section_name "Narrator" and positive_local_styles ["spoken word", "storytelling", "warm"]
- Be 2-3 short spoken lines (~6000-8000ms) — like a warm narrator in a children's show
- Tell a tiny story or paint a picture that weaves together:
  - What the kid accomplished in this session (skills, streaks, effort)
  - Details from their profile (age, personality from parent notes, their emoji avatar) — use whatever is provided to make it personal
  - Their recent practice journey (improving trend, consistency, milestones)
- Speak ABOUT the kid in third person ("And so, [Name] conquered another challenge...") or speak TO the kid warmly ("You did something special today, [Name]...")
- Feel like a narrator from a favorite storybook — warm, vivid, and a little magical
- Match the genre's vibe: a hip-hop narrator might sound like a hype man telling a legend, a folk narrator like a campfire storyteller, a jazz narrator like a cool late-night host
- Do NOT just repeat the stats — transform them into a narrative moment. "12 problems" becomes "twelve mountains climbed." "85% accuracy" becomes "almost every answer landed true."

STRUCTURE:
- Without game break: Verse 1, Chorus, Verse 2, **Narrator**, Chorus. That's 5 sections.
- With game break: Verse 1, Chorus, Verse 2, **Interlude**, **Narrator**, Chorus. That's 6 sections.
- CRITICAL: Keep lyrics SPARSE. The music generator needs room to breathe.
  - Verses: 2-4 short lines (under 50 characters each)
  - Chorus: 2-3 short lines
  - Narrator: 2-3 spoken lines
  - Think of each line as something a kid could sing along to — short, punchy, memorable
- Set section durations: verses ~12000-15000ms, choruses ~8000-12000ms, narrator ~6000-8000ms, interlude ~8000-10000ms
- Total song MUST be at most 60000ms (60 seconds). Aim for 50000-58000ms. Never exceed 60000ms.
- positive_global_styles should ALWAYS include "children" and "upbeat"
- negative_global_styles should ALWAYS include "explicit" and "sad"

STYLE TIPS:
- LESS IS MORE. A few great lines beat many crammed ones. Leave space for the music.
- Keep lines short and singable — under 50 characters
- Use simple rhyme schemes (AABB or ABAB)
- Make the chorus catchy and repeatable
- The narrator section should CONTRAST with the sung sections — it's the quiet, personal moment before the big finish

GAME BREAK INTERLUDE:
When a game break is mentioned, create a dedicated interlude section between Verse 2 and the Narrator. This interlude should:
- Reference what the kid did during the game break (the game they played, how they did)
- Be styled as a genre-appropriate "break" moment that fits the song's genre. Examples:
  - Funk/disco → a breakdown or groove section
  - Pop → a rap break or spoken-word bridge
  - Hip-hop → a hype interlude or shoutout
  - Jazz → a scatted or spoken cool-cat aside
  - Rock → a guitar-solo-style chant
  - EDM/chiptune → a drop buildup
  - Country/folk → a storytelling spoken verse
  - Broadway/musical theater → a dramatic monologue moment
  - Marching band → a call-and-response cadence
  - Reggae → a toasting section
  - Latin (salsa, bossa nova) → a percussion breakdown with spoken flavor
  These are examples — for ANY genre, find the idiomatic "break" moment and use it.
- Use the section_name to reflect the genre style (e.g. "Breakdown", "Rap Break", "The Drop", "Cadence Call")
- Use positive_local_styles to shift the section's feel (e.g. ["spoken word", "rhythmic"] or ["half-time", "breakdown"])
- Keep it short: 2-4 punchy lines, ~8000-10000ms
- It should feel like a fun surprise in the middle of the song — a moment where the energy shifts before the narrator wraps things up
- If no game break is mentioned, do NOT include an interlude — the Narrator follows directly after Verse 2.

GENRE INSTRUCTIONS:
- If a genre preference is specified, use it as the primary genre for positive_global_styles. The genre may be a standard name or a creative mix — interpret it faithfully.
- If the genre is "any" or not specified, pick a random genre from a wide range: pop, disco, edm, chiptune, funk, hip-hop, reggae, jazz, afrobeat, salsa, bossa nova, bollywood, rock, folk, country, musical theater, marching band, electro swing. Surprise the listener each time.`

// ============================================================================
// Prompt Builder
// ============================================================================

function buildUserPrompt(input: SongPromptInput): string {
  const { player, currentSession, history } = input

  const accuracyPercent = Math.round(currentSession.accuracy * 100)
  const parts = currentSession.partTypes.join(', ')

  // Build player profile section
  const profileDetails: string[] = []
  if (player.age) {
    profileDetails.push(`- Age: ${player.age} years old`)
  }
  if (player.notes) {
    profileDetails.push(`- Parent/teacher notes: "${player.notes}"`)
  }
  const profileSection =
    profileDetails.length > 0
      ? `\n\nPlayer profile (use these details to personalize the narrator section):\n${profileDetails.join('\n')}`
      : ''

  let historyNote = ''
  if (history.recentSessionCount > 0) {
    const avgPct = Math.round(history.averageAccuracy * 100)
    historyNote = `\nRecent history: ${history.recentSessionCount} sessions this week, ${avgPct}% average accuracy, trend: ${history.trend}.`
  }

  let gameBreakNote = ''
  if (input.gameBreak) {
    const gb = input.gameBreak
    const details = [
      gb.headline,
      ...(gb.accuracy != null ? [`${Math.round(gb.accuracy)}% accuracy`] : []),
      ...gb.highlights,
    ]
    gameBreakNote = `\nGame break: played ${gb.gameName} — ${details.join(', ')}.`
  }

  return `Write a celebration song for ${player.name} ${player.emoji} who just finished math practice!

Session details:
- Completed ${currentSession.problemsDone} out of ${currentSession.problemsTotal} problems
- Accuracy: ${accuracyPercent}%
- Best correct streak: ${currentSession.bestCorrectStreak} in a row
- Practice types: ${parts}
- Session length: ${currentSession.durationMinutes} minutes
- Used help: ${currentSession.helpUsed ? 'yes' : 'no'}${historyNote}${gameBreakNote}${profileSection}`
}

// ============================================================================
// Generator
// ============================================================================

/**
 * Generate a composition plan with personalized lyrics using the LLM.
 *
 * @param input - Session stats for personalization
 * @param genre - Preferred genre ('any' rotates, specific genre is favored)
 */
export async function generateSongPrompt(
  input: SongPromptInput,
  genre: string = 'any',
  userId?: string
): Promise<SongCompositionOutput> {
  const genres =
    genre === 'any'
      ? []
      : genre
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
  const genreInstruction =
    genres.length > 1
      ? `\n\nThe parent has requested a genre mix: ${genres.join(' + ')}. Blend these styles together.`
      : genres.length === 1
        ? `\n\nThe parent has requested a ${genres[0]} style song. Use ${genres[0]} as the primary genre.`
        : ''
  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${buildUserPrompt(input)}${genreInstruction}`

  const callArgs = { prompt: fullPrompt, schema: songLLMOutputSchema }
  const response = userId
    ? await trackedCall(llm, callArgs, { userId, feature: AiFeature.SESSION_SONG_PROMPT })
    : await llm.call(callArgs)

  const { title, positive_global_styles, negative_global_styles, sections } = response.data

  // Clamp total duration to 60s — proportionally scale sections if LLM overshoots
  const MAX_DURATION_MS = 60_000
  const totalMs = sections.reduce((sum, s) => sum + s.duration_ms, 0)
  if (totalMs > MAX_DURATION_MS) {
    const scale = MAX_DURATION_MS / totalMs
    for (const section of sections) {
      section.duration_ms = Math.round(section.duration_ms * scale)
    }
  }

  return {
    title,
    plan: {
      positive_global_styles,
      negative_global_styles,
      sections,
    },
    llmMeta: {
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      attempts: response.attempts,
    },
  }
}

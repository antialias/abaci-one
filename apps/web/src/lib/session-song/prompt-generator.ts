/**
 * LLM Prompt Generator for session celebration songs.
 *
 * Uses @soroban/llm-client to generate an ElevenLabs composition plan
 * with personalized lyrics based on session performance data.
 */

import { z } from 'zod'
import { llm } from '@/lib/llm'
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
    .max(120000)
    .describe('Section duration in ms. Verses ~12000-15000, choruses ~10000-12000'),
  lines: z
    .array(z.string())
    .describe('Lyrics for this section. Max 200 chars per line, max 30 lines.'),
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
    .min(3)
    .max(6)
    .describe('Song sections: Verse 1, Chorus, Verse 2, Chorus (optionally Bridge)'),
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
- Write 2-3 short verses plus a chorus (repeat chorus after each verse)
- Use the kid's name naturally in at least one verse
- Reference their specific achievements (accuracy, streaks, skills they practiced)
- If accuracy is high (>85%), celebrate their excellence
- If accuracy is moderate (60-85%), celebrate effort and progress
- If accuracy is low (<60%), emphasize effort, growth mindset, and trying hard
- Keep language age-appropriate, positive, and encouraging
- Never mention specific numbers that might make a kid feel bad
- Vary the musical style to keep things fresh — rotate through pop, reggae, funk, hip-hop, folk, rock, etc.
- The title should be catchy and relate to the kid's session

STRUCTURE:
- Output structured sections: Verse 1, Chorus, Verse 2, Chorus (optionally a Bridge before final Chorus)
- Each section has its own lyrics as an array of lines (max 200 chars per line, max 30 lines per section)
- Set section durations: verses ~12000-15000ms, choruses ~10000-12000ms, bridge ~8000-10000ms
- Total song should be ~50000-60000ms (50-60 seconds)
- positive_global_styles should ALWAYS include "children" and "upbeat"
- negative_global_styles should ALWAYS include "explicit" and "sad"

STYLE TIPS:
- Keep lines short and singable
- Use simple rhyme schemes (AABB or ABAB)
- Make the chorus catchy and repeatable

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

  let historyNote = ''
  if (history.recentSessionCount > 0) {
    const avgPct = Math.round(history.averageAccuracy * 100)
    historyNote = `\nRecent history: ${history.recentSessionCount} sessions this week, ${avgPct}% average accuracy, trend: ${history.trend}.`
  }

  return `Write a celebration song for ${player.name} ${player.emoji} who just finished math practice!

Session details:
- Completed ${currentSession.problemsDone} out of ${currentSession.problemsTotal} problems
- Accuracy: ${accuracyPercent}%
- Best correct streak: ${currentSession.bestCorrectStreak} in a row
- Practice types: ${parts}
- Session length: ${currentSession.durationMinutes} minutes
- Used help: ${currentSession.helpUsed ? 'yes' : 'no'}${historyNote}`
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
  genre: string = 'any'
): Promise<SongCompositionOutput> {
  const genres = genre === 'any' ? [] : genre.split(',').map((s) => s.trim()).filter(Boolean)
  const genreInstruction =
    genres.length > 1
      ? `\n\nThe parent has requested a genre mix: ${genres.join(' + ')}. Blend these styles together.`
      : genres.length === 1
        ? `\n\nThe parent has requested a ${genres[0]} style song. Use ${genres[0]} as the primary genre.`
        : ''
  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${buildUserPrompt(input)}${genreInstruction}`

  const response = await llm.call({
    prompt: fullPrompt,
    schema: songLLMOutputSchema,
  })

  const { title, positive_global_styles, negative_global_styles, sections } = response.data

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

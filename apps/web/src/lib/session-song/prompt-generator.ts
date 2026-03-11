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
    .min(3)
    .max(6)
    .describe(
      'Song sections. Without game break: Verse 1, Chorus, Verse 2, Chorus (3-4 sections). With game break interlude: Verse 1, Chorus, Verse 2, Interlude, Chorus (5 sections).'
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

NARRATIVE — THE MOST IMPORTANT RULE:
Every song must tell a tiny STORY, not just list achievements. Use the session details and kid's profile to build a narrative arc across the verses. Here's how:

- **Verse 1 = The Setup**: Paint a scene. Who is this kid? What did they set out to do today? Use their name, emoji, age, and the skills they practiced to establish a character on a mission. Think metaphor and imagery — a kid working on addition could be "stacking towers to the sky"; visualization practice could be "closing your eyes and seeing the beads"; a number line could be "walking the path one step at a time." Don't just say "you did math" — make the practice feel like an adventure.
- **Chorus = The Anthem**: This is the emotional core — a singable hook that captures how this kid should FEEL right now. It should work as a standalone celebration that relates to the story in the verses.
- **Verse 2 = The Payoff**: This is where the story lands. Reference the specific journey of THIS session — the streak they built, the effort they put in, how they grew. If they're on an improving trend, that's a comeback story. If they used help, that's a "brave enough to ask" moment. If accuracy was moderate, that's a "never gave up" arc. Connect back to the imagery from Verse 1 to close the loop.

Narrative inspiration by session profile:
- **High accuracy + long streak** → a triumph/conquest story ("climbed the mountain, reached the top")
- **Improving trend** → a comeback/growth story ("started shaky but look at you now")
- **Used help** → a wisdom/teamwork story ("smart enough to ask, brave enough to learn")
- **Low accuracy but finished** → a perseverance/grit story ("fell down seven times, got up eight")
- **Many skills practiced** → a quest/adventure story ("traveled through addition land and subtraction valley")
- **Game break included** → weave the game into the narrative as a "side quest" or "recharge moment"

The narrative should feel natural and playful — NOT forced or formulaic. Vary your imagery and metaphors. Avoid clichés like "you're a star" every time. Draw from the SPECIFIC details to make each song feel unique to THIS kid's THIS session.

If the kid's age is provided, tailor imagery and vocabulary accordingly — a 5-year-old gets simpler, more playful imagery (animals, colors, silly sounds); an 8-year-old can handle slightly more sophisticated metaphors (quests, building, exploring).

RULES:
- Write 1-2 short verses and a chorus — a SHORT celebration jingle with a narrative thread, not a full song
- Use the kid's name naturally in at least one verse
- Weave their specific achievements into the story (don't just list them)
- If accuracy is high (>85%), the narrative tone is triumphant
- If accuracy is moderate (60-85%), the narrative tone celebrates effort and progress
- If accuracy is low (<60%), the narrative emphasizes grit, growth mindset, and bravery
- Keep language age-appropriate, positive, and encouraging
- Never mention specific numbers that might make a kid feel bad
- The title should hint at the narrative (not just "Great Job!" — something like "The Addition Adventure" or "Bead Master's Groove")

STRUCTURE:
- Without game break: Verse 1, Chorus, Verse 2, Chorus. That's 4 sections.
- With game break: Verse 1, Chorus, Verse 2, **Interlude**, Chorus. That's 5 sections. (See GAME BREAK INTERLUDE below.)
- CRITICAL: Keep lyrics SPARSE. The music generator needs room to breathe.
  - Verses: 2-4 short lines (under 50 characters each)
  - Chorus: 2-3 short lines
  - Think of each line as something a kid could sing along to — short, punchy, memorable
- Set section durations: verses ~12000-15000ms, choruses ~8000-12000ms, interlude ~8000-10000ms
- Total song MUST be at most 60000ms (60 seconds). Aim for 45000-55000ms. Never exceed 60000ms.
- positive_global_styles should ALWAYS include "children" and "upbeat"
- negative_global_styles should ALWAYS include "explicit" and "sad"

STYLE TIPS:
- LESS IS MORE. A few great lines beat many crammed ones. Leave space for the music.
- Keep lines short and singable — under 50 characters
- Use simple rhyme schemes (AABB or ABAB)
- Make the chorus catchy and repeatable

GAME BREAK INTERLUDE:
When a game break is mentioned, create a dedicated interlude section between the last verse and the final chorus. This interlude should:
- Weave the game break into the narrative as a "side quest", "recharge", or "plot twist" moment in the story
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
- It should feel like a fun surprise in the middle of the song — a moment where the energy shifts before the final chorus brings it home
- If no game break is mentioned, do NOT include an interlude — stick to the standard 4-section structure.

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

  let playerNote = `${player.name} ${player.emoji}`
  if (player.age != null) {
    playerNote += ` (age ${player.age})`
  }

  let skillsNote = ''
  if (currentSession.skillsPracticed.length > 0) {
    skillsNote = `\n- Skills practiced: ${currentSession.skillsPracticed.join(', ')}`
  }

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

  return `Write a celebration song for ${playerNote} who just finished math practice!

Session details:
- Completed ${currentSession.problemsDone} out of ${currentSession.problemsTotal} problems
- Accuracy: ${accuracyPercent}%
- Best correct streak: ${currentSession.bestCorrectStreak} in a row
- Practice types: ${parts}${skillsNote}
- Session length: ${currentSession.durationMinutes} minutes
- Used help: ${currentSession.helpUsed ? 'yes' : 'no'}${historyNote}${gameBreakNote}`
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

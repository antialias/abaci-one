/**
 * LLM Prompt Generator for session celebration songs.
 *
 * Uses @soroban/llm-client to generate an ElevenLabs composition plan
 * with personalized lyrics based on session performance data.
 */

import { z } from 'zod'
import { AiFeature } from '@/lib/ai-usage/features'
import { trackedCall } from '@/lib/ai-usage/llm-middleware'
import type { CompositionPlan } from '@/lib/elevenlabs/music-client'
import { llm } from '@/lib/llm'
import type { SongConcept } from './concept-selector'
import type { SongPromptInput } from './extract-session-stats'

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
  /** Deterministic story concept selected before prompt generation */
  songConcept?: SongConcept
  /** LLM metadata for observability */
  llmMeta: {
    provider: string
    model: string
    usage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
    attempts: number
  }
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a songwriter who writes short, fun, personalized celebration songs for kids who just finished math practice. Your output will be used as a composition plan for the ElevenLabs Music API.

SPECIFICITY CONTRACT - THE MOST IMPORTANT RULE:
Every song must prove it knows THIS session. Use the "Song concept", "Practice drama", and "Game break evidence" sections as raw material.

- Use at least one specific problem expression if a problem moment is provided, such as "9 + 6 = 15" or a shorter singable fragment like "nine plus six."
- Use at least one specific skill or strategy if provided, such as "+6 = +10 - 4", "five-complement", "ten-complement", "visualizing beads", or "asked for help and kept going."
- If game-break evidence is provided, use at least one game-specific detail, not just the game name.
- Do not invent problems, attempts, scores, words, notes, regions, or strategies. If a detail is not provided, keep it general.
- Frame mistakes and attempts as plot tension or perseverance. Never mock wrong answers or turn low accuracy into the hook.

NARRATIVE:
Every song must tell a tiny story, not list achievements.

- Verse 1 = The setup. Paint a fresh scene for the session angle. Avoid generic "you did math" openings.
- Chorus = The anthem. Make a short hook that captures how the kid should feel now.
- Verse 2 = The payoff. Land the specific session journey: comeback, streak, strategy unlock, hard problem, or skill tour.
- Interlude = The game-break surprise when game evidence exists.

CREATIVE ANGLE:
If a Song concept is provided, use that selected concept as the creative lens. Do not swap it for a different metaphor. If no concept is provided, pick one vivid lens that fits the evidence and genre: detective case, kitchen experiment, tiny train route, lab test, arcade announcer, weather report, city builder, space checklist, treasure map, sports replay, marching cadence, or another fresh angle. The angle must serve the real session details. Avoid defaulting to stars, superheroes, trophies, or "you are amazing" filler.

Narrative inspiration by session profile:
- High accuracy + long streak: triumph or momentum story
- Improving trend: comeback or leveling-up story
- Used help: wisdom, coaching, or tool-use story
- Low accuracy but finished: grit and brave persistence
- Many skills practiced: journey through different math terrains
- Game break included: side quest, recharge, plot twist, or halftime show

If the kid's age is provided, tailor imagery and vocabulary accordingly. A 5-year-old gets simpler, playful imagery; an 8-year-old can handle more layered metaphors.

RULES:
- Write 1-2 short verses and a chorus: a SHORT celebration jingle with a narrative thread, not a full song
- Use the kid's name naturally in at least one verse
- Weave specific achievements into the story; do not merely list stats
- If accuracy is high (>85%), the narrative tone is triumphant
- If accuracy is moderate (60-85%), the narrative tone celebrates effort and progress
- If accuracy is low (<60%), the narrative emphasizes grit, growth mindset, and bravery
- Keep language age-appropriate, positive, and encouraging
- It is okay to mention problem terms and attempt counts when framed warmly
- The title must hint at the specific story angle, not "Great Job!"

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
- Weave the game break into the narrative as a "side quest", "recharge", "plot twist", or "halftime" moment in the story
- Reference what the kid did during the game break using the provided evidence
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

function formatLines(title: string, lines: string[]): string {
  if (lines.length === 0) return ''
  return `\n\n${title}:\n${lines.join('\n')}`
}

function formatProblemMoments(input: SongPromptInput): string[] {
  return input.practiceDrama.problemMoments.map((moment, index) => {
    const pieces = [
      `${index + 1}. ${moment.kind}: ${moment.problem}`,
      `part: ${moment.partType}`,
      moment.purpose ? `purpose: ${moment.purpose}` : null,
      `outcome: ${moment.outcome}`,
      `attempts: ${moment.attempts}`,
      moment.incorrectAttempts > 0 ? `incorrect attempts: ${moment.incorrectAttempts}` : null,
      moment.studentAnswers.length > 0
        ? `student answers: ${moment.studentAnswers.join(', ')}`
        : null,
      moment.skills.length > 0 ? `skills: ${moment.skills.join(', ')}` : null,
      moment.strategySteps.length > 0 ? `strategies: ${moment.strategySteps.join('; ')}` : null,
      moment.responseSeconds != null ? `response: ${moment.responseSeconds}s` : null,
      `why it matters: ${moment.reason}`,
    ].filter(Boolean)
    return `- ${pieces.join(' | ')}`
  })
}

function formatSkillSpotlights(input: SongPromptInput): string[] {
  return input.practiceDrama.skillSpotlights.map((skill) => {
    const examples =
      skill.exampleProblems.length > 0 ? ` | examples: ${skill.exampleProblems.join('; ')}` : ''
    return `- ${skill.skill}: ${skill.correct}/${skill.problems} problems correct across ${skill.attempts} attempt${skill.attempts === 1 ? '' : 's'}${examples}`
  })
}

function formatGameBreak(input: SongPromptInput): string {
  const gb = input.gameBreak
  if (!gb) return ''

  const details = [
    gb.headline,
    gb.outcome ? `outcome: ${gb.outcome}` : null,
    gb.accuracy != null ? `${Math.round(gb.accuracy)}% accuracy` : null,
    ...gb.highlights,
    ...gb.details,
    ...gb.moments.map((moment) => `moment: ${moment}`),
  ].filter(Boolean)

  return `\n\nGame break evidence:\n- Played ${gb.gameName}: ${details.join(' | ')}`
}

function formatSongConcept(input: SongPromptInput): string {
  const concept = input.songConcept
  if (!concept) return ''

  const lines = [
    `- Concept: ${concept.title} (${concept.id})`,
    `- Lens: ${concept.lens}`,
    `- Why this fits: ${concept.fitReason}`,
    concept.hookSeeds.length > 0 ? `- Hook seeds: ${concept.hookSeeds.join(' | ')}` : null,
    concept.requiredDetails.length > 0
      ? `- Must use factual details: ${concept.requiredDetails.join(' | ')}`
      : null,
    concept.gameBreakInterludeStyle
      ? `- Game-break interlude style: ${concept.gameBreakInterludeStyle}`
      : null,
    concept.avoid.length > 0 ? `- Avoid: ${concept.avoid.join(' | ')}` : null,
  ].filter(Boolean)

  return `\n\nSong concept:\n${lines.join('\n')}`
}

export function buildSongUserPrompt(input: SongPromptInput): string {
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

  return `Write a celebration song for ${playerNote} who just finished math practice!

Session details:
- Completed ${currentSession.problemsDone} out of ${currentSession.problemsTotal} problems
- Accuracy: ${accuracyPercent}%
- Best correct streak: ${currentSession.bestCorrectStreak} in a row
- Practice types: ${parts}${skillsNote}
- Session length: ${currentSession.durationMinutes} minutes
- Used help: ${currentSession.helpUsed ? 'yes' : 'no'}
- Total incorrect attempts: ${currentSession.totalIncorrectAttempts}
- Help moments: ${currentSession.helpMoments}
- Retry/comeback moments: ${currentSession.retryMoments}${
    currentSession.averageResponseSeconds != null
      ? `\n- Average response time: ${currentSession.averageResponseSeconds}s`
      : ''
  }${historyNote}${formatSongConcept(input)}

Practice drama:
- Story angle to build around: ${input.practiceDrama.storyAngle}${
    input.practiceDrama.arcs.length > 0 ? `\n- Arcs: ${input.practiceDrama.arcs.join(' | ')}` : ''
  }${formatLines('Specific problem moments', formatProblemMoments(input))}${formatLines(
    'Skill spotlights',
    formatSkillSpotlights(input)
  )}${formatGameBreak(input)}

Use the selected song concept and the specific problem, skill, attempt, and game-break evidence above. Keep it warm and singable.`
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
  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${buildSongUserPrompt(input)}${genreInstruction}`

  const callArgs = { prompt: fullPrompt, schema: songLLMOutputSchema }
  const response = userId
    ? await trackedCall(llm, callArgs, {
        userId,
        feature: AiFeature.SESSION_SONG_PROMPT,
      })
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
    ...(input.songConcept && { songConcept: input.songConcept }),
    llmMeta: {
      provider: response.provider,
      model: response.model,
      usage: response.usage,
      attempts: response.attempts,
    },
  }
}

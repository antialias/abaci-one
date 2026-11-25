/**
 * LLM Prompt Generator for session celebration songs.
 *
 * Uses @soroban/llm-client to generate an ElevenLabs composition plan
 * with personalized lyrics based on session performance data.
 */

import type { LLMResponse } from '@soroban/llm-client'
import { z } from 'zod'
import { AiFeature } from '@/lib/ai-usage/features'
import { trackedCall } from '@/lib/ai-usage/llm-middleware'
import type { CompositionPlan } from '@/lib/elevenlabs/music-client'
import { llm } from '@/lib/llm'
import {
  buildFallbackSongPlan,
  buildValidationEvidenceSummary,
  clampCompositionPlanDuration,
  getTotalDurationMs,
  SongCompositionValidationError,
  type SongPlanCandidate,
  type SongPlanValidationMetadata,
  type SongPlanValidationOutcome,
  type SongPlanValidationPolicy,
  type SongPlanValidationResult,
  validateCompositionPlan,
} from './composition-plan-validation'
import type { RecentSongSummary, SongPromptInput } from './extract-session-stats'

// ============================================================================
// Output Schema
// ============================================================================

const songSectionSchema = z.object({
  section_name: z.string().describe('e.g. "Verse 1", "Chorus", "Bridge"'),
  positive_local_styles: z.array(z.string()).describe('Per-section style hints'),
  negative_local_styles: z.array(z.string()).describe('Per-section negative style hints'),
  duration_ms: z.number().min(3000).max(30000).describe('Section duration in ms'),
  lines: z
    .array(z.string().max(80))
    .max(6)
    .describe(
      'Lyrics for this section. Keep sparse: at most 4 short lines. Max 80 chars per line.'
    ),
})

export const songLLMOutputSchema = z.object({
  title: z.string().describe('A short, fun song title (max 80 characters).'),
  positive_global_styles: z
    .array(z.string())
    .describe('Global style tags for the sound you chose; include "children"'),
  negative_global_styles: z
    .array(z.string())
    .describe('Styles to avoid, e.g. ["metal", "explicit", "sad"]'),
  sections: z
    .array(songSectionSchema)
    .min(3)
    .max(6)
    .describe('Song sections, 3 to 6, in whatever shape suits the song'),
})

export type SongLLMOutput = z.infer<typeof songLLMOutputSchema>

/** Exported type for the full composition output */
export interface SongCompositionOutput {
  title: string
  plan: CompositionPlan
  /** Semantic quality gate metadata for admin observability */
  validation?: SongPlanValidationMetadata
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

interface GenerateSongPromptOptions {
  validationPolicy?: SongPlanValidationPolicy
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You write a short, one-of-a-kind song for a kid who just finished math practice. Your output becomes a composition plan for the ElevenLabs Music API.

THE BRIEF: SURPRISE THEM.
Every song should feel like nothing this kid has heard from us before. The story, the world, the point of view, the form and the sound are all yours to invent. Go somewhere unexpected: odd, funny, tender, grand, tiny, strange. The session evidence is raw material; what you build from it is up to you.

You will see this kid's most recent songs. Make this one unlike every one of them: a different premise, different imagery, different words in the title and the hook, a different sound. Do not reuse their metaphors, settings or catchphrases.

WHAT MUST BE TRUE:
- It is about THIS session. Use real details from the evidence: a problem (or a singable piece of one, like "nine plus six"), a skill or strategy, and something specific from the game break if there was one. Never invent problems, attempts, scores, answers, games, strategies or people.
- Use the kid's name.
- Mistakes can be part of the story, never the joke. Do not mock wrong answers or make low accuracy the hook.
- It is for a child: kind, age-appropriate, never sad, never scary, nothing explicit. If an age is given, write for that age.

WHAT THE MUSIC GENERATOR NEEDS:
- At most 60000ms in total; aim for 40000-55000ms. Each section 3000-30000ms.
- 3 to 6 sections, in whatever shape suits the song. Name them as you like.
- Sparse lyrics: at most 4 short lines per section, each under 50 characters, so the music has room to breathe. Lines a kid could sing along to.
- positive_global_styles describe the sound you chose and include "children". negative_global_styles include "explicit" and "sad".
- positive_local_styles and negative_local_styles can change a section's feel.

GENRE:
- If the parent chose a genre or a mix, it is the core of the sound.
- Otherwise the sound is yours: any genre, era, tradition or blend, and unlike the recent songs.`

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

const HOOK_SECTION_RE = /chorus|hook|refrain/i

/**
 * What the writer sees of a kid's earlier songs: title, sound, and hook.
 * Takes stored llmOutput values, newest first; skips anything unreadable.
 */
export function summarizeRecentSongs(llmOutputs: unknown[]): RecentSongSummary[] {
  const summaries: RecentSongSummary[] = []
  for (const output of llmOutputs) {
    if (!output || typeof output !== 'object') continue
    const { title, plan } = output as { title?: unknown; plan?: unknown }
    if (typeof title !== 'string' || !plan || typeof plan !== 'object') continue
    const { positive_global_styles: styles, sections } = plan as {
      positive_global_styles?: unknown
      sections?: unknown
    }
    const sectionList = Array.isArray(sections)
      ? (sections as Array<{ section_name?: unknown; lines?: unknown }>)
      : []
    const hookSection =
      sectionList.find(
        (section) =>
          typeof section.section_name === 'string' && HOOK_SECTION_RE.test(section.section_name)
      ) ?? sectionList[0]
    const hook = Array.isArray(hookSection?.lines)
      ? (hookSection.lines as unknown[]).filter((line): line is string => typeof line === 'string')
      : []
    summaries.push({
      title,
      styles: Array.isArray(styles)
        ? styles.filter((style): style is string => typeof style === 'string')
        : [],
      hook: hook.slice(0, 3),
    })
  }
  return summaries
}

function formatRecentSongs(input: SongPromptInput): string {
  const songs = input.recentSongs ?? []
  if (songs.length === 0) {
    return '\n\nThis kid has no earlier songs yet.'
  }
  const lines = songs.map((song) => {
    const hook = song.hook.length > 0 ? ` | hook: ${song.hook.join(' / ')}` : ''
    return `- "${song.title}" | sound: ${song.styles.join(', ') || 'unknown'}${hook}`
  })
  return `\n\nThis kid's recent songs, newest first. Make yours unlike all of them:\n${lines.join('\n')}`
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

  return `Write a song for ${playerNote}, who just finished math practice.

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
  }${historyNote}

Practice evidence:
- One standout moment (use it or not): ${input.practiceDrama.storyAngle}${
    input.practiceDrama.arcs.length > 0 ? `\n- Arcs: ${input.practiceDrama.arcs.join(' | ')}` : ''
  }${formatLines('Specific problem moments', formatProblemMoments(input))}${formatLines(
    'Skill spotlights',
    formatSkillSpotlights(input)
  )}${formatGameBreak(input)}${formatRecentSongs(input)}

Now write something they will not see coming.`
}

// ============================================================================
// Generator
// ============================================================================

const OFF_VALIDATION_POLICY: SongPlanValidationPolicy = {
  mode: 'off',
  maxRepairAttempts: 0,
  fallbackOnFailedRepair: false,
  logPassingPlans: false,
}

function toSongPlanCandidate(output: SongLLMOutput): SongPlanCandidate {
  return {
    title: output.title,
    positive_global_styles: output.positive_global_styles,
    negative_global_styles: output.negative_global_styles,
    sections: output.sections,
  }
}

function toCompositionPlan(candidate: SongPlanCandidate): CompositionPlan {
  return {
    positive_global_styles: candidate.positive_global_styles,
    negative_global_styles: candidate.negative_global_styles,
    sections: candidate.sections,
  }
}

async function callSongPlanLlm(
  prompt: string,
  userId?: string
): Promise<LLMResponse<SongLLMOutput>> {
  const callArgs = { prompt, schema: songLLMOutputSchema }
  return userId
    ? trackedCall(llm, callArgs, {
        userId,
        feature: AiFeature.SESSION_SONG_PROMPT,
      })
    : llm.call(callArgs)
}

function buildRepairPrompt({
  originalPrompt,
  originalPlan,
  validation,
  input,
}: {
  originalPrompt: string
  originalPlan: SongPlanCandidate
  validation: SongPlanValidationResult
  input: SongPromptInput
}): string {
  const issueList = validation.issues.map((issue) => `- ${issue.code}: ${issue.message}`).join('\n')

  return `${SYSTEM_PROMPT}

---

Repair this session song composition plan. Return corrected JSON only, matching the schema.

Failed validation checks:
${issueList}

Allowed evidence:
${buildValidationEvidenceSummary(input)}

Rules for the repair:
- Preserve the genre, kid-safe energy, and useful structure where possible.
- Remove or replace invented names, games, scores, attempt counts, words, notes, regions, or strategies.
- Do not add an interlude, rap break, bridge, breakdown, drop, cadence, or game-break section unless game-break evidence exists.
- Keep the total planned duration at or below 60000ms.

Original request:
${originalPrompt}

Invalid structured plan:
${JSON.stringify(originalPlan, null, 2)}`
}

function buildLlmMeta(
  responses: Array<LLMResponse<SongLLMOutput>>
): SongCompositionOutput['llmMeta'] {
  const latest = responses[responses.length - 1]
  return {
    provider: latest.provider,
    model: latest.model,
    usage: responses.reduce(
      (sum, response) => ({
        promptTokens: sum.promptTokens + response.usage.promptTokens,
        completionTokens: sum.completionTokens + response.usage.completionTokens,
        totalTokens: sum.totalTokens + response.usage.totalTokens,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    ),
    attempts: responses.reduce((sum, response) => sum + response.attempts, 0),
  }
}

function buildValidationMetadata({
  policy,
  outcome,
  issues,
  rawTotalDurationMs,
  finalPlan,
  repaired,
  fallbackUsed,
  repairAttempts,
}: {
  policy: SongPlanValidationPolicy
  outcome: SongPlanValidationOutcome
  issues: SongPlanValidationResult['issues']
  rawTotalDurationMs: number
  finalPlan: CompositionPlan
  repaired: boolean
  fallbackUsed: boolean
  repairAttempts: number
}): SongPlanValidationMetadata {
  return {
    mode: policy.mode,
    outcome,
    issues,
    rawTotalDurationMs,
    finalTotalDurationMs: getTotalDurationMs(finalPlan),
    repaired,
    fallbackUsed,
    repairAttempts,
  }
}

function buildCompositionOutput({
  candidate,
  input,
  responses,
  validation,
}: {
  candidate: SongPlanCandidate
  input: SongPromptInput
  responses: Array<LLMResponse<SongLLMOutput>>
  validation?: SongPlanValidationMetadata
}): SongCompositionOutput {
  return {
    title: candidate.title,
    plan: toCompositionPlan(candidate),
    ...(validation && { validation }),
    llmMeta: buildLlmMeta(responses),
  }
}

function logValidationResult(
  validation: SongPlanValidationMetadata,
  title: string,
  shouldLogPassing: boolean
) {
  if (validation.outcome === 'passed' && !shouldLogPassing) return
  const level = validation.issues.length > 0 ? 'warn' : 'log'
  console[level]('[session-song] composition plan validation', {
    title,
    mode: validation.mode,
    outcome: validation.outcome,
    issueCodes: validation.issues.map((issue) => issue.code),
    repaired: validation.repaired,
    fallbackUsed: validation.fallbackUsed,
    repairAttempts: validation.repairAttempts,
  })
}

/**
 * Generate a composition plan with personalized lyrics using the LLM.
 *
 * @param input - Session stats for personalization
 * @param genre - The parent's genre setting: 'shuffle' (the writer chooses), 'any' (the writer
 *   picks one genre), or the genres the parent named
 */
export async function generateSongPrompt(
  input: SongPromptInput,
  genre: string = 'shuffle',
  userId?: string,
  options: GenerateSongPromptOptions = {}
): Promise<SongCompositionOutput> {
  const validationPolicy = options.validationPolicy ?? OFF_VALIDATION_POLICY
  const choice = genre.trim()
  const genres =
    choice === '' || choice === 'shuffle' || choice === 'any'
      ? []
      : choice
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
  const genreInstruction =
    genres.length > 1
      ? `\n\nThe parent has requested a genre mix: ${genres.join(' + ')}. Blend these styles together.`
      : genres.length === 1
        ? `\n\nThe parent has requested a ${genres[0]} style song. Use ${genres[0]} as the primary genre.`
        : choice === 'any'
          ? '\n\nThe parent asked for one genre per song: pick a single genre, your choice, unlike the recent songs.'
          : ''
  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${buildSongUserPrompt(input)}${genreInstruction}`

  const responses = [await callSongPlanLlm(fullPrompt, userId)]
  const rawCandidate = toSongPlanCandidate(responses[0].data)
  const rawValidation = validateCompositionPlan(input, rawCandidate)
  const rawTotalDurationMs = rawValidation.totalDurationMs

  if (validationPolicy.mode === 'off') {
    const finalCandidate = clampCompositionPlanDuration(rawCandidate)
    const finalPlan = toCompositionPlan(finalCandidate)
    return buildCompositionOutput({
      candidate: finalCandidate,
      input,
      responses,
      validation: buildValidationMetadata({
        policy: validationPolicy,
        outcome: 'skipped',
        issues: [],
        rawTotalDurationMs,
        finalPlan,
        repaired: false,
        fallbackUsed: false,
        repairAttempts: 0,
      }),
    })
  }

  if (validationPolicy.mode === 'observe' || rawValidation.ok) {
    const finalCandidate = clampCompositionPlanDuration(rawCandidate)
    const finalPlan = toCompositionPlan(finalCandidate)
    const metadata = buildValidationMetadata({
      policy: validationPolicy,
      outcome: rawValidation.ok ? 'passed' : 'flagged',
      issues: rawValidation.issues,
      rawTotalDurationMs,
      finalPlan,
      repaired: false,
      fallbackUsed: false,
      repairAttempts: 0,
    })
    logValidationResult(metadata, finalCandidate.title, validationPolicy.logPassingPlans)
    return buildCompositionOutput({
      candidate: finalCandidate,
      input,
      responses,
      validation: metadata,
    })
  }

  let latestCandidate = rawCandidate
  let latestValidation = rawValidation
  let repaired = false
  let repairAttempts = 0

  for (let i = 0; i < validationPolicy.maxRepairAttempts; i++) {
    repairAttempts++
    const repairPrompt = buildRepairPrompt({
      originalPrompt: fullPrompt,
      originalPlan: latestCandidate,
      validation: latestValidation,
      input,
    })
    const repairResponse = await callSongPlanLlm(repairPrompt, userId)
    responses.push(repairResponse)

    latestCandidate = toSongPlanCandidate(repairResponse.data)
    latestValidation = validateCompositionPlan(input, latestCandidate)
    if (latestValidation.ok) {
      repaired = true
      break
    }
  }

  let finalCandidate = repaired ? latestCandidate : rawCandidate
  let fallbackUsed = false
  let outcome: SongPlanValidationOutcome = repaired ? 'repaired' : 'flagged'

  if (!repaired && validationPolicy.fallbackOnFailedRepair) {
    const fallbackCandidate = buildFallbackSongPlan(input, rawCandidate, genre)
    const fallbackValidation = validateCompositionPlan(input, fallbackCandidate)
    if (fallbackValidation.ok) {
      finalCandidate = fallbackCandidate
      fallbackUsed = true
      outcome = 'fallback'
    } else if (validationPolicy.mode === 'enforce') {
      const finalPlan = toCompositionPlan(fallbackCandidate)
      const metadata = buildValidationMetadata({
        policy: validationPolicy,
        outcome: 'blocked',
        issues: fallbackValidation.issues,
        rawTotalDurationMs,
        finalPlan,
        repaired: false,
        fallbackUsed: true,
        repairAttempts,
      })
      logValidationResult(metadata, fallbackCandidate.title, true)
      throw new SongCompositionValidationError(
        `Session song composition plan failed validation: ${fallbackValidation.issues
          .map((issue) => issue.code)
          .join(', ')}`,
        metadata,
        fallbackCandidate
      )
    }
  } else if (!repaired && validationPolicy.mode === 'enforce') {
    const finalPlan = toCompositionPlan(rawCandidate)
    const metadata = buildValidationMetadata({
      policy: validationPolicy,
      outcome: 'blocked',
      issues: latestValidation.issues,
      rawTotalDurationMs,
      finalPlan,
      repaired: false,
      fallbackUsed: false,
      repairAttempts,
    })
    logValidationResult(metadata, rawCandidate.title, true)
    throw new SongCompositionValidationError(
      `Session song composition plan failed validation: ${latestValidation.issues
        .map((issue) => issue.code)
        .join(', ')}`,
      metadata,
      rawCandidate
    )
  }

  if (validationPolicy.mode === 'enforce') {
    const finalValidation = validateCompositionPlan(input, finalCandidate)
    if (!finalValidation.ok) {
      const finalPlan = toCompositionPlan(finalCandidate)
      const metadata = buildValidationMetadata({
        policy: validationPolicy,
        outcome: 'blocked',
        issues: finalValidation.issues,
        rawTotalDurationMs,
        finalPlan,
        repaired,
        fallbackUsed,
        repairAttempts,
      })
      logValidationResult(metadata, finalCandidate.title, true)
      throw new SongCompositionValidationError(
        `Session song composition plan failed validation: ${finalValidation.issues
          .map((issue) => issue.code)
          .join(', ')}`,
        metadata,
        finalCandidate
      )
    }
  }

  finalCandidate = clampCompositionPlanDuration(finalCandidate)
  const finalPlan = toCompositionPlan(finalCandidate)
  const metadata = buildValidationMetadata({
    policy: validationPolicy,
    outcome,
    issues: rawValidation.issues,
    rawTotalDurationMs,
    finalPlan,
    repaired,
    fallbackUsed,
    repairAttempts,
  })
  logValidationResult(metadata, finalCandidate.title, validationPolicy.logPassingPlans)
  return buildCompositionOutput({
    candidate: finalCandidate,
    input,
    responses,
    validation: metadata,
  })
}

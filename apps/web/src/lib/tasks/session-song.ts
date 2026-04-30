/**
 * Session Song background task handler.
 *
 * Orchestrates the song generation pipeline:
 * 1. Check idempotency (existing song for this session plan)
 * 2. Create session_songs record
 * 3. Extract session stats
 * 4. Generate LLM composition plan (structured lyrics + style)
 * 5. Generate music via ElevenLabs Music API
 * 6. Save MP3 locally, mark completed, emit Socket.IO event
 */

import { and, desc, eq } from 'drizzle-orm'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { db, schema } from '@/db'
import type { PlayerSessionPreferencesConfig } from '@/db/schema/player-session-preferences'
import type { SessionSongTriggerSource } from '@/db/schema/session-songs'
import { AiFeature } from '@/lib/ai-usage/features'
import { recordElevenLabsUsage } from '@/lib/ai-usage/helpers'
import { getSocketIO } from '@/lib/socket-io'
import { generateMusic } from '../elevenlabs/music-client'
import { classifySongFailure } from '../session-song/classify-failure'
import { resolveSongGenres, selectSongConcept } from '../session-song/concept-selector'
import { extractSessionStats } from '../session-song/extract-session-stats'
import { generateSongPrompt } from '../session-song/prompt-generator'
import { createTask } from '../task-manager'
import type { SessionSongEvent } from './events'

// ============================================================================
// Types
// ============================================================================

export interface SessionSongInput {
  sessionPlanId: string
  playerId: string
  triggerSource: SessionSongTriggerSource
  _userId?: string
}

export interface SessionSongOutput {
  songId: string
  status: string
}

const SONGS_DIR = join(process.cwd(), 'data', 'audio', 'songs')

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  return asRecord(asRecord(value)?.[key])
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function getRecentSongConceptIds(
  songs: Array<{ promptInput: unknown; llmOutput: unknown }>
): string[] {
  return songs
    .map((song) => {
      const promptConcept = nestedRecord(song.promptInput, 'songConcept')
      const outputConcept = nestedRecord(song.llmOutput, 'songConcept')
      return promptConcept?.id ?? outputConcept?.id
    })
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function getRecentSongGenreTags(songs: Array<{ llmOutput: unknown }>): string[] {
  return songs.flatMap((song) => {
    const plan = nestedRecord(song.llmOutput, 'plan')
    return stringArray(plan?.positive_global_styles)
  })
}

function seedPart(value: unknown): string {
  if (value instanceof Date) return String(value.getTime())
  if (value == null) return ''
  return String(value)
}

function buildConceptSeed(
  input: SessionSongInput,
  plan: { createdAt?: unknown; completedAt?: unknown }
) {
  return [input.playerId, input.sessionPlanId, seedPart(plan.completedAt), seedPart(plan.createdAt)]
    .filter(Boolean)
    .join(':')
}

// ============================================================================
// Handler
// ============================================================================

/**
 * Start a session song generation background task.
 *
 * Idempotent — returns existing song if one already exists for this plan.
 *
 * @returns The background task ID
 */
export async function startSessionSongGeneration(
  input: SessionSongInput,
  userId?: string
): Promise<{ taskId: string; songId?: string; existing?: boolean }> {
  // Check for existing song (idempotency)
  const existing = await db
    .select()
    .from(schema.sessionSongs)
    .where(eq(schema.sessionSongs.sessionPlanId, input.sessionPlanId))
    .limit(1)

  if (existing.length > 0) {
    return {
      taskId: existing[0].backgroundTaskId ?? '',
      songId: existing[0].id,
      existing: true,
    }
  }

  // Create the song record first so we can reference its ID
  const [songRecord] = await db
    .insert(schema.sessionSongs)
    .values({
      sessionPlanId: input.sessionPlanId,
      playerId: input.playerId,
      triggerSource: input.triggerSource,
      status: 'pending',
    })
    .returning()

  const songId = songRecord.id

  const inputWithUser = { ...input, _userId: userId }
  const taskId = await createTask<SessionSongInput, SessionSongOutput, SessionSongEvent>(
    'session-song',
    inputWithUser,
    async (handle) => {
      try {
        // Step 1: Extract stats
        handle.emit({ type: 'song_extracting_stats' })
        handle.setProgress(10, 'Analyzing session data...')

        const [plan] = await db
          .select()
          .from(schema.sessionPlans)
          .where(eq(schema.sessionPlans.id, input.sessionPlanId))
          .limit(1)

        const [player] = await db
          .select()
          .from(schema.players)
          .where(eq(schema.players.id, input.playerId))
          .limit(1)

        if (!plan || !player) {
          throw new Error('Session plan or player not found')
        }

        // Check per-student preference
        const [prefRow] = await db
          .select()
          .from(schema.playerSessionPreferences)
          .where(eq(schema.playerSessionPreferences.playerId, input.playerId))
          .limit(1)

        const prefs = prefRow
          ? (JSON.parse(prefRow.config) as PlayerSessionPreferencesConfig)
          : null
        const studentSongEnabled = prefs?.sessionSongEnabled ?? true
        if (!studentSongEnabled) {
          // Student has songs disabled — complete silently
          handle.complete({ songId, status: 'disabled' })
          await db
            .update(schema.sessionSongs)
            .set({ status: 'failed', errorMessage: 'Songs disabled for this student' })
            .where(eq(schema.sessionSongs.id, songId))
          return
        }

        const rawGenre = prefs?.sessionSongGenre ?? 'shuffle'

        // Get recent completed sessions for history
        const recentPlans = await db
          .select()
          .from(schema.sessionPlans)
          .where(
            and(
              eq(schema.sessionPlans.playerId, input.playerId),
              eq(schema.sessionPlans.status, 'completed')
            )
          )
          .orderBy(schema.sessionPlans.createdAt)
          .limit(10)

        const recentSessions = recentPlans.map((p) => {
          const results = (p as { results: Array<{ isCorrect: boolean }> }).results ?? []
          const correct = results.filter((r) => r.isCorrect).length
          return {
            accuracy: results.length > 0 ? correct / results.length : 0,
          }
        })

        const recentSongs = await db
          .select({
            promptInput: schema.sessionSongs.promptInput,
            llmOutput: schema.sessionSongs.llmOutput,
          })
          .from(schema.sessionSongs)
          .where(
            and(
              eq(schema.sessionSongs.playerId, input.playerId),
              eq(schema.sessionSongs.status, 'completed')
            )
          )
          .orderBy(desc(schema.sessionSongs.createdAt))
          .limit(10)

        // Look up game break result for this session (if any).
        // The smart trigger only fires in the last practice part, so game break
        // results (which happen between parts) are already persisted by now.
        const [gameBreakResult] = await db
          .select()
          .from(schema.gameResults)
          .where(
            and(
              eq(schema.gameResults.sessionId, input.sessionPlanId),
              eq(schema.gameResults.sessionType, 'practice-break')
            )
          )
          .limit(1)

        const stats = extractSessionStats(plan as never, player, recentSessions, gameBreakResult, {
          breakSelectedGame: plan.breakSelectedGame ?? null,
          breakReason: plan.breakReason ?? null,
          breakResults: plan.breakResults ?? null,
        })
        const conceptContext = {
          seed: buildConceptSeed(input, plan),
          recentConceptIds: getRecentSongConceptIds(recentSongs),
          recentGenreTags: getRecentSongGenreTags(recentSongs),
          genrePreference: rawGenre,
        }
        const songConcept = selectSongConcept(stats, conceptContext)
        const genrePreference = resolveSongGenres(rawGenre, songConcept, conceptContext)
        const promptInput = { ...stats, songConcept }

        // Update song record with prompt input
        await db
          .update(schema.sessionSongs)
          .set({
            promptInput: promptInput as unknown as Record<string, unknown>,
            status: 'prompt_generating',
          })
          .where(eq(schema.sessionSongs.id, songId))

        // Step 2: Generate LLM composition plan
        handle.emit({ type: 'song_generating_prompt' })
        handle.setProgress(30, 'Writing your song...')

        const llmOutput = await generateSongPrompt(promptInput, genrePreference, input._userId)

        handle.emit({
          type: 'song_prompt_ready',
          title: llmOutput.title,
        })
        handle.setProgress(50, 'Song lyrics ready!')

        // Update song record with LLM output
        await db
          .update(schema.sessionSongs)
          .set({
            llmOutput: llmOutput as unknown as Record<string, unknown>,
          })
          .where(eq(schema.sessionSongs.id, songId))

        // Step 3: Generate music via ElevenLabs
        handle.emit({ type: 'song_generating_music' })
        handle.setProgress(60, 'Creating your music...')

        await db
          .update(schema.sessionSongs)
          .set({ status: 'generating' })
          .where(eq(schema.sessionSongs.id, songId))

        const { audioBuffer } = await generateMusic({
          compositionPlan: llmOutput.plan,
        })

        if (input._userId) {
          recordElevenLabsUsage(llmOutput.plan, {
            userId: input._userId,
            feature: AiFeature.MUSIC_GENERATE,
            backgroundTaskId: handle.id,
          })
        }

        // Step 4: Save MP3 locally
        handle.setProgress(90, 'Saving your song...')

        const localPath = join(SONGS_DIR, `${songId}.mp3`)
        await mkdir(dirname(localPath), { recursive: true })
        await writeFile(localPath, audioBuffer)

        // Step 5: Mark completed
        await db
          .update(schema.sessionSongs)
          .set({
            status: 'completed',
            localFilePath: localPath,
            completedAt: new Date(),
          })
          .where(eq(schema.sessionSongs.id, songId))

        // Emit Socket.IO event for instant client notification
        try {
          const io = await getSocketIO()
          if (io) {
            io.emit(`session-song:ready:${input.sessionPlanId}`, {
              songId,
              planId: input.sessionPlanId,
            })
          }
        } catch {
          // Socket.IO not available — client will pick up via polling
        }

        handle.complete({ songId, status: 'completed' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        const classified = classifySongFailure(error)

        handle.emit({ type: 'song_error', error: message })

        // Update song record with error + classification
        await db
          .update(schema.sessionSongs)
          .set({
            status: 'failed',
            errorMessage: message,
            failureKind: classified.kind,
          })
          .where(eq(schema.sessionSongs.id, songId))

        handle.fail(message)
      }
    },
    userId
  )

  // Link the background task ID to the song record
  await db
    .update(schema.sessionSongs)
    .set({ backgroundTaskId: taskId })
    .where(eq(schema.sessionSongs.id, songId))

  return { taskId, songId }
}

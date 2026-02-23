/**
 * Session Song background task handler.
 *
 * Orchestrates the song generation pipeline:
 * 1. Check idempotency (existing song for this session plan)
 * 2. Create session_songs record
 * 3. Extract session stats
 * 4. Generate LLM prompt (lyrics, style, title)
 * 5. Submit to Suno API
 * 6. Complete task — Suno generation continues async via webhook
 */

import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/db'
import { createTask } from '../task-manager'
import { submitSongGeneration } from '../suno/client'
import { extractSessionStats } from '../session-song/extract-session-stats'
import { generateSongPrompt } from '../session-song/prompt-generator'
import type { SessionSongEvent } from './events'
import type { SessionSongTriggerSource } from '@/db/schema/session-songs'

// ============================================================================
// Types
// ============================================================================

export interface SessionSongInput {
  sessionPlanId: string
  playerId: string
  triggerSource: SessionSongTriggerSource
}

export interface SessionSongOutput {
  songId: string
  status: string
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

  const taskId = await createTask<SessionSongInput, SessionSongOutput, SessionSongEvent>(
    'session-song',
    input,
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

        const stats = extractSessionStats(plan as never, player, recentSessions)

        // Update song record with prompt input
        await db
          .update(schema.sessionSongs)
          .set({
            promptInput: stats as unknown as Record<string, unknown>,
            status: 'prompt_generating',
          })
          .where(eq(schema.sessionSongs.id, songId))

        // Step 2: Generate LLM prompt
        handle.emit({ type: 'song_generating_prompt' })
        handle.setProgress(30, 'Writing your song...')

        const llmOutput = await generateSongPrompt(stats)

        handle.emit({
          type: 'song_prompt_ready',
          title: llmOutput.title,
          style: llmOutput.style,
        })
        handle.setProgress(60, 'Song lyrics ready!')

        // Update song record with LLM output
        await db
          .update(schema.sessionSongs)
          .set({
            llmOutput: llmOutput as unknown as Record<string, unknown>,
          })
          .where(eq(schema.sessionSongs.id, songId))

        // Step 3: Submit to Suno
        handle.setProgress(70, 'Sending to music studio...')

        const webhookBaseUrl = process.env.SUNO_WEBHOOK_BASE_URL
        const callbackUrl = webhookBaseUrl
          ? `${webhookBaseUrl}/api/webhooks/suno?songId=${songId}`
          : undefined

        const { taskId: sunoTaskId } = await submitSongGeneration({
          lyrics: llmOutput.lyrics,
          style: llmOutput.style,
          title: llmOutput.title,
          callbackUrl,
        })

        handle.emit({ type: 'song_submitted', sunoTaskId })
        handle.setProgress(90, 'Music is being created...')

        // Update song record with Suno task ID
        await db
          .update(schema.sessionSongs)
          .set({
            sunoTaskId,
            status: 'submitted',
            submittedAt: new Date(),
          })
          .where(eq(schema.sessionSongs.id, songId))

        // Task is done — Suno generation continues async via webhook
        handle.complete({ songId, status: 'submitted' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        handle.emit({ type: 'song_error', error: message })

        // Update song record with error
        await db
          .update(schema.sessionSongs)
          .set({
            status: 'failed',
            errorMessage: message,
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

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

import { and, desc, eq, sql } from 'drizzle-orm'
import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { db, schema } from '@/db'
import type { PlayerSessionPreferencesConfig } from '@/db/schema/player-session-preferences'
import type {
  SessionSong,
  SessionSongLLMOutput,
  SessionSongStatus,
  SessionSongTriggerSource,
} from '@/db/schema/session-songs'
import { AiFeature } from '@/lib/ai-usage/features'
import { recordElevenLabsUsage } from '@/lib/ai-usage/helpers'
import { getFlag } from '@/lib/feature-flags'
import { getSocketIO } from '@/lib/socket-io'
import {
  type CompositionPlan,
  generateMusic,
  type MusicAlignmentJson,
} from '../elevenlabs/music-client'
import { classifySongFailure } from '../session-song/classify-failure'
import {
  resolveSongPlanValidationPolicy,
  SESSION_SONG_PLAN_VALIDATION_FLAG,
  SongCompositionValidationError,
  type SongPlanValidationPolicy,
} from '../session-song/composition-plan-validation'
import { resolveSongGenres, selectSongConcept } from '../session-song/concept-selector'
import { extractSessionStats, type SongPromptInput } from '../session-song/extract-session-stats'
import { generateSongPrompt, type SongCompositionOutput } from '../session-song/prompt-generator'
import { createTask, type TaskHandle } from '../task-manager'
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

export type SessionSongRegenerationMode = 'auto' | 'reuse_prompt' | 'regenerate_prompt'

interface SongPromptBuildResult {
  playerName: string
  disabled: boolean
  promptInput?: SongPromptInput
  genrePreference?: string
}

const SONGS_DIR = join(process.cwd(), 'data', 'audio', 'songs')

/**
 * Write the ElevenLabs word-alignment JSON to a sidecar file next to the MP3.
 * The detailed music endpoint returns this when `with_timestamps: true` is set;
 * it powers karaoke-style lyric highlighting in the celebration UI.
 */
async function writeAlignmentSidecar(
  songId: string,
  alignment: MusicAlignmentJson | null
): Promise<void> {
  if (!alignment) return
  const alignmentPath = join(SONGS_DIR, `${songId}.json`)
  await writeFile(alignmentPath, JSON.stringify(alignment))
}

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

async function getSongPlanValidationPolicy(userId?: string): Promise<SongPlanValidationPolicy> {
  try {
    const flag = await getFlag(SESSION_SONG_PLAN_VALIDATION_FLAG, userId ? { userId } : undefined)
    return resolveSongPlanValidationPolicy(flag)
  } catch (error) {
    console.error('[session-song] Failed to load plan-validation feature flag:', error)
    return resolveSongPlanValidationPolicy(null)
  }
}

function getCompositionPlan(llmOutput: unknown): CompositionPlan | null {
  const output = asRecord(llmOutput)
  const plan = asRecord(output?.plan)
  if (!plan) return null

  if (!Array.isArray(plan.positive_global_styles)) return null
  if (!Array.isArray(plan.negative_global_styles)) return null
  if (!Array.isArray(plan.sections)) return null

  return plan as unknown as CompositionPlan
}

function getSongTitle(llmOutput: unknown): string | null {
  const title = asRecord(llmOutput)?.title
  return typeof title === 'string' ? title : null
}

async function getPlayerName(playerId: string): Promise<string> {
  const [player] = await db
    .select({ name: schema.players.name })
    .from(schema.players)
    .where(eq(schema.players.id, playerId))
    .limit(1)

  return player?.name ?? 'Unknown player'
}

async function buildSongPromptInput(input: SessionSongInput): Promise<SongPromptBuildResult> {
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

  const [prefRow] = await db
    .select()
    .from(schema.playerSessionPreferences)
    .where(eq(schema.playerSessionPreferences.playerId, input.playerId))
    .limit(1)

  const prefs = prefRow ? (JSON.parse(prefRow.config) as PlayerSessionPreferencesConfig) : null
  const studentSongEnabled = prefs?.sessionSongEnabled ?? true
  if (!studentSongEnabled) {
    return { playerName: player.name, disabled: true }
  }

  const rawGenre = prefs?.sessionSongGenre ?? 'shuffle'

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

  return {
    playerName: player.name,
    disabled: false,
    promptInput: { ...stats, songConcept },
    genrePreference,
  }
}

async function emitSongReady(input: SessionSongInput, songId: string) {
  try {
    const io = await getSocketIO()
    if (io) {
      io.emit(`session-song:ready:${input.sessionPlanId}`, {
        songId,
        planId: input.sessionPlanId,
      })
    }
  } catch {
    // Socket.IO not available — best effort
  }
}

async function emitSongPhase(planId: string, status: SessionSongStatus) {
  try {
    const io = await getSocketIO()
    if (io) {
      io.emit(`session-song:phase:${planId}`, { status })
    }
  } catch {
    // Socket.IO not available — best effort
  }
}

/**
 * Update a session_songs row's status (plus any extra fields) and broadcast
 * the phase transition over Socket.IO. Centralized so we never write a status
 * without telling the client.
 */
type SessionSongUpdateExtras = Parameters<
  ReturnType<typeof db.update<typeof schema.sessionSongs>>['set']
>[0]

async function setSongStatus(
  songId: string,
  planId: string,
  status: SessionSongStatus,
  extra: Omit<SessionSongUpdateExtras, 'status'> = {}
): Promise<void> {
  await db
    .update(schema.sessionSongs)
    .set({ status, ...extra })
    .where(eq(schema.sessionSongs.id, songId))
  await emitSongPhase(planId, status)
}

async function generateAndSaveMusic({
  songId,
  input,
  handle,
  llmOutput,
  markContentResolved = false,
}: {
  songId: string
  input: SessionSongInput
  handle: TaskHandle<SessionSongOutput, SessionSongEvent>
  llmOutput: SongCompositionOutput | Pick<SessionSongLLMOutput, 'title' | 'plan'>
  markContentResolved?: boolean
}) {
  handle.emit({ type: 'song_generating_music' })
  handle.setProgress(60, 'Creating your music...')

  await setSongStatus(songId, input.sessionPlanId, 'generating', {
    errorMessage: null,
    failureKind: null,
  })

  const { audioBuffer, alignment } = await generateMusic({
    compositionPlan: llmOutput.plan,
  })

  if (input._userId) {
    recordElevenLabsUsage(llmOutput.plan, {
      userId: input._userId,
      feature: AiFeature.MUSIC_GENERATE,
      backgroundTaskId: handle.id,
    })
  }

  handle.setProgress(90, 'Saving your song...')

  const localPath = join(SONGS_DIR, `${songId}.mp3`)
  await mkdir(dirname(localPath), { recursive: true })
  await writeFile(localPath, audioBuffer)
  await writeAlignmentSidecar(songId, alignment)

  await setSongStatus(songId, input.sessionPlanId, 'completed', {
    localFilePath: localPath,
    completedAt: new Date(),
    errorMessage: null,
    failureKind: null,
    ...(markContentResolved ? { contentReviewStatus: 'resolved' } : {}),
  })

  await emitSongReady(input, songId)

  handle.complete({ songId, status: 'completed' })
}

async function notifyAdminsOfSongFailure({
  songId,
  input,
  playerName,
  failureKind,
}: {
  songId: string
  input: SessionSongInput
  playerName: string
  failureKind: string
}) {
  try {
    const admins = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, 'admin'))

    if (admins.length === 0) return

    const [{ bootstrapChannels }, { notifyUser }] = await Promise.all([
      import('@/lib/notifications/bootstrap'),
      import('@/lib/notifications/dispatcher'),
    ])

    bootstrapChannels()

    const event = {
      type: 'admin-song-failed' as const,
      data: {
        songId,
        sessionPlanId: input.sessionPlanId,
        playerId: input.playerId,
        playerName,
        failureKind,
        adminUrl: '/admin/songs',
      },
    }

    const results = await Promise.allSettled(admins.map((admin) => notifyUser(admin.id, event)))
    const failures = results.filter((result) => result.status === 'rejected')
    if (failures.length > 0) {
      console.error(
        `[session-song] Failed to notify ${failures.length} admin(s) about song failure`
      )
    }
  } catch (error) {
    console.error('[session-song] Failed to notify admins about song failure:', error)
  }
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
  userId?: string,
  options: { force?: boolean } = {}
): Promise<{ taskId: string; songId?: string; existing?: boolean }> {
  if (!options.force) {
    const existing = await db
      .select()
      .from(schema.sessionSongs)
      .where(eq(schema.sessionSongs.sessionPlanId, input.sessionPlanId))
      .orderBy(desc(schema.sessionSongs.createdAt))
      .limit(1)

    if (existing.length > 0) {
      return {
        taskId: existing[0].backgroundTaskId ?? '',
        songId: existing[0].id,
        existing: true,
      }
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
  await emitSongPhase(input.sessionPlanId, 'pending')

  const inputWithUser = { ...input, _userId: userId }
  const taskId = await createTask<SessionSongInput, SessionSongOutput, SessionSongEvent>(
    'session-song',
    inputWithUser,
    async (handle) => {
      let playerNameForFailure = 'Unknown player'

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
        playerNameForFailure = player.name

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
          await setSongStatus(songId, input.sessionPlanId, 'failed', {
            errorMessage: 'Songs disabled for this student',
          })
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
        await setSongStatus(songId, input.sessionPlanId, 'prompt_generating', {
          promptInput: promptInput as unknown as Record<string, unknown>,
        })

        // Step 2: Generate LLM composition plan
        handle.emit({ type: 'song_generating_prompt' })
        handle.setProgress(30, 'Writing your song...')

        const validationPolicy = await getSongPlanValidationPolicy(input._userId)
        const llmOutput = await generateSongPrompt(promptInput, genrePreference, input._userId, {
          validationPolicy,
        })

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

        await setSongStatus(songId, input.sessionPlanId, 'generating')

        const { audioBuffer, alignment } = await generateMusic({
          compositionPlan: llmOutput.plan,
        })

        if (input._userId) {
          recordElevenLabsUsage(llmOutput.plan, {
            userId: input._userId,
            feature: AiFeature.MUSIC_GENERATE,
            backgroundTaskId: handle.id,
          })
        }

        // Step 4: Save MP3 (and alignment JSON sidecar) locally
        handle.setProgress(90, 'Saving your song...')

        const localPath = join(SONGS_DIR, `${songId}.mp3`)
        await mkdir(dirname(localPath), { recursive: true })
        await writeFile(localPath, audioBuffer)
        await writeAlignmentSidecar(songId, alignment)

        // Step 5: Mark completed
        await setSongStatus(songId, input.sessionPlanId, 'completed', {
          localFilePath: localPath,
          completedAt: new Date(),
        })

        await emitSongReady(input, songId)

        handle.complete({ songId, status: 'completed' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        const classified = classifySongFailure(error)
        const blockedOutput =
          error instanceof SongCompositionValidationError && error.candidate
            ? {
                title: error.candidate.title,
                plan: {
                  positive_global_styles: error.candidate.positive_global_styles,
                  negative_global_styles: error.candidate.negative_global_styles,
                  sections: error.candidate.sections,
                },
                validation: error.metadata,
              }
            : null

        handle.emit({ type: 'song_error', error: message })

        // Update song record with error + classification
        await setSongStatus(songId, input.sessionPlanId, 'failed', {
          errorMessage: message,
          failureKind: classified.kind,
          ...(blockedOutput && {
            llmOutput: blockedOutput as unknown as Record<string, unknown>,
          }),
        })

        await notifyAdminsOfSongFailure({
          songId,
          input,
          playerName: playerNameForFailure,
          failureKind: classified.kind,
        })

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

export interface RetrySessionSongOptions {
  mode?: SessionSongRegenerationMode
  reason?: string
  userId?: string
}

function isSongActive(status: string): boolean {
  return status === 'pending' || status === 'prompt_generating' || status === 'generating'
}

function resolveRetryMode(
  song: SessionSong,
  requestedMode: SessionSongRegenerationMode
): Exclude<SessionSongRegenerationMode, 'auto'> {
  if (requestedMode === 'auto') {
    return getCompositionPlan(song.llmOutput) ? 'reuse_prompt' : 'regenerate_prompt'
  }
  return requestedMode
}

function getValidationBlockedOutput(error: unknown) {
  if (!(error instanceof SongCompositionValidationError) || !error.candidate) {
    return null
  }

  return {
    title: error.candidate.title,
    plan: {
      positive_global_styles: error.candidate.positive_global_styles,
      negative_global_styles: error.candidate.negative_global_styles,
      sections: error.candidate.sections,
    },
    validation: error.metadata,
  }
}

/**
 * Retry or regenerate an existing song without deleting the row.
 *
 * This keeps the failed song row as the durable queue:
 * - LLM failures retain promptInput and can regenerate lyrics later.
 * - ElevenLabs failures retain llmOutput.plan and can resume at music generation.
 * - Flagged completed songs can regenerate lyrics/music after prompt fixes ship.
 */
export async function retrySessionSongGeneration(
  songId: string,
  options: RetrySessionSongOptions = {}
): Promise<{
  taskId: string
  songId: string
  mode: Exclude<SessionSongRegenerationMode, 'auto'>
}> {
  const [song] = await db
    .select()
    .from(schema.sessionSongs)
    .where(eq(schema.sessionSongs.id, songId))
    .limit(1)

  if (!song) {
    throw new Error('Song not found')
  }

  if (isSongActive(song.status)) {
    throw new Error(`Song is already ${song.status}`)
  }

  const mode = resolveRetryMode(song, options.mode ?? 'auto')
  const reusablePlan = getCompositionPlan(song.llmOutput)
  if (mode === 'reuse_prompt' && !reusablePlan) {
    throw new Error('No saved composition plan is available; regenerate lyrics instead')
  }

  const retryReason =
    options.reason ??
    (mode === 'reuse_prompt' ? 'Retry from saved composition plan' : 'Regenerate lyrics and music')
  const markContentResolved = song.contentReviewStatus === 'flagged' && mode === 'regenerate_prompt'
  const inputWithUser: SessionSongInput = {
    sessionPlanId: song.sessionPlanId,
    playerId: song.playerId,
    triggerSource: (song.triggerSource as SessionSongTriggerSource | null) ?? 'completion_fallback',
    _userId: options.userId,
  }

  await setSongStatus(songId, song.sessionPlanId, 'pending', {
    errorMessage: null,
    failureKind: null,
    backgroundTaskId: null,
    lastRegenerationReason: retryReason,
    lastRegenerationAt: new Date(),
    regenerationCount: sql`${schema.sessionSongs.regenerationCount} + 1`,
    ...(mode === 'regenerate_prompt' ? { llmOutput: null } : {}),
  })

  const taskId = await createTask<SessionSongInput, SessionSongOutput, SessionSongEvent>(
    'session-song',
    inputWithUser,
    async (handle) => {
      let playerNameForFailure = await getPlayerName(song.playerId)

      try {
        if (mode === 'reuse_prompt') {
          const title = getSongTitle(song.llmOutput) ?? 'Session song'
          handle.emit({ type: 'song_prompt_ready', title })
          handle.setProgress(50, 'Song lyrics ready!')

          await generateAndSaveMusic({
            songId,
            input: inputWithUser,
            handle,
            llmOutput: { title, plan: reusablePlan! },
            markContentResolved,
          })
          return
        }

        handle.emit({ type: 'song_extracting_stats' })
        handle.setProgress(10, 'Analyzing session data...')

        const built = await buildSongPromptInput(inputWithUser)
        playerNameForFailure = built.playerName

        if (built.disabled) {
          handle.complete({ songId, status: 'disabled' })
          await setSongStatus(songId, song.sessionPlanId, 'failed', {
            errorMessage: 'Songs disabled for this student',
            failureKind: 'unknown',
          })
          return
        }

        if (!built.promptInput || !built.genrePreference) {
          throw new Error('Failed to build song prompt input')
        }

        await setSongStatus(songId, song.sessionPlanId, 'prompt_generating', {
          promptInput: built.promptInput as unknown as Record<string, unknown>,
          errorMessage: null,
          failureKind: null,
        })

        handle.emit({ type: 'song_generating_prompt' })
        handle.setProgress(30, 'Writing your song...')

        const validationPolicy = await getSongPlanValidationPolicy(inputWithUser._userId)
        const llmOutput = await generateSongPrompt(
          built.promptInput,
          built.genrePreference,
          inputWithUser._userId,
          { validationPolicy }
        )

        handle.emit({
          type: 'song_prompt_ready',
          title: llmOutput.title,
        })
        handle.setProgress(50, 'Song lyrics ready!')

        await db
          .update(schema.sessionSongs)
          .set({
            llmOutput: llmOutput as unknown as Record<string, unknown>,
          })
          .where(eq(schema.sessionSongs.id, songId))

        await generateAndSaveMusic({
          songId,
          input: inputWithUser,
          handle,
          llmOutput,
          markContentResolved,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        const classified = classifySongFailure(error)
        const blockedOutput = getValidationBlockedOutput(error)

        handle.emit({ type: 'song_error', error: message })

        await setSongStatus(songId, song.sessionPlanId, 'failed', {
          errorMessage: message,
          failureKind: classified.kind,
          ...(blockedOutput && {
            llmOutput: blockedOutput as unknown as Record<string, unknown>,
          }),
        })

        await notifyAdminsOfSongFailure({
          songId,
          input: inputWithUser,
          playerName: playerNameForFailure,
          failureKind: classified.kind,
        })

        handle.fail(message)
      }
    },
    options.userId
  )

  await db
    .update(schema.sessionSongs)
    .set({ backgroundTaskId: taskId })
    .where(eq(schema.sessionSongs.id, songId))

  return { taskId, songId, mode }
}

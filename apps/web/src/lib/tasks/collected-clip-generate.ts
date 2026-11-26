import { inArray } from 'drizzle-orm'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { db } from '@/db'
import { ttsCollectedClipSay, ttsCollectedClips } from '@/db/schema'
import { AiFeature } from '../ai-usage/features'
import { resolveCanonicalText } from '../audio/clipHash'
import { generationRefusal } from '../audio/voices'
import { describeSpeechFailure, SPEECH_TIMEOUT_MS, synthesizeSpeech } from '../speech/synthesize'
import { createTask } from '../task-manager'
import type { CollectedClipGenerateEvent } from './events'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

export interface CollectedClipGenerateInput {
  voice: string
  clipIds: string[]
  _userId?: string
}

export interface CollectedClipGenerateOutput {
  voice: string
  generated: number
  errors: number
  total: number
}

/**
 * Resolve the best input text for TTS generation from the say table.
 * Uses shared resolveCanonicalText for consistent priority logic.
 */
function resolveSayText(
  sayEntries: Map<string, Record<string, string>>,
  clipId: string
): string | null {
  const sayMap = sayEntries.get(clipId)
  if (!sayMap) return null
  const text = resolveCanonicalText(sayMap)
  return text || null
}

/**
 * Start a background task to generate mp3s for collected clips in an
 * ElevenLabs voice (lib/speech). Retired OpenAI voices are refused before
 * anything is generated.
 *
 * Collected clips store their tone as freeform text (or a registered tone
 * name); lib/audio/toneDirections turns it into an audio tag. Files are saved
 * as `{clipId}.mp3`.
 */
export async function startCollectedClipGeneration(
  input: CollectedClipGenerateInput
): Promise<string> {
  return createTask<
    CollectedClipGenerateInput,
    CollectedClipGenerateOutput,
    CollectedClipGenerateEvent
  >('collected-clip-generate', input, async (handle, config) => {
    const refusal = generationRefusal(config.voice)
    if (refusal) {
      handle.fail(refusal)
      return
    }

    const voiceDir = join(AUDIO_DIR, config.voice)
    mkdirSync(voiceDir, { recursive: true })

    console.log('[collected-clip-generate] config:', {
      voice: config.voice,
      clipIds: config.clipIds,
      voiceDir,
    })

    // Fetch clip data from DB
    const clips = await db
      .select()
      .from(ttsCollectedClips)
      .where(inArray(ttsCollectedClips.id, config.clipIds))

    console.log('[collected-clip-generate] DB query result:', {
      requestedIds: config.clipIds,
      foundCount: clips.length,
      foundIds: clips.map((c) => c.id),
    })

    if (clips.length === 0) {
      handle.emit({
        type: 'cc_gen_complete',
        generated: 0,
        errors: 0,
        total: 0,
      })
      handle.complete({
        voice: config.voice,
        generated: 0,
        errors: 0,
        total: 0,
      })
      return
    }

    // Fetch say entries for these clips
    const sayRows = await db
      .select()
      .from(ttsCollectedClipSay)
      .where(inArray(ttsCollectedClipSay.clipId, config.clipIds))

    const sayByClipId = new Map<string, Record<string, string>>()
    for (const row of sayRows) {
      let map = sayByClipId.get(row.clipId)
      if (!map) {
        map = {}
        sayByClipId.set(row.clipId, map)
      }
      map[row.locale] = row.text
    }

    // Filter to clips that don't already have files on disk
    const missing = clips.filter((clip) => {
      const filePath = join(voiceDir, `${clip.id}.mp3`)
      const exists = existsSync(filePath)
      console.log('[collected-clip-generate] file check:', { clipId: clip.id, filePath, exists })
      return !exists
    })

    console.log('[collected-clip-generate] missing clips:', {
      total: clips.length,
      missing: missing.length,
    })

    handle.emit({
      type: 'cc_gen_started',
      voice: config.voice,
      totalClips: clips.length,
      missingClips: missing.length,
    })

    if (missing.length === 0) {
      handle.emit({
        type: 'cc_gen_complete',
        generated: 0,
        errors: 0,
        total: clips.length,
      })
      handle.complete({
        voice: config.voice,
        generated: 0,
        errors: 0,
        total: clips.length,
      })
      return
    }

    handle.setProgress(0, `Generating 0/${missing.length} clips`)

    let generated = 0
    let errors = 0
    let consecutiveErrors = 0
    let lastErrorMessage = ''
    const MAX_CONSECUTIVE_ERRORS = 3

    for (let i = 0; i < missing.length; i++) {
      if (handle.isCancelled()) break

      const clip = missing[i]

      // Resolve input text from say table, falling back to clipId itself
      // (older collected clips may lack say entries if they were registered
      // as plain strings before the default-say fix).
      const inputText = resolveSayText(sayByClipId, clip.id) ?? clip.id

      try {
        const { audio } = await synthesizeSpeech({
          timeoutMs: SPEECH_TIMEOUT_MS.bulk,
          voice: config.voice,
          text: inputText,
          tone: clip.tone,
          usage: config._userId
            ? {
                userId: config._userId,
                feature: AiFeature.TTS_COLLECTED,
                backgroundTaskId: handle.id,
              }
            : undefined,
        })
        writeFileSync(join(voiceDir, `${clip.id}.mp3`), audio)
        generated++
        consecutiveErrors = 0
        handle.emit({ type: 'cc_clip_done', clipId: clip.id })
      } catch (err) {
        errors++
        const errorMsg = err instanceof Error ? err.message : String(err)
        consecutiveErrors++
        lastErrorMessage = errorMsg
        handle.emit({
          type: 'cc_clip_error',
          clipId: clip.id,
          error: errorMsg,
        })
      }

      // Abort early on systemic failures
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        const friendlyMsg = describeSpeechFailure(lastErrorMessage, config.voice)
        handle.fail(friendlyMsg)
        return
      }

      const progress = Math.round(((i + 1) / missing.length) * 100)
      handle.setProgress(progress, `Generating ${i + 1}/${missing.length} clips`)
    }

    handle.emit({
      type: 'cc_gen_complete',
      generated,
      errors,
      total: clips.length,
    })

    handle.complete({
      voice: config.voice,
      generated,
      errors,
      total: clips.length,
    })
  })
}

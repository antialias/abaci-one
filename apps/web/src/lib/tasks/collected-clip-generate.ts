import { inArray } from 'drizzle-orm'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { db } from '@/db'
import { ttsCollectedClips } from '@/db/schema'
import { AiFeature } from '../ai-usage/features'
import { AUDIO_MANIFEST_MAP } from '../audio/audioManifest'
import { generationRefusal } from '../audio/voices'
import { clipFileStem, writeClipFile } from '../speech/clipStorage'
import { firstWrittenSayText } from '../speech/collectedClipText'
import { describeSpeechFailure, SPEECH_TIMEOUT_MS, synthesizeSpeech } from '../speech/synthesize'
import { createTask } from '../task-manager'
import type { CollectedClipGenerateEvent } from './events'

function audioDir(): string {
  return join(process.cwd(), 'data', 'audio')
}

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
 * Start a background task to generate mp3s for collected clips in an
 * ElevenLabs voice (lib/speech). Retired OpenAI voices are refused before
 * anything is generated.
 *
 * Collected clips store their tone as freeform text (or a registered tone
 * name); lib/audio/toneDirections turns it into an audio tag.
 *
 * Files are stored exactly where the on-demand route looks for them
 * (lib/speech/clipStorage): manifest clips as `{clipId}.mp3` with the
 * manifest's text and tone; every other clip under the `t-` key of the text
 * it speaks. Say text in the DB is first-write-wins but still came from a
 * client, so keying by text means a bad row can only ever produce audio for
 * its own words, which no other clip's request reaches.
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

    const voiceDir = join(audioDir(), config.voice)
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

    // What each clip says: its first-written text (lib/speech/collectedClipText).
    const sayText = await firstWrittenSayText(config.clipIds)

    // What each clip speaks and where it's stored. Manifest clips speak the
    // manifest's constant text; others their DB text, falling back to the
    // clip id (older collected clips may lack say entries if they were
    // registered as plain strings before the default-say fix).
    const planned = clips.flatMap((clip) => {
      const manifest = AUDIO_MANIFEST_MAP[clip.id]
      const text = manifest?.text ?? sayText.get(clip.id) ?? clip.id
      const tone = manifest?.tone ?? clip.tone
      try {
        return [{ clip, text, tone, stem: clipFileStem(config.voice, clip.id, text, tone) }]
      } catch (err) {
        // Empty or too long to speak: report it rather than abort the run.
        handle.emit({
          type: 'cc_clip_error',
          clipId: clip.id,
          error: err instanceof Error ? err.message : String(err),
        })
        return []
      }
    })

    // Filter to clips that don't already have files on disk
    const missing = planned.filter(({ stem }) => !existsSync(join(voiceDir, `${stem}.mp3`)))

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

      const { clip, text: inputText, tone, stem } = missing[i]

      try {
        const { audio } = await synthesizeSpeech({
          timeoutMs: SPEECH_TIMEOUT_MS.bulk,
          voice: config.voice,
          text: inputText,
          tone,
          usage: config._userId
            ? {
                userId: config._userId,
                feature: AiFeature.TTS_COLLECTED,
                backgroundTaskId: handle.id,
              }
            : undefined,
        })
        writeClipFile(voiceDir, stem, audio)
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

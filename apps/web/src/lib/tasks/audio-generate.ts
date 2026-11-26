import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { AiFeature } from '@/lib/ai-usage/features'
import { AUDIO_MANIFEST } from '@/lib/audio/audioManifest'
import { generationRefusal } from '@/lib/audio/voices'
import { describeSpeechFailure, SPEECH_TIMEOUT_MS, synthesizeSpeech } from '@/lib/speech/synthesize'
import { createTask } from '../task-manager'
import type { AudioGenerateEvent } from './events'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

export interface AudioGenerateInput {
  voice: string
  clipIds?: string[] // If provided, delete these files first and regenerate only them
  _userId?: string
}

export interface AudioGenerateOutput {
  voice: string
  generated: number
  errors: number
  total: number
}

/**
 * Start an audio generation background task.
 *
 * Generates all missing manifest clips for an ElevenLabs voice (lib/speech).
 * Retired OpenAI voices are refused before anything is generated.
 * Reports per-clip progress via task events.
 */
export async function startAudioGeneration(input: AudioGenerateInput): Promise<string> {
  return createTask<AudioGenerateInput, AudioGenerateOutput, AudioGenerateEvent>(
    'audio-generate',
    input,
    async (handle, config) => {
      const refusal = generationRefusal(config.voice)
      if (refusal) {
        handle.fail(refusal)
        return
      }

      const voiceDir = join(AUDIO_DIR, config.voice)
      mkdirSync(voiceDir, { recursive: true })

      // If clipIds provided, delete those files first so they'll be "missing"
      if (config.clipIds && config.clipIds.length > 0) {
        const targetSet = new Set(config.clipIds)
        for (const clip of AUDIO_MANIFEST) {
          if (targetSet.has(clip.id)) {
            const filePath = join(voiceDir, clip.filename)
            if (existsSync(filePath)) {
              unlinkSync(filePath)
            }
          }
        }
      }

      // Determine which clips to generate
      const clipScope = config.clipIds
        ? AUDIO_MANIFEST.filter((clip) => config.clipIds!.includes(clip.id))
        : AUDIO_MANIFEST

      const missing = clipScope.filter((clip) => !existsSync(join(voiceDir, clip.filename)))

      handle.emit({
        type: 'audio_started',
        voice: config.voice,
        totalClips: clipScope.length,
        missingClips: missing.length,
        clipIds: config.clipIds,
      })

      if (missing.length === 0) {
        handle.emit({
          type: 'audio_complete',
          generated: 0,
          errors: 0,
          total: clipScope.length,
        })
        handle.complete({
          voice: config.voice,
          generated: 0,
          errors: 0,
          total: clipScope.length,
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

        try {
          const { audio } = await synthesizeSpeech({
            timeoutMs: SPEECH_TIMEOUT_MS.bulk,
            voice: config.voice,
            text: clip.text,
            tone: clip.tone,
            usage: config._userId
              ? {
                  userId: config._userId,
                  feature: AiFeature.TTS_BATCH,
                  backgroundTaskId: handle.id,
                }
              : undefined,
          })
          writeFileSync(join(voiceDir, clip.filename), audio)
          generated++
          consecutiveErrors = 0
          handle.emit({ type: 'clip_done', clipId: clip.id })
        } catch (err) {
          errors++
          const errorMsg = err instanceof Error ? err.message : String(err)
          consecutiveErrors++
          lastErrorMessage = errorMsg
          handle.emit({
            type: 'clip_error',
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
        type: 'audio_complete',
        generated,
        errors,
        total: clipScope.length,
      })

      handle.complete({
        voice: config.voice,
        generated,
        errors,
        total: clipScope.length,
      })
    }
  )
}

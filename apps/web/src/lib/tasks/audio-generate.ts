import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { AUDIO_MANIFEST } from '@/lib/audio/audioManifest'
import { buildTtsParams } from '@/lib/audio/toneDirections'
import { createTask } from '../task-manager'
import type { AudioGenerateEvent } from './events'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

export interface AudioGenerateInput {
  voice: string
  clipIds?: string[] // If provided, delete these files first and regenerate only them
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
 * Generates all missing TTS clips for a given voice using OpenAI TTS API.
 * Reports per-clip progress via task events.
 */
export async function startAudioGeneration(input: AudioGenerateInput): Promise<string> {
  return createTask<AudioGenerateInput, AudioGenerateOutput, AudioGenerateEvent>(
    'audio-generate',
    input,
    async (handle, config) => {
      const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
      if (!apiKey) {
        handle.fail('LLM_OPENAI_API_KEY is not configured')
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
          const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini-tts',
              voice: config.voice,
              ...buildTtsParams(clip.text, clip.tone),
              response_format: 'mp3',
            }),
          })

          if (!response.ok) {
            const errText = await response.text()
            errors++
            const errorMsg = `HTTP ${response.status}: ${errText}`
            consecutiveErrors++
            lastErrorMessage = errorMsg
            handle.emit({
              type: 'clip_error',
              clipId: clip.id,
              error: errorMsg,
            })
          } else {
            const arrayBuffer = await response.arrayBuffer()
            writeFileSync(join(voiceDir, clip.filename), Buffer.from(arrayBuffer))
            generated++
            consecutiveErrors = 0
            handle.emit({ type: 'clip_done', clipId: clip.id })
          }
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
          const friendlyMsg = describeSystemicError(lastErrorMessage, config.voice)
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

/** Map raw error messages to user-friendly descriptions for systemic failures. */
function describeSystemicError(rawError: string, voice: string): string {
  if (rawError.includes('EACCES') || rawError.includes('permission denied')) {
    return `Permission denied writing audio files for voice "${voice}". The server cannot write to the audio storage directory. An admin needs to fix the directory permissions.`
  }
  if (rawError.includes('ENOSPC') || rawError.includes('no space')) {
    return `Disk full — not enough space to write audio files for voice "${voice}".`
  }
  if (rawError.includes('ENOENT')) {
    return `Audio storage directory not found for voice "${voice}". The volume may not be mounted.`
  }
  if (rawError.includes('HTTP 401') || rawError.includes('HTTP 403')) {
    return `OpenAI API authentication failed. Check that LLM_OPENAI_API_KEY is valid.`
  }
  if (rawError.includes('HTTP 429')) {
    return `OpenAI API rate limit exceeded. Try again later or reduce batch size.`
  }
  return `Generation failed after repeated errors: ${rawError}`
}

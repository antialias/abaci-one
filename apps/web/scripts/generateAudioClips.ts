#!/usr/bin/env tsx

/**
 * Generate audio clips from the audio manifest using OpenAI's TTS API.
 *
 * Usage: OPENAI_API_KEY=sk-... npx tsx scripts/generateAudioClips.ts [--voice <voice>]
 *
 * Options:
 *   --voice <voice>  OpenAI TTS voice name (default: 'nova')
 *
 * Idempotent: skips clips that already exist in public/audio/{voice}/
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import OpenAI from 'openai'
import { AUDIO_MANIFEST } from '../src/lib/audio/audioManifest'

function parseArgs(): { voice: string } {
  const args = process.argv.slice(2)
  let voice = 'nova'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--voice' && args[i + 1]) {
      voice = args[i + 1]
      i++
    }
  }

  return { voice }
}

async function main() {
  const { voice } = parseArgs()
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required')
    process.exit(1)
  }

  const client = new OpenAI({ apiKey })

  const outputDir = join(__dirname, '..', 'public', 'audio', voice)
  mkdirSync(outputDir, { recursive: true })

  console.log(`Voice: ${voice}`)
  console.log(`Output: ${outputDir}`)

  let generated = 0
  let skipped = 0

  for (const clip of AUDIO_MANIFEST) {
    const outputPath = join(outputDir, clip.filename)

    if (existsSync(outputPath)) {
      skipped++
      continue
    }

    console.log(`Generating: ${clip.id} ("${clip.text}")`)

    try {
      const response = await client.audio.speech.create({
        model: 'tts-1',
        voice: voice as 'nova' | 'shimmer' | 'alloy' | 'echo' | 'fable' | 'onyx',
        input: clip.text,
        response_format: 'mp3',
      })

      const buffer = Buffer.from(await response.arrayBuffer())
      writeFileSync(outputPath, buffer)
      generated++
    } catch (error) {
      console.error(`Failed to generate ${clip.id}:`, error)
      process.exit(1)
    }
  }

  console.log(`\nDone! Generated: ${generated}, Skipped (existing): ${skipped}`)
  console.log(`Total clips in manifest: ${AUDIO_MANIFEST.length}`)
  console.log(`Output directory: ${outputDir}`)
}

main()

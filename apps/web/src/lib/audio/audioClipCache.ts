import { AUDIO_MANIFEST_MAP } from './audioManifest'

let audioContext: AudioContext | null = null
const bufferCache = new Map<string, AudioBuffer>()

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )()
  }
  // Resume if suspended (iOS requires user gesture)
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  return audioContext
}

export function getSharedAudioContext(): AudioContext {
  return getAudioContext()
}

export async function loadClip(clipId: string, voice: string): Promise<AudioBuffer> {
  const cacheKey = `${voice}/${clipId}`
  const cached = bufferCache.get(cacheKey)
  if (cached) return cached

  const entry = AUDIO_MANIFEST_MAP[clipId]
  if (!entry) {
    throw new Error(`Audio clip not found in manifest: ${clipId}`)
  }

  const ctx = getAudioContext()
  const response = await fetch(`/audio/${voice}/${entry.filename}`)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch audio clip: /audio/${voice}/${entry.filename} (${response.status})`
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  bufferCache.set(cacheKey, audioBuffer)
  return audioBuffer
}

export async function preloadClips(clipIds: string[], voice: string): Promise<void> {
  await Promise.all(clipIds.map((id) => loadClip(id, voice).catch(() => {})))
}

export function isClipCached(clipId: string, voice: string): boolean {
  return bufferCache.has(`${voice}/${clipId}`)
}

export function clearCache(): void {
  bufferCache.clear()
}

export function closeAudioContext(): void {
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  bufferCache.clear()
}

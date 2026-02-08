import { getSharedAudioContext, loadClip } from './audioClipCache'
import type { SequenceItem } from './problemReader'

let currentAbortController: AbortController | null = null

/**
 * Play a sequence of audio clips with pauses between them.
 * Cancels any currently playing sequence.
 */
export async function playSequence(
  items: SequenceItem[],
  volume: number = 1.0,
  voice: string = 'nova'
): Promise<void> {
  // Cancel any in-progress sequence
  cancel()

  const controller = new AbortController()
  currentAbortController = controller

  const ctx = getSharedAudioContext()

  for (const item of items) {
    if (controller.signal.aborted) return

    try {
      const buffer = await loadClip(item.clipId, voice)
      if (controller.signal.aborted) return

      await playBuffer(ctx, buffer, volume)
      if (controller.signal.aborted) return

      if (item.pauseAfterMs > 0) {
        await delay(item.pauseAfterMs, controller.signal)
      }
    } catch {
      if (controller.signal.aborted) return
      // Skip clips that fail to load and continue
    }
  }

  if (currentAbortController === controller) {
    currentAbortController = null
  }
}

/**
 * Play a single AudioBuffer and wait for it to finish.
 */
function playBuffer(ctx: AudioContext, buffer: AudioBuffer, volume: number): Promise<void> {
  return new Promise((resolve) => {
    const source = ctx.createBufferSource()
    const gainNode = ctx.createGain()

    source.buffer = buffer
    gainNode.gain.value = volume
    source.connect(gainNode)
    gainNode.connect(ctx.destination)

    source.onended = () => resolve()
    source.start(0)
  })
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })
}

/**
 * Cancel any currently playing sequence.
 */
export function cancel(): void {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
}

/**
 * Whether a sequence is currently playing.
 */
export function isPlaying(): boolean {
  return currentAbortController !== null && !currentAbortController.signal.aborted
}

'use client'

// AudioContext manager for generating abacus bead click sounds
let audioCtx: AudioContext | null = null

/**
 * Gets or creates the global AudioContext instance
 * SSR-safe - returns null in server environment
 */
export function getAudioContext(): AudioContext | null {
  // SSR guard - only initialize on client
  if (typeof window === 'undefined') return null

  if (!audioCtx) {
    // Support older Safari versions with webkit prefix
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
    try {
      audioCtx = new AudioCtxClass()
    } catch (e) {
      console.warn('AudioContext could not be initialized:', e)
      return null
    }
  }

  return audioCtx
}

/**
 * Plays a realistic "cozy" bead click sound using Web Audio API
 * Generates sound on-the-fly with no external assets
 * @param volume - Volume level from 0.0 to 1.0
 * @param intensity - Number of beads moved (1-5) to adjust sound heft
 */
export function playBeadSound(volume: number, intensity: number = 1): void {
  const ctx = getAudioContext()
  if (!ctx) return // No audio context available (SSR or initialization failed)

  // Clamp volume to valid range
  const clampedVolume = Math.max(0, Math.min(1, volume))
  if (clampedVolume === 0) return // Skip if volume is zero

  // Clamp intensity to reasonable range (1-5 beads)
  const clampedIntensity = Math.max(1, Math.min(5, intensity))

  const now = ctx.currentTime

  // Calculate sound characteristics based on intensity
  const intensityFactor = Math.sqrt(clampedIntensity) // Square root for natural scaling
  const volumeMultiplier = 0.8 + (intensityFactor - 1) * 0.3 // 0.8 to 1.4 range
  const durationMultiplier = 0.8 + (intensityFactor - 1) * 0.4 // Longer decay for more beads
  const lowFreqBoost = 1 + (intensityFactor - 1) * 0.3 // Lower frequency for more heft

  // Create gain node for volume envelope
  const gainNode = ctx.createGain()
  gainNode.connect(ctx.destination)

  // Create primary oscillator for the warm "thock" sound
  const lowOsc = ctx.createOscillator()
  lowOsc.type = 'triangle' // Warmer than sine, less harsh than square
  lowOsc.frequency.setValueAtTime(220 / lowFreqBoost, now) // Lower frequency for more heft

  // Create secondary oscillator for the sharp "click" component
  const highOsc = ctx.createOscillator()
  highOsc.type = 'sine'
  highOsc.frequency.setValueAtTime(1400, now) // Higher frequency for the tap clarity

  // Optional third oscillator for extra richness on multi-bead movements
  let richOsc: OscillatorNode | null = null
  let richGain: GainNode | null = null
  if (clampedIntensity > 2) {
    richOsc = ctx.createOscillator()
    richOsc.type = 'triangle'
    richOsc.frequency.setValueAtTime(110, now) // Sub-harmonic for richness
    richGain = ctx.createGain()
    richGain.gain.setValueAtTime(clampedVolume * volumeMultiplier * 0.2 * (intensityFactor - 1), now)
    richOsc.connect(richGain)
    richGain.connect(gainNode)
  }

  // Create separate gain nodes for mixing the two main components
  const lowGain = ctx.createGain()
  const highGain = ctx.createGain()

  lowGain.gain.setValueAtTime(clampedVolume * volumeMultiplier * 0.7, now) // Primary component
  highGain.gain.setValueAtTime(clampedVolume * volumeMultiplier * 0.3, now) // Secondary accent

  // Connect oscillators through their gain nodes to the main envelope
  lowOsc.connect(lowGain)
  highOsc.connect(highGain)
  lowGain.connect(gainNode)
  highGain.connect(gainNode)

  // Calculate duration based on intensity
  const baseDuration = 0.08 // 80ms base duration
  const actualDuration = baseDuration * durationMultiplier

  // Create exponential decay envelope for natural sound
  gainNode.gain.setValueAtTime(1.0, now)
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + actualDuration)

  // Start oscillators
  lowOsc.start(now)
  highOsc.start(now)
  if (richOsc) richOsc.start(now)

  // Stop oscillators at end of envelope
  const stopTime = now + actualDuration
  lowOsc.stop(stopTime)
  highOsc.stop(stopTime)
  if (richOsc) richOsc.stop(stopTime)

  // Cleanup: disconnect nodes when sound finishes to prevent memory leaks
  lowOsc.onended = () => {
    lowOsc.disconnect()
    highOsc.disconnect()
    lowGain.disconnect()
    highGain.disconnect()
    gainNode.disconnect()
    if (richOsc && richGain) {
      richOsc.disconnect()
      richGain.disconnect()
    }
  }
}
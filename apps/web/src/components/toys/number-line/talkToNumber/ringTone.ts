/**
 * Synthesize a classic phone ring tone using the Web Audio API.
 * Two-tone burst (440Hz + 480Hz), ~2s on, ~4s off pattern.
 * No external audio files needed.
 */

export function playRingTone(audioContext: AudioContext): { stop: () => void } {
  let stopped = false
  const gainNode = audioContext.createGain()
  gainNode.gain.value = 0
  gainNode.connect(audioContext.destination)

  // Two oscillators for the classic ring
  const osc1 = audioContext.createOscillator()
  osc1.frequency.value = 440
  osc1.type = 'sine'
  osc1.connect(gainNode)

  const osc2 = audioContext.createOscillator()
  osc2.frequency.value = 480
  osc2.type = 'sine'
  osc2.connect(gainNode)

  osc1.start()
  osc2.start()

  // Schedule ring bursts: ring for 1s, silence for 1.5s, repeat
  const ringDuration = 1.0
  const silenceDuration = 1.5
  const ringVolume = 0.12
  const now = audioContext.currentTime

  for (let i = 0; i < 3; i++) {
    const burstStart = now + i * (ringDuration + silenceDuration)
    // Ramp up
    gainNode.gain.setValueAtTime(0, burstStart)
    gainNode.gain.linearRampToValueAtTime(ringVolume, burstStart + 0.02)
    // Ring sustain — add subtle tremolo for more realistic ring
    const tremoloRate = 20 // Hz
    const tremoloDepth = ringVolume * 0.3
    const steps = Math.floor(ringDuration * tremoloRate)
    for (let j = 0; j <= steps; j++) {
      const t = burstStart + 0.02 + (j / tremoloRate)
      const v = ringVolume + tremoloDepth * Math.sin(j * Math.PI)
      gainNode.gain.linearRampToValueAtTime(v, t)
    }
    // Ramp down
    gainNode.gain.setValueAtTime(ringVolume, burstStart + ringDuration - 0.02)
    gainNode.gain.linearRampToValueAtTime(0, burstStart + ringDuration)
  }

  // Auto-stop after all rings
  const totalDuration = 3 * (ringDuration + silenceDuration)
  const stopTimer = setTimeout(() => {
    if (!stopped) cleanup()
  }, totalDuration * 1000 + 100)

  function cleanup() {
    stopped = true
    try {
      osc1.stop()
      osc2.stop()
      osc1.disconnect()
      osc2.disconnect()
      gainNode.disconnect()
    } catch {
      // Already stopped
    }
  }

  return {
    stop() {
      clearTimeout(stopTimer)
      if (!stopped) {
        // Quick fade out
        try {
          gainNode.gain.cancelScheduledValues(audioContext.currentTime)
          gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime)
          gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05)
          setTimeout(cleanup, 60)
        } catch {
          cleanup()
        }
      }
    },
  }
}

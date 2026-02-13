/**
 * Synthesize a caller-perspective phone ring tone using the Web Audio API.
 * Classic North American ringback: two-tone (440Hz + 480Hz), ~1s on, ~0.25s
 * off, repeating until stopped. No external audio files needed.
 */

export function playRingTone(audioContext: AudioContext): { stop: () => void } {
  let stopped = false
  const gainNode = audioContext.createGain()
  gainNode.gain.value = 0
  gainNode.connect(audioContext.destination)

  // Two oscillators for the classic dual-tone ring
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

  // Caller-side ring pattern: ~1s on, ~0.25s off, repeating
  const ringDuration = 1.0
  const silenceDuration = 0.25
  const cycleDuration = ringDuration + silenceDuration
  const ringVolume = 0.12
  const RAMP_MS = 0.015 // 15ms ramp to avoid clicks

  // Schedule several cycles ahead. The ringing will be stopped externally
  // when the call connects, so we schedule plenty of cycles.
  const maxCycles = 20 // ~25s of ringing, more than enough
  const now = audioContext.currentTime

  for (let i = 0; i < maxCycles; i++) {
    const burstStart = now + i * cycleDuration
    // Ramp up
    gainNode.gain.setValueAtTime(0, burstStart)
    gainNode.gain.linearRampToValueAtTime(ringVolume, burstStart + RAMP_MS)
    // Hold
    gainNode.gain.setValueAtTime(ringVolume, burstStart + ringDuration - RAMP_MS)
    // Ramp down
    gainNode.gain.linearRampToValueAtTime(0, burstStart + ringDuration)
  }

  // Auto-stop after all scheduled cycles (safety net)
  const totalDuration = maxCycles * cycleDuration
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

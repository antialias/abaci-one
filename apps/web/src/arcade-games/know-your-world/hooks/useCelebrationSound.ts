/**
 * Celebration Sound Hook
 *
 * Uses Web Audio API to generate celebration sounds without audio files.
 * Three distinct sounds for different celebration types:
 * - Lightning: Quick sparkle (high pitch, fast)
 * - Standard: Pleasant two-note chime
 * - Hard-earned: Triumphant ascending arpeggio
 */

import { useCallback, useRef } from "react";
import type { CelebrationType } from "../Provider";

// Musical frequencies (Hz) - based on C major scale
const NOTES = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  C5: 523.25,
  E5: 659.25,
  G5: 784.0,
};

export function useCelebrationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Get or create audio context (lazy initialization)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      } catch {
        console.warn("Web Audio API not supported");
        return null;
      }
    }

    // Resume if suspended (browsers require user interaction first)
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  // Play a single note with envelope
  const playNote = useCallback(
    (
      ctx: AudioContext,
      frequency: number,
      startTime: number,
      duration: number,
      volume: number = 0.3,
    ) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startTime);

      // Envelope: quick attack, sustain, smooth release
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02); // Attack
      gainNode.gain.setValueAtTime(volume, startTime + duration * 0.7); // Sustain
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Release

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    },
    [],
  );

  // Lightning: Quick sparkle sound
  const playLightning = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Quick ascending glissando
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }, [getAudioContext]);

  // Standard: Two-note chime (C-E)
  const playStandard = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // C4 then E4 chord
    playNote(ctx, NOTES.C5, now, 0.3, 0.25);
    playNote(ctx, NOTES.E5, now + 0.08, 0.35, 0.2);
  }, [getAudioContext, playNote]);

  // Hard-earned: Triumphant C-E-G arpeggio
  const playHardEarned = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Ascending C-E-G arpeggio with final chord
    playNote(ctx, NOTES.C4, now, 0.25, 0.2);
    playNote(ctx, NOTES.E4, now + 0.1, 0.25, 0.2);
    playNote(ctx, NOTES.G4, now + 0.2, 0.25, 0.2);

    // Final chord (C-E-G together)
    playNote(ctx, NOTES.C5, now + 0.35, 0.4, 0.15);
    playNote(ctx, NOTES.E5, now + 0.35, 0.4, 0.15);
    playNote(ctx, NOTES.G5, now + 0.35, 0.4, 0.15);
  }, [getAudioContext, playNote]);

  // Play celebration sound based on type
  const playCelebration = useCallback(
    (type: CelebrationType) => {
      switch (type) {
        case "lightning":
          playLightning();
          break;
        case "standard":
          playStandard();
          break;
        case "hard-earned":
          playHardEarned();
          break;
      }
    },
    [playLightning, playStandard, playHardEarned],
  );

  return { playCelebration };
}

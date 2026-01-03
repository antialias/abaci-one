"use client";

import { useCallback, useRef } from "react";

/**
 * Sound effects for practice sessions using Web Audio API.
 * Generates programmatic sounds - no audio files needed.
 */

interface Note {
  freq: number;
  time: number;
  duration: number;
}

export function usePracticeSoundEffects() {
  const audioContextsRef = useRef<AudioContext[]>([]);

  /**
   * Helper to play multi-note sounds
   */
  const playNotes = useCallback(
    (
      audioContext: AudioContext,
      notes: Note[],
      volume: number = 0.15,
      waveType: OscillatorType = "sine",
    ) => {
      for (const note of notes) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filterNode = audioContext.createBiquadFilter();

        oscillator.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = waveType;

        filterNode.type = "lowpass";
        filterNode.frequency.setValueAtTime(
          2000,
          audioContext.currentTime + note.time,
        );
        filterNode.Q.setValueAtTime(1, audioContext.currentTime + note.time);

        oscillator.frequency.setValueAtTime(
          note.freq,
          audioContext.currentTime + note.time,
        );

        // Envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + note.time);
        gainNode.gain.exponentialRampToValueAtTime(
          volume,
          audioContext.currentTime + note.time + 0.01,
        );
        gainNode.gain.exponentialRampToValueAtTime(
          volume * 0.7,
          audioContext.currentTime + note.time + note.duration * 0.7,
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + note.time + note.duration,
        );

        oscillator.start(audioContext.currentTime + note.time);
        oscillator.stop(audioContext.currentTime + note.time + note.duration);
      }
    },
    [],
  );

  /**
   * Play a practice sound effect
   */
  const playSound = useCallback(
    (type: "womp_womp" | "correct" | "incorrect", volume: number = 0.15) => {
      try {
        const audioContext = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        audioContextsRef.current.push(audioContext);

        switch (type) {
          case "womp_womp":
            // Classic sad trombone - descending notes with slight wobble
            playNotes(
              audioContext,
              [
                { freq: 392, time: 0, duration: 0.22 }, // G4
                { freq: 370, time: 0.22, duration: 0.22 }, // F#4 (slightly flat)
                { freq: 330, time: 0.44, duration: 0.22 }, // E4
                { freq: 277, time: 0.66, duration: 0.5 }, // C#4 - long sad ending
              ],
              volume * 0.8,
              "triangle", // Softer, trombone-like
            );
            break;

          case "correct":
            // Quick ascending celebration
            playNotes(
              audioContext,
              [
                { freq: 523, time: 0, duration: 0.08 }, // C5
                { freq: 659, time: 0.08, duration: 0.08 }, // E5
                { freq: 784, time: 0.16, duration: 0.12 }, // G5
              ],
              volume,
              "sawtooth",
            );
            break;

          case "incorrect":
            // Descending buzz
            playNotes(
              audioContext,
              [
                { freq: 400, time: 0, duration: 0.15 },
                { freq: 300, time: 0.05, duration: 0.15 },
                { freq: 200, time: 0.1, duration: 0.2 },
              ],
              volume * 0.8,
              "square",
            );
            break;
        }
      } catch {
        // Web Audio not supported - silently fail
      }
    },
    [playNotes],
  );

  /**
   * Clean up audio contexts
   */
  const cleanup = useCallback(() => {
    for (const context of audioContextsRef.current) {
      try {
        context.close();
      } catch {
        // Ignore errors
      }
    }
    audioContextsRef.current = [];
  }, []);

  return { playSound, cleanup };
}

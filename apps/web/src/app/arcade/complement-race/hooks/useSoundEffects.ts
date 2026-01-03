import { useCallback, useContext, useRef } from "react";
import { PreviewModeContext } from "@/components/GamePreview";

/**
 * Web Audio API sound effects system
 * Generates retro 90s-style arcade sounds programmatically
 *
 * Based on original implementation from web_generator.py lines 14218-14490
 */

interface Note {
  freq: number;
  time: number;
  duration: number;
}

export function useSoundEffects() {
  const audioContextsRef = useRef<AudioContext[]>([]);
  const previewMode = useContext(PreviewModeContext);

  /**
   * Helper function to play multi-note 90s arcade sounds
   */
  const play90sSound = useCallback(
    (
      audioContext: AudioContext,
      notes: Note[],
      volume: number = 0.15,
      waveType: OscillatorType = "sine",
    ) => {
      notes.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filterNode = audioContext.createBiquadFilter();

        // Create that classic 90s arcade sound chain
        oscillator.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Set wave type for that retro flavor
        oscillator.type = waveType;

        // Add some 90s-style filtering
        filterNode.type = "lowpass";
        filterNode.frequency.setValueAtTime(
          2000,
          audioContext.currentTime + note.time,
        );
        filterNode.Q.setValueAtTime(1, audioContext.currentTime + note.time);

        // Set frequency and add vibrato for that classic arcade wobble
        oscillator.frequency.setValueAtTime(
          note.freq,
          audioContext.currentTime + note.time,
        );
        if (waveType === "sawtooth" || waveType === "square") {
          // Add slight vibrato for extra 90s flavor
          oscillator.frequency.exponentialRampToValueAtTime(
            note.freq * 1.02,
            audioContext.currentTime + note.time + note.duration * 0.5,
          );
          oscillator.frequency.exponentialRampToValueAtTime(
            note.freq,
            audioContext.currentTime + note.time + note.duration,
          );
        }

        // Classic arcade envelope - quick attack, moderate decay
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
      });
    },
    [],
  );

  /**
   * Play a sound effect
   * @param type - Sound type (correct, incorrect, countdown, etc.)
   * @param volume - Volume level (0-1), default 0.15
   */
  const playSound = useCallback(
    (
      type:
        | "correct"
        | "incorrect"
        | "timeout"
        | "countdown"
        | "race_start"
        | "celebration"
        | "lap_celebration"
        | "gameOver"
        | "ai_turbo"
        | "milestone"
        | "streak"
        | "combo"
        | "whoosh"
        | "train_chuff"
        | "train_whistle"
        | "coal_spill"
        | "steam_hiss",
      volume: number = 0.15,
    ) => {
      // Disable all audio in preview mode
      if (previewMode?.isPreview) {
        return;
      }

      try {
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();

        // Track audio contexts for cleanup
        audioContextsRef.current.push(audioContext);

        switch (type) {
          case "correct":
            // Classic 90s "power-up" sound - ascending beeps
            play90sSound(
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
            // Classic arcade "error" sound - descending buzz
            play90sSound(
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

          case "timeout":
            // Classic "time's up" alarm
            play90sSound(
              audioContext,
              [
                { freq: 800, time: 0, duration: 0.1 },
                { freq: 600, time: 0.1, duration: 0.1 },
                { freq: 800, time: 0.2, duration: 0.1 },
                { freq: 600, time: 0.3, duration: 0.15 },
              ],
              volume,
              "square",
            );
            break;

          case "countdown":
            // Classic arcade countdown beep
            play90sSound(
              audioContext,
              [{ freq: 800, time: 0, duration: 0.15 }],
              volume * 0.6,
              "sine",
            );
            break;

          case "race_start":
            // Epic race start fanfare
            play90sSound(
              audioContext,
              [
                { freq: 523, time: 0, duration: 0.1 }, // C5
                { freq: 659, time: 0.1, duration: 0.1 }, // E5
                { freq: 784, time: 0.2, duration: 0.1 }, // G5
                { freq: 1046, time: 0.3, duration: 0.3 }, // C6 - triumphant!
              ],
              volume * 1.2,
              "sawtooth",
            );
            break;

          case "celebration":
            // Classic victory fanfare - like completing a level
            play90sSound(
              audioContext,
              [
                { freq: 523, time: 0, duration: 0.12 }, // C5
                { freq: 659, time: 0.12, duration: 0.12 }, // E5
                { freq: 784, time: 0.24, duration: 0.12 }, // G5
                { freq: 1046, time: 0.36, duration: 0.24 }, // C6
                { freq: 1318, time: 0.6, duration: 0.3 }, // E6 - epic finish!
              ],
              volume * 1.5,
              "sawtooth",
            );
            break;

          case "lap_celebration":
            // Radical "bonus achieved" sound
            play90sSound(
              audioContext,
              [
                { freq: 1046, time: 0, duration: 0.08 }, // C6
                { freq: 1318, time: 0.08, duration: 0.08 }, // E6
                { freq: 1568, time: 0.16, duration: 0.08 }, // G6
                { freq: 2093, time: 0.24, duration: 0.15 }, // C7 - totally rad!
              ],
              volume * 1.3,
              "sawtooth",
            );
            break;

          case "gameOver":
            // Classic "game over" descending tones
            play90sSound(
              audioContext,
              [
                { freq: 400, time: 0, duration: 0.2 },
                { freq: 350, time: 0.2, duration: 0.2 },
                { freq: 300, time: 0.4, duration: 0.2 },
                { freq: 250, time: 0.6, duration: 0.3 },
                { freq: 200, time: 0.9, duration: 0.4 },
              ],
              volume,
              "triangle",
            );
            break;

          case "ai_turbo":
            // Sound when AI goes into turbo mode
            play90sSound(
              audioContext,
              [
                { freq: 200, time: 0, duration: 0.05 },
                { freq: 400, time: 0.05, duration: 0.05 },
                { freq: 600, time: 0.1, duration: 0.05 },
                { freq: 800, time: 0.15, duration: 0.1 },
              ],
              volume * 0.7,
              "sawtooth",
            );
            break;

          case "milestone":
            // Rad milestone sound - like collecting a power-up
            play90sSound(
              audioContext,
              [
                { freq: 659, time: 0, duration: 0.1 }, // E5
                { freq: 784, time: 0.1, duration: 0.1 }, // G5
                { freq: 880, time: 0.2, duration: 0.1 }, // A5
                { freq: 1046, time: 0.3, duration: 0.15 }, // C6 - awesome!
              ],
              volume * 1.1,
              "sawtooth",
            );
            break;

          case "streak":
            // Epic streak sound - getting hot!
            play90sSound(
              audioContext,
              [
                { freq: 880, time: 0, duration: 0.06 }, // A5
                { freq: 1046, time: 0.06, duration: 0.06 }, // C6
                { freq: 1318, time: 0.12, duration: 0.08 }, // E6
                { freq: 1760, time: 0.2, duration: 0.1 }, // A6 - on fire!
              ],
              volume * 1.2,
              "sawtooth",
            );
            break;

          case "combo":
            // Gnarly combo sound - for rapid correct answers
            play90sSound(
              audioContext,
              [
                { freq: 1046, time: 0, duration: 0.04 }, // C6
                { freq: 1175, time: 0.04, duration: 0.04 }, // D6
                { freq: 1318, time: 0.08, duration: 0.04 }, // E6
                { freq: 1480, time: 0.12, duration: 0.06 }, // F#6
              ],
              volume * 0.9,
              "square",
            );
            break;

          case "whoosh": {
            // Cool whoosh sound for fast responses
            const whooshOsc = audioContext.createOscillator();
            const whooshGain = audioContext.createGain();
            const whooshFilter = audioContext.createBiquadFilter();

            whooshOsc.connect(whooshFilter);
            whooshFilter.connect(whooshGain);
            whooshGain.connect(audioContext.destination);

            whooshOsc.type = "sawtooth";
            whooshFilter.type = "highpass";
            whooshFilter.frequency.setValueAtTime(
              1000,
              audioContext.currentTime,
            );
            whooshFilter.frequency.exponentialRampToValueAtTime(
              100,
              audioContext.currentTime + 0.3,
            );

            whooshOsc.frequency.setValueAtTime(400, audioContext.currentTime);
            whooshOsc.frequency.exponentialRampToValueAtTime(
              800,
              audioContext.currentTime + 0.15,
            );
            whooshOsc.frequency.exponentialRampToValueAtTime(
              200,
              audioContext.currentTime + 0.3,
            );

            whooshGain.gain.setValueAtTime(0, audioContext.currentTime);
            whooshGain.gain.exponentialRampToValueAtTime(
              volume * 0.6,
              audioContext.currentTime + 0.02,
            );
            whooshGain.gain.exponentialRampToValueAtTime(
              0.001,
              audioContext.currentTime + 0.3,
            );

            whooshOsc.start(audioContext.currentTime);
            whooshOsc.stop(audioContext.currentTime + 0.3);
            break;
          }

          case "train_chuff": {
            // Realistic steam train chuffing sound
            const chuffOsc = audioContext.createOscillator();
            const chuffGain = audioContext.createGain();
            const chuffFilter = audioContext.createBiquadFilter();

            chuffOsc.connect(chuffFilter);
            chuffFilter.connect(chuffGain);
            chuffGain.connect(audioContext.destination);

            chuffOsc.type = "sawtooth";
            chuffFilter.type = "bandpass";
            chuffFilter.frequency.setValueAtTime(150, audioContext.currentTime);
            chuffFilter.Q.setValueAtTime(5, audioContext.currentTime);

            chuffOsc.frequency.setValueAtTime(80, audioContext.currentTime);
            chuffOsc.frequency.exponentialRampToValueAtTime(
              120,
              audioContext.currentTime + 0.05,
            );
            chuffOsc.frequency.exponentialRampToValueAtTime(
              60,
              audioContext.currentTime + 0.2,
            );

            chuffGain.gain.setValueAtTime(0, audioContext.currentTime);
            chuffGain.gain.exponentialRampToValueAtTime(
              volume * 0.8,
              audioContext.currentTime + 0.01,
            );
            chuffGain.gain.exponentialRampToValueAtTime(
              0.001,
              audioContext.currentTime + 0.2,
            );

            chuffOsc.start(audioContext.currentTime);
            chuffOsc.stop(audioContext.currentTime + 0.2);
            break;
          }

          case "train_whistle":
            // Classic steam train whistle
            play90sSound(
              audioContext,
              [
                { freq: 523, time: 0, duration: 0.3 }, // C5 - long whistle
                { freq: 659, time: 0.1, duration: 0.4 }, // E5 - harmony
                { freq: 523, time: 0.3, duration: 0.2 }, // C5 - fade out
              ],
              volume * 1.2,
              "sine",
            );
            break;

          case "coal_spill": {
            // Coal chunks spilling sound effect
            const coalOsc = audioContext.createOscillator();
            const coalGain = audioContext.createGain();
            const coalFilter = audioContext.createBiquadFilter();

            coalOsc.connect(coalFilter);
            coalFilter.connect(coalGain);
            coalGain.connect(audioContext.destination);

            coalOsc.type = "square";
            coalFilter.type = "lowpass";
            coalFilter.frequency.setValueAtTime(300, audioContext.currentTime);

            // Simulate coal chunks falling with random frequency bursts
            coalOsc.frequency.setValueAtTime(
              200 + Math.random() * 100,
              audioContext.currentTime,
            );
            coalOsc.frequency.exponentialRampToValueAtTime(
              100 + Math.random() * 50,
              audioContext.currentTime + 0.1,
            );
            coalOsc.frequency.exponentialRampToValueAtTime(
              80 + Math.random() * 40,
              audioContext.currentTime + 0.3,
            );

            coalGain.gain.setValueAtTime(0, audioContext.currentTime);
            coalGain.gain.exponentialRampToValueAtTime(
              volume * 0.6,
              audioContext.currentTime + 0.01,
            );
            coalGain.gain.exponentialRampToValueAtTime(
              volume * 0.3,
              audioContext.currentTime + 0.15,
            );
            coalGain.gain.exponentialRampToValueAtTime(
              0.001,
              audioContext.currentTime + 0.4,
            );

            coalOsc.start(audioContext.currentTime);
            coalOsc.stop(audioContext.currentTime + 0.4);
            break;
          }

          case "steam_hiss": {
            // Steam hissing sound for locomotive
            const steamOsc = audioContext.createOscillator();
            const steamGain = audioContext.createGain();
            const steamFilter = audioContext.createBiquadFilter();

            steamOsc.connect(steamFilter);
            steamFilter.connect(steamGain);
            steamGain.connect(audioContext.destination);

            steamOsc.type = "triangle";
            steamFilter.type = "highpass";
            steamFilter.frequency.setValueAtTime(
              2000,
              audioContext.currentTime,
            );

            steamOsc.frequency.setValueAtTime(
              4000 + Math.random() * 1000,
              audioContext.currentTime,
            );

            steamGain.gain.setValueAtTime(0, audioContext.currentTime);
            steamGain.gain.exponentialRampToValueAtTime(
              volume * 0.4,
              audioContext.currentTime + 0.02,
            );
            steamGain.gain.exponentialRampToValueAtTime(
              0.001,
              audioContext.currentTime + 0.6,
            );

            steamOsc.start(audioContext.currentTime);
            steamOsc.stop(audioContext.currentTime + 0.6);
            break;
          }
        }
      } catch (_e) {
        console.log(
          "🎵 Web Audio not supported - missing out on rad 90s sounds!",
        );
      }
    },
    [play90sSound, previewMode],
  );

  /**
   * Stop all currently playing sounds
   */
  const stopAllSounds = useCallback(() => {
    try {
      if (audioContextsRef.current.length > 0) {
        audioContextsRef.current.forEach((context) => {
          try {
            context.close();
          } catch (_e) {
            // Ignore errors
          }
        });
        audioContextsRef.current = [];
      }
    } catch (e) {
      console.log("🔇 Sound cleanup error:", e);
    }
  }, []);

  return {
    playSound,
    stopAllSounds,
  };
}

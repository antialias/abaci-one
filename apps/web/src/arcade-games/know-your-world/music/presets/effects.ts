/**
 * Dynamic Music Effects
 *
 * Provides real-time musical reactivity:
 * - Temperature modulation based on hot/cold feedback
 * - Celebration flourishes when finding regions
 *
 * Uses Strudel's pattern modifiers to adjust running patterns.
 */

import type { FeedbackType } from "../../utils/hotColdPhrases";
import type { CelebrationType } from "../../Provider";

/**
 * Temperature effect settings.
 * Affects filter cutoff, speed, and brightness.
 */
export interface TemperatureEffect {
  /** Low-pass filter cutoff (higher = brighter) */
  lpfMultiplier: number;
  /** Speed modifier (faster when hotter) */
  speedMultiplier: number;
  /** Gain adjustment */
  gainMultiplier: number;
  /** Room reverb adjustment */
  roomMultiplier: number;
}

/**
 * Map hot/cold feedback types to musical temperature effects.
 * Hot = brighter, faster, more present
 * Cold = darker, slower, more distant
 */
export function getTemperatureEffect(
  feedbackType: FeedbackType | null,
): TemperatureEffect {
  const neutral: TemperatureEffect = {
    lpfMultiplier: 1.0,
    speedMultiplier: 1.0,
    gainMultiplier: 1.0,
    roomMultiplier: 1.0,
  };

  if (!feedbackType) return neutral;

  switch (feedbackType) {
    // Very hot - brightest, most energetic
    case "on_fire":
      return {
        lpfMultiplier: 2.0,
        speedMultiplier: 1.3,
        gainMultiplier: 1.2,
        roomMultiplier: 0.6,
      };

    // Hot - bright and lively
    case "hot":
      return {
        lpfMultiplier: 1.6,
        speedMultiplier: 1.15,
        gainMultiplier: 1.1,
        roomMultiplier: 0.75,
      };

    // Getting warmer - subtle brightness
    case "warmer":
      return {
        lpfMultiplier: 1.3,
        speedMultiplier: 1.05,
        gainMultiplier: 1.05,
        roomMultiplier: 0.9,
      };

    // Found it - brief excitation
    case "found_it":
      return {
        lpfMultiplier: 2.5,
        speedMultiplier: 1.4,
        gainMultiplier: 1.3,
        roomMultiplier: 0.5,
      };

    // Getting colder - subtle darkness
    case "colder":
      return {
        lpfMultiplier: 0.8,
        speedMultiplier: 0.95,
        gainMultiplier: 0.95,
        roomMultiplier: 1.1,
      };

    // Cold - darker, slower
    case "cold":
      return {
        lpfMultiplier: 0.6,
        speedMultiplier: 0.9,
        gainMultiplier: 0.85,
        roomMultiplier: 1.3,
      };

    // Freezing - darkest, most distant
    case "freezing":
      return {
        lpfMultiplier: 0.4,
        speedMultiplier: 0.8,
        gainMultiplier: 0.7,
        roomMultiplier: 1.5,
      };

    // Overshot - slight confusion
    case "overshot":
      return {
        lpfMultiplier: 0.7,
        speedMultiplier: 0.85,
        gainMultiplier: 0.9,
        roomMultiplier: 1.2,
      };

    // Stuck - murky, uncertain
    case "stuck":
      return {
        lpfMultiplier: 0.5,
        speedMultiplier: 0.85,
        gainMultiplier: 0.8,
        roomMultiplier: 1.4,
      };

    default:
      return neutral;
  }
}

/**
 * Apply temperature effect modifiers to a pattern string.
 * Wraps the pattern with Strudel effects based on temperature.
 */
export function applyTemperatureToPattern(
  pattern: string,
  effect: TemperatureEffect,
): string {
  // Skip if neutral
  if (
    effect.lpfMultiplier === 1.0 &&
    effect.speedMultiplier === 1.0 &&
    effect.gainMultiplier === 1.0 &&
    effect.roomMultiplier === 1.0
  ) {
    return pattern;
  }

  // Wrap the pattern with temperature modifiers
  // Note: We apply these as outer wrappers to affect the whole pattern
  let modifiedPattern = pattern;

  // Apply speed if not 1.0
  if (effect.speedMultiplier !== 1.0) {
    if (effect.speedMultiplier > 1.0) {
      modifiedPattern = `(${modifiedPattern}).fast(${effect.speedMultiplier.toFixed(2)})`;
    } else {
      modifiedPattern = `(${modifiedPattern}).slow(${(1 / effect.speedMultiplier).toFixed(2)})`;
    }
  }

  return modifiedPattern;
}

/**
 * Celebration flourish patterns.
 * Short, one-shot musical phrases to mark finding a region.
 * Duration controls how long the flourish plays before restoring the base pattern.
 */
export interface CelebrationFlourish {
  /** Strudel pattern for the flourish */
  pattern: string;
  /** Duration in milliseconds before restoring base pattern */
  duration: number;
}

/**
 * Get celebration flourish based on celebration type and continent.
 * Each continent can have its own flourish style.
 * The flourish uses .first(n) so it plays once and naturally stops.
 */
export function getCelebrationFlourish(
  type: CelebrationType,
  continentId: string,
): CelebrationFlourish {
  // Base flourish patterns by celebration type
  // Designed to match the original Web Audio celebration sounds:
  // - Triangle waves for brightness with smooth tone
  // - Musical intervals and chords
  // - Quick, pleasant chime-like sounds
  // These patterns bypass the volume slider via evaluatePatternFullVolume
  const flourishes: Record<CelebrationType, CelebrationFlourish> = {
    // Lightning - quick sparkle: ascending pitch sweep (glissando)
    lightning: {
      pattern: `note("c6 e7 c7")
        .sound("triangle")
        .glide(0.08)
        .decay(0.15)
        .sustain(0)
        .gain(8)
        .slow(0.4)`,
      duration: 250,
    },

    // Standard - two-note chime: C6 then E6 (higher octave for brightness)
    standard: {
      pattern: `note("[c6 e6]")
        .sound("triangle")
        .decay(0.3)
        .sustain(0.2)
        .release(0.2)
        .gain(8)
        .room(0.2)
        .slow(0.8)`,
      duration: 500,
    },

    // Hard-earned - triumphant arpeggio then bright chord
    "hard-earned": {
      pattern: `stack(
        note("c5 e5 g5 ~").sound("triangle").decay(0.2).sustain(0.1).gain(7),
        note("~ ~ ~ [c6,e6,g6]").sound("triangle").decay(0.4).sustain(0.3).release(0.3).gain(6)
      ).room(0.3).slow(1.5)`,
      duration: 800,
    },
  };

  // Get base flourish
  const flourish = flourishes[type];

  // For now, use the same pattern for all continents (simplified for debugging)
  // Continental flavor can be added back once basic celebrations work
  return flourish;
}

/**
 * Build a pattern that includes a celebration flourish.
 * The flourish is layered on top of the base pattern using stack().
 * The base pattern is heavily ducked so the flourish stands out.
 * This pattern bypasses the volume slider (evaluatePatternFullVolume).
 * A JavaScript timeout should be used to restore the base pattern after the flourish.
 */
export function buildPatternWithFlourish(
  basePattern: string,
  flourishPattern: string,
): string {
  // Stack the base pattern (ducked to 15% volume) with the flourish at high gain
  // Since this bypasses the volume slider, celebration at gain(5) is ~33x louder than base
  return `stack(
    (${basePattern}).gain(0.15),
    ${flourishPattern}
  )`;
}

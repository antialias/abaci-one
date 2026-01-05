/**
 * Music Engine Hook for Know Your World
 *
 * Uses Strudel for generative ambient background music.
 * Handles initialization, playback control, and pattern management.
 *
 * @see https://strudel.cc/technical-manual/project-start/
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Declare global Strudel functions (made available after initStrudel)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function evaluate(code: string): Promise<any>;
  function hush(): void;
}

interface MusicEngineState {
  isInitialized: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  error: string | null;
  /** Current pattern being played (for debugging) */
  currentPattern: string;
}

interface MusicEngineControls {
  /** Initialize the audio engine (requires user interaction) */
  initialize: () => Promise<void>;
  /** Start playing the current pattern */
  play: () => Promise<void>;
  /** Stop all playback */
  stop: () => void;
  /** Toggle mute state */
  toggleMute: () => void;
  /** Set mute state */
  setMuted: (muted: boolean) => void;
  /** Set volume (0-1) */
  setVolume: (volume: number) => void;
  /** Evaluate a new pattern */
  evaluatePattern: (pattern: string) => Promise<void>;
  /** Evaluate a pattern at full volume (bypasses volume slider) */
  evaluatePatternFullVolume: (pattern: string) => Promise<void>;
  /** Play a one-shot sound effect (works even when music is off) */
  playOneShot: (pattern: string) => Promise<void>;
  /** Stop one-shot sound without killing the scheduler */
  stopOneShot: () => Promise<void>;
}

export type MusicEngine = MusicEngineState & MusicEngineControls;

// Default ambient pattern - simple drone with sine waves
// Uses Strudel mini notation for a gentle, evolving soundscape
const DEFAULT_PATTERN = `
stack(
  note("c2").sound("sine").lpf(300).gain(0.08).slow(16),
  note("g2").sound("sine").lpf(400).gain(0.05).slow(24),
  note("c3 e3 g3").sound("sine").lpf(500).gain(0.03).slow(32)
).room(0.8)
`;

export function useMusicEngine(): MusicEngine {
  const [state, setState] = useState<MusicEngineState>({
    isInitialized: false,
    isPlaying: false,
    isMuted: true, // Default to muted
    volume: 0.5, // 50% default volume
    error: null,
    currentPattern: "",
  });

  const currentPatternRef = useRef<string>(DEFAULT_PATTERN);
  const initializingRef = useRef(false);
  const volumeRef = useRef(0.5); // Track volume for immediate access
  // Store Strudel repl reference for direct control
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const strudelReplRef = useRef<any>(null);

  // Wrap pattern with volume control
  const wrapWithVolume = useCallback((pattern: string, vol: number): string => {
    // Wrap the entire pattern with a gain multiplier
    return `(${pattern}).gain(${vol.toFixed(2)})`;
  }, []);

  // Initialize Strudel (must be called from user interaction)
  const initialize = useCallback(async () => {
    if (state.isInitialized || initializingRef.current) return;

    initializingRef.current = true;
    setState((s) => ({ ...s, error: null }));

    try {
      // Dynamic import to avoid SSR issues
      // @ts-expect-error - @strudel/web doesn't have type declarations
      const { initStrudel, samples } = await import("@strudel/web");

      // Initialize Strudel with default samples loaded
      // This makes global functions available (evaluate, hush, etc.)
      // and loads drum samples (bd, hh, cp, sd, etc.) from dirt-samples
      const repl = await initStrudel({
        prebake: () => samples("github:tidalcycles/dirt-samples"),
      });

      // Store repl reference for direct control
      strudelReplRef.current = repl;
      console.log("[MusicEngine] Strudel repl:", repl);
      console.log(
        "[MusicEngine] repl methods:",
        repl ? Object.keys(repl) : "null",
      );

      setState((s) => ({
        ...s,
        isInitialized: true,
        error: null,
      }));

      console.log("[MusicEngine] Strudel initialized successfully");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to initialize music engine";
      console.error("[MusicEngine] Initialization failed:", err);
      setState((s) => ({ ...s, error: message }));
    } finally {
      initializingRef.current = false;
    }
  }, [state.isInitialized]);

  // Play the current pattern
  const play = useCallback(async () => {
    console.log("[MusicEngine] play() called, state:", {
      isInitialized: state.isInitialized,
      isMuted: state.isMuted,
      isPlaying: state.isPlaying,
    });

    if (!state.isInitialized) {
      console.warn("[MusicEngine] Cannot play: not initialized");
      return;
    }

    if (state.isMuted) {
      console.warn("[MusicEngine] Cannot play: muted");
      return;
    }

    if (state.isPlaying) {
      console.warn("[MusicEngine] Already playing, skipping");
      return;
    }

    try {
      // Wrap pattern with current volume and evaluate
      const patternWithVolume = wrapWithVolume(
        currentPatternRef.current,
        volumeRef.current,
      );
      console.log("[MusicEngine] Calling evaluate()...");
      await evaluate(patternWithVolume);
      setState((s) => ({
        ...s,
        isPlaying: true,
        error: null,
        currentPattern: currentPatternRef.current,
      }));
      console.log("[MusicEngine] Playing");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to play pattern";
      console.error("[MusicEngine] Play failed:", err);
      setState((s) => ({ ...s, error: message }));
    }
  }, [state.isInitialized, state.isMuted, state.isPlaying, wrapWithVolume]);

  // Stop playback - always try to hush regardless of state
  const stop = useCallback(async () => {
    console.log("[MusicEngine] stop() called");
    try {
      // Try multiple ways to stop Strudel

      // 1. Try the stored repl reference first
      if (strudelReplRef.current) {
        console.log(
          "[MusicEngine] repl ref exists, methods:",
          Object.keys(strudelReplRef.current),
        );
        if (typeof strudelReplRef.current.stop === "function") {
          console.log("[MusicEngine] Calling repl.stop()...");
          strudelReplRef.current.stop();
        }
        if (typeof strudelReplRef.current.hush === "function") {
          console.log("[MusicEngine] Calling repl.hush()...");
          strudelReplRef.current.hush();
        }
      }

      // 2. Try the global hush function
      if (typeof hush === "function") {
        console.log("[MusicEngine] Calling global hush()...");
        hush();
      }

      // 3. Try window.hush as fallback
      if (typeof (window as any).hush === "function") {
        console.log("[MusicEngine] Calling window.hush()...");
        (window as any).hush();
      }

      // 4. Try evaluating silence pattern as nuclear option
      try {
        console.log("[MusicEngine] Evaluating silence pattern...");
        await evaluate("silence");
      } catch {
        // Ignore errors from silence pattern
      }

      setState((s) => {
        console.log("[MusicEngine] Setting isPlaying=false, was:", s.isPlaying);
        return { ...s, isPlaying: false };
      });
    } catch (err) {
      console.error("[MusicEngine] Stop failed:", err);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setState((s) => {
      const newMuted = !s.isMuted;
      if (newMuted) {
        // Always try to stop playback when muting
        try {
          if (typeof hush === "function") {
            hush();
          }
        } catch {
          // Ignore errors
        }
        return { ...s, isMuted: true, isPlaying: false };
      }
      return { ...s, isMuted: false };
    });
  }, []);

  // Set mute state - always stop when muting regardless of current state
  const setMuted = useCallback((muted: boolean) => {
    console.log("[MusicEngine] setMuted called with:", muted);
    if (muted) {
      // Always try to stop when muting - don't rely on state.isPlaying
      // which might be stale in the closure
      try {
        if (typeof hush === "function") {
          console.log("[MusicEngine] setMuted: calling hush()...");
          hush();
        }
      } catch (err) {
        console.error("[MusicEngine] setMuted: hush failed:", err);
      }
      setState((s) => ({ ...s, isMuted: true, isPlaying: false }));
    } else {
      setState((s) => ({ ...s, isMuted: false }));
    }
  }, []);

  // Set volume - re-evaluates pattern with new gain level
  const setVolume = useCallback(
    async (volume: number) => {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      volumeRef.current = clampedVolume;
      setState((s) => ({ ...s, volume: clampedVolume }));

      // If playing, re-evaluate pattern with new volume
      if (state.isPlaying && state.isInitialized && !state.isMuted) {
        try {
          const patternWithVolume = wrapWithVolume(
            currentPatternRef.current,
            clampedVolume,
          );
          await evaluate(patternWithVolume);
        } catch (err) {
          console.error("[MusicEngine] Failed to update volume:", err);
        }
      }
    },
    [state.isPlaying, state.isInitialized, state.isMuted, wrapWithVolume],
  );

  // Evaluate a new pattern
  const evaluatePattern = useCallback(
    async (pattern: string) => {
      console.log(
        "[MusicEngine] evaluatePattern() called, isPlaying:",
        state.isPlaying,
      );
      currentPatternRef.current = pattern;
      // Always update the displayed pattern
      setState((s) => ({ ...s, currentPattern: pattern }));

      if (state.isPlaying && state.isInitialized && !state.isMuted) {
        try {
          const patternWithVolume = wrapWithVolume(pattern, volumeRef.current);
          console.log("[MusicEngine] evaluatePattern: calling evaluate()...");
          await evaluate(patternWithVolume);
        } catch (err) {
          console.error("[MusicEngine] Pattern evaluation failed:", err);
        }
      } else {
        console.log(
          "[MusicEngine] evaluatePattern: not playing, skipped evaluate()",
        );
      }
    },
    [state.isPlaying, state.isInitialized, state.isMuted, wrapWithVolume],
  );

  // Evaluate a pattern at full volume (bypasses volume slider)
  // Used for celebrations where we need precise volume control
  const evaluatePatternFullVolume = useCallback(
    async (pattern: string) => {
      console.log(
        "[MusicEngine] evaluatePatternFullVolume() called, isPlaying:",
        state.isPlaying,
      );
      // Update the displayed pattern
      setState((s) => ({ ...s, currentPattern: pattern }));

      if (state.isPlaying && state.isInitialized && !state.isMuted) {
        try {
          console.log(
            "[MusicEngine] evaluatePatternFullVolume: calling evaluate() without volume wrapper...",
          );
          await evaluate(pattern);
        } catch (err) {
          console.error("[MusicEngine] Pattern evaluation failed:", err);
        }
      } else {
        console.log(
          "[MusicEngine] evaluatePatternFullVolume: not playing, skipped evaluate()",
        );
      }
    },
    [state.isPlaying, state.isInitialized, state.isMuted],
  );

  // Play a one-shot sound effect (works even when music is off)
  // Ignores isPlaying and isMuted state - just plays the pattern if initialized
  const playOneShot = useCallback(
    async (pattern: string) => {
      console.log(
        "[MusicEngine] playOneShot() called, isInitialized:",
        state.isInitialized,
      );

      if (!state.isInitialized) {
        console.warn("[MusicEngine] playOneShot: not initialized, cannot play");
        return;
      }

      try {
        console.log("[MusicEngine] playOneShot: evaluating pattern...");
        await evaluate(pattern);
      } catch (err) {
        console.error("[MusicEngine] playOneShot failed:", err);
      }
    },
    [state.isInitialized],
  );

  // Stop one-shot sound without killing the scheduler
  // Evaluates a silent rest pattern to replace the current sound
  const stopOneShot = useCallback(async () => {
    console.log("[MusicEngine] stopOneShot() called");
    try {
      // Evaluate a rest pattern - this replaces current sound with silence
      // but keeps the scheduler running for future sounds
      await evaluate('note("~")');
    } catch (err) {
      console.error("[MusicEngine] stopOneShot failed:", err);
    }
  }, []);

  // Cleanup on unmount - use refs to avoid stale closures
  useEffect(() => {
    return () => {
      console.log("[MusicEngine] Cleanup on unmount");
      try {
        // Stop the Strudel scheduler via repl reference
        if (strudelReplRef.current) {
          console.log("[MusicEngine] Stopping Strudel repl...");
          if (typeof strudelReplRef.current.stop === "function") {
            strudelReplRef.current.stop();
          }
        }
        // Also try global hush as backup
        if (typeof hush === "function") {
          hush();
        }
      } catch (err) {
        console.error("[MusicEngine] Cleanup error:", err);
      }
      // Clear the repl reference
      strudelReplRef.current = null;
    };
  }, []); // Empty deps - only run on unmount

  // Destructure state for stable memoization (object reference changes on every update)
  const { isInitialized, isPlaying, isMuted, volume, error, currentPattern } =
    state;

  return useMemo(
    () => ({
      isInitialized,
      isPlaying,
      isMuted,
      volume,
      error,
      currentPattern,
      initialize,
      play,
      stop,
      toggleMute,
      setMuted,
      setVolume,
      evaluatePattern,
      evaluatePatternFullVolume,
      playOneShot,
      stopOneShot,
    }),
    [
      isInitialized,
      isPlaying,
      isMuted,
      volume,
      error,
      currentPattern,
      initialize,
      play,
      stop,
      toggleMute,
      setMuted,
      setVolume,
      evaluatePattern,
      evaluatePatternFullVolume,
      playOneShot,
      stopOneShot,
    ],
  );
}

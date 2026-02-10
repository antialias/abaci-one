"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAudioManagerInstance } from "@/contexts/AudioManagerContext";
import { useTTS } from "@/hooks/useTTS";
import { useBackgroundTask } from "@/hooks/useBackgroundTask";
import { useGenerateCollectedClips, collectedClipKeys } from "@/hooks/useCollectedClips";
import type { CollectedClipGenerateOutput } from "@/lib/tasks/collected-clip-generate";
import type { VoiceSource, TtsSay } from "@/lib/audio/TtsAudioManager";
import { computeClipHash } from "@/lib/audio/clipHash";
import { getClipMeta } from "@/lib/audio/audioClipRegistry";
import { ALL_VOICES } from "@/lib/audio/voices";
import { Z_INDEX } from "@/constants/zIndex";
import { css } from "../../../styled-system/css";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_TONES = [
  {
    label: "Math",
    value:
      "Speaking clearly and steadily, reading a math problem to a young child. Pause slightly between each number and operator.",
  },
  {
    label: "Celebration",
    value: "Warmly congratulating a child. Genuinely encouraging and happy.",
  },
  {
    label: "Corrective",
    value:
      "Gently guiding a child after a wrong answer. Kind, not disappointed.",
  },
  {
    label: "Tutorial",
    value:
      "Patiently guiding a young child through an abacus tutorial. Clear, slow, friendly.",
  },
];

const PRESET_PHRASES = [
  "five plus three",
  "ten minus four",
  "Correct!",
  "Great job!",
  "The answer is eight",
  "Welcome!",
  "Tap the bead",
  "forty two plus fifteen",
  "one hundred fifty seven minus twenty three",
];

type InputMode = "say-text" | "clip-id" | "clip-id-say";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TtsTestPanelProps {
  voiceChain: VoiceSource[];
}

export function TtsTestPanel({ voiceChain }: TtsTestPanelProps) {
  const manager = useAudioManagerInstance();
  const queryClient = useQueryClient();

  // -- Always-visible state --
  const [text, setText] = useState("");
  const [tone, setTone] = useState(PRESET_TONES[0].value);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakStatus, setSpeakStatus] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // -- Clip Inspector state --
  const [showInspector, setShowInspector] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("say-text");
  const [locale, setLocale] = useState("en");
  const [clipIdOverride, setClipIdOverride] = useState("");

  // -- Flush tracking: clip IDs that have been spoken + flushed to DB --
  const [flushedClipIds, setFlushedClipIds] = useState<Set<string>>(new Set());

  // -- Generate state --
  const [genVoices, setGenVoices] = useState<Set<string>>(new Set());
  const [genTaskId, setGenTaskId] = useState<string | null>(null);
  const { state: genTaskState } = useBackgroundTask<CollectedClipGenerateOutput>(genTaskId);
  const isGenerating = genTaskState?.status === "pending" || genTaskState?.status === "running";

  // -- Preview state --
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const trimmedText = text.trim();

  // Speak function from the useTTS hook — uses empty string as base input,
  // we pass the actual input at speak time
  const speak = useTTS("", { tone });

  // ---------------------------------------------------------------------------
  // Resolution logic
  // ---------------------------------------------------------------------------

  /** Compute the resolved clip ID, fallback text, and registry info based on current inputs */
  const resolution = useMemo(() => {
    let clipId = "";
    let fallbackText = "";
    let registryHit: { text: string; tone: string } | null = null;

    if (inputMode === "say-text") {
      if (!trimmedText) return null;
      const say: TtsSay = { [locale]: trimmedText };
      clipId = computeClipHash(say, tone);
      fallbackText = trimmedText;
    } else if (inputMode === "clip-id") {
      if (!clipIdOverride.trim()) return null;
      clipId = clipIdOverride.trim();
      const meta = getClipMeta(clipId);
      if (meta) {
        registryHit = { text: meta.text, tone: meta.tone };
        fallbackText = meta.text;
      } else {
        fallbackText = clipId;
      }
    } else {
      // clip-id-say
      if (!clipIdOverride.trim()) return null;
      clipId = clipIdOverride.trim();
      fallbackText = trimmedText || clipId;
      const meta = getClipMeta(clipId);
      if (meta) {
        registryHit = { text: meta.text, tone: meta.tone };
      }
    }

    return { clipId, fallbackText, registryHit };
  }, [inputMode, trimmedText, tone, locale, clipIdOverride]);

  // Voice chain availability
  const availability = useMemo(() => {
    if (!resolution?.clipId) return [];
    return manager.getClipAvailability(resolution.clipId);
  }, [manager, resolution?.clipId]);

  // Which voice will speak (first with clip)
  const servingVoiceLabel = useMemo(() => {
    for (const entry of availability) {
      if (entry.hasClip) {
        return entry.source.type === "browser-tts" ? "browser-tts" : entry.source.name;
      }
    }
    return availability.length > 0 ? "none" : "browser-tts";
  }, [availability]);

  // Default gen voices: chain voices that don't have the clip
  useEffect(() => {
    if (!resolution?.clipId) return;
    const missing = new Set<string>();
    for (const entry of availability) {
      if (entry.source.type === "pregenerated" && !entry.hasClip) {
        missing.add(entry.source.name);
      }
    }
    console.log('[TtsTestPanel] genVoices update:', {
      clipId: resolution.clipId,
      availability: availability.map(e => ({
        type: e.source.type,
        name: e.source.type === 'pregenerated' ? e.source.name : 'browser-tts',
        hasClip: e.hasClip,
      })),
      missing: Array.from(missing),
    });
    setGenVoices(missing);
  }, [availability, resolution?.clipId]);

  // Refresh manifest + query cache when generation completes
  useEffect(() => {
    if (genTaskState?.status === "completed" || genTaskState?.status === "failed") {
      manager.loadPregenManifest(voiceChain);
      queryClient.invalidateQueries({ queryKey: collectedClipKeys.all });
    }
  }, [genTaskState?.status, manager, voiceChain, queryClient]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSpeak = useCallback(async () => {
    if (!trimmedText && inputMode === "say-text") return;
    if (!clipIdOverride.trim() && inputMode !== "say-text") return;

    console.log('[TtsTestPanel] handleSpeak', { inputMode, trimmedText, locale, tone: tone.slice(0, 40) + '...', clipIdOverride });

    const snap = manager.getSnapshot();
    const wasDisabled = !snap.isEnabled;
    if (wasDisabled) manager.configure({ enabled: true });

    setIsSpeaking(true);
    try {
      if (inputMode === "say-text") {
        await speak({ say: { [locale]: trimmedText }, tone });
      } else if (inputMode === "clip-id") {
        await speak(clipIdOverride.trim(), { tone });
      } else {
        // clip-id-say
        await speak(
          { clipId: clipIdOverride.trim(), say: { [locale]: trimmedText }, tone },
        );
      }

      // Auto-flush after speak — use awaitable fetch so the clip is in the DB
      // before the user can click Generate
      console.log('[TtsTestPanel] flushing (awaitResponse)...');
      await manager.flush({ awaitResponse: true });
      console.log('[TtsTestPanel] flush complete');

      // Mark clip as flushed so Generate knows it's in the DB
      if (resolution) {
        setFlushedClipIds((prev) => new Set(prev).add(resolution.clipId));
        // Invalidate collected clips query so Clip Management updates
        queryClient.invalidateQueries({ queryKey: collectedClipKeys.all });
        console.log('[TtsTestPanel] speak done, flushed clipId:', resolution.clipId);
        setSpeakStatus(`${resolution.clipId} \u00b7 via ${servingVoiceLabel}`);
      }
    } finally {
      setIsSpeaking(false);
      if (wasDisabled) manager.configure({ enabled: false });
    }
  }, [manager, trimmedText, tone, speak, inputMode, locale, clipIdOverride, resolution, servingVoiceLabel]);

  const handleStop = useCallback(() => {
    manager.stop();
    setIsSpeaking(false);
  }, [manager]);

  const handlePresetPhrase = useCallback((phrase: string) => {
    setText(phrase);
    textRef.current?.focus();
  }, []);

  const handlePreview = useCallback(async (voice: string) => {
    if (!resolution) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewingVoice(voice);
    try {
      const res = await fetch("/api/admin/audio/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice,
          text: resolution.fallbackText,
          tone,
        }),
      });
      if (!res.ok) {
        setPreviewingVoice(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch {
      setPreviewingVoice(null);
    }
  }, [resolution, tone]);

  // Generate mutation — one per voice
  const ccGenerateMutation = useGenerateCollectedClips();

  const handleGenerate = useCallback(() => {
    console.log('[TtsTestPanel] handleGenerate called', {
      clipId: resolution?.clipId,
      genVoices: Array.from(genVoices),
      genVoicesSize: genVoices.size,
      isGenerating,
      mutationStatus: ccGenerateMutation.status,
    });
    if (!resolution?.clipId || genVoices.size === 0) {
      console.log('[TtsTestPanel] handleGenerate early return — no clipId or no voices');
      return;
    }
    const voiceList = Array.from(genVoices);
    const firstVoice = voiceList[0];
    console.log('[TtsTestPanel] calling ccGenerateMutation.mutate', {
      voice: firstVoice,
      clipIds: [resolution.clipId],
    });
    ccGenerateMutation.mutate(
      { voice: firstVoice, clipIds: [resolution.clipId] },
      {
        onSuccess: ({ taskId }) => {
          console.log('[TtsTestPanel] generate onSuccess, taskId:', taskId);
          setGenTaskId(taskId);
        },
        onError: (err) => {
          console.error('[TtsTestPanel] generate onError:', err);
        },
      },
    );
  }, [resolution, genVoices, ccGenerateMutation, isGenerating]);

  const toggleGenVoice = useCallback((voice: string) => {
    setGenVoices((prev) => {
      const next = new Set(prev);
      if (next.has(voice)) {
        next.delete(voice);
      } else {
        next.add(voice);
      }
      return next;
    });
  }, []);

  // Can speak?
  const canSpeak =
    inputMode === "say-text"
      ? !!trimmedText
      : !!clipIdOverride.trim();

  // Can generate? Clip must have been spoken + flushed to DB first
  const clipFlushed = !!(resolution?.clipId && flushedClipIds.has(resolution.clipId));
  const canGenerate = clipFlushed && genVoices.size > 0 && !isGenerating && !isSpeaking;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      data-component="TtsTestPanel"
      className={css({ padding: "0 16px 16px" })}
    >
      {/* Preset phrases */}
      <div
        data-element="preset-phrases"
        className={css({
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          marginBottom: "10px",
        })}
      >
        {PRESET_PHRASES.map((phrase) => (
          <button
            key={phrase}
            data-action="preset-phrase"
            onClick={() => handlePresetPhrase(phrase)}
            className={css({
              fontSize: "11px",
              backgroundColor: text === phrase ? "#1f6feb33" : "#0d1117",
              color: text === phrase ? "#58a6ff" : "#8b949e",
              border: "1px solid",
              borderColor: text === phrase ? "#1f6feb" : "#21262d",
              borderRadius: "12px",
              padding: "2px 10px",
              cursor: "pointer",
              "&:hover": { borderColor: "#30363d", color: "#c9d1d9" },
            })}
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Text input */}
      <textarea
        ref={textRef}
        data-element="tts-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSpeak();
          }
        }}
        placeholder='Type something to speak, e.g. "five plus three"'
        rows={2}
        className={css({
          width: "100%",
          backgroundColor: "#0d1117",
          color: "#f0f6fc",
          border: "1px solid #30363d",
          borderRadius: "6px",
          padding: "10px 12px",
          fontSize: "14px",
          fontFamily: "inherit",
          resize: "vertical",
          marginBottom: "10px",
          "&::placeholder": { color: "#484f58" },
          "&:focus": { outline: "none", borderColor: "#58a6ff" },
        })}
      />

      {/* Tone selector */}
      <div
        data-element="tone-selector"
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "6px",
        })}
      >
        <span className={css({ color: "#8b949e", fontSize: "13px", flexShrink: 0 })}>
          Tone:
        </span>
        <div className={css({ display: "flex", gap: "4px", flexWrap: "wrap" })}>
          {PRESET_TONES.map((t) => (
            <button
              key={t.label}
              data-action="preset-tone"
              onClick={() => setTone(t.value)}
              className={css({
                fontSize: "12px",
                backgroundColor: tone === t.value ? "#1f6feb33" : "transparent",
                color: tone === t.value ? "#58a6ff" : "#8b949e",
                border: "1px solid",
                borderColor: tone === t.value ? "#1f6feb" : "#30363d",
                borderRadius: "6px",
                padding: "4px 10px",
                cursor: "pointer",
                fontWeight: tone === t.value ? "600" : "400",
                "&:hover": { borderColor: "#58a6ff" },
              })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tone preview */}
      <div
        className={css({
          fontSize: "11px",
          color: "#484f58",
          fontFamily: "monospace",
          padding: "4px 8px",
          backgroundColor: "#0d1117",
          borderRadius: "4px",
          maxHeight: "40px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: "10px",
        })}
        title={tone}
      >
        {tone}
      </div>

      {/* Speak / Stop + inline status */}
      <div
        data-element="tts-actions"
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        })}
      >
        <button
          data-action="speak"
          onClick={handleSpeak}
          disabled={!canSpeak || isSpeaking}
          className={css({
            backgroundColor: "#238636",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "8px 20px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            "&:hover": { backgroundColor: "#2ea043" },
            "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
          })}
        >
          {isSpeaking ? "Speaking..." : "\u25B6 Speak"}
        </button>
        {isSpeaking && (
          <button
            data-action="stop"
            onClick={handleStop}
            className={css({
              backgroundColor: "transparent",
              color: "#f85149",
              border: "1px solid #f85149",
              borderRadius: "6px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              "&:hover": { backgroundColor: "#f8514922" },
            })}
          >
            Stop
          </button>
        )}
        {speakStatus && (
          <span
            data-element="speak-status"
            className={css({
              fontSize: "12px",
              color: "#8b949e",
              fontFamily: "monospace",
            })}
          >
            {speakStatus}
          </span>
        )}
      </div>

      {/* Clip Inspector toggle */}
      <button
        data-action="toggle-inspector"
        onClick={() => setShowInspector((p) => !p)}
        className={css({
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 0",
          background: "none",
          border: "none",
          borderTop: "1px solid #21262d",
          cursor: "pointer",
          color: "#8b949e",
          fontSize: "13px",
          fontWeight: "600",
        })}
      >
        <span>{showInspector ? "\u25BC" : "\u25B6"}</span>
        Clip Inspector
      </button>

      {/* Clip Inspector */}
      {showInspector && (
        <div
          data-element="clip-inspector"
          className={css({
            paddingTop: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          })}
        >
          {/* Input mode selector */}
          <div
            data-element="input-mode-selector"
            className={css({ display: "flex", alignItems: "center", gap: "8px" })}
          >
            <span className={css({ color: "#8b949e", fontSize: "13px", flexShrink: 0 })}>
              Input:
            </span>
            <div className={css({ display: "flex", gap: "2px" })}>
              {([
                { mode: "say-text" as const, label: "Say text" },
                { mode: "clip-id" as const, label: "Clip ID" },
                { mode: "clip-id-say" as const, label: "Clip ID + Say" },
              ]).map(({ mode, label }) => (
                <button
                  key={mode}
                  data-action={`input-mode-${mode}`}
                  onClick={() => setInputMode(mode)}
                  className={css({
                    fontSize: "12px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: inputMode === mode ? "#1f6feb" : "#30363d",
                    backgroundColor: inputMode === mode ? "#1f6feb33" : "transparent",
                    color: inputMode === mode ? "#58a6ff" : "#8b949e",
                    cursor: "pointer",
                    fontWeight: inputMode === mode ? "600" : "400",
                    "&:hover": { borderColor: "#58a6ff" },
                  })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Locale + Clip ID override */}
          <div className={css({ display: "flex", gap: "8px", alignItems: "center" })}>
            <label className={css({ color: "#8b949e", fontSize: "13px", flexShrink: 0 })}>
              Locale:
            </label>
            <select
              data-element="locale-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className={css({
                backgroundColor: "#0d1117",
                color: "#f0f6fc",
                border: "1px solid #30363d",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "13px",
              })}
            >
              <option value="en">en</option>
              <option value="en-US">en-US</option>
              <option value="es">es</option>
              <option value="ja">ja</option>
              <option value="zh">zh</option>
            </select>

            {(inputMode === "clip-id" || inputMode === "clip-id-say") && (
              <>
                <label className={css({ color: "#8b949e", fontSize: "13px", flexShrink: 0 })}>
                  Clip ID:
                </label>
                <input
                  data-element="clip-id-override"
                  type="text"
                  value={clipIdOverride}
                  onChange={(e) => setClipIdOverride(e.target.value)}
                  placeholder="my-clip-id"
                  className={css({
                    flex: 1,
                    backgroundColor: "#0d1117",
                    color: "#f0f6fc",
                    border: "1px solid #30363d",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    "&::placeholder": { color: "#484f58" },
                    "&:focus": { outline: "none", borderColor: "#58a6ff" },
                  })}
                />
              </>
            )}
          </div>

          {/* Resolution info */}
          {resolution && (
            <div
              data-element="resolution-info"
              className={css({
                backgroundColor: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: "6px",
                padding: "10px 12px",
                fontSize: "12px",
                fontFamily: "monospace",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              })}
            >
              <div>
                <span className={css({ color: "#8b949e" })}>Resolved clip ID: </span>
                <span className={css({ color: "#f0f6fc" })}>{resolution.clipId}</span>
              </div>
              <div>
                <span className={css({ color: "#8b949e" })}>Fallback text: </span>
                <span className={css({ color: "#c9d1d9" })}>
                  &quot;{resolution.fallbackText}&quot;
                </span>
              </div>
              <div>
                <span className={css({ color: "#8b949e" })}>Registry: </span>
                <span className={css({ color: resolution.registryHit ? "#3fb950" : "#484f58" })}>
                  {resolution.registryHit
                    ? `"${resolution.registryHit.text}" (${resolution.registryHit.tone})`
                    : "(no static entry)"}
                </span>
              </div>
            </div>
          )}

          {/* Voice chain availability */}
          {resolution && availability.length > 0 && (
            <div data-element="voice-chain-availability">
              <div className={css({ color: "#8b949e", fontSize: "12px", marginBottom: "6px", fontWeight: "600" })}>
                Voice chain availability:
              </div>
              <div className={css({ display: "flex", flexDirection: "column", gap: "4px" })}>
                {(() => {
                  let foundFirst = false;
                  return availability.map((entry, idx) => {
                    const voiceName =
                      entry.source.type === "browser-tts"
                        ? "browser-tts"
                        : entry.source.name;
                    const isFirst = entry.hasClip && !foundFirst;
                    if (entry.hasClip) foundFirst = true;

                    return (
                      <div
                        key={idx}
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "12px",
                          fontFamily: "monospace",
                        })}
                      >
                        <span className={css({ width: "20px", textAlign: "right", color: "#484f58" })}>
                          {idx + 1}.
                        </span>
                        <span className={css({ width: "100px", color: "#f0f6fc" })}>
                          {voiceName}
                        </span>
                        <span
                          className={css({
                            color: entry.hasClip ? "#3fb950" : "#f85149",
                          })}
                        >
                          {entry.hasClip ? "\u2713" : "\u2717"}
                        </span>
                        <span className={css({ color: "#8b949e", flex: 1 })}>
                          {entry.source.type === "browser-tts"
                            ? "always available"
                            : entry.hasClip
                              ? "has mp3"
                              : "no mp3"}
                        </span>
                        {/* Preview link for pregenerated voices without clip */}
                        {entry.source.type === "pregenerated" && !entry.hasClip && (
                          <button
                            data-action={`preview-${voiceName}`}
                            onClick={() => handlePreview(voiceName)}
                            disabled={previewingVoice === voiceName}
                            className={css({
                              fontSize: "11px",
                              background: "none",
                              border: "none",
                              color: "#58a6ff",
                              cursor: "pointer",
                              padding: 0,
                              textDecoration: "underline",
                              "&:disabled": { opacity: 0.5, cursor: "wait" },
                            })}
                          >
                            {previewingVoice === voiceName ? "playing..." : "preview"}
                          </button>
                        )}
                        {isFirst && (
                          <span className={css({ color: "#58a6ff", fontSize: "11px" })}>
                            &larr; will speak
                          </span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Generate section */}
          {resolution && (
            <div
              data-element="generate-section"
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "8px",
              })}
            >
              {/* Voice multi-select dropdown */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    data-element="gen-voice-dropdown-trigger"
                    type="button"
                    disabled={isGenerating}
                    className={css({
                      backgroundColor: "#0d1117",
                      color: "#f0f6fc",
                      border: "1px solid #30363d",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      "&:hover": { borderColor: "#8b949e" },
                      "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
                    })}
                  >
                    Generate for {genVoices.size} voice{genVoices.size !== 1 ? "s" : ""}
                    <span className={css({ color: "#8b949e", fontSize: "10px" })}>&#9662;</span>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    data-element="gen-voice-dropdown-content"
                    sideOffset={5}
                    className={css({
                      backgroundColor: "#161b22",
                      border: "1px solid #30363d",
                      borderRadius: "8px",
                      padding: "4px",
                      minWidth: "200px",
                      maxHeight: "300px",
                      overflowY: "auto",
                      zIndex: Z_INDEX.DROPDOWN,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    })}
                  >
                    {/* All chain voices toggle */}
                    <DropdownMenu.CheckboxItem
                      data-action="toggle-all-chain"
                      checked={(() => {
                        const chainPregen = voiceChain
                          .filter((s): s is { type: "pregenerated"; name: string } => s.type === "pregenerated")
                          .map((s) => s.name);
                        return chainPregen.length > 0 && chainPregen.every((v) => genVoices.has(v));
                      })()}
                      onCheckedChange={() => {
                        const chainPregen = voiceChain
                          .filter((s): s is { type: "pregenerated"; name: string } => s.type === "pregenerated")
                          .map((s) => s.name);
                        setGenVoices((prev) => {
                          const allSelected = chainPregen.every((v) => prev.has(v));
                          const next = new Set(prev);
                          if (allSelected) {
                            for (const v of chainPregen) next.delete(v);
                          } else {
                            for (const v of chainPregen) next.add(v);
                          }
                          return next;
                        });
                      }}
                      onSelect={(e) => e.preventDefault()}
                      className={css({
                        padding: "6px 12px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        outline: "none",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#f0f6fc",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        "&:hover": { backgroundColor: "#21262d" },
                        "&:focus": { backgroundColor: "#21262d" },
                      })}
                    >
                      <DropdownMenu.ItemIndicator className={css({ width: "16px" })}>
                        &#10003;
                      </DropdownMenu.ItemIndicator>
                      <span>All chain voices</span>
                    </DropdownMenu.CheckboxItem>

                    <DropdownMenu.Separator
                      className={css({ height: "1px", backgroundColor: "#30363d", margin: "4px 0" })}
                    />

                    {ALL_VOICES.map((v) => (
                      <DropdownMenu.CheckboxItem
                        key={v}
                        data-action={`toggle-gen-${v}`}
                        checked={genVoices.has(v)}
                        onCheckedChange={() => toggleGenVoice(v)}
                        onSelect={(e) => e.preventDefault()}
                        className={css({
                          padding: "6px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          outline: "none",
                          fontSize: "13px",
                          color: "#c9d1d9",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          "&:hover": { backgroundColor: "#21262d" },
                          "&:focus": { backgroundColor: "#21262d" },
                        })}
                      >
                        <DropdownMenu.ItemIndicator className={css({ width: "16px" })}>
                          &#10003;
                        </DropdownMenu.ItemIndicator>
                        <span>{v}</span>
                      </DropdownMenu.CheckboxItem>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <button
                data-action="generate"
                onClick={handleGenerate}
                disabled={!canGenerate}
                title={!clipFlushed ? "Speak first to register the clip in the database" : undefined}
                className={css({
                  backgroundColor: "#238636",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "6px 16px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  "&:hover": { backgroundColor: "#2ea043" },
                  "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
                })}
              >
                Generate
              </button>
              {!clipFlushed && resolution && (
                <span className={css({ fontSize: "11px", color: "#8b949e", fontStyle: "italic" })}>
                  Speak first to register clip
                </span>
              )}
            </div>
          )}

          {/* Generation progress */}
          {genTaskState && (
            <div
              data-element="gen-progress"
              className={css({
                backgroundColor: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: "6px",
                padding: "10px 12px",
                fontSize: "12px",
              })}
            >
              <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" })}>
                <span className={css({ color: "#f0f6fc", fontWeight: "600" })}>
                  {isGenerating ? "Generating..." : `Generation ${genTaskState.status}`}
                </span>
              </div>
              {isGenerating && (
                <div className={css({ backgroundColor: "#30363d", borderRadius: "4px", height: "4px", overflow: "hidden" })}>
                  <div
                    className={css({ backgroundColor: "#58a6ff", height: "100%", transition: "width 0.3s" })}
                    style={{ width: `${genTaskState.progress}%` }}
                  />
                </div>
              )}
              {genTaskState.output && (
                <span className={css({ color: "#8b949e" })}>
                  Generated: {genTaskState.output.generated}, Errors: {genTaskState.output.errors}
                </span>
              )}
              {genTaskState.error && (
                <span className={css({ color: "#f85149" })}>{genTaskState.error}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

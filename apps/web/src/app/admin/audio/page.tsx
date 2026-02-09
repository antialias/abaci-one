"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppNavBar } from "@/components/AppNavBar";
import { AdminNav } from "@/components/AdminNav";
import { AudioReviewMode } from "@/components/admin/AudioReviewMode";
import { AudioClipActions } from "@/components/admin/AudioClipActions";
import { TtsTestPanel } from "@/components/admin/TtsTestPanel";
import { useBackgroundTask } from "@/hooks/useBackgroundTask";
import { useCollectedClips, useGenerateCollectedClips, collectedClipKeys } from "@/hooks/useCollectedClips";
import { AUDIO_CATEGORIES } from "@/lib/audio/audioManifest";
import type { AudioClipEntry } from "@/lib/audio/audioManifest";
import type { AudioGenerateOutput } from "@/lib/tasks/audio-generate";
import type { CollectedClipGenerateOutput } from "@/lib/tasks/collected-clip-generate";
import { css } from "../../../../styled-system/css";

/** Known OpenAI TTS voices */
const ALL_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
] as const;

interface VoiceInfo {
  total: number;
  existing: number;
}

type VoiceSource =
  | { type: "pregenerated"; name: string }
  | { type: "browser-tts" };

interface AudioStatus {
  activeVoice: string;
  manifest: AudioClipEntry[];
  voices: Record<string, VoiceInfo>;
}

export default function AdminAudioPage() {
  const [status, setStatus] = useState<AudioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genTaskId, setGenTaskId] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [addVoice, setAddVoice] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [reviewVoice, setReviewVoice] = useState<string | null>(null);
  const [flaggedClips, setFlaggedClips] = useState<Set<string>>(new Set());
  const [voiceChain, setVoiceChain] = useState<VoiceSource[]>([]);
  const [voiceChainDirty, setVoiceChainDirty] = useState(false);
  const [showVoiceChain, setShowVoiceChain] = useState(false);
  const [showTtsTest, setShowTtsTest] = useState(false);
  const [showVoiceManagement, setShowVoiceManagement] = useState(false);
  const [showCollectedClips, setShowCollectedClips] = useState(false);
  const [ccGenVoice, setCcGenVoice] = useState<string>("onyx");
  const [ccGenTaskId, setCcGenTaskId] = useState<string | null>(null);
  const [ccPlayingClipId, setCcPlayingClipId] = useState<string | null>(null);
  const ccAudioRef = useRef<HTMLAudioElement | null>(null);
  const queryClient = useQueryClient();

  // React Query: collected clips with per-voice generation status
  const {
    data: ccData,
    isLoading: collectedClipsLoading,
  } = useCollectedClips(ccGenVoice, { enabled: showCollectedClips });
  const collectedClips = ccData?.clips ?? [];
  const ccGeneratedFor = ccData?.generatedFor ?? {};

  // React Query: mutation for triggering collected clip generation
  const ccGenerateMutation = useGenerateCollectedClips(ccGenVoice);

  const handleToggleFlag = useCallback((clipId: string) => {
    setFlaggedClips((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  }, []);

  // Background task subscription
  const { state: taskState, cancel: cancelTask } =
    useBackgroundTask<AudioGenerateOutput>(genTaskId);

  // Background task subscription for collected clip generation
  const { state: ccTaskState, cancel: cancelCcTask } =
    useBackgroundTask<CollectedClipGenerateOutput>(ccGenTaskId);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audio");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: AudioStatus = await res.json();
      setStatus(data);
      if (!selectedVoice && Object.keys(data.voices).length > 0) {
        setSelectedVoice(
          data.activeVoice in data.voices
            ? data.activeVoice
            : Object.keys(data.voices)[0],
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [selectedVoice]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Fetch voice chain config on mount
  useEffect(() => {
    fetch("/api/settings/voice-chain")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.voiceChain) setVoiceChain(data.voiceChain);
      })
      .catch(() => {});
  }, []);

  const handleSaveVoiceChain = async () => {
    try {
      const res = await fetch("/api/settings/voice-chain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceChain }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setVoiceChainDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save voice chain");
    }
  };

  const moveVoiceChainEntry = (index: number, direction: -1 | 1) => {
    const next = [...voiceChain];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setVoiceChain(next);
    setVoiceChainDirty(true);
  };

  const removeVoiceChainEntry = (index: number) => {
    setVoiceChain((prev) => prev.filter((_, i) => i !== index));
    setVoiceChainDirty(true);
  };

  const addToVoiceChain = (voiceName: string) => {
    // Insert before browser-tts if it exists, otherwise append
    const browserIdx = voiceChain.findIndex((v) => v.type === "browser-tts");
    const entry: VoiceSource = { type: "pregenerated", name: voiceName };
    if (browserIdx >= 0) {
      const next = [...voiceChain];
      next.splice(browserIdx, 0, entry);
      setVoiceChain(next);
    } else {
      setVoiceChain((prev) => [...prev, entry]);
    }
    setVoiceChainDirty(true);
  };

  const toggleBrowserTts = () => {
    const hasBrowser = voiceChain.some((v) => v.type === "browser-tts");
    if (hasBrowser) {
      setVoiceChain((prev) => prev.filter((v) => v.type !== "browser-tts"));
    } else {
      setVoiceChain((prev) => [...prev, { type: "browser-tts" }]);
    }
    setVoiceChainDirty(true);
  };

  // Refresh status when task completes
  useEffect(() => {
    if (taskState?.status === "completed" || taskState?.status === "failed") {
      fetchStatus();
    }
  }, [taskState?.status, fetchStatus]);

  const isGenerating =
    taskState?.status === "pending" || taskState?.status === "running";

  const isCcGenerating =
    ccTaskState?.status === "pending" || ccTaskState?.status === "running";

  const handleSetActiveVoice = async (voice: string) => {
    try {
      const res = await fetch("/api/settings/audio-voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioVoice: voice }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set voice");
    }
  };

  const handleGenerate = async (voice: string) => {
    try {
      const res = await fetch("/api/admin/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Generation failed");
      }

      const { taskId } = await res.json();
      setGenTaskId(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  };

  const handleRemoveVoice = async (voice: string) => {
    if (!confirm(`Remove all clips for voice "${voice}"?`)) return;
    try {
      const res = await fetch(
        `/api/admin/audio/voice/${encodeURIComponent(voice)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to remove");
      }
      if (selectedVoice === voice) setSelectedVoice(null);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove voice");
    }
  };

  const handlePlay = (voice: string, filename: string, clipId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`/audio/${voice}/${filename}`);
    audioRef.current = audio;
    setPlayingClipId(clipId);
    audio.play();
    audio.onended = () => setPlayingClipId(null);
    audio.onerror = () => setPlayingClipId(null);
  };

  const handleRegenerate = async (voice: string, clipIds: string[]) => {
    if (!voice || clipIds.length === 0) return;
    try {
      const res = await fetch("/api/admin/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice, clipIds }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Generation failed");
      }
      const { taskId } = await res.json();
      setGenTaskId(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    }
  };

  const handleRegenerateSingle = (voice: string, clipId: string) => {
    handleRegenerate(voice, [clipId]);
  };

  // Collected clip generation handler (uses mutation)
  const handleCcGenerate = (clipIds: string[]) => {
    ccGenerateMutation.mutate(
      { voice: ccGenVoice, clipIds },
      {
        onSuccess: ({ taskId }) => setCcGenTaskId(taskId),
        onError: (err) =>
          setError(err instanceof Error ? err.message : "CC generation failed"),
      },
    );
  };

  const handleCcPlayClip = (clipId: string) => {
    if (ccAudioRef.current) {
      ccAudioRef.current.pause();
    }
    const audio = new Audio(`/api/audio/clips/${ccGenVoice}/${clipId}`);
    ccAudioRef.current = audio;
    setCcPlayingClipId(clipId);
    audio.play();
    audio.onended = () => setCcPlayingClipId(null);
    audio.onerror = () => setCcPlayingClipId(null);
  };

  // Invalidate collected clips query when cc task completes
  useEffect(() => {
    if (ccTaskState?.status === "completed" || ccTaskState?.status === "failed") {
      queryClient.invalidateQueries({
        queryKey: collectedClipKeys.list(ccGenVoice),
      });
    }
  }, [ccTaskState?.status, ccGenVoice, queryClient]);

  const installedVoices = status ? Object.keys(status.voices).sort() : [];
  const uninstalledVoices = ALL_VOICES.filter(
    (v) => !installedVoices.includes(v),
  );

  // Collect domain events from task for per-clip status
  const clipEvents = (taskState?.events ?? []).filter(
    (e) => e.eventType === "clip_done" || e.eventType === "clip_error",
  );

  // Group manifest by category
  const groupedManifest = status?.manifest.reduce(
    (acc, clip) => {
      if (!acc[clip.category]) acc[clip.category] = [];
      acc[clip.category].push(clip);
      return acc;
    },
    {} as Record<string, AudioClipEntry[]>,
  );

  const categoryOrder = AUDIO_CATEGORIES;

  return (
    <>
      <AppNavBar navSlot={null} />
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>
      <div
        data-component="AdminAudioPage"
        className={css({
          backgroundColor: "#0d1117",
          minHeight: "100vh",
          color: "#c9d1d9",
          padding: "24px",
        })}
      >
        <div className={css({ maxWidth: "1200px", margin: "0 auto" })}>
          <h1
            className={css({
              fontSize: "24px",
              fontWeight: "600",
              color: "#f0f6fc",
              marginBottom: "24px",
            })}
          >
            Audio Management
          </h1>

          {error && (
            <div
              data-element="error-banner"
              className={css({
                backgroundColor: "#3d1f28",
                border: "1px solid #f85149",
                borderRadius: "6px",
                padding: "12px 16px",
                marginBottom: "16px",
                color: "#f85149",
              })}
            >
              {error}
              <button
                onClick={() => setError(null)}
                className={css({
                  marginLeft: "12px",
                  color: "#8b949e",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                })}
              >
                dismiss
              </button>
            </div>
          )}

          {loading && <p className={css({ color: "#8b949e" })}>Loading...</p>}

          {status && (
            <>
              {/* Voice Chain Configuration — collapsible */}
              <section
                data-element="voice-chain-config"
                className={css({
                  backgroundColor: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: "6px",
                  marginBottom: "8px",
                })}
              >
                <button
                  data-action="toggle-voice-chain"
                  onClick={() => setShowVoiceChain((p) => !p)}
                  className={css({
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#f0f6fc",
                  })}
                >
                  <span className={css({ fontSize: "15px", fontWeight: "600" })}>
                    Voice Chain (Fallback Order)
                  </span>
                  <span className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                    <span className={css({ color: "#8b949e", fontSize: "12px" })}>
                      {voiceChain.map((s) => s.type === "pregenerated" ? s.name : "browser").join(" \u2192 ")}
                    </span>
                    <span className={css({ color: "#8b949e", fontSize: "12px" })}>
                      {showVoiceChain ? "\u25B2" : "\u25BC"}
                    </span>
                  </span>
                </button>
                {showVoiceChain && (
                  <div className={css({ padding: "0 16px 16px" })}>
                    <p className={css({ color: "#8b949e", fontSize: "13px", marginBottom: "12px" })}>
                      Audio plays through each voice in order. If a clip is missing from the first voice, the next voice is tried.
                    </p>

                    {voiceChain.length === 0 && (
                      <p className={css({ color: "#8b949e", fontSize: "13px", fontStyle: "italic" })}>
                        No voice chain configured. Add a voice below.
                      </p>
                    )}

                    <div className={css({ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" })}>
                      {voiceChain.map((source, idx) => (
                        <div
                          key={idx}
                          data-element="voice-chain-entry"
                          className={css({
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            backgroundColor: "#0d1117",
                            border: "1px solid #30363d",
                            borderRadius: "6px",
                            padding: "8px 12px",
                          })}
                        >
                          <span className={css({ color: "#8b949e", fontSize: "12px", width: "20px" })}>
                            {idx + 1}.
                          </span>
                          <span className={css({ color: "#f0f6fc", fontWeight: "600", flex: 1 })}>
                            {source.type === "pregenerated" ? source.name : "Browser TTS"}
                          </span>
                          {source.type === "pregenerated" && status.voices[source.name] && (
                            <span className={css({ color: "#8b949e", fontSize: "12px" })}>
                              {status.voices[source.name].existing}/{status.voices[source.name].total}
                            </span>
                          )}
                          <span
                            className={css({
                              fontSize: "11px",
                              padding: "1px 6px",
                              borderRadius: "8px",
                              backgroundColor: source.type === "pregenerated" ? "#1f6feb33" : "#23863633",
                              color: source.type === "pregenerated" ? "#58a6ff" : "#3fb950",
                            })}
                          >
                            {source.type === "pregenerated" ? "pregenerated" : "browser"}
                          </span>
                          <button
                            data-action="chain-move-up"
                            onClick={() => moveVoiceChainEntry(idx, -1)}
                            disabled={idx === 0}
                            className={css({
                              background: "none",
                              border: "none",
                              color: idx === 0 ? "#30363d" : "#8b949e",
                              cursor: idx === 0 ? "not-allowed" : "pointer",
                              fontSize: "14px",
                              padding: "2px 4px",
                            })}
                            title="Move up"
                          >
                            &#9650;
                          </button>
                          <button
                            data-action="chain-move-down"
                            onClick={() => moveVoiceChainEntry(idx, 1)}
                            disabled={idx === voiceChain.length - 1}
                            className={css({
                              background: "none",
                              border: "none",
                              color: idx === voiceChain.length - 1 ? "#30363d" : "#8b949e",
                              cursor: idx === voiceChain.length - 1 ? "not-allowed" : "pointer",
                              fontSize: "14px",
                              padding: "2px 4px",
                            })}
                            title="Move down"
                          >
                            &#9660;
                          </button>
                          <button
                            data-action="chain-remove"
                            onClick={() => removeVoiceChainEntry(idx)}
                            className={css({
                              background: "none",
                              border: "none",
                              color: "#f85149",
                              cursor: "pointer",
                              fontSize: "14px",
                              padding: "2px 4px",
                            })}
                            title="Remove"
                          >
                            &#10005;
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className={css({ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" })}>
                      <select
                        data-element="add-chain-voice"
                        onChange={(e) => {
                          if (e.target.value) {
                            addToVoiceChain(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className={css({
                          backgroundColor: "#0d1117",
                          color: "#f0f6fc",
                          border: "1px solid #30363d",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "13px",
                        })}
                      >
                        <option value="">Add pregenerated voice...</option>
                        {installedVoices
                          .filter((v) => !voiceChain.some((vc) => vc.type === "pregenerated" && vc.name === v))
                          .map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                      </select>
                      <button
                        data-action="toggle-browser-tts"
                        onClick={toggleBrowserTts}
                        className={css({
                          fontSize: "12px",
                          backgroundColor: voiceChain.some((v) => v.type === "browser-tts") ? "#f8514922" : "#23863633",
                          color: voiceChain.some((v) => v.type === "browser-tts") ? "#f85149" : "#3fb950",
                          border: "1px solid",
                          borderColor: voiceChain.some((v) => v.type === "browser-tts") ? "#f85149" : "#3fb950",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          cursor: "pointer",
                        })}
                      >
                        {voiceChain.some((v) => v.type === "browser-tts") ? "Remove Browser TTS" : "Add Browser TTS Fallback"}
                      </button>
                    </div>

                    {voiceChainDirty && (
                      <button
                        data-action="save-voice-chain"
                        onClick={handleSaveVoiceChain}
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
                        })}
                      >
                        Save Voice Chain
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* TTS Test Panel — collapsible */}
              <section
                data-element="tts-test-panel"
                className={css({
                  backgroundColor: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: "6px",
                  marginBottom: "8px",
                })}
              >
                <button
                  data-action="toggle-tts-test"
                  onClick={() => setShowTtsTest((p) => !p)}
                  className={css({
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#f0f6fc",
                  })}
                >
                  <span className={css({ fontSize: "15px", fontWeight: "600" })}>
                    TTS Test Panel
                  </span>
                  <span className={css({ color: "#8b949e", fontSize: "12px" })}>
                    {showTtsTest ? "\u25B2" : "\u25BC"}
                  </span>
                </button>
                {showTtsTest && <TtsTestPanel />}
              </section>

              {/* Collected Clips — collapsible */}
              <section
                data-element="collected-clips"
                className={css({
                  backgroundColor: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: "6px",
                  marginBottom: "8px",
                })}
              >
                <button
                  data-action="toggle-collected-clips"
                  onClick={() => setShowCollectedClips((p) => !p)}
                  className={css({
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#f0f6fc",
                  })}
                >
                  <span className={css({ fontSize: "15px", fontWeight: "600" })}>
                    Collected Clips (Runtime TTS)
                  </span>
                  <span className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                    <span className={css({ color: "#8b949e", fontSize: "12px" })}>
                      {collectedClips.length > 0 ? `${collectedClips.length} clips` : ""}
                    </span>
                    <span className={css({ color: "#8b949e", fontSize: "12px" })}>
                      {showCollectedClips ? "\u25B2" : "\u25BC"}
                    </span>
                  </span>
                </button>
                {showCollectedClips && (
                  <div className={css({ padding: "0 16px 16px" })}>
                    <p className={css({ color: "#8b949e", fontSize: "13px", marginBottom: "12px" })}>
                      These text+tone pairs were collected from actual app usage via browser TTS. Higher play counts indicate priority for pre-generation.
                    </p>

                    {/* Voice selector + controls */}
                    <div
                      data-element="cc-controls"
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "12px",
                        flexWrap: "wrap",
                      })}
                    >
                      <label className={css({ color: "#8b949e", fontSize: "13px" })}>
                        Voice:
                      </label>
                      <select
                        data-element="cc-voice-select"
                        value={ccGenVoice}
                        onChange={(e) => setCcGenVoice(e.target.value)}
                        className={css({
                          backgroundColor: "#0d1117",
                          color: "#f0f6fc",
                          border: "1px solid #30363d",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          fontSize: "13px",
                        })}
                      >
                        {ALL_VOICES.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      <button
                        data-action="cc-generate-all-missing"
                        onClick={() => {
                          const missingIds = collectedClips
                            .filter((c) => !ccGeneratedFor[c.id])
                            .map((c) => c.id);
                          if (missingIds.length > 0) handleCcGenerate(missingIds);
                        }}
                        disabled={isCcGenerating || collectedClips.length === 0 || collectedClips.every((c) => ccGeneratedFor[c.id])}
                        className={css({
                          fontSize: "12px",
                          backgroundColor: "#238636",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "4px 12px",
                          cursor: "pointer",
                          fontWeight: "600",
                          "&:hover": { backgroundColor: "#2ea043" },
                          "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
                        })}
                      >
                        Generate All Missing
                      </button>
                      <button
                        data-action="refresh-collected"
                        onClick={() => queryClient.invalidateQueries({ queryKey: collectedClipKeys.list(ccGenVoice) })}
                        disabled={collectedClipsLoading}
                        className={css({
                          fontSize: "12px",
                          background: "none",
                          border: "1px solid #30363d",
                          color: "#8b949e",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          cursor: "pointer",
                          "&:hover": { borderColor: "#8b949e" },
                          "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
                        })}
                      >
                        Refresh
                      </button>
                    </div>

                    {/* CC generation progress */}
                    {ccTaskState && (
                      <div
                        data-element="cc-gen-progress"
                        className={css({
                          backgroundColor: "#0d1117",
                          border: "1px solid #30363d",
                          borderRadius: "6px",
                          padding: "12px",
                          marginBottom: "12px",
                        })}
                      >
                        <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" })}>
                          <span className={css({ color: "#f0f6fc", fontSize: "13px", fontWeight: "600" })}>
                            Collected Clip Generation{" "}
                            {isCcGenerating ? "in progress..." : ccTaskState.status}
                          </span>
                          {isCcGenerating && (
                            <button
                              data-action="cancel-cc-gen"
                              onClick={cancelCcTask}
                              className={css({
                                fontSize: "11px",
                                background: "none",
                                border: "1px solid #f85149",
                                color: "#f85149",
                                borderRadius: "6px",
                                padding: "2px 8px",
                                cursor: "pointer",
                              })}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        {isCcGenerating && (
                          <div>
                            <div className={css({ backgroundColor: "#30363d", borderRadius: "4px", height: "6px", overflow: "hidden" })}>
                              <div
                                className={css({ backgroundColor: "#58a6ff", height: "100%", transition: "width 0.3s" })}
                                style={{ width: `${ccTaskState.progress}%` }}
                              />
                            </div>
                            <p className={css({ color: "#8b949e", fontSize: "11px", marginTop: "4px" })}>
                              {ccTaskState.progressMessage || `${ccTaskState.progress}%`}
                            </p>
                          </div>
                        )}
                        {ccTaskState.output && (
                          <p className={css({ color: "#8b949e", fontSize: "12px" })}>
                            Generated: {ccTaskState.output.generated}, Errors: {ccTaskState.output.errors}, Total: {ccTaskState.output.total}
                          </p>
                        )}
                        {ccTaskState.error && (
                          <p className={css({ color: "#f85149", fontSize: "12px" })}>
                            Error: {ccTaskState.error}
                          </p>
                        )}
                      </div>
                    )}

                    {collectedClipsLoading && (
                      <p className={css({ color: "#8b949e", fontSize: "13px" })}>Loading...</p>
                    )}

                    {!collectedClipsLoading && collectedClips.length === 0 && (
                      <p className={css({ color: "#8b949e", fontSize: "13px", fontStyle: "italic" })}>
                        No clips collected yet. Use the app with audio enabled to populate this list.
                      </p>
                    )}

                    {collectedClips.length > 0 && (
                      <table
                        className={css({
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "13px",
                        })}
                      >
                        <thead>
                          <tr>
                            {["Status", "Text", "Tone", "Plays", "Play", "Actions"].map((header, idx) => (
                              <th
                                key={header}
                                className={css({
                                  textAlign: idx === 1 || idx === 2 ? "left" : "center",
                                  padding: "6px 8px",
                                  color: "#8b949e",
                                  borderBottom: "1px solid #30363d",
                                  fontWeight: "500",
                                  backgroundColor: "#161b22",
                                  width: idx === 0 || idx === 4 ? "50px" : idx === 5 ? "90px" : undefined,
                                })}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {collectedClips.map((clip) => {
                            const isGenerated = !!ccGeneratedFor[clip.id];
                            return (
                              <tr key={clip.id}>
                                <td
                                  className={css({
                                    padding: "6px 8px",
                                    borderBottom: "1px solid #21262d",
                                    textAlign: "center",
                                  })}
                                >
                                  <span
                                    title={isGenerated ? `Generated for ${ccGenVoice}` : "Not generated"}
                                    className={css({
                                      display: "inline-block",
                                      width: "8px",
                                      height: "8px",
                                      borderRadius: "50%",
                                      backgroundColor: isGenerated ? "#3fb950" : "#484f58",
                                    })}
                                  />
                                </td>
                                <td
                                  className={css({
                                    padding: "6px 8px",
                                    borderBottom: "1px solid #21262d",
                                    color: "#f0f6fc",
                                  })}
                                >
                                  {clip.text}
                                </td>
                                <td
                                  className={css({
                                    padding: "6px 8px",
                                    borderBottom: "1px solid #21262d",
                                    fontSize: "11px",
                                    color: "#8b949e",
                                    maxWidth: "200px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  })}
                                  title={clip.tone}
                                >
                                  {clip.tone}
                                </td>
                                <td
                                  className={css({
                                    padding: "6px 8px",
                                    borderBottom: "1px solid #21262d",
                                    textAlign: "center",
                                    fontFamily: "monospace",
                                    color: clip.playCount > 0 ? "#3fb950" : "#8b949e",
                                  })}
                                >
                                  {clip.playCount}
                                </td>
                                <td
                                  className={css({
                                    padding: "6px 8px",
                                    borderBottom: "1px solid #21262d",
                                    textAlign: "center",
                                  })}
                                >
                                  <button
                                    data-action="play-cc-clip"
                                    onClick={() => handleCcPlayClip(clip.id)}
                                    disabled={!isGenerated}
                                    className={css({
                                      background: "none",
                                      border: "none",
                                      color: ccPlayingClipId === clip.id ? "#58a6ff" : "#c9d1d9",
                                      cursor: isGenerated ? "pointer" : "not-allowed",
                                      fontSize: "16px",
                                      opacity: isGenerated ? 1 : 0.3,
                                    })}
                                    title={isGenerated ? "Play clip" : "Not generated yet"}
                                  >
                                    {ccPlayingClipId === clip.id ? "\u23F8" : "\u25B6"}
                                  </button>
                                </td>
                                <td
                                  className={css({
                                    padding: "6px 8px",
                                    borderBottom: "1px solid #21262d",
                                    textAlign: "center",
                                  })}
                                >
                                  <button
                                    data-action="generate-cc-clip"
                                    onClick={() => handleCcGenerate([clip.id])}
                                    disabled={isCcGenerating}
                                    className={css({
                                      fontSize: "11px",
                                      backgroundColor: isGenerated ? "transparent" : "#238636",
                                      color: isGenerated ? "#d29922" : "#fff",
                                      border: isGenerated ? "1px solid #d29922" : "none",
                                      borderRadius: "6px",
                                      padding: "2px 8px",
                                      cursor: "pointer",
                                      "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
                                    })}
                                  >
                                    {isGenerated ? "Regen" : "Generate"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </section>

              {/* Voice Management Section — collapsible */}
              <section
                data-element="voice-management"
                className={css({
                  backgroundColor: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: "6px",
                  marginBottom: "8px",
                })}
              >
                <button
                  data-action="toggle-voice-management"
                  onClick={() => setShowVoiceManagement((p) => !p)}
                  className={css({
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#f0f6fc",
                  })}
                >
                  <span className={css({ fontSize: "15px", fontWeight: "600" })}>
                    Voices
                  </span>
                  <span className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                    <span className={css({ color: "#8b949e", fontSize: "12px" })}>
                      {installedVoices.length} installed, active: {status.activeVoice}
                    </span>
                    <span className={css({ color: "#8b949e", fontSize: "12px" })}>
                      {showVoiceManagement ? "\u25B2" : "\u25BC"}
                    </span>
                  </span>
                </button>
                {showVoiceManagement && (
                  <div className={css({ padding: "0 16px 16px" })}>
                    {/* Active voice indicator */}
                    <div
                      data-element="active-voice"
                      className={css({
                        marginBottom: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      })}
                    >
                      <span className={css({ color: "#8b949e", fontSize: "14px" })}>
                        Active voice:
                      </span>
                      <select
                        value={status.activeVoice}
                        onChange={(e) => handleSetActiveVoice(e.target.value)}
                        disabled={installedVoices.length === 0}
                        className={css({
                          backgroundColor: "#0d1117",
                          color: "#f0f6fc",
                          border: "1px solid #30363d",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "14px",
                        })}
                      >
                        {installedVoices.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Voice cards */}
                    <div
                      className={css({
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        marginBottom: "16px",
                      })}
                    >
                      {installedVoices.map((v) => {
                        const info = status.voices[v];
                        const isActive = v === status.activeVoice;
                        return (
                          <div
                            key={v}
                            data-element="voice-card"
                            className={css({
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: "#0d1117",
                              border: "1px solid",
                              borderColor: isActive ? "#58a6ff" : "#30363d",
                              borderRadius: "6px",
                              padding: "12px 16px",
                            })}
                          >
                            <div
                              className={css({
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                              })}
                            >
                              <span
                                className={css({
                                  fontWeight: "600",
                                  color: "#f0f6fc",
                                })}
                              >
                                {v}
                              </span>
                              {isActive && (
                                <span
                                  className={css({
                                    fontSize: "11px",
                                    backgroundColor: "#1f6feb33",
                                    color: "#58a6ff",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                  })}
                                >
                                  active
                                </span>
                              )}
                              <span
                                className={css({
                                  color: "#8b949e",
                                  fontSize: "13px",
                                })}
                              >
                                {info.existing}/{info.total} clips
                              </span>
                              {info.existing < info.total && (
                                <button
                                  data-action="generate-missing"
                                  onClick={() => handleGenerate(v)}
                                  disabled={isGenerating}
                                  className={css({
                                    fontSize: "12px",
                                    backgroundColor: "#238636",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "6px",
                                    padding: "4px 10px",
                                    cursor: "pointer",
                                    "&:hover": { backgroundColor: "#2ea043" },
                                    "&:disabled": {
                                      opacity: 0.5,
                                      cursor: "not-allowed",
                                    },
                                  })}
                                >
                                  Generate missing
                                </button>
                              )}
                              {info.existing > 0 && (
                                <button
                                  data-action="regenerate-all"
                                  onClick={() => {
                                    if (confirm(`Regenerate all ${info.total} clips for "${v}"? This will replace all existing clips.`)) {
                                      handleRegenerate(v, status.manifest.map((c) => c.id));
                                    }
                                  }}
                                  disabled={isGenerating}
                                  className={css({
                                    fontSize: "12px",
                                    backgroundColor: "transparent",
                                    color: "#d29922",
                                    border: "1px solid #d29922",
                                    borderRadius: "6px",
                                    padding: "4px 10px",
                                    cursor: "pointer",
                                    "&:hover": { backgroundColor: "#d2992222" },
                                    "&:disabled": {
                                      opacity: 0.5,
                                      cursor: "not-allowed",
                                    },
                                  })}
                                >
                                  Regenerate all
                                </button>
                              )}
                              {info.existing > 0 && (
                                <button
                                  data-action="start-review"
                                  onClick={() => setReviewVoice(v)}
                                  disabled={isGenerating || reviewVoice === v}
                                  className={css({
                                    fontSize: "12px",
                                    backgroundColor: "#1f6feb",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "6px",
                                    padding: "4px 10px",
                                    cursor: "pointer",
                                    "&:hover": { backgroundColor: "#388bfd" },
                                    "&:disabled": {
                                      opacity: 0.5,
                                      cursor: "not-allowed",
                                    },
                                  })}
                                >
                                  Start Review
                                </button>
                              )}
                            </div>
                            <button
                              data-action="remove-voice"
                              onClick={() => handleRemoveVoice(v)}
                              disabled={isActive || isGenerating}
                              className={css({
                                fontSize: "12px",
                                backgroundColor: "transparent",
                                color: "#f85149",
                                border: "1px solid #f85149",
                                borderRadius: "6px",
                                padding: "4px 10px",
                                cursor: "pointer",
                                "&:hover": { backgroundColor: "#f8514922" },
                                "&:disabled": {
                                  opacity: 0.3,
                                  cursor: "not-allowed",
                                },
                              })}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add voice */}
                    <div
                      data-element="add-voice"
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      })}
                    >
                      <select
                        value={addVoice}
                        onChange={(e) => setAddVoice(e.target.value)}
                        className={css({
                          backgroundColor: "#0d1117",
                          color: "#f0f6fc",
                          border: "1px solid #30363d",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "14px",
                        })}
                      >
                        <option value="">Add a voice...</option>
                        {uninstalledVoices.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <button
                        data-action="add-voice-generate"
                        onClick={() => {
                          if (addVoice) {
                            handleGenerate(addVoice);
                            setAddVoice("");
                          }
                        }}
                        disabled={!addVoice || isGenerating}
                        className={css({
                          backgroundColor: "#238636",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 16px",
                          fontSize: "14px",
                          fontWeight: "600",
                          cursor: "pointer",
                          "&:hover": { backgroundColor: "#2ea043" },
                          "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
                        })}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Review Mode */}
              {reviewVoice && status && (
                <AudioReviewMode
                  voice={reviewVoice}
                  manifest={status.manifest}
                  onClose={() => setReviewVoice(null)}
                  onRegenerateFlagged={(clipIds) => handleRegenerate(reviewVoice, clipIds)}
                  onRegenerateSingle={(clipId) => handleRegenerateSingle(reviewVoice, clipId)}
                  isRegenerating={isGenerating}
                  flagged={flaggedClips}
                  onToggleFlag={handleToggleFlag}
                />
              )}

              {/* Generation Progress (from background task) */}
              {taskState && (
                <section
                  data-element="generation-progress"
                  className={css({
                    backgroundColor: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: "6px",
                    padding: "20px",
                    marginBottom: "24px",
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                    })}
                  >
                    <h2
                      className={css({
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#f0f6fc",
                      })}
                    >
                      Generation{" "}
                      {taskState.status === "running" ||
                      taskState.status === "pending"
                        ? "in progress..."
                        : taskState.status}
                    </h2>
                    {isGenerating && (
                      <button
                        data-action="cancel-generation"
                        onClick={cancelTask}
                        className={css({
                          fontSize: "12px",
                          backgroundColor: "transparent",
                          color: "#f85149",
                          border: "1px solid #f85149",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          cursor: "pointer",
                          "&:hover": { backgroundColor: "#f8514922" },
                        })}
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {taskState.output && (
                    <p
                      className={css({ color: "#8b949e", marginBottom: "8px" })}
                    >
                      Generated: {taskState.output.generated}, Errors:{" "}
                      {taskState.output.errors}, Total: {taskState.output.total}
                    </p>
                  )}

                  {taskState.error && (
                    <p
                      className={css({ color: "#f85149", marginBottom: "8px" })}
                    >
                      Error: {taskState.error}
                    </p>
                  )}

                  {/* Progress bar */}
                  {isGenerating && (
                    <div className={css({ marginBottom: "8px" })}>
                      <div
                        className={css({
                          backgroundColor: "#30363d",
                          borderRadius: "4px",
                          height: "8px",
                          overflow: "hidden",
                        })}
                      >
                        <div
                          className={css({
                            backgroundColor: "#58a6ff",
                            height: "100%",
                            transition: "width 0.3s",
                          })}
                          style={{ width: `${taskState.progress}%` }}
                        />
                      </div>
                      <p
                        className={css({
                          color: "#8b949e",
                          fontSize: "12px",
                          marginTop: "4px",
                        })}
                      >
                        {taskState.progressMessage || `${taskState.progress}%`}
                      </p>
                    </div>
                  )}

                  {/* Per-clip event log */}
                  {clipEvents.length > 0 && (
                    <div
                      className={css({
                        maxHeight: "150px",
                        overflowY: "auto",
                        fontSize: "12px",
                        fontFamily: "monospace",
                      })}
                    >
                      {clipEvents.map((e, i) => {
                        const payload = e.payload as {
                          clipId?: string;
                          error?: string;
                        };
                        return (
                          <div
                            key={i}
                            className={css({
                              color:
                                e.eventType === "clip_error"
                                  ? "#f85149"
                                  : "#3fb950",
                              padding: "1px 0",
                            })}
                          >
                            {e.eventType === "clip_done" ? "\u2713" : "\u2717"}{" "}
                            {payload.clipId}
                            {payload.error && ` - ${payload.error}`}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Clip Table */}
              {installedVoices.length > 0 && (
                <section
                  data-element="clip-table"
                  className={css({
                    backgroundColor: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: "6px",
                    padding: "20px",
                    overflow: "auto",
                    maxHeight: "calc(100vh - 400px)",
                    position: "relative",
                  })}
                >
                  <h2
                    className={css({
                      fontSize: "18px",
                      fontWeight: "600",
                      color: "#f0f6fc",
                      marginBottom: "12px",
                    })}
                  >
                    Clip Browser
                  </h2>

                  {/* Voice tabs */}
                  <div
                    data-element="voice-tabs"
                    className={css({
                      display: "flex",
                      gap: "4px",
                      marginBottom: "16px",
                      borderBottom: "1px solid #30363d",
                      paddingBottom: "8px",
                      position: "sticky",
                      top: 0,
                      zIndex: 10,
                      backgroundColor: "#161b22",
                    })}
                  >
                    {installedVoices.map((v) => (
                      <button
                        key={v}
                        onClick={() => setSelectedVoice(v)}
                        className={css({
                          backgroundColor:
                            selectedVoice === v ? "#30363d" : "transparent",
                          color: selectedVoice === v ? "#f0f6fc" : "#8b949e",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 14px",
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: "pointer",
                          "&:hover": { backgroundColor: "#21262d" },
                        })}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  {selectedVoice && flaggedClips.size > 0 && (
                    <div
                      data-element="flagged-toolbar"
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 12px",
                        marginBottom: "12px",
                        backgroundColor: "#3d1f28",
                        border: "1px solid #f8514944",
                        borderRadius: "6px",
                        fontSize: "13px",
                      })}
                    >
                      <span className={css({ color: "#f85149", fontWeight: "600" })}>
                        {flaggedClips.size} flagged
                      </span>
                      <button
                        data-action="regenerate-all-flagged"
                        onClick={() => handleRegenerate(selectedVoice, Array.from(flaggedClips))}
                        disabled={isGenerating}
                        className={css({
                          backgroundColor: "#238636",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "4px 12px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          "&:hover": { backgroundColor: "#2ea043" },
                          "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
                        })}
                      >
                        Regenerate {flaggedClips.size} flagged
                      </button>
                      <button
                        data-action="clear-flags"
                        onClick={() => setFlaggedClips(new Set())}
                        className={css({
                          background: "none",
                          border: "1px solid #30363d",
                          color: "#8b949e",
                          borderRadius: "6px",
                          padding: "4px 12px",
                          fontSize: "12px",
                          cursor: "pointer",
                          "&:hover": { borderColor: "#8b949e" },
                        })}
                      >
                        Clear flags
                      </button>
                    </div>
                  )}

                  {selectedVoice && groupedManifest && (
                    <div>
                      {categoryOrder
                        .filter((cat) => groupedManifest[cat])
                        .map((cat) => (
                          <div
                            key={cat}
                            className={css({ marginBottom: "20px" })}
                          >
                            <h3
                              className={css({
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#58a6ff",
                                textTransform: "capitalize",
                                marginBottom: "8px",
                                position: "sticky",
                                top: "48px",
                                zIndex: 9,
                                backgroundColor: "#161b22",
                                padding: "4px 0",
                              })}
                            >
                              {cat}
                            </h3>
                            <table
                              className={css({
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: "13px",
                              })}
                            >
                              <thead
                                className={css({
                                  position: "sticky",
                                  top: "80px",
                                  zIndex: 8,
                                })}
                              >
                                <tr>
                                  {["ID", "Text", "Tone", "Status", "Play", "Actions"].map(
                                    (header, idx) => (
                                      <th
                                        key={header}
                                        className={css({
                                          textAlign:
                                            idx >= 3 ? "center" : "left",
                                          padding: "6px 8px",
                                          color: "#8b949e",
                                          borderBottom: "1px solid #30363d",
                                          fontWeight: "500",
                                          width: idx >= 3 && idx <= 4 ? "60px" : undefined,
                                          backgroundColor: "#161b22",
                                        })}
                                      >
                                        {header}
                                      </th>
                                    ),
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {groupedManifest[cat].map((clip) => {
                                  const voiceInfo =
                                    status.voices[selectedVoice];
                                  const allExist =
                                    voiceInfo &&
                                    voiceInfo.existing === voiceInfo.total;
                                  const isClipFlagged = flaggedClips.has(clip.id);
                                  return (
                                    <tr
                                      key={clip.id}
                                      className={css({
                                        backgroundColor: isClipFlagged ? "#3d1f2810" : undefined,
                                      })}
                                    >
                                      <td
                                        className={css({
                                          padding: "6px 8px",
                                          borderBottom: "1px solid #21262d",
                                          fontFamily: "monospace",
                                          fontSize: "12px",
                                        })}
                                      >
                                        {clip.id}
                                      </td>
                                      <td
                                        className={css({
                                          padding: "6px 8px",
                                          borderBottom: "1px solid #21262d",
                                        })}
                                      >
                                        {clip.text}
                                      </td>
                                      <td
                                        className={css({
                                          padding: "6px 8px",
                                          borderBottom: "1px solid #21262d",
                                          fontSize: "11px",
                                          color: "#8b949e",
                                        })}
                                      >
                                        {clip.tone}
                                      </td>
                                      <td
                                        className={css({
                                          padding: "6px 8px",
                                          borderBottom: "1px solid #21262d",
                                          textAlign: "center",
                                        })}
                                      >
                                        <span
                                          className={css({
                                            display: "inline-block",
                                            width: "8px",
                                            height: "8px",
                                            borderRadius: "50%",
                                            backgroundColor: allExist
                                              ? "#3fb950"
                                              : "#8b949e",
                                          })}
                                        />
                                      </td>
                                      <td
                                        className={css({
                                          padding: "6px 8px",
                                          borderBottom: "1px solid #21262d",
                                          textAlign: "center",
                                        })}
                                      >
                                        <button
                                          data-action="play-clip"
                                          onClick={() =>
                                            handlePlay(
                                              selectedVoice,
                                              clip.filename,
                                              clip.id,
                                            )
                                          }
                                          disabled={!allExist}
                                          className={css({
                                            background: "none",
                                            border: "none",
                                            color:
                                              playingClipId === clip.id
                                                ? "#58a6ff"
                                                : "#c9d1d9",
                                            cursor: allExist
                                              ? "pointer"
                                              : "not-allowed",
                                            fontSize: "16px",
                                            opacity: allExist ? 1 : 0.3,
                                          })}
                                          title={`Play ${clip.id}`}
                                        >
                                          {playingClipId === clip.id
                                            ? "\u23F8"
                                            : "\u25B6"}
                                        </button>
                                      </td>
                                      <td
                                        className={css({
                                          padding: "6px 8px",
                                          borderBottom: "1px solid #21262d",
                                          textAlign: "center",
                                        })}
                                      >
                                        <AudioClipActions
                                          clipId={clip.id}
                                          isFlagged={isClipFlagged}
                                          onToggleFlag={handleToggleFlag}
                                          onRegenerate={(id) => handleRegenerateSingle(selectedVoice, id)}
                                          isRegenerating={isGenerating}
                                          compact
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

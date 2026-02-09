"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppNavBar } from "@/components/AppNavBar";
import { AdminNav } from "@/components/AdminNav";
import { TtsTestPanel } from "@/components/admin/TtsTestPanel";
import { useBackgroundTask } from "@/hooks/useBackgroundTask";
import { useCollectedClips, useGenerateCollectedClips, collectedClipKeys } from "@/hooks/useCollectedClips";
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

type VoiceSource =
  | { type: "pregenerated"; name: string }
  | { type: "browser-tts" };

interface AudioStatus {
  activeVoice: string;
  voices: Record<string, { total: number; existing: number }>;
}

export default function AdminAudioPage() {
  const [status, setStatus] = useState<AudioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Background task subscription for collected clip generation
  const { state: ccTaskState, cancel: cancelCcTask } =
    useBackgroundTask<CollectedClipGenerateOutput>(ccGenTaskId);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/audio");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setStatus({ activeVoice: data.activeVoice, voices: data.voices });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

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
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove voice");
    }
  };

  // Collected clip generation handler (uses mutation)
  const handleCcGenerate = (clipIds: string[]) => {
    ccGenerateMutation.mutate(
      { voice: ccGenVoice, clipIds },
      {
        onSuccess: ({ taskId }) => setCcGenTaskId(taskId),
        onError: (err) =>
          setError(err instanceof Error ? err.message : "Generation failed"),
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
                    Collected Clips
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
                      Clips collected from app usage. Generate mp3s for a voice, then add the voice to the chain above.
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
                      {(() => {
                        const missingCount = collectedClips.filter((c) => !ccGeneratedFor[c.id]).length;
                        return missingCount > 0 ? (
                          <button
                            data-action="cc-generate-all-missing"
                            onClick={() => {
                              const missingIds = collectedClips
                                .filter((c) => !ccGeneratedFor[c.id])
                                .map((c) => c.id);
                              handleCcGenerate(missingIds);
                            }}
                            disabled={isCcGenerating}
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
                            Generate {missingCount} Missing
                          </button>
                        ) : null;
                      })()}
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
                            Generation{" "}
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
                          <div
                            data-element="cc-task-error-banner"
                            className={css({
                              backgroundColor: "#3d1f28",
                              border: "1px solid #f85149",
                              borderRadius: "6px",
                              padding: "10px 14px",
                              marginTop: "8px",
                              color: "#f85149",
                              fontSize: "13px",
                              lineHeight: "1.5",
                            })}
                          >
                            {ccTaskState.error}
                          </div>
                        )}
                        {/* Per-clip event log */}
                        {(() => {
                          const ccClipEvents = (ccTaskState.events ?? []).filter(
                            (e) => e.eventType === "cc_clip_done" || e.eventType === "cc_clip_error",
                          );
                          return ccClipEvents.length > 0 ? (
                            <div
                              data-element="cc-clip-events"
                              className={css({
                                maxHeight: "150px",
                                overflowY: "auto",
                                fontSize: "12px",
                                fontFamily: "monospace",
                                marginTop: "8px",
                              })}
                            >
                              {ccClipEvents.map((e, i) => {
                                const payload = e.payload as {
                                  clipId?: string;
                                  error?: string;
                                };
                                return (
                                  <div
                                    key={i}
                                    className={css({
                                      color:
                                        e.eventType === "cc_clip_error"
                                          ? "#f85149"
                                          : "#3fb950",
                                      padding: "1px 0",
                                    })}
                                  >
                                    {e.eventType === "cc_clip_done" ? "\u2713" : "\u2717"}{" "}
                                    {payload.clipId}
                                    {payload.error && ` \u2014 ${payload.error}`}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null;
                        })()}
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

                    {collectedClips.length > 0 && (() => {
                      const clipsWithoutSay = collectedClips.filter((c) => !c.say || Object.keys(c.say).length === 0);
                      return (
                      <>
                      {clipsWithoutSay.length > 0 && (
                        <div
                          data-element="cc-missing-say-warning"
                          className={css({
                            backgroundColor: "#3b2e00",
                            border: "1px solid #d29922",
                            borderRadius: "6px",
                            padding: "10px 14px",
                            marginBottom: "12px",
                            color: "#d29922",
                            fontSize: "13px",
                            lineHeight: "1.5",
                          })}
                        >
                          <strong>{clipsWithoutSay.length} clip{clipsWithoutSay.length > 1 ? "s" : ""}</strong> missing{" "}
                          <code className={css({ fontSize: "12px", backgroundColor: "#d2992220", padding: "1px 4px", borderRadius: "3px" })}>say</code>{" "}
                          text. These will use the clip ID as the spoken text, which may not sound natural.
                          Register clips with a <code className={css({ fontSize: "12px", backgroundColor: "#d2992220", padding: "1px 4px", borderRadius: "3px" })}>say</code> map
                          in <code className={css({ fontSize: "12px", backgroundColor: "#d2992220", padding: "1px 4px", borderRadius: "3px" })}>useTTS()</code> to provide proper text.
                        </div>
                      )}
                      <table
                        className={css({
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "13px",
                        })}
                      >
                        <thead>
                          <tr>
                            {["Status", "Clip ID", "Text", "Tone", "Plays", "Play", "Actions"].map((header, idx) => (
                              <th
                                key={header}
                                className={css({
                                  textAlign: idx === 1 || idx === 2 || idx === 3 ? "left" : "center",
                                  padding: "6px 8px",
                                  color: "#8b949e",
                                  borderBottom: "1px solid #30363d",
                                  fontWeight: "500",
                                  backgroundColor: "#161b22",
                                  width: idx === 0 || idx === 5 ? "50px" : idx === 6 ? "90px" : undefined,
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
                                    fontSize: "12px",
                                    maxWidth: "200px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  })}
                                  title={clip.say ? JSON.stringify(clip.say) : `No say text — clip ID "${clip.id}" will be read aloud verbatim`}
                                >
                                  {(() => {
                                    const sayText = clip.say ? Object.values(clip.say)[0] : undefined;
                                    if (sayText) return <span className={css({ color: "#c9d1d9" })}>{sayText}</span>;
                                    return (
                                      <span className={css({ display: "flex", alignItems: "center", gap: "4px" })}>
                                        <span className={css({ color: "#d29922", fontSize: "13px" })} title="Missing say text — clip ID will be spoken as-is">&#9888;</span>
                                        <span className={css({ color: "#d29922", fontStyle: "italic" })}>
                                          &quot;{clip.id}&quot;
                                        </span>
                                      </span>
                                    );
                                  })()}
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
                      </>
                      );
                    })()}
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
                      })}
                    >
                      {installedVoices.map((v) => {
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
                            </div>
                            <button
                              data-action="remove-voice"
                              onClick={() => handleRemoveVoice(v)}
                              disabled={isActive}
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
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

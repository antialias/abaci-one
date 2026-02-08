"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppNavBar } from "@/components/AppNavBar";
import { AdminNav } from "@/components/AdminNav";
import { AudioReviewMode } from "@/components/admin/AudioReviewMode";
import { useBackgroundTask } from "@/hooks/useBackgroundTask";
import type { AudioClipEntry } from "@/lib/audio/audioManifest";
import type { AudioGenerateOutput } from "@/lib/tasks/audio-generate";
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

  // Background task subscription
  const { state: taskState, cancel: cancelTask } =
    useBackgroundTask<AudioGenerateOutput>(genTaskId);

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

  // Refresh status when task completes
  useEffect(() => {
    if (taskState?.status === "completed" || taskState?.status === "failed") {
      fetchStatus();
    }
  }, [taskState?.status, fetchStatus]);

  const isGenerating =
    taskState?.status === "pending" || taskState?.status === "running";

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

  const handleRegenerateFlagged = async (clipIds: string[]) => {
    if (!reviewVoice || clipIds.length === 0) return;
    try {
      const res = await fetch("/api/admin/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: reviewVoice, clipIds }),
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

  const categoryOrder = ["number", "operator", "feedback", "tutorial"];

  return (
    <>
      <AppNavBar navSlot={null} />
      <AdminNav />
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
              {/* Voice Management Section */}
              <section
                data-element="voice-management"
                className={css({
                  backgroundColor: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: "6px",
                  padding: "20px",
                  marginBottom: "24px",
                })}
              >
                <h2
                  className={css({
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#f0f6fc",
                    marginBottom: "16px",
                  })}
                >
                  Voices
                </h2>

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
              </section>

              {/* Review Mode */}
              {reviewVoice && status && (
                <AudioReviewMode
                  voice={reviewVoice}
                  manifest={status.manifest}
                  onClose={() => setReviewVoice(null)}
                  onRegenerateFlagged={handleRegenerateFlagged}
                  isRegenerating={isGenerating}
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
                                  {["ID", "Text", "Status", "Play"].map(
                                    (header, idx) => (
                                      <th
                                        key={header}
                                        className={css({
                                          textAlign:
                                            idx >= 2 ? "center" : "left",
                                          padding: "6px 8px",
                                          color: "#8b949e",
                                          borderBottom: "1px solid #30363d",
                                          fontWeight: "500",
                                          width: idx >= 2 ? "60px" : undefined,
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
                                  return (
                                    <tr key={clip.id}>
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

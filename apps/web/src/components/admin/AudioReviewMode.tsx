"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AUDIO_CATEGORIES } from "@/lib/audio/audioManifest";
import type { AudioClipEntry } from "@/lib/audio/audioManifest";
import { css } from "../../../styled-system/css";

interface AudioReviewModeProps {
  voice: string;
  manifest: AudioClipEntry[];
  onClose: () => void;
  onRegenerateFlagged: (clipIds: string[]) => void;
  onRegenerateSingle: (clipId: string) => void;
  isRegenerating: boolean;
  flagged: Set<string>;
  onToggleFlag: (clipId: string) => void;
}

type Phase = "reviewing" | "summary";

export function AudioReviewMode({
  voice,
  manifest,
  onClose,
  onRegenerateFlagged,
  onRegenerateSingle,
  isRegenerating,
  flagged,
  onToggleFlag,
}: AudioReviewModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoAdvance, setIsAutoAdvance] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase>("reviewing");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // When re-reviewing flagged only, this holds the filtered subset
  const [reviewSubset, setReviewSubset] = useState<AudioClipEntry[] | null>(
    null,
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Refs to mirror state — readable from onended without nesting state updaters
  // (nesting setState updaters causes StrictMode to call them 2×2 = 4 times)
  const flaggedRef = useRef(flagged);
  flaggedRef.current = flagged;
  const isAutoAdvanceRef = useRef(isAutoAdvance);
  isAutoAdvanceRef.current = isAutoAdvance;

  const clips = useMemo(() => {
    const base = reviewSubset ?? manifest;
    return categoryFilter ? base.filter((c) => c.category === categoryFilter) : base;
  }, [reviewSubset, manifest, categoryFilter]);

  const currentClip = clips[currentIndex] as AudioClipEntry | undefined;

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    clearAutoAdvanceTimer();
  }, [clearAutoAdvanceTimer]);

  // Play current clip
  const playCurrentClip = useCallback(() => {
    if (!currentClip) return;
    stopAudio();

    const audio = new Audio(`/api/audio/clips/${voice}/${currentClip.id}`);
    audioRef.current = audio;
    setIsPlaying(true);

    audio.onended = () => {
      setIsPlaying(false);
      // Read current state from refs (not state updaters) to avoid
      // StrictMode double-invocation creating multiple orphaned timers
      if (isAutoAdvanceRef.current && !flaggedRef.current.has(currentClip.id)) {
        autoAdvanceTimerRef.current = setTimeout(() => {
          setCurrentIndex((idx) => {
            const nextIdx = idx + 1;
            if (nextIdx >= clips.length) {
              setPhase("summary");
              return idx;
            }
            return nextIdx;
          });
        }, 1000);
      }
    };

    audio.onerror = () => {
      setIsPlaying(false);
    };

    audio.play();
  }, [currentClip, voice, stopAudio, clips.length]);

  // Play on mount and index changes
  useEffect(() => {
    if (phase === "reviewing" && currentClip) {
      playCurrentClip();
    }
    return () => {
      clearAutoAdvanceTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const handleNext = () => {
    clearAutoAdvanceTimer();
    if (currentIndex + 1 >= clips.length) {
      setPhase("summary");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    clearAutoAdvanceTimer();
    setCurrentIndex((i) => Math.max(0, i - 1));
  };

  const handleToggleFlag = () => {
    if (!currentClip) return;
    const wasFlagged = flagged.has(currentClip.id);
    onToggleFlag(currentClip.id);
    if (!wasFlagged) {
      // Flagging pauses auto-advance
      setIsAutoAdvance(false);
      clearAutoAdvanceTimer();
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      playCurrentClip();
    }
  };

  const handleReReviewFlagged = () => {
    const flaggedClips = manifest.filter((c) => flagged.has(c.id));
    if (flaggedClips.length === 0) return;
    setReviewSubset(flaggedClips);
    setCurrentIndex(0);
    setPhase("reviewing");
  };

  const handleRegenerate = () => {
    onRegenerateFlagged(Array.from(flagged));
  };

  const categoryLabel = (cat: string) => {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  const progressPercent =
    clips.length > 0
      ? Math.round(((currentIndex + 1) / clips.length) * 100)
      : 0;

  const buttonBase = css({
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
  });

  if (phase === "summary") {
    const flaggedClips = manifest.filter((c) => flagged.has(c.id));

    return (
      <section
        data-component="AudioReviewMode"
        data-element="summary"
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
            marginBottom: "16px",
          })}
        >
          <h2
            className={css({
              fontSize: "18px",
              fontWeight: "600",
              color: "#f0f6fc",
            })}
          >
            Review Complete — {voice}
          </h2>
          <button
            data-action="close-review"
            onClick={onClose}
            className={css({
              background: "none",
              border: "1px solid #30363d",
              color: "#8b949e",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "13px",
              cursor: "pointer",
              "&:hover": { borderColor: "#8b949e" },
            })}
          >
            Done
          </button>
        </div>

        {flaggedClips.length === 0 ? (
          <p className={css({ color: "#3fb950", fontSize: "14px" })}>
            All clips passed review. No issues found.
          </p>
        ) : (
          <>
            <p
              className={css({
                color: "#f0f6fc",
                fontSize: "14px",
                marginBottom: "12px",
              })}
            >
              {flaggedClips.length} clip{flaggedClips.length !== 1 ? "s" : ""}{" "}
              flagged for regeneration:
            </p>

            <div
              className={css({
                maxHeight: "300px",
                overflowY: "auto",
                marginBottom: "16px",
              })}
            >
              {flaggedClips.map((clip) => (
                <div
                  key={clip.id}
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderBottom: "1px solid #21262d",
                    fontSize: "13px",
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
                        fontFamily: "monospace",
                        fontSize: "12px",
                        color: "#8b949e",
                      })}
                    >
                      {clip.id}
                    </span>
                    <span className={css({ color: "#c9d1d9" })}>
                      {clip.text}
                    </span>
                  </div>
                  <div className={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                    <button
                      data-action="regenerate-single"
                      onClick={() => onRegenerateSingle(clip.id)}
                      disabled={isRegenerating}
                      className={css({
                        background: "none",
                        border: "none",
                        color: "#238636",
                        cursor: "pointer",
                        fontSize: "12px",
                        "&:hover": { textDecoration: "underline" },
                        "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
                      })}
                    >
                      Regen
                    </button>
                    <button
                      data-action="unflag-clip"
                      onClick={() => onToggleFlag(clip.id)}
                      className={css({
                        background: "none",
                        border: "none",
                        color: "#f85149",
                        cursor: "pointer",
                        fontSize: "12px",
                        "&:hover": { textDecoration: "underline" },
                      })}
                    >
                      Unflag
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={css({ display: "flex", gap: "8px" })}>
              <button
                data-action="regenerate-flagged"
                onClick={handleRegenerate}
                disabled={isRegenerating || flaggedClips.length === 0}
                className={`${buttonBase} ${css({
                  backgroundColor: "#238636",
                  color: "#fff",
                  "&:hover": { backgroundColor: "#2ea043" },
                })}`}
              >
                Regenerate {flaggedClips.length} flagged clip
                {flaggedClips.length !== 1 ? "s" : ""}
              </button>
              <button
                data-action="re-review-flagged"
                onClick={handleReReviewFlagged}
                disabled={flaggedClips.length === 0}
                className={`${buttonBase} ${css({
                  backgroundColor: "#30363d",
                  color: "#c9d1d9",
                  "&:hover": { backgroundColor: "#3d444d" },
                })}`}
              >
                Re-review flagged only
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  // Review phase
  return (
    <section
      data-component="AudioReviewMode"
      data-element="review"
      className={css({
        backgroundColor: "#161b22",
        border: "1px solid #30363d",
        borderRadius: "6px",
        padding: "20px",
        marginBottom: "24px",
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        })}
      >
        <h2
          className={css({
            fontSize: "18px",
            fontWeight: "600",
            color: "#f0f6fc",
          })}
        >
          Reviewing: {voice}
          {reviewSubset && (
            <span
              className={css({
                color: "#8b949e",
                fontSize: "13px",
                marginLeft: "8px",
              })}
            >
              (flagged only)
            </span>
          )}
        </h2>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "12px",
          })}
        >
          <span
            className={css({
              color: "#f85149",
              fontSize: "13px",
              fontWeight: "600",
            })}
          >
            {flagged.size} flagged
          </span>
          {flagged.size > 0 && (
            <button
              data-action="regen-flagged-header"
              onClick={() => onRegenerateFlagged(Array.from(flagged))}
              disabled={isRegenerating}
              className={css({
                fontSize: "12px",
                backgroundColor: "#238636",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                fontWeight: "600",
                cursor: "pointer",
                "&:hover": { backgroundColor: "#2ea043" },
                "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
              })}
            >
              Regen {flagged.size} flagged
            </button>
          )}
          <button
            data-action="close-review"
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className={css({
              background: "none",
              border: "1px solid #30363d",
              color: "#8b949e",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "13px",
              cursor: "pointer",
              "&:hover": { borderColor: "#8b949e" },
            })}
          >
            Close
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div
        data-element="category-tabs"
        className={css({
          display: "flex",
          gap: "4px",
          marginBottom: "12px",
          borderBottom: "1px solid #30363d",
          paddingBottom: "8px",
        })}
      >
        <button
          data-action="category-all"
          onClick={() => { setCategoryFilter(null); setCurrentIndex(0); }}
          className={css({
            backgroundColor: categoryFilter === null ? "#30363d" : "transparent",
            color: categoryFilter === null ? "#f0f6fc" : "#8b949e",
            border: "none",
            borderRadius: "6px",
            padding: "4px 12px",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            "&:hover": { backgroundColor: "#21262d" },
          })}
        >
          All ({(reviewSubset ?? manifest).length})
        </button>
        {AUDIO_CATEGORIES.map((cat) => {
          const count = (reviewSubset ?? manifest).filter((c) => c.category === cat).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              data-action={`category-${cat}`}
              onClick={() => { setCategoryFilter(cat); setCurrentIndex(0); }}
              className={css({
                backgroundColor: categoryFilter === cat ? "#30363d" : "transparent",
                color: categoryFilter === cat ? "#f0f6fc" : "#8b949e",
                border: "none",
                borderRadius: "6px",
                padding: "4px 12px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                textTransform: "capitalize",
                "&:hover": { backgroundColor: "#21262d" },
              })}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className={css({ marginBottom: "16px" })}>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
            fontSize: "12px",
            color: "#8b949e",
          })}
        >
          <span>
            {currentIndex + 1} / {clips.length}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div
          className={css({
            backgroundColor: "#30363d",
            borderRadius: "4px",
            height: "4px",
            overflow: "hidden",
          })}
        >
          <div
            className={css({
              backgroundColor: "#58a6ff",
              height: "100%",
              transition: "width 0.3s",
            })}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Current clip card */}
      {currentClip && (
        <div
          data-element="clip-card"
          className={css({
            backgroundColor: "#0d1117",
            border: "1px solid",
            borderColor: flagged.has(currentClip.id) ? "#f85149" : "#30363d",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "16px",
            textAlign: "center",
          })}
        >
          <span
            className={css({
              display: "inline-block",
              fontSize: "11px",
              backgroundColor: "#1f6feb33",
              color: "#58a6ff",
              padding: "2px 10px",
              borderRadius: "12px",
              marginBottom: "12px",
              textTransform: "capitalize",
            })}
          >
            {categoryLabel(currentClip.category)}
          </span>
          <div
            className={css({
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#8b949e",
              marginBottom: "8px",
            })}
          >
            {currentClip.id}
          </div>
          <div
            className={css({
              fontSize: "24px",
              fontWeight: "600",
              color: "#f0f6fc",
            })}
          >
            &ldquo;{currentClip.text}&rdquo;
          </div>
          {flagged.has(currentClip.id) && (
            <div
              className={css({
                marginTop: "8px",
                color: "#f85149",
                fontSize: "13px",
                fontWeight: "600",
              })}
            >
              FLAGGED
            </div>
          )}
        </div>
      )}

      {/* Playback controls */}
      <div
        data-element="playback-controls"
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          marginBottom: "12px",
        })}
      >
        <button
          data-action="review-back"
          onClick={handleBack}
          disabled={currentIndex === 0}
          className={`${buttonBase} ${css({
            backgroundColor: "#30363d",
            color: "#c9d1d9",
            "&:hover": { backgroundColor: "#3d444d" },
          })}`}
        >
          Back
        </button>
        <button
          data-action="review-play-pause"
          onClick={handlePlayPause}
          className={`${buttonBase} ${css({
            backgroundColor: "#1f6feb",
            color: "#fff",
            minWidth: "80px",
            "&:hover": { backgroundColor: "#388bfd" },
          })}`}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          data-action="review-next"
          onClick={handleNext}
          className={`${buttonBase} ${css({
            backgroundColor: "#30363d",
            color: "#c9d1d9",
            "&:hover": { backgroundColor: "#3d444d" },
          })}`}
        >
          Next
        </button>
        <div className={css({ width: "16px" })} />
        <button
          data-action="review-flag"
          onClick={handleToggleFlag}
          className={`${buttonBase} ${css({
            backgroundColor:
              currentClip && flagged.has(currentClip.id)
                ? "#f85149"
                : "#3d1f28",
            color:
              currentClip && flagged.has(currentClip.id) ? "#fff" : "#f85149",
            border: "1px solid #f85149",
            "&:hover": { backgroundColor: "#f8514944" },
          })}`}
        >
          {currentClip && flagged.has(currentClip.id) ? "Unflag" : "Flag"}
        </button>
        {currentClip && flagged.has(currentClip.id) && (
          <button
            data-action="regenerate-now"
            onClick={() => onRegenerateSingle(currentClip.id)}
            disabled={isRegenerating}
            className={`${buttonBase} ${css({
              backgroundColor: "#238636",
              color: "#fff",
              "&:hover": { backgroundColor: "#2ea043" },
            })}`}
          >
            Regenerate Now
          </button>
        )}
      </div>

      {/* Auto-advance toggle */}
      <div
        data-element="auto-advance"
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          fontSize: "13px",
          color: "#8b949e",
        })}
      >
        <label
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
          })}
        >
          <input
            type="checkbox"
            checked={isAutoAdvance}
            onChange={(e) => setIsAutoAdvance(e.target.checked)}
            className={css({ cursor: "pointer" })}
          />
          Auto-advance
        </label>
        {isAutoAdvance && (
          <span className={css({ color: "#3fb950", fontSize: "12px" })}>
            ON
          </span>
        )}
      </div>
    </section>
  );
}

/**
 * ProblemVideoPlayer - Enhanced video player for recorded problem attempts
 *
 * Shows the recorded video from when a student was working on a specific problem,
 * with synchronized metadata display that recreates the live observation experience:
 * - Problem display (VerticalProblem component)
 * - Detected abacus value overlay on video
 * - Student's typed answer as it progresses
 * - Feedback state at the correct moment
 * - Attempt selector when multiple recordings exist (retries/redos)
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ProblemMetadata,
  ProblemMetadataEntry,
} from "@/lib/vision/recording";
import {
  type VideoAttemptInfo,
  getVideoAttemptsForProblem,
  buildVideoUrl,
  buildMetadataUrl,
} from "@/lib/utils/attempt-tracking";
import { css } from "../../../styled-system/css";
import { VerticalProblem } from "../practice/VerticalProblem";

interface ProblemVideoPlayerProps {
  /** Player ID for the API route */
  playerId: string;
  /** Session ID for the API route */
  sessionId: string;
  /** Problem number to display (1-indexed) */
  problemNumber: number;
  /** Dark mode */
  isDark: boolean;
  /** All available video attempts for this session */
  availableVideos?: VideoAttemptInfo[];
  /** Selected attempt to play (controlled by parent) */
  selectedAttempt?: { epochNumber: number; attemptNumber: number } | null;
}

/**
 * Fetch all videos for a session from the API
 */
async function fetchAllVideos(
  playerId: string,
  sessionId: string,
): Promise<VideoAttemptInfo[]> {
  try {
    const response = await fetch(
      `/api/curriculum/${playerId}/sessions/${sessionId}/videos`,
    );
    if (!response.ok) return [];

    const data = (await response.json()) as { videos: VideoAttemptInfo[] };
    return data.videos;
  } catch {
    return [];
  }
}

/**
 * Fetch problem metadata from the API
 */
async function fetchMetadata(
  playerId: string,
  sessionId: string,
  problemNumber: number,
  epochNumber: number,
  attemptNumber: number,
): Promise<ProblemMetadata | null> {
  try {
    const url = buildMetadataUrl(
      playerId,
      sessionId,
      problemNumber,
      epochNumber,
      attemptNumber,
    );
    const response = await fetch(url);
    if (!response.ok) return null;

    return (await response.json()) as ProblemMetadata;
  } catch {
    return null;
  }
}

/**
 * Find the metadata entry for a given timestamp
 * Returns the most recent entry before or at the given time
 */
function findEntryAtTime(
  entries: ProblemMetadataEntry[],
  timeMs: number,
): ProblemMetadataEntry | null {
  if (entries.length === 0) return null;

  // Binary search for the entry at or before timeMs
  let left = 0;
  let right = entries.length - 1;
  let result: ProblemMetadataEntry | null = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (entries[mid].t <= timeMs) {
      result = entries[mid];
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

export function ProblemVideoPlayer({
  playerId,
  sessionId,
  problemNumber,
  isDark,
  availableVideos,
  selectedAttempt: selectedAttemptProp,
}: ProblemVideoPlayerProps) {
  // Use provided videos or fetch them
  const [allVideos, setAllVideos] = useState<VideoAttemptInfo[]>(
    availableVideos ?? [],
  );
  // Internal selected attempt state (only used if not controlled by parent)
  const [internalSelectedAttempt, setInternalSelectedAttempt] = useState<{
    epochNumber: number;
    attemptNumber: number;
  } | null>(null);
  const [metadata, setMetadata] = useState<ProblemMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEntry, setCurrentEntry] = useState<ProblemMetadataEntry | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  // No-video playback state
  const [noVideoPlaybackIndex, setNoVideoPlaybackIndex] = useState(0);
  const [isNoVideoPlaying, setIsNoVideoPlaying] = useState(false);
  const noVideoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use parent's selectedAttempt if provided, otherwise use internal state
  const isControlled = selectedAttemptProp !== undefined;
  const selectedAttempt = isControlled
    ? selectedAttemptProp
    : internalSelectedAttempt;

  // Get attempts for this specific problem - memoized to prevent render loops
  const problemAttempts = useMemo(
    () => getVideoAttemptsForProblem(allVideos, problemNumber),
    [allVideos, problemNumber],
  );
  const currentVideo = problemAttempts.find(
    (v) =>
      v.epochNumber === selectedAttempt?.epochNumber &&
      v.attemptNumber === selectedAttempt?.attemptNumber,
  );

  // Extract unique answer states for no-video playback
  // Each entry represents a distinct answer state (when studentAnswer changes)
  const answerProgression = useMemo(() => {
    if (!metadata || metadata.entries.length === 0) return [];

    const progression: Array<{
      answer: string;
      phase: "problem" | "feedback";
      isCorrect?: boolean;
      originalTimestamp: number; // Keep original timing for reference
    }> = [];

    let lastAnswer = "";
    for (const entry of metadata.entries) {
      // Add entry if answer changed or phase changed to feedback
      if (entry.studentAnswer !== lastAnswer || entry.phase === "feedback") {
        progression.push({
          answer: entry.studentAnswer,
          phase: entry.phase,
          isCorrect: entry.isCorrect,
          originalTimestamp: entry.t,
        });
        lastAnswer = entry.studentAnswer;
      }
    }

    return progression;
  }, [metadata]);

  // No-video playback controls
  const startNoVideoPlayback = useCallback(() => {
    if (answerProgression.length === 0) return;
    setIsNoVideoPlaying(true);
  }, [answerProgression.length]);

  const pauseNoVideoPlayback = useCallback(() => {
    setIsNoVideoPlaying(false);
  }, []);

  const restartNoVideoPlayback = useCallback(() => {
    setNoVideoPlaybackIndex(0);
    setIsNoVideoPlaying(true);
  }, []);

  // No-video playback interval effect
  useEffect(() => {
    if (!isNoVideoPlaying || answerProgression.length === 0) {
      if (noVideoIntervalRef.current) {
        clearInterval(noVideoIntervalRef.current);
        noVideoIntervalRef.current = null;
      }
      return;
    }

    noVideoIntervalRef.current = setInterval(() => {
      setNoVideoPlaybackIndex((prev) => {
        const next = prev + 1;
        if (next >= answerProgression.length) {
          setIsNoVideoPlaying(false);
          return prev; // Stay on last entry
        }
        return next;
      });
    }, 500); // 500ms between entries

    return () => {
      if (noVideoIntervalRef.current) {
        clearInterval(noVideoIntervalRef.current);
        noVideoIntervalRef.current = null;
      }
    };
  }, [isNoVideoPlaying, answerProgression.length]);

  // Reset no-video playback when metadata changes
  useEffect(() => {
    setNoVideoPlaybackIndex(0);
    setIsNoVideoPlaying(false);
  }, [metadata]);

  // Get current state for no-video playback
  const currentNoVideoState = answerProgression[noVideoPlaybackIndex] ?? null;
  const isNoVideoComplete =
    noVideoPlaybackIndex >= answerProgression.length - 1;

  // Reset internal state when problem number changes (only if uncontrolled)
  useEffect(() => {
    if (!isControlled) {
      setInternalSelectedAttempt(null);
    }
    setMetadata(null);
    setError(null);
    setCurrentEntry(null);
  }, [problemNumber, isControlled]);

  // Auto-select latest attempt (only if uncontrolled)
  useEffect(() => {
    if (isControlled) return;
    if (problemAttempts.length > 0 && internalSelectedAttempt === null) {
      const latest = problemAttempts[problemAttempts.length - 1];
      setInternalSelectedAttempt({
        epochNumber: latest.epochNumber,
        attemptNumber: latest.attemptNumber,
      });
    }
  }, [problemAttempts, internalSelectedAttempt, isControlled]);

  // Track whether we've finished loading available videos
  const [videosLoaded, setVideosLoaded] = useState(false);

  // Fetch all videos if not provided
  useEffect(() => {
    if (availableVideos && availableVideos.length >= 0) {
      setAllVideos(availableVideos);
      setVideosLoaded(true);
      return;
    }

    // Fetch videos if not provided
    setVideosLoaded(false);
    fetchAllVideos(playerId, sessionId).then((videos) => {
      setAllVideos(videos);
      setVideosLoaded(true);
    });
  }, [playerId, sessionId, availableVideos]);

  // Determine if no recording exists for this problem
  const noRecordingExists = videosLoaded && problemAttempts.length === 0;

  // Fetch metadata when selected attempt changes
  useEffect(() => {
    if (!selectedAttempt) {
      // Only show loading if we haven't determined there are no recordings
      setIsLoading(!noRecordingExists);
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentEntry(null);

    fetchMetadata(
      playerId,
      sessionId,
      problemNumber,
      selectedAttempt.epochNumber,
      selectedAttempt.attemptNumber,
    )
      .then((meta) => {
        setMetadata(meta);
        setIsLoading(false);

        // Check video status - find in current attempts
        const video = allVideos.find(
          (v) =>
            v.problemNumber === problemNumber &&
            v.epochNumber === selectedAttempt.epochNumber &&
            v.attemptNumber === selectedAttempt.attemptNumber,
        );
        if (!video) {
          setError("Video not found");
        } else if (video.status === "processing") {
          setError("Video is being processed...");
        } else if (video.status === "failed") {
          setError(video.processingError || "Video encoding failed");
        } else if (video.status === "recording") {
          setError("Video is still recording");
        } else if (video.status === "no_video") {
          // No error - we have metadata but no video, which is valid
          // The UI will show the metadata-only view
        }
      })
      .catch(() => {
        setIsLoading(false);
        setError("Failed to load video info");
      });
  }, [playerId, sessionId, problemNumber, selectedAttempt, allVideos]);

  // Sync metadata to video time
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !metadata) return;

    const currentTimeMs = videoRef.current.currentTime * 1000;
    const entry = findEntryAtTime(metadata.entries, currentTimeMs);
    setCurrentEntry(entry);
  }, [metadata]);

  // Auto-play when video loads
  const handleCanPlay = useCallback(() => {
    videoRef.current?.play();
  }, []);

  // Build video URL with epoch/attempt params
  const videoUrl = selectedAttempt
    ? buildVideoUrl(
        playerId,
        sessionId,
        problemNumber,
        selectedAttempt.epochNumber,
        selectedAttempt.attemptNumber,
      )
    : null;

  // Determine display state
  const hasProblemData = metadata?.problem && metadata.problem.terms.length > 0;
  const showFeedback = currentEntry?.phase === "feedback";
  const studentAnswer = currentEntry?.studentAnswer || "";

  return (
    <div
      data-component="problem-video-player"
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        width: "100%",
        maxWidth: "600px",
      })}
    >
      {/* Main content area - problem and video side by side on larger screens */}
      {!isLoading && !error && currentVideo?.status === "ready" && videoUrl && (
        <div
          data-element="playback-content"
          className={css({
            display: "flex",
            flexDirection: { base: "column", md: "row" },
            gap: "16px",
            width: "100%",
            alignItems: "flex-start",
          })}
        >
          {/* Problem display */}
          {hasProblemData && (
            <div
              data-element="problem-display"
              className={css({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                minWidth: "200px",
                padding: "16px",
                backgroundColor: isDark ? "gray.800" : "gray.50",
                borderRadius: "12px",
              })}
            >
              <VerticalProblem
                terms={metadata!.problem.terms}
                userAnswer={studentAnswer}
                isCompleted={showFeedback}
                correctAnswer={
                  showFeedback ? metadata!.problem.answer : undefined
                }
                size="normal"
              />

              {/* Feedback indicator when in feedback phase */}
              {showFeedback && currentEntry?.isCorrect !== undefined && (
                <div
                  data-element="feedback-display"
                  className={css({
                    marginTop: "12px",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: currentEntry.isCorrect
                      ? isDark
                        ? "green.900"
                        : "green.50"
                      : isDark
                        ? "red.900"
                        : "red.50",
                    border: "2px solid",
                    borderColor: currentEntry.isCorrect
                      ? isDark
                        ? "green.700"
                        : "green.300"
                      : isDark
                        ? "red.700"
                        : "red.300",
                  })}
                >
                  <span
                    data-element="feedback-message"
                    className={css({
                      fontSize: "0.875rem",
                      fontWeight: "600",
                      color: currentEntry.isCorrect
                        ? isDark
                          ? "green.300"
                          : "green.700"
                        : isDark
                          ? "red.300"
                          : "red.700",
                    })}
                  >
                    {currentEntry.isCorrect ? "✓ Correct!" : "✗ Incorrect"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Video container with detection overlay */}
          <div
            data-element="video-container"
            className={css({
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            })}
          >
            <div
              data-element="video-wrapper"
              className={css({
                position: "relative",
                width: "100%",
                aspectRatio: "4/3",
                backgroundColor: isDark ? "gray.900" : "gray.200",
                borderRadius: "8px",
                overflow: "hidden",
              })}
            >
              <video
                data-element="video"
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                muted
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                className={css({
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                })}
              />

              {/* Detection overlay - shows detected abacus value */}
              {currentEntry && currentEntry.detectedValue !== null && (
                <div
                  data-element="detection-overlay"
                  className={css({
                    position: "absolute",
                    bottom: "48px", // Above video controls
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    py: "6px",
                    bg: "rgba(0, 0, 0, 0.75)",
                    backdropFilter: "blur(4px)",
                  })}
                >
                  <div
                    data-element="detection-content"
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    })}
                  >
                    <span
                      data-element="detection-label"
                      className={css({
                        fontSize: "0.75rem",
                        color: "gray.400",
                      })}
                    >
                      Detected:
                    </span>
                    <span
                      data-element="detection-value"
                      className={css({
                        fontSize: "1.25rem",
                        fontWeight: "bold",
                        color: "white",
                        fontFamily: "mono",
                      })}
                    >
                      {currentEntry.detectedValue}
                    </span>
                    <span
                      data-element="detection-confidence"
                      className={css({
                        fontSize: "0.75rem",
                        color: "gray.500",
                      })}
                    >
                      ({Math.round(currentEntry.confidence * 100)}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Recording badge */}
              <div
                data-element="recording-badge"
                className={css({
                  position: "absolute",
                  top: "8px",
                  left: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  px: "8px",
                  py: "4px",
                  bg: "rgba(0, 0, 0, 0.7)",
                  borderRadius: "md",
                  fontSize: "0.75rem",
                  color: "gray.300",
                })}
              >
                <span className={css({ color: "red.400" })}>●</span>
                <span>REC</span>
              </div>
            </div>

            {/* Metadata info below video */}
            {metadata && (
              <div
                data-element="metadata-info"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  fontSize: "0.75rem",
                  color: isDark ? "gray.400" : "gray.500",
                })}
              >
                {metadata.durationMs > 0 && (
                  <span data-element="metadata-duration">
                    Duration: {(metadata.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
                {metadata.frameCount > 0 && (
                  <span data-element="metadata-frames">
                    {metadata.frameCount} frames
                  </span>
                )}
                {metadata.isCorrect !== null && (
                  <span
                    data-element="metadata-result"
                    className={css({
                      color: metadata.isCorrect
                        ? isDark
                          ? "green.400"
                          : "green.600"
                        : isDark
                          ? "red.400"
                          : "red.600",
                    })}
                  >
                    {metadata.isCorrect ? "✓ Correct" : "✗ Incorrect"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* No video state - shows metadata with animated answer playback */}
      {!isLoading &&
        !error &&
        currentVideo?.status === "no_video" &&
        metadata && (
          <div
            data-element="no-video-content"
            className={css({
              display: "flex",
              flexDirection: { base: "column", md: "row" },
              gap: "16px",
              width: "100%",
              alignItems: "flex-start",
            })}
          >
            {/* Problem display with animated answer */}
            {hasProblemData && (
              <div
                data-element="problem-display"
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  minWidth: "200px",
                  padding: "16px",
                  backgroundColor: isDark ? "gray.800" : "gray.50",
                  borderRadius: "12px",
                })}
              >
                <VerticalProblem
                  terms={metadata.problem.terms}
                  userAnswer={currentNoVideoState?.answer ?? ""}
                  isCompleted={currentNoVideoState?.phase === "feedback"}
                  correctAnswer={
                    currentNoVideoState?.phase === "feedback"
                      ? metadata.problem.answer
                      : undefined
                  }
                  size="normal"
                />

                {/* Result indicator - only show when playback reaches feedback phase */}
                {currentNoVideoState?.phase === "feedback" &&
                  currentNoVideoState?.isCorrect !== undefined && (
                    <div
                      data-element="result-display"
                      className={css({
                        marginTop: "12px",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        backgroundColor: currentNoVideoState.isCorrect
                          ? isDark
                            ? "green.900"
                            : "green.50"
                          : isDark
                            ? "red.900"
                            : "red.50",
                        border: "2px solid",
                        borderColor: currentNoVideoState.isCorrect
                          ? isDark
                            ? "green.700"
                            : "green.300"
                          : isDark
                            ? "red.700"
                            : "red.300",
                      })}
                    >
                      <span
                        data-element="result-message"
                        className={css({
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          color: currentNoVideoState.isCorrect
                            ? isDark
                              ? "green.300"
                              : "green.700"
                            : isDark
                              ? "red.300"
                              : "red.700",
                        })}
                      >
                        {currentNoVideoState.isCorrect
                          ? "✓ Correct!"
                          : "✗ Incorrect"}
                      </span>
                    </div>
                  )}
              </div>
            )}

            {/* Playback panel (replaces video) */}
            <div
              data-element="no-video-playback-panel"
              className={css({
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              })}
            >
              {/* Playback area */}
              <div
                data-element="no-video-placeholder"
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  aspectRatio: "4/3",
                  backgroundColor: isDark ? "gray.800" : "gray.100",
                  borderRadius: "8px",
                  border: "2px dashed",
                  borderColor: isDark ? "gray.700" : "gray.300",
                  padding: "24px",
                  textAlign: "center",
                })}
              >
                <span
                  data-element="no-video-icon"
                  className={css({
                    fontSize: "2.5rem",
                    opacity: 0.6,
                  })}
                >
                  📷
                </span>
                <div
                  data-element="no-video-message"
                  className={css({
                    color: isDark ? "gray.400" : "gray.500",
                  })}
                >
                  <p
                    className={css({
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      marginBottom: "4px",
                    })}
                  >
                    No video recording
                  </p>
                  <p
                    className={css({
                      fontSize: "0.75rem",
                      color: isDark ? "gray.500" : "gray.400",
                    })}
                  >
                    Camera was not enabled
                  </p>
                </div>

                {/* Playback controls */}
                {answerProgression.length > 0 && (
                  <div
                    data-element="playback-controls"
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginTop: "8px",
                    })}
                  >
                    {/* Restart button */}
                    <button
                      type="button"
                      data-action="restart-playback"
                      onClick={restartNoVideoPlayback}
                      className={css({
                        padding: "8px",
                        backgroundColor: isDark ? "gray.700" : "gray.200",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "1rem",
                        transition: "background-color 0.15s",
                        _hover: {
                          backgroundColor: isDark ? "gray.600" : "gray.300",
                        },
                      })}
                      title="Restart"
                    >
                      ⏮
                    </button>

                    {/* Play/Pause button */}
                    <button
                      type="button"
                      data-action={
                        isNoVideoPlaying ? "pause-playback" : "play-playback"
                      }
                      onClick={
                        isNoVideoPlaying
                          ? pauseNoVideoPlayback
                          : startNoVideoPlayback
                      }
                      disabled={isNoVideoComplete && !isNoVideoPlaying}
                      className={css({
                        padding: "8px 16px",
                        backgroundColor: isNoVideoPlaying
                          ? isDark
                            ? "orange.600"
                            : "orange.500"
                          : isDark
                            ? "blue.600"
                            : "blue.500",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        fontWeight: "600",
                        transition: "background-color 0.15s",
                        _hover: {
                          backgroundColor: isNoVideoPlaying
                            ? isDark
                              ? "orange.500"
                              : "orange.600"
                            : isDark
                              ? "blue.500"
                              : "blue.600",
                        },
                        _disabled: {
                          opacity: 0.5,
                          cursor: "default",
                        },
                      })}
                    >
                      {isNoVideoPlaying
                        ? "⏸ Pause"
                        : isNoVideoComplete
                          ? "✓ Done"
                          : "▶ Play"}
                    </button>
                  </div>
                )}

                {/* Progress indicator */}
                {answerProgression.length > 0 && (
                  <div
                    data-element="playback-progress"
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.75rem",
                      color: isDark ? "gray.500" : "gray.400",
                    })}
                  >
                    <span>
                      Step {noVideoPlaybackIndex + 1} of{" "}
                      {answerProgression.length}
                    </span>
                    {currentNoVideoState?.originalTimestamp !== undefined && (
                      <span
                        className={css({
                          color: isDark ? "gray.600" : "gray.300",
                        })}
                      >
                        (actual:{" "}
                        {(currentNoVideoState.originalTimestamp / 1000).toFixed(
                          1,
                        )}
                        s)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Metadata info below playback area */}
              <div
                data-element="no-video-metadata"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  fontSize: "0.75rem",
                  color: isDark ? "gray.400" : "gray.500",
                })}
              >
                {metadata.durationMs > 0 && (
                  <span data-element="metadata-duration">
                    Actual duration: {(metadata.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
                {answerProgression.length > 0 && (
                  <span data-element="metadata-entries">
                    {answerProgression.length} input events
                  </span>
                )}
                {metadata.isCorrect !== null && (
                  <span
                    data-element="metadata-result"
                    className={css({
                      color: metadata.isCorrect
                        ? isDark
                          ? "green.400"
                          : "green.600"
                        : isDark
                          ? "red.400"
                          : "red.600",
                    })}
                  >
                    {metadata.isCorrect ? "✓ Correct" : "✗ Incorrect"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

      {/* No recording exists state - problem was never recorded */}
      {!isLoading && noRecordingExists && (
        <div
          data-element="no-recording-state"
          className={css({
            width: "100%",
            aspectRatio: "4/3",
            backgroundColor: isDark ? "gray.800" : "gray.100",
            borderRadius: "8px",
            border: "2px dashed",
            borderColor: isDark ? "gray.700" : "gray.300",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "24px",
            textAlign: "center",
          })}
        >
          <span
            data-element="no-recording-icon"
            className={css({
              fontSize: "2.5rem",
              opacity: 0.5,
            })}
          >
            📭
          </span>
          <div data-element="no-recording-message">
            <p
              className={css({
                fontSize: "0.875rem",
                fontWeight: "500",
                color: isDark ? "gray.400" : "gray.500",
                marginBottom: "4px",
              })}
            >
              No recording exists
            </p>
            <p
              className={css({
                fontSize: "0.75rem",
                color: isDark ? "gray.500" : "gray.400",
              })}
            >
              This problem was not recorded
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !noRecordingExists && (
        <div
          data-element="loading-state"
          className={css({
            width: "100%",
            aspectRatio: "4/3",
            backgroundColor: isDark ? "gray.900" : "gray.200",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <div
            data-element="loading-text"
            className={css({
              color: isDark ? "gray.400" : "gray.500",
              fontSize: "0.875rem",
            })}
          >
            Loading...
          </div>
        </div>
      )}

      {/* Error/status state */}
      {!isLoading && error && (
        <div
          data-element="error-state"
          className={css({
            width: "100%",
            aspectRatio: "4/3",
            backgroundColor:
              currentVideo?.status === "failed"
                ? isDark
                  ? "red.900/30"
                  : "red.50"
                : currentVideo?.status === "processing"
                  ? isDark
                    ? "cyan.900/30"
                    : "cyan.50"
                  : currentVideo?.status === "recording"
                    ? isDark
                      ? "yellow.900/30"
                      : "yellow.50"
                    : isDark
                      ? "gray.900"
                      : "gray.200",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid",
            borderColor:
              currentVideo?.status === "failed"
                ? isDark
                  ? "red.700/50"
                  : "red.200"
                : currentVideo?.status === "processing"
                  ? isDark
                    ? "cyan.700/50"
                    : "cyan.200"
                  : currentVideo?.status === "recording"
                    ? isDark
                      ? "yellow.700/50"
                      : "yellow.200"
                    : "transparent",
          })}
        >
          <div
            data-element="error-content"
            className={css({
              textAlign: "center",
              padding: "20px",
            })}
          >
            {/* Status icon */}
            <div
              data-element="status-icon"
              className={css({
                fontSize: "2rem",
                marginBottom: "12px",
              })}
            >
              {currentVideo?.status === "failed"
                ? "⚠️"
                : currentVideo?.status === "processing"
                  ? "⏳"
                  : currentVideo?.status === "recording"
                    ? "🔴"
                    : "📹"}
            </div>
            <p
              data-element="error-message"
              className={css({
                color:
                  currentVideo?.status === "failed"
                    ? isDark
                      ? "red.300"
                      : "red.700"
                    : currentVideo?.status === "processing"
                      ? isDark
                        ? "cyan.300"
                        : "cyan.700"
                      : currentVideo?.status === "recording"
                        ? isDark
                          ? "yellow.300"
                          : "yellow.700"
                        : isDark
                          ? "gray.400"
                          : "gray.500",
                fontSize: "0.875rem",
                fontWeight: "500",
                marginBottom: "8px",
              })}
            >
              {currentVideo?.status === "failed"
                ? "Recording Failed"
                : currentVideo?.status === "processing"
                  ? "Encoding Video..."
                  : currentVideo?.status === "recording"
                    ? "Recording in Progress"
                    : error}
            </p>
            <p
              data-element="error-hint"
              className={css({
                color: isDark ? "gray.500" : "gray.400",
                fontSize: "0.75rem",
              })}
            >
              {currentVideo?.status === "failed"
                ? currentVideo.processingError ||
                  "The video could not be encoded"
                : currentVideo?.status === "processing"
                  ? "Video will be ready in a few moments"
                  : currentVideo?.status === "recording"
                    ? "Wait for the student to finish this problem"
                    : "No video available for this attempt"}
            </p>
          </div>
        </div>
      )}

      {/* Video info (legacy fallback when no metadata available) */}
      {currentVideo && currentVideo.status === "ready" && !metadata && (
        <div
          data-element="legacy-video-info"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "0.75rem",
            color: isDark ? "gray.400" : "gray.500",
          })}
        >
          {currentVideo.durationMs && (
            <span data-element="legacy-duration">
              Duration: {(currentVideo.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {currentVideo.isCorrect !== null && (
            <span
              data-element="legacy-result"
              className={css({
                color: currentVideo.isCorrect
                  ? isDark
                    ? "green.400"
                    : "green.600"
                  : isDark
                    ? "red.400"
                    : "red.600",
              })}
            >
              {currentVideo.isCorrect ? "✓ Correct" : "✗ Incorrect"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

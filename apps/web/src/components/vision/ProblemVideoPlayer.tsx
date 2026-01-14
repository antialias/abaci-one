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

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProblemMetadata, ProblemMetadataEntry } from '@/lib/vision/recording'
import {
  type VideoAttemptInfo,
  getVideoAttemptsForProblem,
  getAttemptLabel,
  buildVideoUrl,
  buildMetadataUrl,
} from '@/lib/utils/attempt-tracking'
import { css } from '../../../styled-system/css'
import { VerticalProblem } from '../practice/VerticalProblem'

interface ProblemVideoPlayerProps {
  /** Player ID for the API route */
  playerId: string
  /** Session ID for the API route */
  sessionId: string
  /** Problem number to display (1-indexed) */
  problemNumber: number
  /** Dark mode */
  isDark: boolean
  /** Callback when user wants to return to live view */
  onGoLive: () => void
  /** All available video attempts for this session (used for attempt selection) */
  availableVideos?: VideoAttemptInfo[]
}

/**
 * Fetch all videos for a session from the API
 */
async function fetchAllVideos(playerId: string, sessionId: string): Promise<VideoAttemptInfo[]> {
  try {
    const response = await fetch(`/api/curriculum/${playerId}/sessions/${sessionId}/videos`)
    if (!response.ok) return []

    const data = (await response.json()) as { videos: VideoAttemptInfo[] }
    return data.videos
  } catch {
    return []
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
  attemptNumber: number
): Promise<ProblemMetadata | null> {
  try {
    const url = buildMetadataUrl(playerId, sessionId, problemNumber, epochNumber, attemptNumber)
    const response = await fetch(url)
    if (!response.ok) return null

    return (await response.json()) as ProblemMetadata
  } catch {
    return null
  }
}

/**
 * Find the metadata entry for a given timestamp
 * Returns the most recent entry before or at the given time
 */
function findEntryAtTime(
  entries: ProblemMetadataEntry[],
  timeMs: number
): ProblemMetadataEntry | null {
  if (entries.length === 0) return null

  // Binary search for the entry at or before timeMs
  let left = 0
  let right = entries.length - 1
  let result: ProblemMetadataEntry | null = null

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (entries[mid].t <= timeMs) {
      result = entries[mid]
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return result
}

export function ProblemVideoPlayer({
  playerId,
  sessionId,
  problemNumber,
  isDark,
  onGoLive,
  availableVideos,
}: ProblemVideoPlayerProps) {
  const [allVideos, setAllVideos] = useState<VideoAttemptInfo[]>(availableVideos ?? [])
  const [selectedAttempt, setSelectedAttempt] = useState<{
    epochNumber: number
    attemptNumber: number
  } | null>(null)
  const [metadata, setMetadata] = useState<ProblemMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentEntry, setCurrentEntry] = useState<ProblemMetadataEntry | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Get attempts for this specific problem - memoized to prevent render loops
  const problemAttempts = useMemo(
    () => getVideoAttemptsForProblem(allVideos, problemNumber),
    [allVideos, problemNumber]
  )
  const hasMultipleAttempts = problemAttempts.length > 1
  const currentVideo = problemAttempts.find(
    (v) =>
      v.epochNumber === selectedAttempt?.epochNumber &&
      v.attemptNumber === selectedAttempt?.attemptNumber
  )

  // Reset selected attempt when problem number changes
  useEffect(() => {
    setSelectedAttempt(null)
    setMetadata(null)
    setError(null)
    setCurrentEntry(null)
  }, [problemNumber])

  // Fetch all videos if not provided
  useEffect(() => {
    if (availableVideos && availableVideos.length > 0) {
      setAllVideos(availableVideos)
      return
    }

    // Fetch videos if not provided
    fetchAllVideos(playerId, sessionId).then((videos) => {
      setAllVideos(videos)
    })
  }, [playerId, sessionId, availableVideos])

  // Set initial selected attempt when problem attempts are available and no attempt selected
  useEffect(() => {
    if (problemAttempts.length > 0 && selectedAttempt === null) {
      // Default to the latest attempt (last in sorted list)
      const latest = problemAttempts[problemAttempts.length - 1]
      setSelectedAttempt({
        epochNumber: latest.epochNumber,
        attemptNumber: latest.attemptNumber,
      })
    }
  }, [problemAttempts, selectedAttempt])

  // Fetch metadata when selected attempt changes
  useEffect(() => {
    if (!selectedAttempt) {
      setIsLoading(true)
      return
    }

    setIsLoading(true)
    setError(null)
    setCurrentEntry(null)

    fetchMetadata(
      playerId,
      sessionId,
      problemNumber,
      selectedAttempt.epochNumber,
      selectedAttempt.attemptNumber
    )
      .then((meta) => {
        setMetadata(meta)
        setIsLoading(false)

        // Check video status - find in current attempts
        const video = allVideos.find(
          (v) =>
            v.problemNumber === problemNumber &&
            v.epochNumber === selectedAttempt.epochNumber &&
            v.attemptNumber === selectedAttempt.attemptNumber
        )
        if (!video) {
          setError('Video not found')
        } else if (video.status === 'processing') {
          setError('Video is being processed...')
        } else if (video.status === 'failed') {
          setError(video.processingError || 'Video encoding failed')
        } else if (video.status === 'recording') {
          setError('Video is still recording')
        }
      })
      .catch(() => {
        setIsLoading(false)
        setError('Failed to load video info')
      })
  }, [playerId, sessionId, problemNumber, selectedAttempt, allVideos])

  // Handle attempt selection change
  const handleAttemptChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const [epoch, attempt] = event.target.value.split('-').map(Number)
    setSelectedAttempt({ epochNumber: epoch, attemptNumber: attempt })
  }, [])

  // Sync metadata to video time
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current || !metadata) return

    const currentTimeMs = videoRef.current.currentTime * 1000
    const entry = findEntryAtTime(metadata.entries, currentTimeMs)
    setCurrentEntry(entry)
  }, [metadata])

  // Auto-play when video loads
  const handleCanPlay = useCallback(() => {
    videoRef.current?.play()
  }, [])

  // Build video URL with epoch/attempt params
  const videoUrl = selectedAttempt
    ? buildVideoUrl(
        playerId,
        sessionId,
        problemNumber,
        selectedAttempt.epochNumber,
        selectedAttempt.attemptNumber
      )
    : null

  // Determine display state
  const hasProblemData = metadata?.problem && metadata.problem.terms.length > 0
  const showFeedback = currentEntry?.phase === 'feedback'
  const studentAnswer = currentEntry?.studentAnswer || ''

  return (
    <div
      data-component="problem-video-player"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        maxWidth: '600px',
      })}
    >
      {/* Header with back button and attempt selector */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          backgroundColor: isDark ? 'gray.800' : 'gray.100',
          borderRadius: '8px',
          gap: '12px',
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flex: 1,
          })}
        >
          <span
            className={css({
              fontSize: '0.875rem',
              fontWeight: '600',
              color: isDark ? 'gray.200' : 'gray.700',
            })}
          >
            Problem {problemNumber} Recording
          </span>

          {/* Attempt selector dropdown - only shows when multiple attempts exist */}
          {hasMultipleAttempts && selectedAttempt && (
            <select
              data-element="attempt-selector"
              value={`${selectedAttempt.epochNumber}-${selectedAttempt.attemptNumber}`}
              onChange={handleAttemptChange}
              className={css({
                padding: '4px 8px',
                fontSize: '0.8125rem',
                fontWeight: '500',
                backgroundColor: isDark ? 'gray.700' : 'white',
                color: isDark ? 'gray.200' : 'gray.700',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                borderRadius: '6px',
                cursor: 'pointer',
                minWidth: '120px',
              })}
            >
              {problemAttempts.map((attempt) => (
                <option
                  key={`${attempt.epochNumber}-${attempt.attemptNumber}`}
                  value={`${attempt.epochNumber}-${attempt.attemptNumber}`}
                >
                  {getAttemptLabel(attempt)}{' '}
                  {attempt.isCorrect === true ? '✓' : attempt.isCorrect === false ? '✗' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          onClick={onGoLive}
          className={css({
            padding: '6px 12px',
            fontSize: '0.8125rem',
            fontWeight: '500',
            backgroundColor: isDark ? 'blue.700' : 'blue.100',
            color: isDark ? 'blue.200' : 'blue.700',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            _hover: { backgroundColor: isDark ? 'blue.600' : 'blue.200' },
            flexShrink: 0,
          })}
        >
          ← Back to Live
        </button>
      </div>

      {/* Main content area - problem and video side by side on larger screens */}
      {!isLoading && !error && currentVideo?.status === 'ready' && videoUrl && (
        <div
          data-element="playback-content"
          className={css({
            display: 'flex',
            flexDirection: { base: 'column', md: 'row' },
            gap: '16px',
            width: '100%',
            alignItems: 'flex-start',
          })}
        >
          {/* Problem display */}
          {hasProblemData && (
            <div
              data-element="problem-display"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                minWidth: '200px',
                padding: '16px',
                backgroundColor: isDark ? 'gray.800' : 'gray.50',
                borderRadius: '12px',
              })}
            >
              <VerticalProblem
                terms={metadata!.problem.terms}
                userAnswer={studentAnswer}
                isCompleted={showFeedback}
                correctAnswer={showFeedback ? metadata!.problem.answer : undefined}
                size="normal"
              />

              {/* Feedback indicator when in feedback phase */}
              {showFeedback && currentEntry?.isCorrect !== undefined && (
                <div
                  data-element="feedback-display"
                  className={css({
                    marginTop: '12px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: currentEntry.isCorrect
                      ? isDark
                        ? 'green.900'
                        : 'green.50'
                      : isDark
                        ? 'red.900'
                        : 'red.50',
                    border: '2px solid',
                    borderColor: currentEntry.isCorrect
                      ? isDark
                        ? 'green.700'
                        : 'green.300'
                      : isDark
                        ? 'red.700'
                        : 'red.300',
                  })}
                >
                  <span
                    className={css({
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: currentEntry.isCorrect
                        ? isDark
                          ? 'green.300'
                          : 'green.700'
                        : isDark
                          ? 'red.300'
                          : 'red.700',
                    })}
                  >
                    {currentEntry.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
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
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            })}
          >
            <div
              className={css({
                position: 'relative',
                width: '100%',
                aspectRatio: '4/3',
                backgroundColor: isDark ? 'gray.900' : 'gray.200',
                borderRadius: '8px',
                overflow: 'hidden',
              })}
            >
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                className={css({
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                })}
              />

              {/* Detection overlay - shows detected abacus value */}
              {currentEntry && currentEntry.detectedValue !== null && (
                <div
                  data-element="detection-overlay"
                  className={css({
                    position: 'absolute',
                    bottom: '48px', // Above video controls
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    py: '6px',
                    bg: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    })}
                  >
                    <span
                      className={css({
                        fontSize: '0.75rem',
                        color: 'gray.400',
                      })}
                    >
                      Detected:
                    </span>
                    <span
                      className={css({
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: 'white',
                        fontFamily: 'mono',
                      })}
                    >
                      {currentEntry.detectedValue}
                    </span>
                    <span
                      className={css({
                        fontSize: '0.75rem',
                        color: 'gray.500',
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
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  px: '8px',
                  py: '4px',
                  bg: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: 'md',
                  fontSize: '0.75rem',
                  color: 'gray.300',
                })}
              >
                <span className={css({ color: 'red.400' })}>●</span>
                <span>REC</span>
              </div>
            </div>

            {/* Metadata info below video */}
            {metadata && (
              <div
                data-element="metadata-info"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  fontSize: '0.75rem',
                  color: isDark ? 'gray.400' : 'gray.500',
                })}
              >
                {metadata.durationMs > 0 && (
                  <span>Duration: {(metadata.durationMs / 1000).toFixed(1)}s</span>
                )}
                {metadata.frameCount > 0 && <span>{metadata.frameCount} frames</span>}
                {metadata.isCorrect !== null && (
                  <span
                    className={css({
                      color: metadata.isCorrect
                        ? isDark
                          ? 'green.400'
                          : 'green.600'
                        : isDark
                          ? 'red.400'
                          : 'red.600',
                    })}
                  >
                    {metadata.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          className={css({
            width: '100%',
            aspectRatio: '4/3',
            backgroundColor: isDark ? 'gray.900' : 'gray.200',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <div
            className={css({
              color: isDark ? 'gray.400' : 'gray.500',
              fontSize: '0.875rem',
            })}
          >
            Loading...
          </div>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div
          className={css({
            width: '100%',
            aspectRatio: '4/3',
            backgroundColor: isDark ? 'gray.900' : 'gray.200',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <div
            className={css({
              textAlign: 'center',
              padding: '20px',
            })}
          >
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.500',
                fontSize: '0.875rem',
                marginBottom: '8px',
              })}
            >
              {error}
            </p>
            {currentVideo?.status === 'processing' && (
              <p
                className={css({
                  color: isDark ? 'gray.500' : 'gray.400',
                  fontSize: '0.75rem',
                })}
              >
                Check back in a few moments
              </p>
            )}
          </div>
        </div>
      )}

      {/* Video info (legacy fallback when no metadata available) */}
      {currentVideo && currentVideo.status === 'ready' && !metadata && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '0.75rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          {currentVideo.durationMs && (
            <span>Duration: {(currentVideo.durationMs / 1000).toFixed(1)}s</span>
          )}
          {currentVideo.isCorrect !== null && (
            <span
              className={css({
                color: currentVideo.isCorrect
                  ? isDark
                    ? 'green.400'
                    : 'green.600'
                  : isDark
                    ? 'red.400'
                    : 'red.600',
              })}
            >
              {currentVideo.isCorrect ? '✓ Correct' : '✗ Incorrect'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

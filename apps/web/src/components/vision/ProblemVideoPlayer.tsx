/**
 * ProblemVideoPlayer - Video player for recorded problem attempts
 *
 * Shows the recorded video from when a student was working on a specific problem.
 * Used in the observer view when clicking on a completed problem in the progress indicator.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

interface ProblemVideoInfo {
  problemNumber: number
  partIndex: number
  status: 'recording' | 'processing' | 'ready' | 'failed'
  durationMs: number | null
  fileSize: number | null
  isCorrect: boolean | null
  processingError: string | null
}

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
}

/**
 * Fetch video info from the API
 */
async function fetchVideoInfo(
  playerId: string,
  sessionId: string,
  problemNumber: number
): Promise<ProblemVideoInfo | null> {
  try {
    const response = await fetch(`/api/curriculum/${playerId}/sessions/${sessionId}/videos`)
    if (!response.ok) return null

    const data = (await response.json()) as { videos: ProblemVideoInfo[] }
    return data.videos.find((v) => v.problemNumber === problemNumber) || null
  } catch {
    return null
  }
}

export function ProblemVideoPlayer({
  playerId,
  sessionId,
  problemNumber,
  isDark,
  onGoLive,
}: ProblemVideoPlayerProps) {
  const [videoInfo, setVideoInfo] = useState<ProblemVideoInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Fetch video info on mount
  useEffect(() => {
    setIsLoading(true)
    setError(null)

    fetchVideoInfo(playerId, sessionId, problemNumber)
      .then((info) => {
        setVideoInfo(info)
        setIsLoading(false)
        if (!info) {
          setError('Video not found')
        } else if (info.status === 'processing') {
          setError('Video is being processed...')
        } else if (info.status === 'failed') {
          setError(info.processingError || 'Video encoding failed')
        } else if (info.status === 'recording') {
          setError('Video is still recording')
        }
      })
      .catch(() => {
        setIsLoading(false)
        setError('Failed to load video info')
      })
  }, [playerId, sessionId, problemNumber])

  // Auto-play when video loads
  const handleCanPlay = useCallback(() => {
    videoRef.current?.play()
  }, [])

  const videoUrl = `/api/curriculum/${playerId}/sessions/${sessionId}/problems/${problemNumber}/video`

  return (
    <div
      data-component="problem-video-player"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        maxWidth: '400px',
      })}
    >
      {/* Header with back button */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          backgroundColor: isDark ? 'gray.800' : 'gray.100',
          borderRadius: '8px',
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
          })}
        >
          ← Back to Live
        </button>
      </div>

      {/* Video container */}
      <div
        className={css({
          width: '100%',
          aspectRatio: '4/3',
          backgroundColor: isDark ? 'gray.900' : 'gray.200',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        {isLoading && (
          <div
            className={css({
              color: isDark ? 'gray.400' : 'gray.500',
              fontSize: '0.875rem',
            })}
          >
            Loading...
          </div>
        )}

        {!isLoading && error && (
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
            {videoInfo?.status === 'processing' && (
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
        )}

        {!isLoading && !error && videoInfo?.status === 'ready' && (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            onCanPlay={handleCanPlay}
            className={css({
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            })}
          />
        )}
      </div>

      {/* Video info */}
      {videoInfo && videoInfo.status === 'ready' && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '0.75rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          {videoInfo.durationMs && (
            <span>Duration: {(videoInfo.durationMs / 1000).toFixed(1)}s</span>
          )}
          {videoInfo.isCorrect !== null && (
            <span
              className={css({
                color: videoInfo.isCorrect
                  ? isDark
                    ? 'green.400'
                    : 'green.600'
                  : isDark
                    ? 'red.400'
                    : 'red.600',
              })}
            >
              {videoInfo.isCorrect ? '✓ Correct' : '✗ Incorrect'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

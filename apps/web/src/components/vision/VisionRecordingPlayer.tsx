'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { css } from '../../../styled-system/css'

/**
 * Problem marker for timeline synchronization
 */
export interface ProblemMarker {
  offsetMs: number
  problemNumber: number
  partIndex: number
  eventType: 'problem-shown' | 'answer-submitted' | 'feedback-shown'
  isCorrect?: boolean
}

interface VisionRecordingPlayerProps {
  /** URL to the video file */
  videoUrl: string
  /** Total duration in milliseconds */
  durationMs: number
  /** Problem markers for timeline */
  problemMarkers?: ProblemMarker[] | null
  /** Callback when playback position changes */
  onTimeUpdate?: (currentTimeMs: number) => void
  /** Whether to autoplay */
  autoPlay?: boolean
}

/**
 * Video player for vision recordings with problem marker timeline.
 *
 * Features:
 * - Standard HTML5 video controls (play, pause, seek, volume)
 * - Problem marker timeline below video
 * - Click markers to seek to that point
 * - Hover to see problem info
 */
export function VisionRecordingPlayer({
  videoUrl,
  durationMs,
  problemMarkers,
  onTimeUpdate,
  autoPlay = false,
}: VisionRecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hoveredMarker, setHoveredMarker] = useState<ProblemMarker | null>(null)

  // Handle time updates
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const timeMs = videoRef.current.currentTime * 1000
      setCurrentTime(timeMs)
      onTimeUpdate?.(timeMs)
    }
  }, [onTimeUpdate])

  // Seek to specific time
  const seekTo = useCallback((timeMs: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeMs / 1000
    }
  }, [])

  // Handle marker click
  const handleMarkerClick = useCallback(
    (marker: ProblemMarker) => {
      seekTo(marker.offsetMs)
    },
    [seekTo]
  )

  // Track play/pause state
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [])

  // Group markers by problem for display
  const problemGroups = problemMarkers ? groupMarkersByProblem(problemMarkers) : []

  return (
    <div
      data-component="vision-recording-player"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        bg: 'gray.900',
        borderRadius: 'lg',
        overflow: 'hidden',
      })}
    >
      {/* Video element */}
      {/* biome-ignore lint/a11y/useMediaCaption: vision recording playback where captions are not applicable */}
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        autoPlay={autoPlay}
        onTimeUpdate={handleTimeUpdate}
        className={css({
          width: '100%',
          height: 'auto',
          display: 'block',
          bg: 'black',
        })}
      />

      {/* Problem marker timeline */}
      {problemMarkers && problemMarkers.length > 0 && (
        <div
          data-element="marker-timeline"
          className={css({
            position: 'relative',
            height: '48px',
            bg: 'gray.800',
            mx: 2,
            mb: 2,
            borderRadius: 'md',
            overflow: 'hidden',
          })}
        >
          {/* Timeline track */}
          <div
            className={css({
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '4px',
              bg: 'gray.700',
              transform: 'translateY(-50%)',
            })}
          />

          {/* Current time indicator */}
          <div
            className={css({
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '2px',
              bg: 'cyan.500',
              transition: 'left 0.1s linear',
            })}
            style={{ left: `${(currentTime / durationMs) * 100}%` }}
          />

          {/* Problem markers */}
          {problemGroups.map((group, idx) => {
            const position = (group.shownAt / durationMs) * 100
            const isCorrect = group.isCorrect
            const isCurrent =
              currentTime >= group.shownAt &&
              (idx === problemGroups.length - 1 || currentTime < problemGroups[idx + 1].shownAt)

            return (
              <button
                key={`problem-${group.problemNumber}-${group.partIndex}`}
                data-element="problem-marker"
                data-problem={group.problemNumber}
                data-correct={isCorrect}
                onClick={() =>
                  handleMarkerClick({
                    offsetMs: group.shownAt,
                    problemNumber: group.problemNumber,
                    partIndex: group.partIndex,
                    eventType: 'problem-shown',
                  })
                }
                onMouseEnter={() =>
                  setHoveredMarker({
                    offsetMs: group.shownAt,
                    problemNumber: group.problemNumber,
                    partIndex: group.partIndex,
                    eventType: 'problem-shown',
                    isCorrect,
                  })
                }
                onMouseLeave={() => setHoveredMarker(null)}
                className={css({
                  position: 'absolute',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '24px',
                  height: '24px',
                  borderRadius: 'full',
                  border: '2px solid',
                  borderColor: isCurrent ? 'cyan.400' : 'transparent',
                  bg:
                    isCorrect === true ? 'green.500' : isCorrect === false ? 'red.500' : 'gray.500',
                  color: 'white',
                  fontSize: 'xs',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  _hover: {
                    transform: 'translate(-50%, -50%) scale(1.2)',
                    zIndex: 10,
                  },
                })}
                style={{ left: `${position}%` }}
              >
                {group.problemNumber}
              </button>
            )
          })}

          {/* Hover tooltip */}
          {hoveredMarker && (
            <div
              data-element="marker-tooltip"
              className={css({
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                mb: 1,
                px: 2,
                py: 1,
                bg: 'gray.900',
                borderRadius: 'md',
                fontSize: 'xs',
                color: 'white',
                whiteSpace: 'nowrap',
                zIndex: 20,
              })}
            >
              Problem {hoveredMarker.problemNumber} (Part {hoveredMarker.partIndex + 1})
              {hoveredMarker.isCorrect !== undefined && (
                <span
                  className={css({
                    ml: 1,
                    color: hoveredMarker.isCorrect ? 'green.400' : 'red.400',
                  })}
                >
                  {hoveredMarker.isCorrect ? '✓' : '✗'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recording info */}
      <div
        data-element="recording-info"
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          px: 3,
          pb: 2,
          fontSize: 'xs',
          color: 'gray.400',
        })}
      >
        <span>
          {formatDuration(currentTime)} / {formatDuration(durationMs)}
        </span>
        {problemMarkers && (
          <span>
            {problemMarkers.filter((m) => m.eventType === 'problem-shown').length} problems
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Group markers by problem number and extract key info
 */
interface ProblemGroup {
  problemNumber: number
  partIndex: number
  shownAt: number
  answeredAt?: number
  isCorrect?: boolean
}

function groupMarkersByProblem(markers: ProblemMarker[]): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup>()

  for (const marker of markers) {
    const key = `${marker.partIndex}-${marker.problemNumber}`

    if (!groups.has(key)) {
      groups.set(key, {
        problemNumber: marker.problemNumber,
        partIndex: marker.partIndex,
        shownAt: marker.offsetMs,
      })
    }

    const group = groups.get(key)!

    if (marker.eventType === 'problem-shown') {
      group.shownAt = Math.min(group.shownAt, marker.offsetMs)
    } else if (marker.eventType === 'answer-submitted') {
      group.answeredAt = marker.offsetMs
      group.isCorrect = marker.isCorrect
    }
  }

  // Sort by shownAt time
  return Array.from(groups.values()).sort((a, b) => a.shownAt - b.shownAt)
}

/**
 * Format duration in ms to mm:ss
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

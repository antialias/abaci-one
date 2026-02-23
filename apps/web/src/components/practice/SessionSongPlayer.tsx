'use client'

/**
 * Kid-friendly audio player for AI-generated session celebration songs.
 *
 * States:
 * - Generating: animated shimmer with "Creating your song..." text
 * - Ready: large play button, song title, progress bar
 * - Error/absent: renders nothing (don't show errors to kids)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionSong } from '@/hooks/useSessionSong'
import { css } from '../../../styled-system/css'

interface SessionSongPlayerProps {
  playerId: string
  planId: string
  /** Whether to trigger a completion fallback POST if no song exists */
  triggerFallback?: boolean
}

export function SessionSongPlayer({
  playerId,
  planId,
  triggerFallback = false,
}: SessionSongPlayerProps) {
  const { song, isGenerating, isReady } = useSessionSong({
    playerId,
    planId,
    enabled: true,
  })

  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const fallbackTriggered = useRef(false)

  // Fire completion fallback trigger if needed
  useEffect(() => {
    if (triggerFallback && !song && !fallbackTriggered.current) {
      fallbackTriggered.current = true
      fetch(`/api/curriculum/${playerId}/sessions/plans/${planId}/song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerSource: 'completion_fallback' }),
      }).catch(() => {
        // Fire and forget
      })
    }
  }, [triggerFallback, song, playerId, planId])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }, [isPlaying])

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      setCurrentTime(audio.currentTime)
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      setDuration(audio.duration)
    }
  }, [])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current
      if (!audio || duration === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = x / rect.width
      audio.currentTime = ratio * duration
    },
    [duration]
  )

  // Don't render anything if no song or failed
  if (!song && !isGenerating) return null
  if (song?.status === 'failed') return null

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      data-component="session-song-player"
      className={css({
        mx: 'auto',
        maxW: '480px',
        p: 4,
        borderRadius: 'xl',
        bg: 'purple.50',
        _dark: { bg: 'purple.900/30' },
        mb: 4,
      })}
    >
      {isGenerating && !isReady && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            py: 2,
          })}
        >
          <div
            className={css({
              w: 8,
              h: 8,
              borderRadius: 'full',
              bg: 'purple.200',
              _dark: { bg: 'purple.700' },
              animation: 'pulse 1.5s ease-in-out infinite',
              flexShrink: 0,
            })}
          />
          <span
            className={css({
              fontSize: 'sm',
              color: 'purple.700',
              _dark: { color: 'purple.200' },
              fontWeight: 'medium',
            })}
          >
            Creating your song...
          </span>
        </div>
      )}

      {isReady && song?.audioPath && (
        <>
          <audio
            ref={audioRef}
            src={song.audioPath}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Title */}
          {song.title && (
            <div
              className={css({
                fontSize: 'md',
                fontWeight: 'bold',
                color: 'purple.800',
                _dark: { color: 'purple.100' },
                mb: 3,
                textAlign: 'center',
              })}
            >
              {song.title}
            </div>
          )}

          {/* Play button + progress */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            })}
          >
            {/* Play/Pause button */}
            <button
              data-action="toggle-play"
              onClick={togglePlay}
              className={css({
                w: 12,
                h: 12,
                borderRadius: 'full',
                bg: 'purple.500',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'xl',
                cursor: 'pointer',
                flexShrink: 0,
                border: 'none',
                _hover: { bg: 'purple.600' },
                _active: { bg: 'purple.700' },
                transition: 'background 0.15s',
              })}
            >
              {isPlaying ? '\u23F8' : '\u25B6'}
            </button>

            {/* Progress bar + time */}
            <div className={css({ flex: 1, minW: 0 })}>
              {/* Seekable progress bar */}
              <div
                data-element="progress-bar"
                onClick={handleSeek}
                className={css({
                  h: 2,
                  bg: 'purple.200',
                  _dark: { bg: 'purple.700' },
                  borderRadius: 'full',
                  cursor: 'pointer',
                  position: 'relative',
                  mb: 1,
                })}
              >
                <div
                  className={css({
                    h: '100%',
                    bg: 'purple.500',
                    borderRadius: 'full',
                    transition: 'width 0.1s linear',
                  })}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Time display */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'xs',
                  color: 'purple.500',
                  _dark: { color: 'purple.300' },
                })}
              >
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

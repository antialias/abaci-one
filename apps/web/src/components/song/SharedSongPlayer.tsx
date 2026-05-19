'use client'

/**
 * Presentational audio player for the public song share page.
 *
 * Lifted from `SessionSongPlayer` (play/pause + seekable progress + time) but
 * stripped of `useSessionSong`, owner/failure/generating states — a shared link
 * always points at one completed song. Duration is read from the <audio>
 * element (the DB `durationSeconds` column is frequently NULL).
 *
 * No autoplay: a visitor on a shared link presses play themselves.
 */

import { useCallback, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

interface SharedSongPlayerProps {
  audioPath: string
  title: string | null
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SharedSongPlayer({ audioPath, title }: SharedSongPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else audio.play()
  }, [isPlaying])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current
      if (!audio || duration === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration
    },
    [duration]
  )

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      data-component="shared-song-player"
      className={css({
        w: '100%',
        p: '20px',
        borderRadius: '16px',
        bg: 'purple.50',
        border: '1px solid token(colors.purple.100)',
      })}
    >
      <audio
        ref={audioRef}
        src={audioPath}
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {title && (
        <div
          className={css({
            fontSize: '17px',
            fontWeight: '700',
            color: 'purple.800',
            mb: '14px',
            textAlign: 'center',
          })}
        >
          {title}
        </div>
      )}

      <div className={css({ display: 'flex', alignItems: 'center', gap: '14px' })}>
        <button
          type="button"
          data-action="toggle-play"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={togglePlay}
          className={css({
            w: '52px',
            h: '52px',
            borderRadius: '50%',
            bg: 'purple.600',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            cursor: 'pointer',
            flexShrink: 0,
            border: 'none',
            _hover: { bg: 'purple.700' },
            transition: 'background 0.15s',
          })}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className={css({ flex: 1, minW: 0 })}>
          <div
            data-element="progress-bar"
            onClick={handleSeek}
            className={css({
              h: '8px',
              bg: 'purple.200',
              borderRadius: 'full',
              cursor: 'pointer',
              position: 'relative',
              mb: '6px',
            })}
          >
            <div
              className={css({
                h: '100%',
                bg: 'purple.600',
                borderRadius: 'full',
                transition: 'width 0.1s linear',
              })}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'purple.500',
            })}
          >
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

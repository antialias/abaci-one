'use client'

/**
 * Integrated lyrics + playback surface for AI-generated session songs.
 *
 * The lyrics ARE the player: each word is a seek target, the active word
 * highlights as it's sung, and the section/line/word stack reads as your
 * progress through the song. A thin sliver progress bar at the top covers
 * non-lyrical sections (intros, instrumental breaks) and songs without
 * alignment data; a floating play/pause button stays bottom-center.
 *
 * Two variants:
 * - `compact`: 480px card used in the kid celebration card (auto-scrolls
 *   the active line to vertical center within a bounded scroll region)
 * - `full`:    width-100% surface used on the public share page
 *   (no internal scroll; relies on page scroll)
 *
 * Degradation:
 * - No alignment data → lines render as static text. The sliver progress
 *   bar and play/pause still work.
 * - Alignment data present but extra words on either side → unmatched
 *   words just lose timing; the rest still highlight.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSongAlignment } from '@/hooks/useSongAlignment'
import {
  buildSyncedLyricsModel,
  findActiveLocation,
  type SongLyricsSection,
  type SyncedLine,
} from '@/lib/song/alignment'
import { css } from '../../../styled-system/css'

export interface SyncedLyricsPlayerProps {
  audioPath: string
  alignmentPath: string | null
  lyrics: SongLyricsSection[]
  title?: string | null
  variant?: 'compact' | 'full'
  /** Try to begin playback as soon as the audio element mounts. */
  autoPlay?: boolean
  /** Optional slot rendered under the play/pause control (e.g. share button). */
  footer?: ReactNode
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SyncedLyricsPlayer({
  audioPath,
  alignmentPath,
  lyrics,
  title,
  variant = 'compact',
  autoPlay = false,
  footer,
}: SyncedLyricsPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement | null>(null)
  const hasAutoplayed = useRef(false)

  const [currentMs, setCurrentMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)

  const alignmentQuery = useSongAlignment(alignmentPath)

  const model = useMemo(
    () => buildSyncedLyricsModel(lyrics, alignmentQuery.data ?? null),
    [lyrics, alignmentQuery.data]
  )

  const active = useMemo(() => findActiveLocation(model, currentMs), [model, currentMs])

  // Smooth RAF loop while playing — onTimeUpdate alone fires ~4Hz which is
  // too coarse for word-level highlight transitions.
  useEffect(() => {
    if (!isPlaying) return
    let rafId = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio) setCurrentMs(audio.currentTime * 1000)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying])

  // Auto-play once on ready (best effort — browsers may block).
  useEffect(() => {
    if (!autoPlay || hasAutoplayed.current) return
    const audio = audioRef.current
    if (!audio) return
    hasAutoplayed.current = true
    const timer = setTimeout(() => {
      audio.play().catch(() => setAutoplayBlocked(true))
    }, 200)
    return () => clearTimeout(timer)
  }, [autoPlay])

  // Auto-scroll the active line into view (compact only — full variant
  // assumes the whole song fits on the page).
  useEffect(() => {
    if (variant !== 'compact') return
    const lineEl = activeLineRef.current
    const container = scrollRef.current
    if (!lineEl || !container) return
    const lineRect = lineEl.getBoundingClientRect()
    const cRect = container.getBoundingClientRect()
    const buffer = 48
    const outOfView = lineRect.top < cRect.top + buffer || lineRect.bottom > cRect.bottom - buffer
    if (outOfView) {
      lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [variant, active?.sectionIndex, active?.lineIndex])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(() => setAutoplayBlocked(true))
      setAutoplayBlocked(false)
    }
  }, [isPlaying])

  const seekToMs = useCallback(
    (targetMs: number) => {
      const audio = audioRef.current
      if (!audio) return
      const seconds = Math.max(0, targetMs / 1000)
      audio.currentTime = seconds
      setCurrentMs(seconds * 1000)
      if (!isPlaying) {
        audio.play().catch(() => setAutoplayBlocked(true))
      }
    },
    [isPlaying]
  )

  const handleSliverSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (durationMs === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      seekToMs(ratio * durationMs)
    },
    [durationMs, seekToMs]
  )

  const progress = durationMs > 0 ? (currentMs / durationMs) * 100 : 0

  return (
    <div
      data-component="synced-lyrics-player"
      data-variant={variant}
      data-has-alignment={model.hasAlignment ? 'true' : 'false'}
      className={css({
        position: 'relative',
        w: '100%',
        maxW: variant === 'compact' ? '480px' : '100%',
        mx: variant === 'compact' ? 'auto' : 0,
        borderRadius: '16px',
        bg: 'purple.50',
        _dark: { bg: 'purple.900/30' },
        overflow: 'hidden',
        border: '1px solid token(colors.purple.100)',
      })}
    >
      <audio
        ref={audioRef}
        src={audioPath}
        preload="metadata"
        onTimeUpdate={() => {
          // Backup path — RAF takes over while playing.
          if (!isPlaying) setCurrentMs((audioRef.current?.currentTime ?? 0) * 1000)
        }}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration ?? 0
          if (Number.isFinite(d)) setDurationMs(d * 1000)
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Sliver progress bar — scrubbable, top of card */}
      <div
        data-element="progress-sliver"
        onClick={handleSliverSeek}
        className={css({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          h: '3px',
          bg: 'purple.200/60',
          cursor: 'pointer',
          zIndex: 2,
        })}
      >
        <div
          className={css({
            h: '100%',
            bg: 'purple.600',
            transition: 'width 0.1s linear',
          })}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Title + current time */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          px: '16px',
          pt: '14px',
          pb: '6px',
        })}
      >
        <div
          data-element="song-title"
          className={css({
            fontSize: variant === 'compact' ? '15px' : '17px',
            fontWeight: '700',
            color: 'purple.800',
            _dark: { color: 'purple.100' },
            flex: 1,
            minW: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          })}
        >
          {title ?? ''}
        </div>
        <div
          data-element="song-time"
          className={css({
            fontSize: '12px',
            color: 'purple.600',
            _dark: { color: 'purple.300' },
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          })}
        >
          {formatTime(currentMs / 1000)}
        </div>
      </div>

      {/* Lyrics surface */}
      <div
        ref={scrollRef}
        data-element="lyrics-scroll"
        className={css({
          px: '16px',
          py: '8px',
          maxH: variant === 'compact' ? '240px' : 'unset',
          overflowY: variant === 'compact' ? 'auto' : 'visible',
          scrollBehavior: 'smooth',
        })}
      >
        {model.sections.map((section, si) => {
          const isActiveSection = active?.sectionIndex === si
          return (
            <div
              key={si}
              data-element="lyric-section"
              data-active-section={isActiveSection ? 'true' : undefined}
              className={css({ mb: '14px' })}
            >
              <div
                data-element="section-label"
                className={css({
                  fontSize: '10px',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isActiveSection ? 'purple.600' : 'purple.300',
                  _dark: { color: isActiveSection ? 'purple.200' : 'purple.500' },
                  mb: '6px',
                  transition: 'color 0.2s',
                })}
              >
                {section.name}
              </div>

              {section.lines.map((line, li) => {
                const isActiveLine = active?.sectionIndex === si && active?.lineIndex === li
                const isPastLine =
                  active != null &&
                  (si < active.sectionIndex ||
                    (si === active.sectionIndex && li < active.lineIndex))
                return (
                  <LyricLine
                    key={li}
                    ref={isActiveLine ? activeLineRef : null}
                    line={line}
                    isActiveLine={isActiveLine}
                    isPastLine={isPastLine}
                    activeWordIndex={isActiveLine ? (active?.wordIndex ?? -1) : -1}
                    variant={variant}
                    onSeekToWord={seekToMs}
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Floating play/pause */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          py: '12px',
        })}
      >
        <button
          type="button"
          data-action="toggle-play"
          aria-label={isPlaying ? 'Pause song' : 'Play song'}
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
            lineHeight: 1,
            cursor: 'pointer',
            border: 'none',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)',
            transition: 'background 0.15s, transform 0.1s',
            _hover: { bg: 'purple.700' },
            _active: { transform: 'scale(0.94)' },
          })}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        {autoplayBlocked && !isPlaying && (
          <div
            data-element="autoplay-hint"
            className={css({
              fontSize: '12px',
              color: 'purple.600',
              _dark: { color: 'purple.300' },
              fontWeight: '500',
            })}
          >
            Tap to play
          </div>
        )}
        {footer}
      </div>
    </div>
  )
}

// ============================================================================
// LyricLine — extracted so the active-line ref forward stays tidy
// ============================================================================

interface LyricLineProps {
  line: SyncedLine
  isActiveLine: boolean
  isPastLine: boolean
  activeWordIndex: number
  variant: 'compact' | 'full'
  onSeekToWord: (ms: number) => void
}

const LyricLine = forwardRef<HTMLDivElement, LyricLineProps>(function LyricLine(
  { line, isActiveLine, isPastLine, activeWordIndex, variant, onSeekToWord },
  ref
) {
  const color = isActiveLine ? 'purple.900' : isPastLine ? 'purple.400' : 'gray.500'
  const darkColor = isActiveLine ? 'purple.50' : isPastLine ? 'purple.500' : 'gray.500'
  const words = line.words

  return (
    <div
      ref={ref}
      data-element="lyric-line"
      data-active-line={isActiveLine ? 'true' : undefined}
      data-past-line={isPastLine ? 'true' : undefined}
      className={css({
        fontSize: variant === 'compact' ? '16px' : '17px',
        lineHeight: '1.55',
        color,
        _dark: { color: darkColor },
        fontWeight: isActiveLine ? '700' : '500',
        transition: 'color 0.2s, font-weight 0.2s, border-color 0.2s',
        borderLeft: isActiveLine
          ? '3px solid token(colors.purple.500)'
          : '3px solid transparent',
        pl: '8px',
        mb: '4px',
      })}
    >
      {words
        ? words.map((word, wi) => {
            const isActiveWord = isActiveLine && wi === activeWordIndex
            return (
              <span key={wi}>
                <button
                  type="button"
                  data-action="seek-to-word"
                  data-active-word={isActiveWord ? 'true' : undefined}
                  onClick={() => onSeekToWord(word.startMs)}
                  className={css({
                    bg: 'transparent',
                    border: 'none',
                    p: 0,
                    m: 0,
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                    borderRadius: '5px',
                    px: '3px',
                    py: '1px',
                    transition:
                      'background 120ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 120ms cubic-bezier(0.4, 0, 0.2, 1), transform 120ms cubic-bezier(0.4, 0, 0.2, 1)',
                    '&[data-active-word="true"]': {
                      bg: 'purple.300',
                      _dark: { bg: 'purple.700' },
                      boxShadow: '0 2px 8px rgba(168, 85, 247, 0.35)',
                      transform: 'translateY(-1px)',
                    },
                    _hover: {
                      bg: 'purple.200/60',
                      _dark: { bg: 'purple.800/60' },
                    },
                  })}
                >
                  {word.text}
                </button>
                {wi < words.length - 1 && ' '}
              </span>
            )
          })
        : line.rawText}
    </div>
  )
})

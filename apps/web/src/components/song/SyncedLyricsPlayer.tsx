'use client'

/**
 * Integrated lyrics + playback surface for AI-generated session songs.
 *
 * The lyrics ARE the player: each word is a seek target, the active word
 * highlights as it's sung, and the section/line/word stack reads as your
 * progress through the song. A thin sliver progress bar at the top covers
 * non-lyrical sections (intros, instrumental breaks) and songs without
 * alignment data.
 *
 * Variants — pick the display context, the component handles the rest:
 * - `compact`: 480px card used in the kid celebration card (auto-scrolls
 *   the active line to vertical center within a bounded scroll region;
 *   floating play/pause control at the bottom)
 * - `full`:    width-100% surface used on the public share page
 *   (no internal scroll; relies on page scroll; floating play/pause control
 *   at the bottom)
 * - `row`:     list-item friendly. Collapses to a single header row when
 *   the song is idle, smoothly expands to reveal the lyrics surface on
 *   play. The play button + footer slot live inline in the header so the
 *   collapsed state remains a one-line list item.
 *
 * Degradation:
 * - No alignment data → lines render as static text. The sliver progress
 *   bar and play/pause still work.
 * - Alignment data present but extra words on either side → unmatched
 *   words just lose timing; the rest still highlight.
 *
 * Annotations:
 * - Sections may carry optional "behind the line" notes; when present
 *   they render as a warm strip beneath the lines (share-page Phase 2).
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
  type ActiveLyricLocation,
  type SongLyricsSection,
  type SyncedLine,
  type SyncedLyricsModel,
} from '@/lib/song/alignment'
import { css } from '../../../styled-system/css'

export type SyncedLyricsVariant = 'compact' | 'full' | 'row'

export interface SyncedLyricsPlayerProps {
  audioPath: string
  alignmentPath: string | null
  lyrics: SongLyricsSection[]
  title?: string | null
  variant?: SyncedLyricsVariant
  /** Try to begin playback as soon as the audio element mounts. */
  autoPlay?: boolean
  /** Optional slot rendered next to the play control (header in row, footer otherwise). */
  footer?: ReactNode
  /**
   * Fired exactly once per mount, the first time the audio actually starts
   * playing — host pages use this for confetti / celebration moments that
   * should accompany the first beat (not re-fire on every pause/resume).
   */
  onFirstPlay?: () => void
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
  onFirstPlay,
}: SyncedLyricsPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement | null>(null)
  const hasAutoplayed = useRef(false)
  // Tracks whether `onFirstPlay` has already fired this mount — the audio
  // element emits `play` on every resume too, but we only want the callback
  // on the very first beat.
  const hasFiredFirstPlay = useRef(false)

  const [currentMs, setCurrentMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [userExpanded, setUserExpanded] = useState(false)

  const alignmentQuery = useSongAlignment(alignmentPath)

  const model = useMemo(
    () => buildSyncedLyricsModel(lyrics, alignmentQuery.data ?? null),
    [lyrics, alignmentQuery.data]
  )

  const active = useMemo(() => findActiveLocation(model, currentMs), [model, currentMs])

  // For row variant: only the user's explicit/auto-expand toggles the body open.
  // We intentionally do NOT include `isPlaying` here so the user can manually
  // collapse during playback — in that state the header's karaoke ticker is the
  // lyric surface, leaving the row as a one-line item in a long library.
  const isRow = variant === 'row'
  const isFull = variant === 'full'
  const expanded = !isRow || userExpanded

  // Auto-expand row variant when playback starts (e.g. via autoPlay or first
  // click of the play button from a fully-collapsed state).
  useEffect(() => {
    if (isPlaying && isRow) setUserExpanded(true)
  }, [isPlaying, isRow])

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
  // assumes the whole song fits on the page; row defers to its own scroll
  // container which is also bounded when expanded).
  useEffect(() => {
    if (variant === 'full') return
    if (!expanded) return
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
  }, [variant, expanded, active?.sectionIndex, active?.lineIndex])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      // Expand the row synchronously when starting playback — avoids a
      // single-frame gap before the auto-expand effect catches up.
      if (isRow) setUserExpanded(true)
      audio.play().catch(() => setAutoplayBlocked(true))
      setAutoplayBlocked(false)
    }
  }, [isPlaying, isRow])

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

  const handleEnded = useCallback(() => {
    setIsPlaying(false)
    // Collapse the row variant back to idle when the song finishes.
    if (isRow) setUserExpanded(false)
  }, [isRow])

  const handleHeaderToggle = useCallback(() => {
    if (!isRow) return
    setUserExpanded((prev) => !prev)
  }, [isRow])

  const progress = durationMs > 0 ? (currentMs / durationMs) * 100 : 0

  const playButton = (
    <button
      type="button"
      data-action="toggle-play"
      aria-label={isPlaying ? 'Pause song' : 'Play song'}
      onClick={(e) => {
        e.stopPropagation()
        togglePlay()
      }}
      className={css({
        w: isRow ? '40px' : isFull ? '64px' : '52px',
        h: isRow ? '40px' : isFull ? '64px' : '52px',
        borderRadius: '50%',
        bg: 'purple.600',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isRow ? '16px' : isFull ? '28px' : '22px',
        lineHeight: 1,
        cursor: 'pointer',
        border: 'none',
        // Stronger glow for the full variant so the button reads as the focal
        // CTA above the lyrics (the share page lands here and visitors should
        // immediately understand this is something to play, not just read).
        boxShadow: isFull
          ? '0 6px 22px rgba(168, 85, 247, 0.55)'
          : '0 4px 12px rgba(168, 85, 247, 0.4)',
        transition: 'background 0.15s, transform 0.1s',
        flexShrink: 0,
        _hover: { bg: 'purple.700' },
        _active: { transform: 'scale(0.94)' },
      })}
    >
      {isPlaying ? '⏸' : '▶'}
    </button>
  )

  return (
    <div
      data-component="synced-lyrics-player"
      data-variant={variant}
      data-has-alignment={model.hasAlignment ? 'true' : 'false'}
      data-expanded={expanded ? 'true' : 'false'}
      className={css({
        position: 'relative',
        w: '100%',
        maxW: variant === 'compact' ? '480px' : '100%',
        mx: variant === 'compact' ? 'auto' : 0,
        borderRadius: '16px',
        bg: 'purple.50',
        // Solid in dark mode — the previous 30% opacity blended into whatever
        // sat behind the card, and when host pages haven't gone dark (e.g. My
        // Stuff stays on gray.50) the result was a washed-out lavender that
        // killed contrast with the light dark-mode text.
        _dark: { bg: 'purple.900', borderColor: 'purple.700' },
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
        onPlay={() => {
          setIsPlaying(true)
          if (!hasFiredFirstPlay.current) {
            hasFiredFirstPlay.current = true
            onFirstPlay?.()
          }
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
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

      {/* Header — layout varies by variant */}
      {isRow ? (
        <div
          data-element="row-header"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            px: '14px',
            pt: '12px',
            pb: '10px',
          })}
        >
          {/* Title + secondary line. The title is its own toggle button so
              the karaoke ticker below it (which contains word-buttons for
              seeking) can sit alongside without nesting buttons. */}
          <div className={css({ flex: 1, minW: 0 })}>
            <button
              type="button"
              data-action="toggle-row-expand"
              aria-expanded={expanded ? 'true' : 'false'}
              onClick={handleHeaderToggle}
              className={css({
                display: 'block',
                w: '100%',
                bg: 'transparent',
                border: 'none',
                p: 0,
                m: 0,
                textAlign: 'left',
                cursor: 'pointer',
                color: 'inherit',
                font: 'inherit',
              })}
            >
              <div
                data-element="song-title"
                className={css({
                  fontSize: '15px',
                  fontWeight: '700',
                  color: 'purple.800',
                  _dark: { color: 'purple.100' },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                })}
              >
                {title ?? 'Celebration Song'}
              </div>
            </button>
            {/* Secondary line — karaoke ticker when the row is collapsed and
                we have alignment data to surface; otherwise plain time text.
                Keeps the collapsed row from going lyric-less while the song
                plays in the background. */}
            {!expanded && model.hasAlignment && active != null ? (
              <ActiveLyricStrip model={model} active={active} onSeekToWord={seekToMs} />
            ) : (
              <div
                data-element="song-time"
                className={css({
                  fontSize: '11px',
                  color: 'purple.600',
                  _dark: { color: 'purple.300' },
                  fontVariantNumeric: 'tabular-nums',
                  mt: '2px',
                })}
              >
                {durationMs > 0
                  ? `${formatTime(currentMs / 1000)} / ${formatTime(durationMs / 1000)}`
                  : formatTime(currentMs / 1000)}
              </div>
            )}
          </div>
          {playButton}
          {footer && (
            <div
              data-element="row-footer"
              className={css({ display: 'flex', alignItems: 'center', flexShrink: 0 })}
            >
              {footer}
            </div>
          )}
        </div>
      ) : (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            px: '16px',
            pt: isFull ? '18px' : '14px',
            pb: isFull ? '14px' : '6px',
          })}
        >
          <div className={css({ flex: 1, minW: 0 })}>
            <div
              data-element="song-title"
              className={css({
                fontSize: isFull ? '17px' : '15px',
                fontWeight: '700',
                color: 'purple.800',
                _dark: { color: 'purple.100' },
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
                mt: '2px',
              })}
            >
              {durationMs > 0
                ? `${formatTime(currentMs / 1000)} / ${formatTime(durationMs / 1000)}`
                : formatTime(currentMs / 1000)}
            </div>
            {/* Full variant only — the play button lives in the header now (so
                share-page visitors see it before the lyric wall), and this
                line surfaces the autoplay-blocked hint near it. */}
            {isFull && autoplayBlocked && !isPlaying && (
              <div
                data-element="autoplay-hint"
                className={css({
                  mt: '4px',
                  fontSize: '12px',
                  color: 'purple.700',
                  _dark: { color: 'purple.200' },
                  fontWeight: '600',
                })}
              >
                Tap play to start the song
              </div>
            )}
          </div>
          {isFull && playButton}
        </div>
      )}

      {/* Collapsible body — only the row variant actually collapses; others
          render their body unconditionally. Uses CSS grid template rows for a
          smooth height transition without measuring the content. */}
      <div
        data-element="body-collapse"
        className={css({
          display: 'grid',
          transition: 'grid-template-rows 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        })}
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div
          className={css({
            overflow: 'hidden',
            transition: 'opacity 220ms ease',
          })}
          style={{ opacity: expanded ? 1 : 0 }}
        >
          {/* Lyrics surface */}
          <div
            ref={scrollRef}
            data-element="lyrics-scroll"
            className={css({
              px: '16px',
              py: '8px',
              maxH: variant === 'compact' ? '240px' : variant === 'row' ? '320px' : 'unset',
              overflowY: variant === 'compact' || variant === 'row' ? 'auto' : 'visible',
              scrollBehavior: 'smooth',
            })}
          >
            {model.sections.map((section, si) => {
              const isActiveSection = active?.sectionIndex === si
              const sectionAnnotations = section.annotations ?? []
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
                      // Full variant: display-italic, larger, with a thin
                      // rule beneath so each section reads like a chapter.
                      // Compact/row variants keep the original tight caps.
                      ...(isFull
                        ? {
                            fontFamily: 'display',
                            fontStyle: 'italic',
                            fontSize: '20px',
                            fontWeight: '600',
                            letterSpacing: 'normal',
                            textTransform: 'none',
                            pb: '6px',
                            mb: '10px',
                            borderBottom: '1px solid token(colors.purple.200)',
                          }
                        : {
                            fontSize: '10px',
                            fontWeight: '700',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            mb: '6px',
                          }),
                      color: isActiveSection ? 'purple.600' : 'purple.400',
                      _dark: { color: isActiveSection ? 'purple.200' : 'purple.500' },
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

                  {sectionAnnotations.length > 0 && (
                    <div
                      data-element="lyric-annotations"
                      className={css({
                        mt: '10px',
                        px: isFull ? '14px' : '10px',
                        py: isFull ? '12px' : '8px',
                        background: isFull
                          ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.7), rgba(254, 215, 170, 0.5))'
                          : 'token(colors.amber.50)',
                        _dark: { bg: 'amber.900/20', background: 'none' },
                        borderLeft: '3px solid token(colors.amber.400)',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      })}
                    >
                      {sectionAnnotations.map((note, ai) => (
                        <div
                          key={ai}
                          className={css({
                            fontFamily: isFull ? 'display' : 'inherit',
                            fontStyle: isFull ? 'italic' : 'normal',
                            fontSize: isFull ? '14px' : '12px',
                            lineHeight: '1.5',
                            color: 'amber.800',
                            _dark: { color: 'amber.200' },
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start',
                          })}
                        >
                          <span aria-hidden="true">✨</span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom controls — compact variant only. The full variant lifts
              the play button into the header so it's visible above the lyric
              wall; the row variant carries its controls in the header too. */}
          {!isRow && !isFull && (
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                py: '12px',
              })}
            >
              {playButton}
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
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ActiveLyricStrip — single-line karaoke ticker for tight contexts (the
// collapsed `row` variant). Renders the current line of lyrics with the
// active word pill-styled, and auto-scrolls horizontally to keep that word
// centered. Each word is a seek target, same as the full lyrics surface.
// ============================================================================

interface ActiveLyricStripProps {
  model: SyncedLyricsModel
  active: ActiveLyricLocation
  onSeekToWord: (ms: number) => void
}

function ActiveLyricStrip({ model, active, onSeekToWord }: ActiveLyricStripProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const activeWordRef = useRef<HTMLButtonElement>(null)

  // Center the active word inside the strip's scrollport. Runs whenever the
  // active location moves (word, line, or section).
  useEffect(() => {
    const strip = stripRef.current
    const word = activeWordRef.current
    if (!strip || !word) return
    const target = word.offsetLeft + word.offsetWidth / 2 - strip.clientWidth / 2
    strip.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [active.sectionIndex, active.lineIndex, active.wordIndex])

  const section = model.sections[active.sectionIndex]
  const line = section?.lines[active.lineIndex]
  if (!line?.words) return null

  return (
    <div
      ref={stripRef}
      data-element="active-lyric-strip"
      className={css({
        mt: '2px',
        display: 'flex',
        gap: '3px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
        // Soft fade at both edges so off-screen words don't visually clip hard.
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
        maskImage:
          'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 16px), transparent 100%)',
        '&::-webkit-scrollbar': { display: 'none' },
      })}
    >
      {line.words.map((word, wi) => {
        const isActive = wi === active.wordIndex
        return (
          <button
            key={wi}
            ref={isActive ? activeWordRef : null}
            type="button"
            data-action="seek-to-word"
            data-active-word={isActive ? 'true' : undefined}
            onClick={(e) => {
              e.stopPropagation()
              onSeekToWord(word.startMs)
            }}
            className={css({
              fontSize: '12px',
              lineHeight: '18px',
              border: 'none',
              bg: 'transparent',
              color: 'purple.500',
              // Brighter in dark mode — purple.300 was too faint against the
              // solid purple.900 card; the dim words still read as secondary
              // but stay legible.
              _dark: { color: 'purple.200' },
              cursor: 'pointer',
              borderRadius: '4px',
              px: '4px',
              flexShrink: 0,
              transition: 'color 120ms, background 120ms, font-weight 120ms',
              '&[data-active-word="true"]': {
                color: 'purple.900',
                bg: 'purple.200',
                fontWeight: '700',
                _dark: { color: 'purple.50', bg: 'purple.600' },
              },
              _hover: {
                bg: 'purple.200/60',
                _dark: { bg: 'purple.700/60' },
              },
            })}
          >
            {word.text}
          </button>
        )
      })}
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
  variant: SyncedLyricsVariant
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
        fontSize: variant === 'full' ? '17px' : '16px',
        lineHeight: '1.55',
        color,
        _dark: { color: darkColor },
        fontWeight: isActiveLine ? '700' : '500',
        transition: 'color 0.2s, font-weight 0.2s, border-color 0.2s',
        borderLeft: isActiveLine ? '3px solid token(colors.purple.500)' : '3px solid transparent',
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

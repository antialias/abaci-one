'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { css, cx } from '../styled-system/css/index.mjs'
import {
  buildSyncedLyricsModel,
  findActiveLocation,
  type ActiveLyricLocation,
  type RawAlignment,
  type SongLyricsSection,
  type SyncedLine,
  type SyncedLyricsModel,
} from './alignment'

export type KaraokePlayerVariant = 'compact' | 'full' | 'row'
export type KaraokePlayerTheme = 'auto' | 'light' | 'dark'

export interface KaraokePlayerProps {
  audioSrc: string
  lyrics: SongLyricsSection[]
  alignment?: RawAlignment | null
  title?: string | null
  variant?: KaraokePlayerVariant
  theme?: KaraokePlayerTheme
  autoPlay?: boolean
  footer?: ReactNode
  className?: string
  style?: CSSProperties
  onFirstPlay?: () => void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`
}

const playerClass = css({
  '--karaoke-bg': 'light-dark(#faf7ff, #11131a)',
  '--karaoke-surface': 'light-dark(#ffffff, #171a23)',
  '--karaoke-border': 'light-dark(#e8ddfa, #343849)',
  '--karaoke-text': 'light-dark(#2e1647, #f3effa)',
  '--karaoke-muted': 'light-dark(#79688a, #9a94a7)',
  '--karaoke-faint': 'light-dark(#a896b7, #656170)',
  '--karaoke-accent': '#8b5cf6',
  '--karaoke-accent-strong': '#6d28d9',
  '--karaoke-accent-soft': 'light-dark(#ddd0f8, #403066)',
  '--karaoke-note-bg': 'light-dark(#fff7dd, #2b2518)',
  '--karaoke-note': 'light-dark(#7a4a08, #f7ca72)',
  colorScheme: 'light dark',
  position: 'relative',
  width: '100%',
  overflow: 'hidden',
  border: '1px solid var(--karaoke-border)',
  borderRadius: '16px',
  background: 'var(--karaoke-bg)',
  color: 'var(--karaoke-text)',
  fontFamily: 'var(--karaoke-font, ui-sans-serif, system-ui, sans-serif)',
  boxShadow: '0 18px 48px rgba(24, 16, 38, 0.12)',

  '&[data-theme="light"]': {
    colorScheme: 'light',
    '--karaoke-bg': '#faf7ff',
    '--karaoke-surface': '#ffffff',
    '--karaoke-border': '#e8ddfa',
    '--karaoke-text': '#2e1647',
    '--karaoke-muted': '#79688a',
    '--karaoke-faint': '#a896b7',
    '--karaoke-accent-soft': '#ddd0f8',
    '--karaoke-note-bg': '#fff7dd',
    '--karaoke-note': '#7a4a08',
  },
  '&[data-theme="dark"]': {
    colorScheme: 'dark',
    '--karaoke-bg': '#11131a',
    '--karaoke-surface': '#171a23',
    '--karaoke-border': '#343849',
    '--karaoke-text': '#f3effa',
    '--karaoke-muted': '#9a94a7',
    '--karaoke-faint': '#656170',
    '--karaoke-accent-soft': '#403066',
    '--karaoke-note-bg': '#2b2518',
    '--karaoke-note': '#f7ca72',
  },
  '&[data-variant="compact"]': { maxWidth: '480px', marginInline: 'auto' },
  '&[data-variant="row"]': { borderRadius: '12px' },

  '& [data-element="seek"]': {
    position: 'absolute',
    zIndex: 3,
    inset: '0 0 auto',
    width: '100%',
    height: '4px',
    margin: 0,
    cursor: 'pointer',
    accentColor: 'var(--karaoke-accent)',
  },
  '& [data-element="header"]': {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'var(--karaoke-surface)',
    borderBottom: '1px solid var(--karaoke-border)',
  },
  '&[data-variant="row"] [data-element="header"]': {
    padding: '12px 14px 10px',
    borderBottom: 'none',
  },
  '& [data-element="heading"]': { flex: '1', minWidth: 0 },
  '& [data-element="title"]': {
    width: '100%',
    overflow: 'hidden',
    color: 'var(--karaoke-text)',
    font: 'inherit',
    fontSize: '15px',
    fontWeight: '700',
    textAlign: 'left',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    background: 'transparent',
    border: 0,
    padding: 0,
  },
  '& button[data-element="title"]': { cursor: 'pointer' },
  '& [data-element="time"]': {
    marginTop: '3px',
    color: 'var(--karaoke-muted)',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
  },
  '& [data-element="play"]': {
    display: 'grid',
    flex: '0 0 auto',
    width: '52px',
    height: '52px',
    placeItems: 'center',
    color: '#fff',
    fontSize: '20px',
    lineHeight: 1,
    cursor: 'pointer',
    background: 'var(--karaoke-accent-strong)',
    border: 0,
    borderRadius: '999px',
    boxShadow: '0 6px 20px color-mix(in srgb, var(--karaoke-accent) 45%, transparent)',
    transition: 'transform 120ms ease, background 120ms ease',
    _hover: { background: 'var(--karaoke-accent)' },
    _active: { transform: 'scale(0.94)' },
  },
  '&[data-variant="full"] [data-element="play"]': {
    width: '64px',
    height: '64px',
    fontSize: '26px',
  },
  '&[data-variant="row"] [data-element="play"]': {
    width: '40px',
    height: '40px',
    fontSize: '15px',
  },
  '& [data-element="collapse"]': {
    display: 'grid',
    transition: 'grid-template-rows 280ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  '& [data-element="collapse-inner"]': {
    minHeight: 0,
    overflow: 'hidden',
    transition: 'opacity 220ms ease',
  },
  '& [data-element="lyrics"]': { padding: '16px' },
  '&[data-variant="compact"] [data-element="lyrics"], &[data-variant="row"] [data-element="lyrics"]': {
    maxHeight: '280px',
    overflowY: 'auto',
    scrollBehavior: 'smooth',
  },
  '& [data-element="section"]': { marginBottom: '18px' },
  '& [data-element="section-label"]': {
    marginBottom: '8px',
    color: 'var(--karaoke-faint)',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    transition: 'color 160ms ease',
  },
  '& [data-active-section="true"] > [data-element="section-label"]': {
    color: 'var(--karaoke-accent)',
  },
  '&[data-variant="full"] [data-element="section-label"]': {
    paddingBottom: '7px',
    marginBottom: '11px',
    fontFamily: 'var(--karaoke-display-font, ui-serif, Georgia, serif)',
    fontSize: '20px',
    fontStyle: 'italic',
    fontWeight: '600',
    letterSpacing: 'normal',
    textTransform: 'none',
    borderBottom: '1px solid var(--karaoke-border)',
  },
  '& [data-element="line"]': {
    paddingLeft: '9px',
    marginBottom: '4px',
    color: 'var(--karaoke-muted)',
    fontSize: '16px',
    fontWeight: '500',
    lineHeight: '1.55',
    borderLeft: '3px solid transparent',
    transition: 'color 160ms ease, border-color 160ms ease',
  },
  '&[data-variant="full"] [data-element="line"]': { fontSize: '17px' },
  '& [data-past-line="true"]': { color: 'var(--karaoke-faint)' },
  '& [data-active-line="true"]': {
    color: 'var(--karaoke-text)',
    fontWeight: '700',
    borderLeftColor: 'var(--karaoke-accent)',
  },
  '& [data-action="seek-word"]': {
    padding: '1px 3px',
    margin: 0,
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
    background: 'transparent',
    border: 0,
    borderRadius: '5px',
    transition: 'background 120ms ease, transform 120ms ease',
    _hover: { background: 'var(--karaoke-accent-soft)' },
  },
  '& [data-active-word="true"]': {
    color: 'var(--karaoke-text)',
    background: 'var(--karaoke-accent-soft)',
    boxShadow: '0 2px 8px color-mix(in srgb, var(--karaoke-accent) 30%, transparent)',
    transform: 'translateY(-1px)',
  },
  '& [data-element="annotations"]': {
    display: 'grid',
    gap: '6px',
    padding: '10px 12px',
    marginTop: '10px',
    color: 'var(--karaoke-note)',
    fontSize: '13px',
    lineHeight: '1.5',
    background: 'var(--karaoke-note-bg)',
    borderLeft: '3px solid #e7a833',
    borderRadius: '10px',
  },
  '& [data-element="empty"]': {
    padding: '28px 16px',
    color: 'var(--karaoke-muted)',
    textAlign: 'center',
  },
  '& [data-element="footer"]': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px 16px',
  },
  '& [data-element="strip"]': {
    display: 'flex',
    gap: '3px',
    marginTop: '3px',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    scrollbarWidth: 'none',
    maskImage:
      'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)',
  },
  '& [data-element="strip"]::-webkit-scrollbar': { display: 'none' },
  '& [data-element="strip"] [data-action="seek-word"]': {
    flexShrink: 0,
    color: 'var(--karaoke-muted)',
    fontSize: '12px',
    lineHeight: '18px',
  },
  '& [data-element="strip"] [data-active-word="true"]': {
    color: 'var(--karaoke-text)',
    fontWeight: '700',
  },
})

export function KaraokePlayer({
  audioSrc,
  lyrics,
  alignment = null,
  title,
  variant = 'compact',
  theme = 'auto',
  autoPlay = false,
  footer,
  className,
  style,
  onFirstPlay,
}: KaraokePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement | null>(null)
  const hasAutoplayed = useRef(false)
  const hasFiredFirstPlay = useRef(false)
  const [currentMs, setCurrentMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [rowExpanded, setRowExpanded] = useState(false)

  const model = useMemo(
    () => buildSyncedLyricsModel(lyrics, alignment),
    [alignment, lyrics]
  )
  const active = useMemo(
    () => findActiveLocation(model, currentMs),
    [currentMs, model]
  )
  const isRow = variant === 'row'
  const expanded = !isRow || rowExpanded

  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio) setCurrentMs(audio.currentTime * 1000)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying])

  useEffect(() => {
    if (!autoPlay || hasAutoplayed.current) return
    const audio = audioRef.current
    if (!audio) return
    hasAutoplayed.current = true
    const timer = window.setTimeout(() => {
      void audio.play().catch(() => setAutoplayBlocked(true))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [autoPlay])

  useEffect(() => {
    if (variant === 'full' || !expanded) return
    const line = activeLineRef.current
    const scroll = scrollRef.current
    if (!line || !scroll) return
    const lineRect = line.getBoundingClientRect()
    const scrollRect = scroll.getBoundingClientRect()
    if (lineRect.top < scrollRect.top + 48 || lineRect.bottom > scrollRect.bottom - 48) {
      line.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [active?.lineIndex, active?.sectionIndex, expanded, variant])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      return
    }
    if (isRow) setRowExpanded(true)
    setAutoplayBlocked(false)
    void audio.play().catch(() => setAutoplayBlocked(true))
  }, [isPlaying, isRow])

  const seekToMs = useCallback((targetMs: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, targetMs / 1000)
    setCurrentMs(audio.currentTime * 1000)
    if (audio.paused) void audio.play().catch(() => setAutoplayBlocked(true))
  }, [])

  return (
    <div
      className={cx(playerClass, className)}
      style={style}
      data-component="karaoke-player"
      data-variant={variant}
      data-theme={theme}
      data-has-alignment={model.hasAlignment ? 'true' : 'false'}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        onLoadedMetadata={() => {
          const seconds = audioRef.current?.duration ?? 0
          setDurationMs(Number.isFinite(seconds) ? seconds * 1000 : 0)
        }}
        onTimeUpdate={() => {
          if (!isPlaying) setCurrentMs((audioRef.current?.currentTime ?? 0) * 1000)
        }}
        onPlay={() => {
          setIsPlaying(true)
          if (!hasFiredFirstPlay.current) {
            hasFiredFirstPlay.current = true
            onFirstPlay?.()
          }
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          if (isRow) setRowExpanded(false)
        }}
      />

      <input
        data-element="seek"
        aria-label="Seek through song"
        type="range"
        min={0}
        max={Math.max(durationMs, model.totalDurationMs, 1)}
        step={50}
        value={Math.min(currentMs, Math.max(durationMs, model.totalDurationMs, 1))}
        onChange={(event) => seekToMs(Number(event.currentTarget.value))}
      />

      <div data-element="header">
        <div data-element="heading">
          {isRow ? (
            <button
              type="button"
              data-element="title"
              aria-expanded={expanded}
              onClick={() => setRowExpanded((value) => !value)}
            >
              {title ?? 'Celebration Song'}
            </button>
          ) : (
            <div data-element="title">{title ?? ''}</div>
          )}
          {isRow && !expanded && active && model.hasAlignment ? (
            <ActiveLyricStrip model={model} active={active} onSeek={seekToMs} />
          ) : (
            <div data-element="time">
              {durationMs > 0
                ? `${formatTime(currentMs / 1000)} / ${formatTime(durationMs / 1000)}`
                : formatTime(currentMs / 1000)}
              {autoplayBlocked && !isPlaying ? ' · tap play to start' : ''}
            </div>
          )}
        </div>
        <button
          type="button"
          data-element="play"
          aria-label={isPlaying ? 'Pause song' : 'Play song'}
          onClick={togglePlay}
        >
          <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
        </button>
        {isRow && footer ? <div>{footer}</div> : null}
      </div>

      <div data-element="collapse" style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
        <div
          data-element="collapse-inner"
          style={{ opacity: expanded ? 1 : 0 }}
          aria-hidden={!expanded}
        >
          <div ref={scrollRef} data-element="lyrics">
            {model.sections.length === 0 ? (
              <div data-element="empty">Instrumental track — no lyrics</div>
            ) : (
              model.sections.map((section, sectionIndex) => {
                const activeSection = active?.sectionIndex === sectionIndex
                return (
                  <section
                    key={`${section.name}-${sectionIndex}`}
                    data-element="section"
                    data-active-section={activeSection ? 'true' : undefined}
                  >
                    <div data-element="section-label">{section.name}</div>
                    {section.lines.map((line, lineIndex) => {
                      const activeLine =
                        active?.sectionIndex === sectionIndex && active.lineIndex === lineIndex
                      const pastLine =
                        active != null &&
                        (sectionIndex < active.sectionIndex ||
                          (sectionIndex === active.sectionIndex && lineIndex < active.lineIndex))
                      return (
                        <LyricLine
                          key={`${line.rawText}-${lineIndex}`}
                          ref={activeLine ? activeLineRef : null}
                          line={line}
                          activeLine={activeLine}
                          pastLine={pastLine}
                          activeWordIndex={activeLine ? (active?.wordIndex ?? -1) : -1}
                          onSeek={seekToMs}
                        />
                      )
                    })}
                    {section.annotations?.length ? (
                      <div data-element="annotations">
                        {section.annotations.map((annotation, index) => (
                          <div key={`${annotation}-${index}`}>✦ {annotation}</div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                )
              })
            )}
          </div>
          {!isRow && footer ? <div data-element="footer">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}

interface ActiveLyricStripProps {
  model: SyncedLyricsModel
  active: ActiveLyricLocation
  onSeek: (milliseconds: number) => void
}

function ActiveLyricStrip({ model, active, onSeek }: ActiveLyricStripProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLButtonElement>(null)
  const words = model.sections[active.sectionIndex]?.lines[active.lineIndex]?.words

  useEffect(() => {
    const strip = stripRef.current
    const word = wordRef.current
    if (!strip || !word) return
    strip.scrollTo({
      left: Math.max(0, word.offsetLeft + word.offsetWidth / 2 - strip.clientWidth / 2),
      behavior: 'smooth',
    })
  }, [active.lineIndex, active.sectionIndex, active.wordIndex])

  if (!words) return null
  return (
    <div ref={stripRef} data-element="strip">
      {words.map((word, index) => (
        <button
          key={`${word.text}-${index}`}
          ref={index === active.wordIndex ? wordRef : null}
          type="button"
          data-action="seek-word"
          data-active-word={index === active.wordIndex ? 'true' : undefined}
          onClick={() => onSeek(word.startMs)}
        >
          {word.text}
        </button>
      ))}
    </div>
  )
}

interface LyricLineProps {
  line: SyncedLine
  activeLine: boolean
  pastLine: boolean
  activeWordIndex: number
  onSeek: (milliseconds: number) => void
}

const LyricLine = forwardRef<HTMLDivElement, LyricLineProps>(function LyricLine(
  { line, activeLine, pastLine, activeWordIndex, onSeek },
  ref
) {
  return (
    <div
      ref={ref}
      data-element="line"
      data-active-line={activeLine ? 'true' : undefined}
      data-past-line={pastLine ? 'true' : undefined}
    >
      {line.words
        ? line.words.map((word, index) => (
            <span key={`${word.text}-${index}`}>
              <button
                type="button"
                data-action="seek-word"
                data-active-word={activeLine && index === activeWordIndex ? 'true' : undefined}
                onClick={() => onSeek(word.startMs)}
              >
                {word.text}
              </button>{' '}
            </span>
          ))
        : line.rawText}
    </div>
  )
})

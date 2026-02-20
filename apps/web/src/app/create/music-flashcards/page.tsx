'use client'

import { useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../styled-system/css'
import { container, stack, hstack, grid } from '../../../../styled-system/patterns'

type Clef = 'treble' | 'bass' | 'both'
type NoteRange = 'beginner' | 'intermediate' | 'advanced' | 'custom'
type Layout = '1-up' | '4-up' | '6-up'

interface MusicFlashcardConfig {
  clef: Clef
  noteRange: NoteRange
  customLowNote?: number // position relative to bottom line
  customHighNote?: number
  layout: Layout
  showNoteNames: boolean
  instrument?: 'violin' | 'piano' | 'general'
}

const NOTE_RANGES = {
  beginner: { low: -2, high: 8, description: 'Middle C to F (top line)' },
  intermediate: { low: -5, high: 10, description: 'G below staff to A above' },
  advanced: { low: -8, high: 12, description: 'Extended range with ledger lines' },
}

const VIOLIN_FIRST_POSITION = { low: -5, high: 10 } // G3 to A5

export default function MusicFlashcardsPage() {
  const [config, setConfig] = useState<MusicFlashcardConfig>({
    clef: 'treble',
    noteRange: 'intermediate',
    layout: '4-up',
    showNoteNames: true,
    instrument: 'violin',
  })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)

    try {
      // Determine note range
      let lowNote: number, highNote: number

      if (config.instrument === 'violin') {
        // Override with violin first position range
        lowNote = VIOLIN_FIRST_POSITION.low
        highNote = VIOLIN_FIRST_POSITION.high
      } else if (config.noteRange === 'custom') {
        lowNote = config.customLowNote ?? -2
        highNote = config.customHighNote ?? 8
      } else {
        const range = NOTE_RANGES[config.noteRange]
        lowNote = range.low
        highNote = range.high
      }

      const response = await fetch('/api/create/music-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clef: config.clef,
          lowNote,
          highNote,
          layout: config.layout,
          showNoteNames: config.showNoteNames,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Generation failed')
      }

      // Download the PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `music-flashcards-${config.clef}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <PageWithNav navTitle="Music Flashcards" navEmoji="🎵">
      <div className={css({ minHeight: '100vh', bg: 'bg.canvas' })}>
        <div className={container({ maxW: '4xl', px: '4', py: '8' })}>
          <div className={stack({ gap: '6', mb: '8' })}>
            <div className={stack({ gap: '2', textAlign: 'center' })}>
              <h1 className={css({ fontSize: '3xl', fontWeight: 'bold', color: 'text.primary' })}>
                🎵 Music Note Flashcards
              </h1>
              <p className={css({ fontSize: 'lg', color: 'text.secondary' })}>
                Generate printable flashcards for learning to read music notation
              </p>
            </div>
          </div>

          <div className={grid({ columns: { base: 1, md: 2 }, gap: '8' })}>
            {/* Configuration Panel */}
            <div className={css({ bg: 'bg.default', rounded: '2xl', shadow: 'card', p: '6' })}>
              <div className={stack({ gap: '6' })}>
                <h2
                  className={css({ fontSize: 'lg', fontWeight: 'semibold', color: 'text.primary' })}
                >
                  Configuration
                </h2>

                {/* Instrument Preset */}
                <div className={stack({ gap: '2' })}>
                  <label
                    className={css({
                      fontSize: 'sm',
                      fontWeight: 'medium',
                      color: 'text.secondary',
                    })}
                  >
                    Instrument
                  </label>
                  <select
                    value={config.instrument}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        instrument: e.target.value as MusicFlashcardConfig['instrument'],
                      })
                    }
                    className={css({
                      w: 'full',
                      p: '3',
                      bg: 'bg.subtle',
                      border: '1px solid',
                      borderColor: 'border.default',
                      rounded: 'lg',
                      fontSize: 'md',
                      color: 'text.primary',
                    })}
                  >
                    <option value="violin">🎻 Violin (First Position)</option>
                    <option value="piano">🎹 Piano</option>
                    <option value="general">📖 General</option>
                  </select>
                </div>

                {/* Clef Selection */}
                <div className={stack({ gap: '2' })}>
                  <label
                    className={css({
                      fontSize: 'sm',
                      fontWeight: 'medium',
                      color: 'text.secondary',
                    })}
                  >
                    Clef
                  </label>
                  <div className={hstack({ gap: '2' })}>
                    {(['treble', 'bass', 'both'] as const).map((clef) => (
                      <button
                        key={clef}
                        onClick={() => setConfig({ ...config, clef })}
                        className={css({
                          flex: 1,
                          py: '3',
                          px: '4',
                          rounded: 'lg',
                          fontWeight: 'medium',
                          transition: 'all 0.2s',
                          bg: config.clef === clef ? 'accent.default' : 'bg.subtle',
                          color: config.clef === clef ? 'accent.fg' : 'text.primary',
                          border: '1px solid',
                          borderColor: config.clef === clef ? 'accent.default' : 'border.default',
                          _hover: { bg: config.clef === clef ? 'accent.emphasis' : 'bg.muted' },
                        })}
                      >
                        {clef === 'treble' ? '𝄞 Treble' : clef === 'bass' ? '𝄢 Bass' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note Range (only for non-violin) */}
                {config.instrument !== 'violin' && (
                  <div className={stack({ gap: '2' })}>
                    <label
                      className={css({
                        fontSize: 'sm',
                        fontWeight: 'medium',
                        color: 'text.secondary',
                      })}
                    >
                      Note Range
                    </label>
                    <select
                      value={config.noteRange}
                      onChange={(e) =>
                        setConfig({ ...config, noteRange: e.target.value as NoteRange })
                      }
                      className={css({
                        w: 'full',
                        p: '3',
                        bg: 'bg.subtle',
                        border: '1px solid',
                        borderColor: 'border.default',
                        rounded: 'lg',
                        fontSize: 'md',
                        color: 'text.primary',
                      })}
                    >
                      <option value="beginner">
                        Beginner — {NOTE_RANGES.beginner.description}
                      </option>
                      <option value="intermediate">
                        Intermediate — {NOTE_RANGES.intermediate.description}
                      </option>
                      <option value="advanced">
                        Advanced — {NOTE_RANGES.advanced.description}
                      </option>
                    </select>
                  </div>
                )}

                {/* Layout */}
                <div className={stack({ gap: '2' })}>
                  <label
                    className={css({
                      fontSize: 'sm',
                      fontWeight: 'medium',
                      color: 'text.secondary',
                    })}
                  >
                    Cards per Page
                  </label>
                  <div className={hstack({ gap: '2' })}>
                    {(['1-up', '4-up', '6-up'] as const).map((layout) => (
                      <button
                        key={layout}
                        onClick={() => setConfig({ ...config, layout })}
                        className={css({
                          flex: 1,
                          py: '2',
                          px: '3',
                          rounded: 'lg',
                          fontSize: 'sm',
                          fontWeight: 'medium',
                          transition: 'all 0.2s',
                          bg: config.layout === layout ? 'accent.default' : 'bg.subtle',
                          color: config.layout === layout ? 'accent.fg' : 'text.primary',
                          border: '1px solid',
                          borderColor:
                            config.layout === layout ? 'accent.default' : 'border.default',
                        })}
                      >
                        {layout === '1-up' ? '1' : layout === '4-up' ? '4' : '6'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Show Note Names */}
                <div className={hstack({ gap: '3', alignItems: 'center' })}>
                  <input
                    type="checkbox"
                    id="showNames"
                    checked={config.showNoteNames}
                    onChange={(e) => setConfig({ ...config, showNoteNames: e.target.checked })}
                    className={css({ w: '5', h: '5', accentColor: 'accent.default' })}
                  />
                  <label
                    htmlFor="showNames"
                    className={css({ fontSize: 'sm', color: 'text.primary' })}
                  >
                    Show note name (small, in corner)
                  </label>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className={css({
                    w: 'full',
                    py: '4',
                    px: '6',
                    mt: '4',
                    bg: 'accent.default',
                    color: 'accent.fg',
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    rounded: 'xl',
                    transition: 'all 0.2s',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    opacity: generating ? 0.7 : 1,
                    _hover: generating
                      ? {}
                      : { bg: 'accent.emphasis', transform: 'translateY(-1px)' },
                  })}
                >
                  {generating ? '⏳ Generating...' : '✨ Generate Flashcards'}
                </button>

                {error && (
                  <div
                    className={css({
                      p: '4',
                      bg: 'red.50',
                      rounded: 'lg',
                      color: 'red.700',
                      fontSize: 'sm',
                    })}
                  >
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Preview Panel */}
            <div className={css({ bg: 'bg.default', rounded: '2xl', shadow: 'card', p: '6' })}>
              <div className={stack({ gap: '4' })}>
                <h2
                  className={css({ fontSize: 'lg', fontWeight: 'semibold', color: 'text.primary' })}
                >
                  Preview
                </h2>

                <div
                  className={css({
                    bg: 'bg.subtle',
                    rounded: 'xl',
                    p: '6',
                    minH: '300px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed',
                    borderColor: 'border.default',
                  })}
                >
                  {/* Simple preview representation */}
                  <div className={stack({ gap: '4', textAlign: 'center' })}>
                    <div className={css({ fontSize: '4xl' })}>
                      {config.clef === 'treble' ? '𝄞' : config.clef === 'bass' ? '𝄢' : '𝄞 𝄢'}
                    </div>
                    <div className={css({ color: 'text.secondary', fontSize: 'sm' })}>
                      {config.instrument === 'violin' ? (
                        <>
                          Violin first position: G₃ to A₅
                          <br />
                          16 cards
                        </>
                      ) : (
                        <>
                          {NOTE_RANGES[config.noteRange as keyof typeof NOTE_RANGES]?.description ||
                            'Custom range'}
                          <br />
                          Layout: {config.layout}
                        </>
                      )}
                    </div>
                    <div className={css({ fontSize: 'xs', color: 'text.muted' })}>
                      Click generate to create PDF
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div
                  className={css({
                    fontSize: 'sm',
                    color: 'text.secondary',
                    lineHeight: 'relaxed',
                  })}
                >
                  <strong>What you&apos;ll get:</strong>
                  <ul className={css({ listStyle: 'disc', pl: '5', mt: '2' })}>
                    <li>Professional music staff with {config.clef} clef</li>
                    <li>One note per card for focused practice</li>
                    <li>Bravura music font for authentic notation</li>
                    {config.showNoteNames && <li>Note name in corner (can be covered)</li>}
                    <li>Print-ready PDF at {config.layout} per page</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWithNav>
  )
}

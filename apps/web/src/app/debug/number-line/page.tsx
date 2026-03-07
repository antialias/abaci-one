'use client'

import { useState, useCallback, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'
import type {
  MomentSnapshot,
  PostcardManifest,
  RankedMoment,
} from '@/db/schema/number-line-postcards'

// ── Screenshot scenarios (for render preview) ───────────────────────

const SCREENSHOT_SCENARIOS: Array<{ label: string; snapshot: MomentSnapshot }> = [
  {
    label: 'Bare origin',
    snapshot: { viewport: { center: 0, pixelsPerUnit: 80 }, timestamp: 0 },
  },
  {
    label: 'Game target (7)',
    snapshot: {
      viewport: { center: 7, pixelsPerUnit: 60 },
      gameTarget: { value: 7, emoji: '🎯' },
      timestamp: 5000,
    },
  },
  {
    label: 'Indicator 3-5',
    snapshot: {
      viewport: { center: 4, pixelsPerUnit: 80 },
      highlights: [3, 4, 5],
      indicatorRange: { from: 3, to: 5 },
      timestamp: 8000,
    },
  },
  {
    label: 'Pi demo (75%)',
    snapshot: {
      viewport: { center: Math.PI, pixelsPerUnit: 100 },
      activeExplorationId: 'pi',
      demoProgress: 0.75,
      timestamp: 25000,
    },
  },
  {
    label: 'Phi spiral (50%)',
    snapshot: {
      viewport: { center: 1.618, pixelsPerUnit: 100 },
      activeExplorationId: 'phi',
      demoProgress: 0.5,
      timestamp: 30000,
    },
  },
  {
    label: 'e demo (60%)',
    snapshot: {
      viewport: { center: Math.E, pixelsPerUnit: 100 },
      activeExplorationId: 'e',
      demoProgress: 0.6,
      timestamp: 35000,
    },
  },
  {
    label: 'Zoomed out (0-100)',
    snapshot: {
      viewport: { center: 50, pixelsPerUnit: 8 },
      highlights: [25, 50, 75],
      indicatorRange: { from: 25, to: 75 },
      timestamp: 45000,
    },
  },
  {
    label: 'Negative numbers',
    snapshot: {
      viewport: { center: -3, pixelsPerUnit: 60 },
      gameTarget: { value: -3, emoji: '🧊' },
      highlights: [-5, -4, -3, -2, -1],
      indicatorRange: { from: -5, to: -1 },
      timestamp: 50000,
    },
  },
]

// ── Postcard presets (full realistic call stories) ───────────────────

interface PostcardPreset {
  label: string
  description: string
  manifest: PostcardManifest
}

const POSTCARD_PRESETS: PostcardPreset[] = [
  {
    label: "Seven's adventure",
    description: 'A lucky prime plays Find the Number and explores pi',
    manifest: {
      callerNumber: 7,
      callerPersonality:
        'Lucky and confident. A prime number who knows it. Loves being the most popular number in the world — asked in every survey, chosen for every lucky draw. Has a dry wit and a soft spot for underdogs like 13.',
      childName: 'Mila',
      childEmoji: '🦋',
      moments: [
        {
          rank: 1,
          caption:
            'Seven challenged Mila to find it on the number line, hiding behind a warm glow at position 7',
          category: 'game',
          snapshot: {
            viewport: { center: 7, pixelsPerUnit: 60 },
            gameTarget: { value: 7, emoji: '🎯' },
            timestamp: 8000,
          },
          transcriptExcerpt:
            'Seven: "I\'m hiding somewhere on the number line... can you find me?"\nMila: "Is it near 5?"\nSeven: "Warmer! Keep going right!"\nMila: "Seven! I found you!"',
        },
        {
          rank: 2,
          caption: 'Mila asked why 7 is prime, and Seven showed its neighborhood from 5 to 9',
          category: 'question',
          snapshot: {
            viewport: { center: 7, pixelsPerUnit: 80 },
            highlights: [5, 6, 7, 8, 9],
            indicatorRange: { from: 5, to: 9 },
            timestamp: 25000,
          },
          transcriptExcerpt:
            'Mila: "Why are you a prime number?"\nSeven: "Because nobody divides me evenly! Look at my neighbors — 6 is 2×3, 8 is 2×4, but me? I\'m just me."',
        },
        {
          rank: 3,
          caption: 'Seven introduced Mila to its friend pi, rolling a circle along the number line',
          category: 'exploration',
          snapshot: {
            viewport: { center: Math.PI, pixelsPerUnit: 100 },
            activeExplorationId: 'pi',
            demoProgress: 0.75,
            timestamp: 52000,
          },
          transcriptExcerpt:
            'Seven: "Want to meet someone cool? This is pi — it goes on forever!"\nMila: "It\'s 3.14 something?"\nSeven: "Watch the circle roll — that\'s exactly how far it goes in one rotation!"',
        },
      ],
      sessionSummary:
        'Mila called Seven and they played Find the Number together, then discussed what makes a number prime. Seven introduced its friend pi and showed the rolling circle demo. Mila was fascinated by numbers that go on forever.',
    },
  },
  {
    label: "Forty-two's deep thoughts",
    description: 'The answer to everything reflects on life and the golden ratio',
    manifest: {
      callerNumber: 42,
      callerPersonality:
        'Deeply philosophical. Claims to be the answer to life, the universe, and everything, but is secretly insecure about it. Loves Douglas Adams. Speaks in measured, thoughtful sentences. Finds beauty in mathematical patterns and enjoys pointing out that 42 = 2 × 3 × 7.',
      childName: 'Leo',
      childEmoji: '🦁',
      moments: [
        {
          rank: 1,
          caption:
            'Forty-two reflected on being the answer to everything while Leo searched for it on the zoomed-out number line',
          category: 'game',
          snapshot: {
            viewport: { center: 42, pixelsPerUnit: 40 },
            gameTarget: { value: 42, emoji: '🌟' },
            timestamp: 12000,
          },
          transcriptExcerpt:
            'Leo: "Are you really the answer to everything?"\nForty-two: "That\'s what they say. But honestly, I think every number has something to answer for."\nLeo: "I found you! You\'re at 42!"\nForty-two: "Well done. Not everyone can find the meaning of life so quickly."',
        },
        {
          rank: 2,
          caption:
            'Forty-two showed Leo the golden ratio spiral, connecting math to the beauty of nature',
          category: 'exploration',
          snapshot: {
            viewport: { center: 1.618, pixelsPerUnit: 100 },
            activeExplorationId: 'phi',
            demoProgress: 0.5,
            timestamp: 45000,
          },
          transcriptExcerpt:
            'Forty-two: "Want to see something beautiful? This is phi — the golden ratio."\nLeo: "What\'s the spiral thing?"\nForty-two: "It\'s the same pattern you see in sunflowers and seashells. Math is secretly everywhere."',
        },
        {
          rank: 3,
          caption: 'Leo asked about negative numbers and Forty-two took a trip below zero',
          category: 'discovery',
          snapshot: {
            viewport: { center: -3, pixelsPerUnit: 60 },
            highlights: [-5, -4, -3, -2, -1, 0, 1],
            indicatorRange: { from: -5, to: 1 },
            timestamp: 70000,
          },
          transcriptExcerpt:
            'Leo: "What happens if you go past zero?"\nForty-two: "Ah, the negative side. It\'s like looking in a mirror — everything is the same, but backwards."\nLeo: "So negative 42 is like your evil twin?"',
        },
        {
          rank: 4,
          caption: 'They zoomed way out and Forty-two showed how it sits between its neighbors',
          category: 'conversation',
          snapshot: {
            viewport: { center: 42, pixelsPerUnit: 8 },
            highlights: [42],
            indicatorRange: { from: 30, to: 54 },
            timestamp: 85000,
          },
          transcriptExcerpt:
            'Forty-two: "From far away I\'m just a tiny dot. But zoom in and I\'m a whole world."\nLeo: "You\'re between 41 and 43. Are they your friends?"\nForty-two: "41 is prime — very independent. 43 too, actually. I\'m sandwiched between two loners."',
        },
      ],
      sessionSummary:
        'Leo had a philosophical call with Forty-two about being the answer to everything. They played Find the Number, explored the golden ratio spiral, ventured into negative numbers, and zoomed way out to see the big picture. Forty-two shared its love of patterns and its slightly existential outlook on being famous.',
    },
  },
  {
    label: "Pi's math adventure",
    description: 'Exploring circles, constants, and the beauty of irrational numbers',
    manifest: {
      callerNumber: 3,
      callerPersonality:
        'Friendly and energetic. Lives right next to pi on the number line and never stops talking about it. A small number with big ideas. Loves triangles (it takes 3 sides!), primary colors (there are 3!), and being the first odd prime.',
      childName: 'Ava',
      childEmoji: '🌸',
      moments: [
        {
          rank: 1,
          caption:
            "Three showed Ava the rolling circle demo, tracing pi's exact position as the circle unrolled",
          category: 'exploration',
          snapshot: {
            viewport: { center: Math.PI, pixelsPerUnit: 100 },
            activeExplorationId: 'pi',
            demoProgress: 0.25,
            timestamp: 15000,
          },
          transcriptExcerpt:
            'Three: "See that circle? Watch what happens when it rolls along the number line..."\nAva: "It stops a little past 3!"\nThree: "Exactly! That distance is pi — my neighbor. 3.14159..."',
        },
        {
          rank: 2,
          caption: 'The circle completed its full roll to pi while Ava watched the digits appear',
          category: 'exploration',
          snapshot: {
            viewport: { center: Math.PI, pixelsPerUnit: 100 },
            activeExplorationId: 'pi',
            demoProgress: 0.9,
            timestamp: 35000,
          },
          transcriptExcerpt:
            'Ava: "Does it ever end?"\nThree: "Never! Pi goes on forever without repeating. That\'s what makes it irrational."\nAva: "Ir-rational? Like it\'s angry?"\nThree: "Ha! No — it just means you can\'t write it as a simple fraction."',
        },
        {
          rank: 3,
          caption:
            "Three then introduced e, showing compound interest bars stacking up toward Euler's number",
          category: 'exploration',
          snapshot: {
            viewport: { center: Math.E, pixelsPerUnit: 100 },
            activeExplorationId: 'e',
            demoProgress: 0.6,
            timestamp: 55000,
          },
          transcriptExcerpt:
            'Three: "Pi has a friend named e. It\'s about 2.718..."\nAva: "What does e do?"\nThree: "Imagine you put a dollar in the bank and it keeps growing — the bars show how it approaches e!"',
        },
      ],
      sessionSummary:
        "Ava called Three and went on a mathematical adventure through the world of irrational numbers. They watched pi emerge from a rolling circle, learned that irrational doesn't mean angry, and then met e through a compound interest visualization. Ava was amazed that some numbers go on forever.",
    },
  },
  {
    label: "Negative three's cold adventure",
    description: 'Exploring the other side of zero with games and discovery',
    manifest: {
      callerNumber: -3,
      callerPersonality:
        'Chilly and playful. Lives on the "other side" of zero and is a bit jealous of positive 3. Loves winter metaphors. Thinks of itself as 3\'s reflection in a frozen lake. Surprisingly warm-hearted despite the cold exterior.',
      childName: 'Kai',
      childEmoji: '❄️',
      moments: [
        {
          rank: 1,
          caption: 'Negative Three hid in the frozen zone below zero and Kai had to find it',
          category: 'game',
          snapshot: {
            viewport: { center: -3, pixelsPerUnit: 60 },
            gameTarget: { value: -3, emoji: '🧊' },
            timestamp: 10000,
          },
          transcriptExcerpt:
            'Negative Three: "I\'m hiding in the cold side of the number line... brrr!"\nKai: "Is it negative 5?"\nNegative Three: "Too cold! Come back towards zero a bit."\nKai: "Negative 3!"',
        },
        {
          rank: 2,
          caption:
            'Kai explored the mirror symmetry between -5 and 5, with the indicator highlighting both sides',
          category: 'discovery',
          snapshot: {
            viewport: { center: 0, pixelsPerUnit: 50 },
            highlights: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
            indicatorRange: { from: -5, to: 5 },
            timestamp: 35000,
          },
          transcriptExcerpt:
            'Kai: "So you\'re like a mirror of 3?"\nNegative Three: "Exactly! Zero is our mirror. Everything on my side is a reflection."\nKai: "So -5 and 5 are reflections too?"\nNegative Three: "Now you\'re getting it!"',
        },
        {
          rank: 3,
          caption:
            'They discovered that the Euler-Mascheroni constant lives between 0 and 1, right near the mirror',
          category: 'exploration',
          snapshot: {
            viewport: { center: 0.5772, pixelsPerUnit: 120 },
            activeExplorationId: 'gamma',
            demoProgress: 0.8,
            timestamp: 60000,
          },
          transcriptExcerpt:
            'Negative Three: "See those stairs? They\'re the harmonic series — 1, 1/2, 1/3, 1/4..."\nKai: "They go up forever but they slow down!"\nNegative Three: "The gap between the stairs and the curve... that\'s gamma. About 0.5772."',
        },
      ],
      sessionSummary:
        "Kai called Negative Three and explored the frozen side of the number line. They played Find the Number in negative territory, discovered the mirror symmetry around zero, and then Negative Three showed off the harmonic staircase revealing the Euler-Mascheroni constant. Kai learned that the negative side isn't scary — it's just a reflection.",
    },
  },
]

// ── Component ────────────────────────────────────────────────────────

type RenderStatus = 'idle' | 'loading' | 'done' | 'error'

export default function NumberLineDebugPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Screenshot section state
  const [ssIdx, setSsIdx] = useState(0)
  const [tileMode, setTileMode] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<RenderStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [renderTimeMs, setRenderTimeMs] = useState<number | null>(null)

  // Postcard section state
  const [presetIdx, setPresetIdx] = useState(0)
  const [postcardStatus, setPostcardStatus] = useState<'idle' | 'creating' | 'created' | 'error'>(
    'idle'
  )
  const [postcardResult, setPostcardResult] = useState<{
    postcardId?: string
    taskId?: string
    error?: string
  } | null>(null)

  const getSelectedSnapshots = useCallback((): MomentSnapshot[] => {
    if (tileMode) {
      const startIdx = Math.floor(ssIdx / 4) * 4
      return SCREENSHOT_SCENARIOS.slice(startIdx, startIdx + 4).map((s) => s.snapshot)
    }
    return [SCREENSHOT_SCENARIOS[ssIdx].snapshot]
  }, [ssIdx, tileMode])

  const fetchRender = useCallback(async () => {
    setStatus('loading')
    setErrorMsg(null)

    const snapshots = getSelectedSnapshots()
    const startTime = performance.now()
    try {
      const res = await fetch('/api/demo/moment-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshots }),
      })
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`)
      }
      const blob = await res.blob()
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      setImageUrl(URL.createObjectURL(blob))
      setRenderTimeMs(Math.round(performance.now() - startTime))
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setRenderTimeMs(null)
      setStatus('error')
    }
  }, [getSelectedSnapshots, imageUrl])

  const generatePostcard = useCallback(async () => {
    setPostcardStatus('creating')
    setPostcardResult(null)

    const manifest = POSTCARD_PRESETS[presetIdx].manifest

    try {
      const res = await fetch('/api/postcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest }),
      })
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`)
      }
      const data = await res.json()
      setPostcardResult({ postcardId: data.postcardId, taskId: data.taskId })
      setPostcardStatus('created')
    } catch (err) {
      setPostcardResult({
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      setPostcardStatus('error')
    }
  }, [presetIdx])

  // Auto-fetch screenshot on scenario/mode change
  useEffect(() => {
    fetchRender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssIdx, tileMode])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tileLabels = tileMode
    ? (() => {
        const startIdx = Math.floor(ssIdx / 4) * 4
        return SCREENSHOT_SCENARIOS.slice(startIdx, startIdx + 4)
          .map((s) => s.label)
          .join(', ')
      })()
    : null

  return (
    <PageWithNav>
      <main
        data-component="debug-number-line"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '900px', margin: '0 auto' })}>
          {/* Back link */}
          <Link
            href="/debug"
            data-action="back-to-debug-hub"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: isDark ? 'gray.400' : 'gray.600',
              textDecoration: 'none',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              _hover: { color: isDark ? 'gray.200' : 'gray.800' },
            })}
          >
            <ArrowLeft size={16} />
            Debug Hub
          </Link>

          {/* Header */}
          <header data-element="header" className={css({ marginBottom: '1.5rem' })}>
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '0.25rem',
              })}
            >
              Number Line Screenshots & Postcards
            </h1>
            <p className={css({ color: isDark ? 'gray.400' : 'gray.600', fontSize: '0.875rem' })}>
              Test server-side rendering and the full postcard generation pipeline
            </p>
          </header>

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5rem' })}>
            {/* Screenshot section */}
            <section
              data-element="screenshot-section"
              className={css({
                backgroundColor: isDark ? 'gray.800' : 'white',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
                padding: '1.25rem',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                })}
              >
                <h2
                  className={css({
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: isDark ? 'white' : 'gray.800',
                  })}
                >
                  Server-Side Render Preview
                </h2>
                <div className={css({ display: 'flex', gap: '0.5rem', alignItems: 'center' })}>
                  {status === 'loading' && (
                    <span
                      className={css({
                        fontSize: '0.75rem',
                        color: isDark ? 'gray.500' : 'gray.400',
                      })}
                    >
                      rendering...
                    </span>
                  )}
                  {status === 'done' && renderTimeMs != null && (
                    <span
                      className={css({
                        fontSize: '0.75rem',
                        color: isDark ? 'gray.500' : 'gray.400',
                      })}
                    >
                      {renderTimeMs}ms
                    </span>
                  )}
                  {status === 'error' && (
                    <span className={css({ fontSize: '0.75rem', color: 'red.400' })}>failed</span>
                  )}
                </div>
              </div>

              {/* Image preview */}
              <div
                data-element="screenshot-preview"
                className={css({
                  width: '100%',
                  aspectRatio: '4/3',
                  maxWidth: '800px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.200',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  marginBottom: '1rem',
                })}
              >
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt="Server-rendered moment screenshot"
                    className={css({ width: '100%', height: '100%', objectFit: 'contain' })}
                  />
                ) : (
                  <span className={css({ color: 'gray.400', fontSize: '0.875rem' })}>
                    {status === 'loading' ? 'Rendering on server...' : 'No image yet'}
                  </span>
                )}
              </div>

              {/* Error */}
              {errorMsg && (
                <div
                  data-element="error-message"
                  className={css({
                    fontSize: '0.75rem',
                    color: 'red.400',
                    background: isDark ? 'rgba(248,113,113,0.1)' : 'red.50',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    wordBreak: 'break-all',
                  })}
                >
                  {errorMsg}
                </div>
              )}

              {/* Tile mode info */}
              {tileMode && tileLabels && (
                <div
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'gray.500' : 'gray.500',
                    marginBottom: '0.5rem',
                  })}
                >
                  Tiles: {tileLabels}
                </div>
              )}

              {/* Controls */}
              <div
                className={css({
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                  marginBottom: '1rem',
                })}
              >
                <label
                  data-element="tile-toggle"
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: isDark ? 'gray.300' : 'gray.700',
                  })}
                >
                  <input
                    type="checkbox"
                    checked={tileMode}
                    onChange={(e) => setTileMode(e.target.checked)}
                    className={css({ cursor: 'pointer' })}
                  />
                  2x2 tile mode
                </label>
                <button
                  data-action="re-render"
                  onClick={fetchRender}
                  disabled={status === 'loading'}
                  className={css({
                    padding: '6px 16px',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: status === 'loading' ? 'wait' : 'pointer',
                    background: isDark ? 'indigo.600' : 'indigo.500',
                    color: 'white',
                    opacity: status === 'loading' ? 0.5 : 1,
                    _hover: { background: isDark ? 'indigo.500' : 'indigo.600' },
                  })}
                >
                  Re-render
                </button>
              </div>

              {/* Scenario selector */}
              <div
                data-element="scenario-selector"
                className={css({ display: 'flex', flexWrap: 'wrap', gap: '6px' })}
              >
                {SCREENSHOT_SCENARIOS.map((s, i) => (
                  <button
                    key={s.label}
                    data-action={`select-scenario-${i}`}
                    onClick={() => setSsIdx(i)}
                    className={css({
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: ssIdx === i ? '700' : '400',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background:
                        ssIdx === i
                          ? isDark
                            ? 'indigo.600'
                            : 'indigo.500'
                          : isDark
                            ? 'gray.700'
                            : 'gray.100',
                      color: ssIdx === i ? 'white' : isDark ? 'gray.300' : 'gray.700',
                      transition: 'all 0.15s',
                      _hover: {
                        background:
                          ssIdx === i
                            ? isDark
                              ? 'indigo.500'
                              : 'indigo.600'
                            : isDark
                              ? 'gray.600'
                              : 'gray.200',
                      },
                    })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Postcard generation section */}
            <section
              data-element="postcard-section"
              className={css({
                backgroundColor: isDark ? 'gray.800' : 'white',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
                padding: '1.25rem',
              })}
            >
              <h2
                className={css({
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: isDark ? 'white' : 'gray.800',
                  marginBottom: '0.5rem',
                })}
              >
                Full Postcard Pipeline
              </h2>
              <p
                className={css({
                  fontSize: '0.8125rem',
                  color: isDark ? 'gray.400' : 'gray.600',
                  marginBottom: '1rem',
                })}
              >
                Creates a real postcard DB record with a rich multi-moment manifest, then kicks off
                the background task (server-side screenshot render + AI image generation with the
                screenshots as reference).
              </p>

              {/* Preset selector */}
              <div
                data-element="preset-selector"
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '1rem',
                })}
              >
                {POSTCARD_PRESETS.map((p, i) => (
                  <button
                    key={p.label}
                    data-action={`select-preset-${i}`}
                    onClick={() => {
                      setPresetIdx(i)
                      setPostcardStatus('idle')
                      setPostcardResult(null)
                    }}
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '2px solid',
                      borderColor:
                        presetIdx === i
                          ? isDark
                            ? 'green.500'
                            : 'green.600'
                          : isDark
                            ? 'gray.700'
                            : 'gray.200',
                      background:
                        presetIdx === i
                          ? isDark
                            ? 'green.900/30'
                            : 'green.50'
                          : isDark
                            ? 'gray.800'
                            : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      _hover: {
                        borderColor: isDark ? 'green.400' : 'green.500',
                      },
                    })}
                  >
                    <div className={css({ display: 'flex', gap: '0.5rem', alignItems: 'center' })}>
                      <span
                        className={css({
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          color: isDark ? 'white' : 'gray.800',
                        })}
                      >
                        #{p.manifest.callerNumber} — {p.label}
                      </span>
                      <span
                        className={css({
                          fontSize: '0.75rem',
                          color: isDark ? 'gray.500' : 'gray.400',
                        })}
                      >
                        {p.manifest.moments.length} moments
                      </span>
                    </div>
                    <span
                      className={css({
                        fontSize: '0.8125rem',
                        color: isDark ? 'gray.400' : 'gray.600',
                      })}
                    >
                      {p.description}
                    </span>
                  </button>
                ))}
              </div>

              <div
                className={css({
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                })}
              >
                <button
                  data-action="generate-postcard"
                  onClick={generatePostcard}
                  disabled={postcardStatus === 'creating'}
                  className={css({
                    padding: '8px 20px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: postcardStatus === 'creating' ? 'wait' : 'pointer',
                    background: isDark ? 'green.700' : 'green.600',
                    color: 'white',
                    opacity: postcardStatus === 'creating' ? 0.5 : 1,
                    _hover: { background: isDark ? 'green.600' : 'green.700' },
                  })}
                >
                  {postcardStatus === 'creating' ? 'Creating...' : 'Generate Postcard'}
                </button>

                {postcardStatus === 'created' && postcardResult?.postcardId && (
                  <div className={css({ display: 'flex', gap: '0.75rem', alignItems: 'center' })}>
                    <span
                      className={css({
                        fontSize: '0.8125rem',
                        color: isDark ? 'green.400' : 'green.600',
                        fontWeight: '500',
                      })}
                    >
                      Created!
                    </span>
                    <Link
                      href={`/my-stuff/postcards/${postcardResult.postcardId}`}
                      className={css({
                        fontSize: '0.8125rem',
                        color: isDark ? 'indigo.400' : 'indigo.600',
                        textDecoration: 'underline',
                      })}
                    >
                      View postcard
                    </Link>
                    {postcardResult.taskId && (
                      <span
                        className={css({
                          fontSize: '0.6875rem',
                          fontFamily: 'mono',
                          color: isDark ? 'gray.500' : 'gray.400',
                        })}
                      >
                        task: {postcardResult.taskId.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                )}

                {postcardStatus === 'error' && postcardResult?.error && (
                  <span className={css({ fontSize: '0.8125rem', color: 'red.400' })}>
                    {postcardResult.error}
                  </span>
                )}
              </div>

              {/* Manifest preview */}
              <details
                data-element="manifest-preview"
                className={css({
                  marginTop: '1rem',
                  fontSize: '0.75rem',
                  color: isDark ? 'gray.400' : 'gray.600',
                })}
              >
                <summary className={css({ cursor: 'pointer', userSelect: 'none' })}>
                  Manifest JSON (will be sent to /api/postcards)
                </summary>
                <pre
                  className={css({
                    fontSize: '0.6875rem',
                    maxHeight: '300px',
                    overflow: 'auto',
                    background: isDark ? 'gray.900' : 'gray.50',
                    padding: '12px',
                    borderRadius: '6px',
                    marginTop: '0.5rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.700' : 'gray.200',
                  })}
                >
                  {JSON.stringify(POSTCARD_PRESETS[presetIdx].manifest, null, 2)}
                </pre>
              </details>
            </section>
          </div>
        </div>
      </main>
    </PageWithNav>
  )
}

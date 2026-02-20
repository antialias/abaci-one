'use client'

import { useCallback, useState } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { computeClipHash } from '@/lib/audio/clipHash'
import { TestCard, type TestStatus } from '../TestCard'
import { useTestLog } from '../useTestLog'
import { css } from '../../../../../styled-system/css'

const TONE_PRESETS = [
  'tutorial-instruction',
  'problem-prompt',
  'feedback-correct',
  'feedback-incorrect',
  'encouragement',
]

function LabButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={css({
        fontSize: '12px',
        padding: '6px 12px',
        borderRadius: '6px',
        border: '1px solid #30363d',
        backgroundColor: '#21262d',
        color: '#c9d1d9',
        cursor: 'pointer',
        _hover: { backgroundColor: '#30363d' },
        _disabled: { opacity: 0.5, cursor: 'not-allowed' },
      })}
    >
      {children}
    </button>
  )
}

export function NovelClipTest() {
  const manager = useAudioManagerInstance()
  const { entries, log, clear } = useTestLog()
  const [status, setStatus] = useState<TestStatus>('idle')
  const [text, setText] = useState('The soroban has five beads on each rod')
  const [tone, setTone] = useState('tutorial-instruction')
  const [isPlaying, setIsPlaying] = useState(false)

  const handleSpeak = useCallback(async () => {
    if (!text.trim()) {
      log('warn', 'No text to speak')
      return
    }

    setStatus('running')
    setIsPlaying(true)

    // Compute and log clip hash
    const clipId = computeClipHash({ en: text }, tone)
    log('info', `Computed clip ID: ${clipId}`)

    // Check availability
    const avail = manager.getClipAvailability(clipId)
    if (avail.length === 0) {
      log('warn', 'No voice chain configured')
    } else {
      for (const a of avail) {
        const sourceName = a.source.type === 'pregenerated' ? a.source.name : 'browser-tts'
        log('info', `  ${sourceName}: hasClip=${a.hasClip}`)
      }
    }

    const pregenSources = avail.filter((a) => a.source.type === 'pregenerated' && a.hasClip)
    if (pregenSources.length === 0) {
      log('info', 'No pregenerated source has this clip — expecting browser TTS fallback')
    }

    const start = performance.now()
    try {
      await manager.speak({ say: { en: text }, tone })
      const elapsed = (performance.now() - start).toFixed(0)
      log('success', `Speak completed in ${elapsed}ms`)
      setStatus('pass')
    } catch (err) {
      log('error', 'Speak failed', String(err))
      setStatus('fail')
    } finally {
      setIsPlaying(false)
    }
  }, [manager, text, tone, log])

  return (
    <TestCard
      title="Test 5: Novel Clips / Browser TTS"
      description="Hash-based clips with no mp3 fall through voice chain to browser TTS"
      status={status}
      entries={entries}
      onClear={clear}
    >
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' })}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={css({
            fontSize: '12px',
            padding: '6px 8px',
            borderRadius: '6px',
            border: '1px solid #30363d',
            backgroundColor: '#0d1117',
            color: '#c9d1d9',
            width: '100%',
          })}
        />
        <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className={css({
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #30363d',
              backgroundColor: '#21262d',
              color: '#c9d1d9',
            })}
          >
            {TONE_PRESETS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <LabButton onClick={handleSpeak} disabled={isPlaying}>
            Speak
          </LabButton>
        </div>
      </div>
    </TestCard>
  )
}

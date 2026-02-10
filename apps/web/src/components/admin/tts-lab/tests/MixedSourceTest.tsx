'use client'

import { useCallback, useState } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { computeClipHash } from '@/lib/audio/clipHash'
import type { TtsSegment } from '@/lib/audio/TtsAudioManager'
import { TestCard, type TestStatus } from '../TestCard'
import { useTestLog } from '../useTestLog'
import { css } from '../../../../../styled-system/css'

const PRESETS: Record<string, { label: string; segments: TtsSegment[] }> = {
  'all-pregen': {
    label: 'All pregenerated',
    segments: ['number-5', 'number-3'],
  },
  'all-novel': {
    label: 'All novel',
    segments: [
      { say: { en: 'something entirely new' }, tone: 'tutorial-instruction' },
      { say: { en: 'another novel phrase' }, tone: 'tutorial-instruction' },
    ],
  },
  mixed: {
    label: 'Mixed',
    segments: [
      'number-5',
      { say: { en: 'something novel' }, tone: 'tutorial-instruction' },
      'number-3',
    ],
  },
}

function LabButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
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

function getSegmentClipId(seg: TtsSegment): string {
  if (typeof seg === 'string') return seg
  if ('clipId' in seg) return (seg as { clipId: string }).clipId
  if ('say' in seg) return computeClipHash(seg.say, seg.tone ?? '')
  return '(unknown)'
}

export function MixedSourceTest() {
  const manager = useAudioManagerInstance()
  const { entries, log, clear } = useTestLog()
  const [status, setStatus] = useState<TestStatus>('idle')
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('mixed')

  const handlePlay = useCallback(async () => {
    const preset = PRESETS[selectedPreset]
    if (!preset) return

    setStatus('running')
    setIsPlaying(true)
    log('info', `Playing "${preset.label}" preset`)

    // Log per-segment availability
    for (const seg of preset.segments) {
      const clipId = getSegmentClipId(seg)
      const avail = manager.getClipAvailability(clipId)
      const availStr = avail
        .map((a) => {
          const name = a.source.type === 'pregenerated' ? a.source.name : 'browser-tts'
          return `${name}=${a.hasClip}`
        })
        .join(', ')
      log('info', `  ${clipId}: ${availStr}`)
    }

    const start = performance.now()
    try {
      await manager.speak(preset.segments)
      const elapsed = (performance.now() - start).toFixed(0)
      log('success', `Sequence completed in ${elapsed}ms`)
      setStatus('pass')
    } catch (err) {
      log('error', 'Sequence failed', String(err))
      setStatus('fail')
    } finally {
      setIsPlaying(false)
    }
  }, [manager, selectedPreset, log])

  const handleCheckAvailability = useCallback(() => {
    const preset = PRESETS[selectedPreset]
    if (!preset) return

    log('info', `Checking availability for "${preset.label}" preset:`)
    for (const seg of preset.segments) {
      const clipId = getSegmentClipId(seg)
      const avail = manager.getClipAvailability(clipId)
      const pregenHits = avail.filter(
        (a) => a.source.type === 'pregenerated' && a.hasClip
      )
      const hasBrowserTts = avail.some(
        (a) => a.source.type === 'browser-tts'
      )
      const expected =
        pregenHits.length > 0
          ? `pregenerated (${pregenHits.map((a) => a.source.type === 'pregenerated' ? (a.source as { name: string }).name : '').join(', ')})`
          : hasBrowserTts
            ? 'browser-tts fallback'
            : 'NO SOURCE'

      log('info', `  ${clipId} -> ${expected}`)
    }
  }, [manager, selectedPreset, log])

  return (
    <TestCard
      title="Test 6: Mixed Pregenerated + Novel"
      description="Array where some clips have mp3s, some don't. Each segment resolves independently."
      status={status}
      entries={entries}
      onClear={clear}
    >
      <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
        <select
          value={selectedPreset}
          onChange={(e) => setSelectedPreset(e.target.value)}
          className={css({
            fontSize: '12px',
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid #30363d',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
          })}
        >
          {Object.entries(PRESETS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <LabButton onClick={handleCheckAvailability}>Check Availability</LabButton>
        <LabButton onClick={handlePlay} disabled={isPlaying}>
          Play
        </LabButton>
      </div>
    </TestCard>
  )
}

'use client'

import { useCallback, useState } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import type { TtsSegment } from '@/lib/audio/TtsAudioManager'
import { TestCard, type TestStatus } from '../TestCard'
import { useTestLog } from '../useTestLog'
import { css } from '../../../../../styled-system/css'

const PRESETS: Record<string, { label: string; segments: TtsSegment[] }> = {
  'five-plus-three': {
    label: '5 + 3',
    segments: ['number-5', 'operator-plus', 'number-3'],
  },
  'ten-minus-seven': {
    label: '10 - 7',
    segments: ['number-1', 'number-0', 'operator-minus', 'number-7'],
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

export function MultiClipSequenceTest() {
  const manager = useAudioManagerInstance()
  const { entries, log, clear } = useTestLog()
  const [status, setStatus] = useState<TestStatus>('idle')
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('five-plus-three')
  const [customInput, setCustomInput] = useState('')

  const getSegments = useCallback((): TtsSegment[] => {
    if (selectedPreset === 'custom') {
      return customInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    return PRESETS[selectedPreset]?.segments ?? []
  }, [selectedPreset, customInput])

  const handlePlay = useCallback(async () => {
    const segments = getSegments()
    if (segments.length === 0) {
      log('warn', 'No segments to play')
      return
    }

    setStatus('running')
    setIsPlaying(true)

    log('info', `Playing sequence: [${segments.map((s) => (typeof s === 'string' ? s : JSON.stringify(s))).join(', ')}]`)

    // Log per-segment availability
    for (const seg of segments) {
      const clipId = typeof seg === 'string' ? seg : 'clipId' in seg ? (seg as { clipId: string }).clipId : '(hash)'
      const avail = manager.getClipAvailability(clipId)
      log('info', `  ${clipId}: ${avail.map((a) => `${a.source.type === 'pregenerated' ? a.source.name : 'browser-tts'}=${a.hasClip}`).join(', ')}`)
    }

    const start = performance.now()
    try {
      await manager.speak(segments)
      const elapsed = (performance.now() - start).toFixed(0)
      log('success', `Sequence completed in ${elapsed}ms`)
      setStatus('pass')
    } catch (err) {
      log('error', 'Sequence failed', String(err))
      setStatus('fail')
    } finally {
      setIsPlaying(false)
    }
  }, [manager, log, getSegments])

  const handleCancel = useCallback(() => {
    log('info', 'Cancelling mid-playback...')
    manager.stop()
    log('success', 'stop() called')
    setIsPlaying(false)
  }, [manager, log])

  return (
    <TestCard
      title="Test 4: Multi-Clip Sequence"
      description="Array inputs — sequential playback, inter-segment gaps, mid-sequence cancellation"
      status={status}
      entries={entries}
      onClear={clear}
    >
      <div className={css({ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' })}>
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
          <option value="custom">Custom</option>
        </select>
        {selectedPreset === 'custom' && (
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="clip-1, clip-2, clip-3"
            className={css({
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #30363d',
              backgroundColor: '#0d1117',
              color: '#c9d1d9',
              flex: 1,
            })}
          />
        )}
      </div>
      <LabButton onClick={handlePlay} disabled={isPlaying}>
        Play Sequence
      </LabButton>
      <LabButton onClick={handleCancel} disabled={!isPlaying}>
        Cancel Mid-Playback
      </LabButton>
    </TestCard>
  )
}

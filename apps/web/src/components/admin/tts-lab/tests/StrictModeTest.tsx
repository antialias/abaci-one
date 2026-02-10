'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { useTTS } from '@/hooks/useTTS'
import { TestCard, type TestStatus } from '../TestCard'
import { useTestLog, type UseTestLogReturn } from '../useTestLog'
import { css } from '../../../../../styled-system/css'

function LabButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={css({
        fontSize: '12px',
        padding: '6px 12px',
        borderRadius: '6px',
        border: '1px solid #30363d',
        backgroundColor: '#21262d',
        color: '#c9d1d9',
        cursor: 'pointer',
        _hover: { backgroundColor: '#30363d' },
      })}
    >
      {children}
    </button>
  )
}

/** Inner child that uses useTTS — rendered inside StrictMode wrapper */
function StrictModeChild({ log }: { log: UseTestLogReturn['log'] }) {
  const mountCount = useRef(0)

  const speak = useTTS({ say: { en: 'Strict mode test' }, tone: 'tutorial-instruction' })

  useEffect(() => {
    mountCount.current++
    log('info', `useEffect fired (mount #${mountCount.current})`)
    return () => {
      log('info', `useEffect cleanup (mount #${mountCount.current})`)
    }
  }, [log])

  const handleSpeak = useCallback(async () => {
    log('info', 'Speak button clicked')
    try {
      await speak()
      log('success', 'Speak completed')
    } catch (err) {
      log('error', 'Speak failed', String(err))
    }
  }, [speak, log])

  return (
    <div
      className={css({
        padding: '8px 12px',
        border: '1px dashed #30363d',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      })}
    >
      <span className={css({ fontSize: '11px', color: '#8b949e' })}>StrictMode Child</span>
      <LabButton onClick={handleSpeak}>Speak</LabButton>
    </div>
  )
}

export function StrictModeTest() {
  const manager = useAudioManagerInstance()
  const { entries, log, clear } = useTestLog()
  const [status, setStatus] = useState<TestStatus>('idle')
  const [mounted, setMounted] = useState(false)

  const handleToggleMount = useCallback(() => {
    setMounted((prev) => {
      const next = !prev
      log('info', next ? 'Mounting StrictMode child' : 'Unmounting StrictMode child')
      return next
    })
  }, [log])

  const handleCheckCollection = useCallback(() => {
    const collection = manager.getCollection()
    const matching = collection.filter(
      (c) => c.clipId.startsWith('h-') && c.say?.en === 'Strict mode test'
    )
    log('info', `Collection entries matching "Strict mode test": ${matching.length}`)
    if (matching.length === 1) {
      log('success', 'Exactly 1 entry — register() is idempotent')
      setStatus('pass')
    } else if (matching.length === 0) {
      log('warn', 'No matching entries found (is child mounted?)')
    } else {
      log('error', `Found ${matching.length} entries — duplicate registration!`)
      setStatus('fail')
    }
    log('info', `Total collection size: ${collection.length}`)
  }, [manager, log])

  return (
    <TestCard
      title="Test 3: Strict Mode Double Mount"
      description="Does dev-mode double-mount cause double registration or double playback? (Dev mode only)"
      status={status}
      entries={entries}
      onClear={clear}
    >
      <LabButton onClick={handleToggleMount}>
        {mounted ? 'Unmount Component' : 'Mount Component'}
      </LabButton>
      <LabButton onClick={handleCheckCollection}>Check Collection</LabButton>
      {mounted && (
        <React.StrictMode>
          <StrictModeChild log={log} />
        </React.StrictMode>
      )}
    </TestCard>
  )
}

'use client'

import { useCallback, useState } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { TestCard, type TestStatus } from '../TestCard'
import { useTestLog } from '../useTestLog'
import { css } from '../../../../../styled-system/css'

const WORDS = ['One', 'Two', 'Three', 'Four', 'Five']

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

export function RapidFireTest() {
  const manager = useAudioManagerInstance()
  const { entries, log, clear } = useTestLog()
  const [status, setStatus] = useState<TestStatus>('idle')

  const handleNoAwait = useCallback(() => {
    setStatus('running')
    log('info', 'Fire 5x (no await) — calling speak() in sync loop')
    let completed = 0

    for (let i = 0; i < WORDS.length; i++) {
      const word = WORDS[i]
      const start = performance.now()
      log('info', `  speak("${word}") called`)
      manager.speak({ say: { en: word }, tone: 'tutorial-instruction' }).then(
        () => {
          const elapsed = (performance.now() - start).toFixed(0)
          completed++
          log('success', `  speak("${word}") resolved (${elapsed}ms)`)
          if (completed === WORDS.length) {
            setStatus('pass')
          }
        },
        (err) => {
          completed++
          log('error', `  speak("${word}") rejected`, String(err))
          setStatus('fail')
        }
      )
    }
  }, [manager, log])

  const handleWithGaps = useCallback(() => {
    setStatus('running')
    log('info', 'Fire 5x (50ms gaps) — setTimeout between calls')

    let completed = 0
    WORDS.forEach((word, i) => {
      setTimeout(() => {
        const start = performance.now()
        log('info', `  speak("${word}") called at +${i * 50}ms`)
        manager.speak({ say: { en: word }, tone: 'tutorial-instruction' }).then(
          () => {
            const elapsed = (performance.now() - start).toFixed(0)
            completed++
            log('success', `  speak("${word}") resolved (${elapsed}ms)`)
            if (completed === WORDS.length) {
              setStatus('pass')
            }
          },
          (err) => {
            completed++
            log('error', `  speak("${word}") rejected`, String(err))
            setStatus('fail')
          }
        )
      }, i * 50)
    })
  }, [manager, log])

  const handleAwaited = useCallback(async () => {
    setStatus('running')
    log('info', 'Fire 5x (awaited) — sequential await each speak()')

    for (const word of WORDS) {
      const start = performance.now()
      log('info', `  speak("${word}") called`)
      try {
        await manager.speak({ say: { en: word }, tone: 'tutorial-instruction' })
        const elapsed = (performance.now() - start).toFixed(0)
        log('success', `  speak("${word}") resolved (${elapsed}ms)`)
      } catch (err) {
        log('error', `  speak("${word}") rejected`, String(err))
        setStatus('fail')
        return
      }
    }

    setStatus('pass')
    log('success', 'All 5 sequential speaks completed')
  }, [manager, log])

  return (
    <TestCard
      title="Test 2: Rapid-Fire Overlap"
      description="What happens when speak() is called while a previous call is still playing?"
      status={status}
      entries={entries}
      onClear={clear}
    >
      <LabButton onClick={handleNoAwait}>Fire 5x (no await)</LabButton>
      <LabButton onClick={handleWithGaps}>Fire 5x (50ms gaps)</LabButton>
      <LabButton onClick={handleAwaited}>Fire 5x (awaited)</LabButton>
    </TestCard>
  )
}

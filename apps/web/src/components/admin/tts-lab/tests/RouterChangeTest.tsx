'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { useTTS } from '@/hooks/useTTS'
import type { TestStatus } from '../TestCard'
import type { LogEntry } from '../useTestLog'
import { css } from '../../../../../styled-system/css'
import { EventLog } from '../EventLog'
import {
  STRESS_PROBLEMS,
  readNavState,
  writeNavState,
  clearNavState,
  appendNavLog,
  describeSegments,
  type NavStressState,
} from '../stressProblems'

const STATUS_COLORS: Record<TestStatus, string> = {
  idle: '#484f58',
  running: '#58a6ff',
  pass: '#3fb950',
  fail: '#f85149',
}
const STATUS_LABELS: Record<TestStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  pass: 'Pass',
  fail: 'Fail',
}

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

export function RouterChangeTest() {
  const router = useRouter()
  const manager = useAudioManagerInstance()
  const [status, setStatus] = useState<TestStatus>('idle')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [steps, setSteps] = useState(8)
  const [interruptMs, setInterruptMs] = useState(150)
  const [isRunning, setIsRunning] = useState(false)
  const resumedRef = useRef(false)

  // Register the first problem with useTTS so the hook exercises the normal path
  const firstProblem = STRESS_PROBLEMS[0]
  const speak = useTTS(firstProblem, { tone: 'stress-test' })

  // On mount: detect return from completed stress circuit
  useEffect(() => {
    if (resumedRef.current) return
    resumedRef.current = true

    const state = readNavState()
    if (!state || !state.running) return

    // We're back from the circuit — show the full log
    const snapshot = manager.getSnapshot()
    const collection = manager.getCollection()

    let s = appendNavLog(state, 'info', '--- Returned to TTS Lab ---')
    s = appendNavLog(
      s,
      snapshot.isPlaying ? 'warn' : 'info',
      `Manager: playing=${snapshot.isPlaying} enabled=${snapshot.isEnabled} collection=${collection.length}`
    )

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const ss = window.speechSynthesis
      if (ss.speaking || ss.pending) {
        s = appendNavLog(
          s,
          'warn',
          `speechSynthesis leaked: speaking=${ss.speaking} pending=${ss.pending}`
        )
      }
    }

    // Final speak — does TTS still work after the whole gauntlet?
    const finalProblem =
      STRESS_PROBLEMS[state.totalSteps % STRESS_PROBLEMS.length] ?? STRESS_PROBLEMS[0]
    s = appendNavLog(
      s,
      'info',
      `Final speak: [${describeSegments(finalProblem)}] (${finalProblem.length} segs)`
    )

    const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1)
    s = appendNavLog(s, 'success', `Circuit completed: ${state.totalSteps} steps in ${elapsed}s`)
    s = { ...s, running: false }
    writeNavState(s)
    setEntries(s.log)
    setIsRunning(false)
    setStatus('pass')

    // Fire the final speak to prove TTS still works
    speak(finalProblem, { tone: 'stress-test' }).then(
      () => {
        const s2 = readNavState()
        if (s2) {
          const updated = appendNavLog(s2, 'success', 'Final speak() resolved — TTS survived!')
          setEntries(updated.log)
          writeNavState(updated)
        }
      },
      (err) => {
        const s2 = readNavState()
        if (s2) {
          const updated = appendNavLog(s2, 'error', 'Final speak() REJECTED', String(err))
          setEntries(updated.log)
          writeNavState(updated)
        }
        setStatus('fail')
      }
    )

    clearNavState()
  }, [manager, speak])

  const handleStart = useCallback(() => {
    const state: NavStressState = {
      running: true,
      currentStep: 0,
      totalSteps: steps,
      interruptDelayMs: interruptMs,
      startTime: Date.now(),
      log: [],
    }

    let s = appendNavLog(
      state,
      'info',
      `=== Navigation Stress: ${steps} steps, ${interruptMs}ms interrupt ===`
    )
    s = appendNavLog(s, 'info', `Collection: ${manager.getCollection().length} clips`)
    s = appendNavLog(
      s,
      'info',
      `Problems: ${STRESS_PROBLEMS.length} templates, ${STRESS_PROBLEMS.reduce((n, p) => n + p.length, 0)} total segments`
    )

    // Fire the first problem right here before navigating
    const problem = STRESS_PROBLEMS[0]
    s = appendNavLog(s, 'info', `--- Step 1/${steps} (origin) ---`)
    s = appendNavLog(s, 'info', `Speaking [${describeSegments(problem)}] (${problem.length} segs)`)

    writeNavState(s)
    setEntries(s.log)
    setIsRunning(true)
    setStatus('running')

    // Fire speak — don't await, navigate mid-playback
    speak().then(
      () => {},
      () => {}
    )

    // Navigate to first bounce step
    setTimeout(() => {
      const s2 = readNavState()
      if (!s2?.running) return
      const snap = manager.getSnapshot()
      const updated = appendNavLog(s2, 'info', `Navigating → bounce/1 (playing=${snap.isPlaying})`)
      writeNavState(updated)
      router.push('/admin/tts-lab/bounce/1')
    }, interruptMs)
  }, [steps, interruptMs, manager, speak, router])

  const handleStop = useCallback(() => {
    const state = readNavState()
    if (state) {
      const s = appendNavLog(state, 'warn', 'Test stopped by user')
      setEntries(s.log)
    }
    clearNavState()
    manager.stop()
    setIsRunning(false)
    setStatus('idle')
  }, [manager])

  const handleClear = useCallback(() => {
    setEntries([])
    clearNavState()
    setStatus('idle')
    setIsRunning(false)
  }, [])

  const inputCss = css({
    width: '55px',
    fontSize: '12px',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid #30363d',
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    textAlign: 'center',
  })

  const labelCss = css({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: '#8b949e',
  })

  return (
    <div
      data-component="TestCard"
      className={css({
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        })}
      >
        <div>
          <h3
            className={css({ fontSize: '14px', fontWeight: '600', color: '#f0f6fc', margin: '0' })}
          >
            Test 1: Navigation Stress
          </h3>
          <p className={css({ fontSize: '12px', color: '#8b949e', margin: '4px 0 0' })}>
            Fire multi-segment practice problems (novel + pregenerated), navigate mid-speech, repeat{' '}
            {steps}x
          </p>
        </div>
        <span
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: '600',
            padding: '2px 8px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
          })}
          style={{
            color: STATUS_COLORS[status],
            backgroundColor: STATUS_COLORS[status] + '20',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: STATUS_COLORS[status],
              display: 'inline-block',
            }}
          />
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Config */}
      <div
        className={css({ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' })}
      >
        <label className={labelCss}>
          Steps:
          <input
            type="number"
            min={6}
            max={12}
            value={steps}
            onChange={(e) => setSteps(Math.max(6, Math.min(12, Number(e.target.value))))}
            disabled={isRunning}
            className={inputCss}
          />
        </label>
        <label className={labelCss}>
          Interrupt:
          <input
            type="number"
            min={0}
            max={5000}
            step={50}
            value={interruptMs}
            onChange={(e) => setInterruptMs(Number(e.target.value))}
            disabled={isRunning}
            className={inputCss}
          />
          <span>ms</span>
        </label>
      </div>

      {/* Segment preview */}
      <div
        className={css({
          fontSize: '11px',
          color: '#484f58',
          fontFamily: 'monospace',
          lineHeight: '1.6',
        })}
      >
        {Array.from({ length: steps }, (_, i) => {
          const p = STRESS_PROBLEMS[i % STRESS_PROBLEMS.length]
          return (
            <div key={i}>
              {i + 1}. [{p.length} segs] {describeSegments(p).slice(0, 80)}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '8px' })}>
        <LabButton onClick={handleStart} disabled={isRunning}>
          Start
        </LabButton>
        <LabButton onClick={handleStop} disabled={!isRunning}>
          Stop
        </LabButton>
      </div>

      {/* Log */}
      <EventLog entries={entries} onClear={handleClear} />
    </div>
  )
}

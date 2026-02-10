'use client'

import { useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { useTTS } from '@/hooks/useTTS'
import {
  STRESS_PROBLEMS,
  readNavState,
  writeNavState,
  appendNavLog,
  describeSegments,
} from '@/components/admin/tts-lab/stressProblems'
import { css } from '../../../../../../styled-system/css'

export default function BounceStepPage() {
  const router = useRouter()
  const params = useParams()
  const step = parseInt(params.step as string, 10)
  const manager = useAudioManagerInstance()
  const ranRef = useRef(false)

  // Register this step's problem with useTTS — mirrors real practice components
  const problem = STRESS_PROBLEMS[step % STRESS_PROBLEMS.length]
  const speak = useTTS(problem, { tone: 'stress-test' })

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const state = readNavState()
    if (!state || !state.running) {
      router.replace('/admin/tts-lab')
      return
    }

    const snapshot = manager.getSnapshot()
    const collection = manager.getCollection()

    let s = appendNavLog(
      state,
      'info',
      `--- Step ${step + 1}/${state.totalSteps} ---`
    )
    s = appendNavLog(
      s,
      snapshot.isPlaying ? 'warn' : 'info',
      `Manager: playing=${snapshot.isPlaying} enabled=${snapshot.isEnabled} collection=${collection.length}`
    )

    // Check if browser speechSynthesis is still going from the previous page
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const ss = window.speechSynthesis
      if (ss.speaking || ss.pending) {
        s = appendNavLog(s, 'warn', `speechSynthesis leaked: speaking=${ss.speaking} pending=${ss.pending}`)
      }
    }

    s = appendNavLog(
      s,
      'info',
      `Speaking [${describeSegments(problem)}] (${problem.length} segs)`
    )
    s = { ...s, currentStep: step }
    writeNavState(s)

    // Fire speak — don't await, we'll navigate mid-playback
    const t0 = performance.now()
    speak().then(
      () => {
        const elapsed = (performance.now() - t0).toFixed(0)
        const s2 = readNavState()
        if (s2?.running) {
          writeNavState(appendNavLog(s2, 'info', `speak() resolved (${elapsed}ms)`))
        }
      },
      () => {}
    )

    // Navigate mid-speech
    const isLast = step + 1 >= state.totalSteps
    const dest = isLast ? '/admin/tts-lab' : `/admin/tts-lab/bounce/${step + 1}`

    const timeout = setTimeout(() => {
      const s2 = readNavState()
      if (!s2?.running) return

      const snap = manager.getSnapshot()
      const updated = appendNavLog(s2, 'info', `Navigating → ${dest} (playing=${snap.isPlaying})`)
      writeNavState(updated)
      router.push(dest)
    }, state.interruptDelayMs)

    return () => clearTimeout(timeout)
  }, [manager, speak, router, step, problem])

  const state = readNavState()

  return (
    <div
      className={css({
        backgroundColor: '#0d1117',
        color: '#8b949e',
        padding: '24px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
      })}
    >
      <div className={css({ color: '#f0f6fc', fontSize: '16px' })}>
        Step {step + 1} / {state?.totalSteps ?? '?'}
      </div>
      <div className={css({ fontSize: '11px', color: '#484f58', maxWidth: '400px', textAlign: 'center' })}>
        Speaking {problem.length} segments + navigating in {state?.interruptDelayMs ?? '?'}ms...
      </div>
    </div>
  )
}

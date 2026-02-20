'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'
import type { ImageGenerateOutput } from '@/lib/tasks/image-generate'
import type { PhiExploreGenerateOutput } from '@/lib/tasks/phi-explore-generate'
import {
  SUBDIVISIONS,
  RECT_RATIO,
} from '@/components/toys/number-line/constants/demos/goldenRatioDemo'

interface AlignmentConfig {
  scale: number
  rotation: number
  offsetX: number
  offsetY: number
}

const DEFAULT_ALIGNMENT: AlignmentConfig = { scale: 1, rotation: 0, offsetX: 0, offsetY: 0 }

type AlignmentData = Record<string, Record<string, AlignmentConfig>>

interface AlignmentKey {
  subjectId: string
  theme: 'light' | 'dark'
}

// Spiral convergence point from the innermost subdivision
const SPIRAL_CONVERGENCE = {
  x: SUBDIVISIONS[SUBDIVISIONS.length - 1].arcCx,
  y: SUBDIVISIONS[SUBDIVISIONS.length - 1].arcCy,
}

type PipelinePhase = 'base' | 'light' | 'dark'

interface ImageStyleStatus {
  exists: boolean
  sizeBytes?: number
  prompt: string
  lightExists: boolean
  darkExists: boolean
}

interface ConstantImageStatus {
  id: string
  name: string
  symbol: string
  metaphor: ImageStyleStatus
  math: ImageStyleStatus
}

interface PhiExploreImageStatus {
  id: string
  name: string
  prompt: string
  exists: boolean
  sizeBytes?: number
  lightExists: boolean
  darkExists: boolean
}

interface ProviderInfo {
  id: string
  name: string
  available: boolean
  models: Array<{ id: string; name: string }>
}

interface StatusResponse {
  constants: ConstantImageStatus[]
  providers: ProviderInfo[]
  phiExplore: PhiExploreImageStatus[]
}

/**
 * Admin page for generating constant illustration images.
 *
 * Shows all 11 math constants with their metaphor/math image slots,
 * allows selecting an AI provider/model, and triggers generation
 * as a background task with real-time progress.
 */
export default function ConstantImagesPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [provider, setProvider] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [pipelineQueue, setPipelineQueue] = useState<PipelinePhase[]>([])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())
  // REST-polled task state as fallback when socket is slow to connect
  const [polledTaskError, setPolledTaskError] = useState<string | null>(null)
  const [polledTaskStatus, setPolledTaskStatus] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ImageGenerateOutput | null>(null)
  // Phi explore state (independent task, pipeline runs server-side)
  const [phiTaskId, setPhiTaskId] = useState<string | null>(null)
  const [phiExpandedPrompts, setPhiExpandedPrompts] = useState<Set<string>>(new Set())
  const [phiPolledTaskError, setPhiPolledTaskError] = useState<string | null>(null)
  const [phiPolledTaskStatus, setPhiPolledTaskStatus] = useState<string | null>(null)
  const [phiLastResult, setPhiLastResult] = useState<PhiExploreGenerateOutput | null>(null)
  // Alignment editor state
  const [alignmentData, setAlignmentData] = useState<AlignmentData>({})
  const [aligningKey, setAligningKey] = useState<AlignmentKey | null>(null)

  const providerInitRef = useRef(false)
  const pipelineAdvancingRef = useRef(false)

  const { state: taskState, cancel: cancelTask } = useBackgroundTask<ImageGenerateOutput>(taskId)
  const { state: phiTaskState, cancel: cancelPhiTask } =
    useBackgroundTask<PhiExploreGenerateOutput>(phiTaskId)

  const isGenerating =
    taskState?.status === 'pending' ||
    taskState?.status === 'running' ||
    (!!taskId && !taskState && polledTaskStatus !== 'completed' && polledTaskStatus !== 'failed')

  const isPhiGenerating =
    phiTaskState?.status === 'pending' ||
    phiTaskState?.status === 'running' ||
    (!!phiTaskId &&
      !phiTaskState &&
      phiPolledTaskStatus !== 'completed' &&
      phiPolledTaskStatus !== 'failed')

  // REST polling fallback: when taskId is set but socket hasn't delivered state yet
  useEffect(() => {
    if (!taskId) {
      setPolledTaskError(null)
      setPolledTaskStatus(null)
      return
    }

    // Poll every 2s until we get a terminal state
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/tasks?taskId=${taskId}`)
        if (!res.ok) return
        const data = await res.json()
        const task = data.task
        if (!task) return

        setPolledTaskStatus(task.status)

        if (task.status === 'failed' && task.error) {
          setPolledTaskError(task.error)
        }
        if (task.status === 'completed' && task.output) {
          setLastResult(task.output as ImageGenerateOutput)
        }
      } catch {
        // Silently ignore poll errors
      }
    }

    poll()
    const interval = setInterval(poll, 2000)

    return () => clearInterval(interval)
  }, [taskId])

  // Sync task results from socket state
  useEffect(() => {
    if (taskState?.status === 'failed' && taskState.error) {
      setPolledTaskError(taskState.error)
      setPolledTaskStatus('failed')
    }
    if (taskState?.status === 'completed' && taskState.output) {
      setLastResult(taskState.output)
      setPolledTaskStatus('completed')
    }
  }, [taskState?.status, taskState?.error, taskState?.output])

  // Phi explore REST polling fallback
  useEffect(() => {
    if (!phiTaskId) {
      setPhiPolledTaskError(null)
      setPhiPolledTaskStatus(null)
      return
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/tasks?taskId=${phiTaskId}`)
        if (!res.ok) return
        const data = await res.json()
        const task = data.task
        if (!task) return

        setPhiPolledTaskStatus(task.status)
        if (task.status === 'failed' && task.error) {
          setPhiPolledTaskError(task.error)
        }
        if (task.status === 'completed' && task.output) {
          setPhiLastResult(task.output as PhiExploreGenerateOutput)
        }
      } catch {
        // Silently ignore poll errors
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [phiTaskId])

  // Sync phi task results from socket state
  useEffect(() => {
    if (phiTaskState?.status === 'failed' && phiTaskState.error) {
      setPhiPolledTaskError(phiTaskState.error)
      setPhiPolledTaskStatus('failed')
    }
    if (phiTaskState?.status === 'completed' && phiTaskState.output) {
      setPhiLastResult(phiTaskState.output)
      setPhiPolledTaskStatus('completed')
    }
  }, [phiTaskState?.status, phiTaskState?.error, phiTaskState?.output])

  // Effective error: from socket, REST poll, or local fetch error
  const effectiveError = error || taskState?.error || polledTaskError

  // Fetch status on mount and after task completes
  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, alignRes] = await Promise.all([
        fetch('/api/admin/constant-images/status'),
        fetch('/api/admin/constant-images/phi-explore/alignment'),
      ])
      if (!statusRes.ok) throw new Error(`Failed to fetch status: ${statusRes.status}`)
      const data: StatusResponse = await statusRes.json()
      setStatus(data)

      if (alignRes.ok) {
        const alignData = await alignRes.json()
        setAlignmentData(alignData)
      }

      // Auto-select first available provider/model (once)
      if (!providerInitRef.current) {
        const available = data.providers.find((p) => p.available)
        if (available) {
          setProvider(available.id)
          setModel(available.models[0]?.id ?? '')
        }
        providerInitRef.current = true
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Refresh image status after task reaches terminal state
  useEffect(() => {
    if (polledTaskStatus === 'completed' || polledTaskStatus === 'failed') {
      fetchStatus()
    }
  }, [polledTaskStatus, fetchStatus])

  // Refresh image status after phi task reaches terminal state
  useEffect(() => {
    if (phiPolledTaskStatus === 'completed' || phiPolledTaskStatus === 'failed') {
      fetchStatus()
    }
  }, [phiPolledTaskStatus, fetchStatus])

  // Derive per-variant stats
  const stats = useMemo(() => {
    if (!status) return { total: 0, base: 0, light: 0, dark: 0 }
    const total = status.constants.length * 2
    let base = 0,
      light = 0,
      dark = 0
    for (const c of status.constants) {
      if (c.metaphor.exists) base++
      if (c.math.exists) base++
      if (c.metaphor.lightExists) light++
      if (c.math.lightExists) light++
      if (c.metaphor.darkExists) dark++
      if (c.math.darkExists) dark++
    }
    return { total, base, light, dark }
  }, [status])

  // Phi explore stats
  const phiStats = useMemo(() => {
    if (!status?.phiExplore) return { total: 0, base: 0, light: 0, dark: 0 }
    const total = status.phiExplore.length
    let base = 0,
      light = 0,
      dark = 0
    for (const s of status.phiExplore) {
      if (s.exists) base++
      if (s.lightExists) light++
      if (s.darkExists) dark++
    }
    return { total, base, light, dark }
  }, [status])

  // Currently generating images (from task events)
  const generatingSet = useMemo(() => {
    const set = new Set<string>()
    if (!taskState || !isGenerating) return set
    for (const event of taskState.events) {
      if (event.eventType === 'image_started') {
        const p = event.payload as { constantId: string; style: string }
        set.add(`${p.constantId}-${p.style}`)
      }
      if (event.eventType === 'image_complete' || event.eventType === 'image_error') {
        const p = event.payload as { constantId: string; style: string }
        set.delete(`${p.constantId}-${p.style}`)
      }
    }
    return set
  }, [taskState, isGenerating])

  // Currently generating phi explore images (from task events)
  const phiGeneratingSet = useMemo(() => {
    const set = new Set<string>()
    if (!phiTaskState || !isPhiGenerating) return set
    for (const event of phiTaskState.events) {
      if (event.eventType === 'image_started') {
        const p = event.payload as { subjectId: string }
        set.add(p.subjectId)
      }
      if (event.eventType === 'image_complete' || event.eventType === 'image_error') {
        const p = event.payload as { subjectId: string }
        set.delete(p.subjectId)
      }
    }
    return set
  }, [phiTaskState, isPhiGenerating])

  const handleGenerate = useCallback(
    async (
      targets?: Array<{ constantId: string; style: 'metaphor' | 'math'; theme?: 'light' | 'dark' }>,
      forceRegenerate?: boolean,
      themeOverride?: 'light' | 'dark'
    ) => {
      setError(null)
      setPolledTaskError(null)
      setPolledTaskStatus(null)
      setLastResult(null)

      const themedTargets = targets
        ? targets.map((t) => ({ ...t, theme: t.theme ?? themeOverride }))
        : undefined

      try {
        const res = await fetch('/api/admin/constant-images/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            model,
            targets: themedTargets,
            forceRegenerate,
            ...(themeOverride && !themedTargets && { theme: themeOverride }),
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        setTaskId(data.taskId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start generation')
        // If pipeline is running and we hit an error, clear it
        setPipelineQueue([])
      }
    },
    [provider, model]
  )

  const handlePhiGenerate = useCallback(
    async (opts?: {
      targets?: Array<{ subjectId: string; theme?: 'light' | 'dark' }>
      forceRegenerate?: boolean
      theme?: 'light' | 'dark'
      pipeline?: boolean
    }) => {
      setError(null)
      setPhiPolledTaskError(null)
      setPhiPolledTaskStatus(null)
      setPhiLastResult(null)

      try {
        const res = await fetch('/api/admin/constant-images/phi-explore/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            model,
            targets: opts?.targets,
            forceRegenerate: opts?.forceRegenerate,
            theme: opts?.theme,
            pipeline: opts?.pipeline,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        setPhiTaskId(data.taskId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start phi explore generation')
      }
    },
    [provider, model]
  )

  // Pipeline advancement: when a task completes and there's more in the queue, advance
  useEffect(() => {
    if (pipelineQueue.length === 0) return
    if (polledTaskStatus !== 'completed') return
    if (pipelineAdvancingRef.current) return

    pipelineAdvancingRef.current = true

    // Brief delay to let status refresh complete
    const timer = setTimeout(() => {
      const [, ...remaining] = pipelineQueue
      setPipelineQueue(remaining)

      if (remaining.length > 0) {
        const nextTheme = remaining[0] === 'base' ? undefined : remaining[0]
        handleGenerate(undefined, false, nextTheme)
      }
      pipelineAdvancingRef.current = false
    }, 1000)

    return () => {
      clearTimeout(timer)
      pipelineAdvancingRef.current = false
    }
  }, [polledTaskStatus, pipelineQueue, handleGenerate])

  // Clear pipeline on task failure
  useEffect(() => {
    if (polledTaskStatus === 'failed' && pipelineQueue.length > 0) {
      setPipelineQueue([])
    }
  }, [polledTaskStatus, pipelineQueue])

  const handlePipelineGenerate = () => {
    const queue: PipelinePhase[] = ['base', 'light', 'dark']
    setPipelineQueue(queue)
    // Start with base (no theme override)
    handleGenerate(undefined, false, undefined)
  }

  const handleCancel = () => {
    setPipelineQueue([])
    cancelTask()
  }

  const handlePhiPipelineGenerate = () => {
    handlePhiGenerate({ pipeline: true })
  }

  const handlePhiCancel = () => {
    cancelPhiTask()
  }

  const togglePhiPrompt = (key: string) => {
    setPhiExpandedPrompts((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const togglePrompt = (key: string) => {
    setExpandedPrompts((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Provider/model change handler
  const handleProviderChange = (value: string) => {
    // value is "provider:model"
    const [p, m] = value.split(':')
    setProvider(p)
    setModel(m)
  }

  // Build provider options for dropdown
  const providerOptions = useMemo(() => {
    if (!status) return []
    return status.providers.flatMap((p) =>
      p.models.map((m) => ({
        value: `${p.id}:${m.id}`,
        label: `${p.name} — ${m.name}${!p.available ? ' (no key)' : ''}`,
        disabled: !p.available,
      }))
    )
  }, [status])

  const selectedValue = `${provider}:${model}`

  // Pipeline progress info
  const pipelinePhaseIndex = pipelineQueue.length > 0 ? 3 - pipelineQueue.length : -1
  const pipelinePhaseLabel =
    pipelineQueue[0] === 'base'
      ? 'base images'
      : pipelineQueue[0] === 'light'
        ? 'light variants'
        : pipelineQueue[0] === 'dark'
          ? 'dark variants'
          : ''

  const phiBaseMissing = phiStats.total - phiStats.base
  const phiLightMissing = phiStats.total - phiStats.light
  const phiDarkMissing = phiStats.total - phiStats.dark

  // Effective phi error
  const effectivePhiError = phiTaskState?.error || phiPolledTaskError

  const baseMissing = stats.total - stats.base

  return (
    <div
      data-component="constant-images-admin"
      className={css({
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
      })}
    >
      <AppNavBar />
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>

      <div
        className={css({
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px',
        })}
      >
        {/* Header */}
        <div className={css({ marginBottom: '24px' })}>
          <h1 className={css({ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' })}>
            Constant Illustrations
          </h1>
          <p className={css({ fontSize: '13px', color: '#8b949e' })}>
            Generate AI illustrations for math constants. Each constant has a metaphor and a math
            style image.
            {stats.total > 0 && (
              <>
                {' '}
                Base: {stats.base}/{stats.total}, Light: {stats.light}/{stats.total}, Dark:{' '}
                {stats.dark}/{stats.total}
              </>
            )}
          </p>
          <p className={css({ fontSize: '12px', color: '#d29922', marginTop: '8px' })}>
            Images are baked into the source code and deployed with the build. Generate locally,
            commit to git, then deploy. Do not regenerate on production.
          </p>
        </div>

        {/* Controls bar */}
        <div
          data-element="controls-bar"
          className={css({
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: '#161b22',
            borderRadius: '8px',
            border: '1px solid #30363d',
          })}
        >
          {/* Provider/model selector */}
          <select
            data-action="select-provider"
            value={selectedValue}
            onChange={(e) => handleProviderChange(e.target.value)}
            disabled={isGenerating}
            className={css({
              backgroundColor: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {providerOptions.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Generate All Pipeline button */}
          <button
            data-action="generate-all-pipeline"
            onClick={handlePipelineGenerate}
            disabled={isGenerating || !provider}
            className={css({
              fontSize: '13px',
              backgroundColor: '#8957e5',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 16px',
              cursor: 'pointer',
              fontWeight: '600',
              '&:hover': { backgroundColor: '#a371f7' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Generate All Pipeline
          </button>

          {/* Generate Missing (base only) */}
          <button
            data-action="generate-all-missing"
            onClick={() => handleGenerate()}
            disabled={isGenerating || baseMissing === 0 || !provider}
            className={css({
              fontSize: '13px',
              backgroundColor: '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 16px',
              cursor: 'pointer',
              fontWeight: '600',
              '&:hover': { backgroundColor: '#2ea043' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Generate {baseMissing} Missing
          </button>

          {/* Force regenerate all (base only) */}
          <button
            data-action="generate-all-force"
            onClick={() => handleGenerate(undefined, true)}
            disabled={isGenerating || !provider}
            className={css({
              fontSize: '13px',
              backgroundColor: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '6px 16px',
              cursor: 'pointer',
              fontWeight: '600',
              '&:hover': { backgroundColor: '#30363d' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Regenerate All
          </button>

          {/* Cancel button */}
          {isGenerating && (
            <button
              data-action="cancel-generation"
              onClick={handleCancel}
              className={css({
                fontSize: '13px',
                backgroundColor: '#da3633',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 16px',
                cursor: 'pointer',
                fontWeight: '600',
                '&:hover': { backgroundColor: '#f85149' },
              })}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Error banner */}
        {effectiveError && (
          <div
            data-element="error-banner"
            className={css({
              padding: '12px 16px',
              backgroundColor: '#f8514922',
              border: '1px solid #f85149',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#f85149',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            })}
          >
            {effectiveError}
          </div>
        )}

        {/* Task result summary (only show when pipeline is fully done) */}
        {lastResult && !isGenerating && pipelineQueue.length === 0 && (
          <div
            data-element="task-result"
            className={css({
              padding: '12px 16px',
              backgroundColor: lastResult.failed > 0 ? '#9e6a0322' : '#23863522',
              border: '1px solid',
              borderColor: lastResult.failed > 0 ? '#d29922' : '#3fb950',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13px',
            })}
          >
            <div>
              <span className={css({ fontWeight: '600' })}>Generation complete: </span>
              {lastResult.generated > 0 && (
                <span className={css({ color: '#3fb950' })}>{lastResult.generated} generated </span>
              )}
              {lastResult.skipped > 0 && (
                <span className={css({ color: '#8b949e' })}>{lastResult.skipped} skipped </span>
              )}
              {lastResult.failed > 0 && (
                <span className={css({ color: '#f85149' })}>{lastResult.failed} failed</span>
              )}
            </div>
            {/* Show per-image errors */}
            {lastResult.results
              ?.filter((r) => r.status === 'failed' && r.error)
              .map((r, i) => (
                <div
                  key={i}
                  className={css({
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#f8514911',
                    borderRadius: '4px',
                    border: '1px solid #f8514933',
                    color: '#f85149',
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  })}
                >
                  <span className={css({ fontWeight: '600', color: '#c9d1d9' })}>
                    {r.constantId} ({r.style}):{' '}
                  </span>
                  {r.error}
                </div>
              ))}
          </div>
        )}

        {/* Active task banner */}
        {isGenerating && (
          <div
            data-element="task-progress"
            className={css({
              padding: '16px',
              backgroundColor: '#161b22',
              border: '1px solid #1f6feb',
              borderRadius: '8px',
              marginBottom: '20px',
            })}
          >
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              })}
            >
              <span className={css({ fontSize: '13px', fontWeight: '600', color: '#58a6ff' })}>
                {pipelineQueue.length > 0
                  ? `Pipeline Step ${pipelinePhaseIndex + 1}/3 — Generating ${pipelinePhaseLabel}...`
                  : taskState
                    ? 'Generating images...'
                    : 'Starting generation...'}
              </span>
              <span className={css({ fontSize: '12px', color: '#8b949e' })}>
                {taskState?.progress ?? 0}%
              </span>
            </div>
            <div
              className={css({
                height: '6px',
                backgroundColor: '#30363d',
                borderRadius: '3px',
                overflow: 'hidden',
                marginBottom: '6px',
              })}
            >
              <div
                className={css({
                  height: '100%',
                  backgroundColor: pipelineQueue.length > 0 ? '#8957e5' : '#58a6ff',
                  borderRadius: '3px',
                  transition: 'width 0.3s',
                })}
                style={{ width: `${taskState?.progress ?? 0}%` }}
              />
            </div>
            {taskState?.progressMessage && (
              <p className={css({ fontSize: '12px', color: '#8b949e' })}>
                {taskState.progressMessage}
              </p>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className={css({ textAlign: 'center', padding: '48px', color: '#8b949e' })}>
            Loading...
          </div>
        )}

        {/* Constants grid */}
        {status && (
          <div
            data-element="constants-grid"
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '16px',
            })}
          >
            {status.constants.map((constant) => (
              <ConstantCard
                key={constant.id}
                constant={constant}
                isGenerating={isGenerating}
                generatingSet={generatingSet}
                expandedPrompts={expandedPrompts}
                onTogglePrompt={togglePrompt}
                onRegenerate={(constantId, style) => handleGenerate([{ constantId, style }], true)}
                provider={provider}
              />
            ))}
          </div>
        )}

        {/* ============================================================ */}
        {/* Phi Explore Section                                          */}
        {/* ============================================================ */}
        {status?.phiExplore && (
          <>
            {/* Phi explore header */}
            <div className={css({ marginTop: '48px', marginBottom: '24px' })}>
              <h2
                data-element="phi-explore-header"
                className={css({ fontSize: '20px', fontWeight: 'bold', marginBottom: '4px' })}
              >
                {'\u03C6'} Explore Images
              </h2>
              <p className={css({ fontSize: '13px', color: '#8b949e' })}>
                AI-generated images of natural phenomena exhibiting the golden spiral.
                {phiStats.total > 0 && (
                  <>
                    {' '}
                    Base: {phiStats.base}/{phiStats.total}, Light: {phiStats.light}/{phiStats.total}
                    , Dark: {phiStats.dark}/{phiStats.total}
                  </>
                )}
              </p>
            </div>

            {/* Phi explore controls */}
            <div
              data-element="phi-controls-bar"
              className={css({
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#161b22',
                borderRadius: '8px',
                border: '1px solid #30363d',
              })}
            >
              <button
                data-action="phi-generate-pipeline"
                onClick={handlePhiPipelineGenerate}
                disabled={isPhiGenerating || !provider}
                className={css({
                  fontSize: '13px',
                  backgroundColor: '#8957e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  '&:hover': { backgroundColor: '#a371f7' },
                  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                Generate Pipeline
              </button>

              <button
                data-action="phi-generate-missing"
                onClick={() => handlePhiGenerate({})}
                disabled={isPhiGenerating || phiBaseMissing === 0 || !provider}
                className={css({
                  fontSize: '13px',
                  backgroundColor: '#238636',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  '&:hover': { backgroundColor: '#2ea043' },
                  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                Generate {phiBaseMissing} Missing
              </button>

              <button
                data-action="phi-regenerate-all"
                onClick={() => handlePhiGenerate({ forceRegenerate: true })}
                disabled={isPhiGenerating || !provider}
                className={css({
                  fontSize: '13px',
                  backgroundColor: '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  '&:hover': { backgroundColor: '#30363d' },
                  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                Regenerate All
              </button>

              <button
                data-action="phi-generate-light"
                onClick={() => handlePhiGenerate({ theme: 'light' })}
                disabled={isPhiGenerating || phiLightMissing === 0 || !provider}
                className={css({
                  fontSize: '13px',
                  backgroundColor: '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  '&:hover': { backgroundColor: '#30363d' },
                  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                Light ({phiLightMissing})
              </button>

              <button
                data-action="phi-generate-dark"
                onClick={() => handlePhiGenerate({ theme: 'dark' })}
                disabled={isPhiGenerating || phiDarkMissing === 0 || !provider}
                className={css({
                  fontSize: '13px',
                  backgroundColor: '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '6px 16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  '&:hover': { backgroundColor: '#30363d' },
                  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                Dark ({phiDarkMissing})
              </button>

              {isPhiGenerating && (
                <button
                  data-action="phi-cancel"
                  onClick={handlePhiCancel}
                  className={css({
                    fontSize: '13px',
                    backgroundColor: '#da3633',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 16px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    '&:hover': { backgroundColor: '#f85149' },
                  })}
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Phi error banner */}
            {effectivePhiError && (
              <div
                data-element="phi-error-banner"
                className={css({
                  padding: '12px 16px',
                  backgroundColor: '#f8514922',
                  border: '1px solid #f85149',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  color: '#f85149',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                })}
              >
                {effectivePhiError}
              </div>
            )}

            {/* Phi task result summary */}
            {phiLastResult && !isPhiGenerating && (
              <div
                data-element="phi-task-result"
                className={css({
                  padding: '12px 16px',
                  backgroundColor: phiLastResult.failed > 0 ? '#9e6a0322' : '#23863522',
                  border: '1px solid',
                  borderColor: phiLastResult.failed > 0 ? '#d29922' : '#3fb950',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '13px',
                })}
              >
                <div>
                  <span className={css({ fontWeight: '600' })}>Generation complete: </span>
                  {phiLastResult.generated > 0 && (
                    <span className={css({ color: '#3fb950' })}>
                      {phiLastResult.generated} generated{' '}
                    </span>
                  )}
                  {phiLastResult.skipped > 0 && (
                    <span className={css({ color: '#8b949e' })}>
                      {phiLastResult.skipped} skipped{' '}
                    </span>
                  )}
                  {phiLastResult.failed > 0 && (
                    <span className={css({ color: '#f85149' })}>{phiLastResult.failed} failed</span>
                  )}
                </div>
                {phiLastResult.results
                  ?.filter((r) => r.status === 'failed' && r.error)
                  .map((r, i) => (
                    <div
                      key={i}
                      className={css({
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: '#f8514911',
                        borderRadius: '4px',
                        border: '1px solid #f8514933',
                        color: '#f85149',
                        fontSize: '12px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      })}
                    >
                      <span className={css({ fontWeight: '600', color: '#c9d1d9' })}>
                        {r.subjectId}:{' '}
                      </span>
                      {r.error}
                    </div>
                  ))}
              </div>
            )}

            {/* Phi task progress */}
            {isPhiGenerating && (
              <div
                data-element="phi-task-progress"
                className={css({
                  padding: '16px',
                  backgroundColor: '#161b22',
                  border: '1px solid #1f6feb',
                  borderRadius: '8px',
                  marginBottom: '20px',
                })}
              >
                <div
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  })}
                >
                  <span className={css({ fontSize: '13px', fontWeight: '600', color: '#58a6ff' })}>
                    {phiTaskState ? 'Generating phi explore images...' : 'Starting generation...'}
                  </span>
                  <span className={css({ fontSize: '12px', color: '#8b949e' })}>
                    {phiTaskState?.progress ?? 0}%
                  </span>
                </div>
                <div
                  className={css({
                    height: '6px',
                    backgroundColor: '#30363d',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginBottom: '6px',
                  })}
                >
                  <div
                    className={css({
                      height: '100%',
                      backgroundColor: '#58a6ff',
                      borderRadius: '3px',
                      transition: 'width 0.3s',
                    })}
                    style={{ width: `${phiTaskState?.progress ?? 0}%` }}
                  />
                </div>
                {phiTaskState?.progressMessage && (
                  <p className={css({ fontSize: '12px', color: '#8b949e' })}>
                    {phiTaskState.progressMessage}
                  </p>
                )}
              </div>
            )}

            {/* Phi explore grid */}
            <div
              data-element="phi-explore-grid"
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '16px',
              })}
            >
              {status.phiExplore.map((subject) => {
                const aligningTheme =
                  aligningKey?.subjectId === subject.id ? aligningKey.theme : null
                return (
                  <div key={subject.id}>
                    <PhiExploreCard
                      subject={subject}
                      isGenerating={isPhiGenerating}
                      isCurrentlyGenerating={phiGeneratingSet.has(subject.id)}
                      isExpanded={phiExpandedPrompts.has(subject.id)}
                      onTogglePrompt={() => togglePhiPrompt(subject.id)}
                      onRegenerate={() =>
                        handlePhiGenerate({
                          targets: [{ subjectId: subject.id }],
                          forceRegenerate: true,
                        })
                      }
                      provider={provider}
                      aligningTheme={aligningTheme}
                      onToggleAlign={(theme) =>
                        setAligningKey((prev) =>
                          prev?.subjectId === subject.id && prev.theme === theme
                            ? null
                            : { subjectId: subject.id, theme }
                        )
                      }
                    />
                    {aligningTheme && (
                      <PhiAlignmentEditor
                        key={`${subject.id}-${aligningTheme}`}
                        subjectId={subject.id}
                        theme={aligningTheme}
                        alignment={alignmentData[subject.id]?.[aligningTheme] ?? DEFAULT_ALIGNMENT}
                        onSave={(a) => {
                          setAlignmentData((prev) => ({
                            ...prev,
                            [subject.id]: { ...prev[subject.id], [aligningTheme]: a },
                          }))
                        }}
                        onClose={() => setAligningKey(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ConstantCard({
  constant,
  isGenerating,
  generatingSet,
  expandedPrompts,
  onTogglePrompt,
  onRegenerate,
  provider,
}: {
  constant: ConstantImageStatus
  isGenerating: boolean
  generatingSet: Set<string>
  expandedPrompts: Set<string>
  onTogglePrompt: (key: string) => void
  onRegenerate: (constantId: string, style: 'metaphor' | 'math') => void
  provider: string
}) {
  return (
    <div
      data-element="constant-card"
      data-constant-id={constant.id}
      className={css({
        backgroundColor: '#161b22',
        borderRadius: '8px',
        border: '1px solid #30363d',
        overflow: 'hidden',
      })}
    >
      {/* Card header */}
      <div
        className={css({
          padding: '12px 16px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        })}
      >
        <span className={css({ fontSize: '18px', fontWeight: 'bold', color: '#f0f6fc' })}>
          {constant.symbol}
        </span>
        <span className={css({ fontSize: '14px', color: '#c9d1d9' })}>{constant.name}</span>
        <div className={css({ marginLeft: 'auto', display: 'flex', gap: '4px', flexWrap: 'wrap' })}>
          {(['metaphor', 'math'] as const).map((style) => {
            const info = constant[style]
            const hasBase = info.exists
            const hasLight = info.lightExists
            const hasDark = info.darkExists
            if (!hasBase && !hasLight && !hasDark) return null
            return (
              <span
                key={style}
                className={css({
                  fontSize: '10px',
                  color: '#3fb950',
                  padding: '2px 6px',
                  backgroundColor: '#23863533',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                })}
              >
                {style}
                {hasLight && (
                  <span
                    data-element={`badge-${style}-light`}
                    title="Light variant"
                    className={css({
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#f0f6fc',
                      border: '1px solid #484f58',
                    })}
                  />
                )}
                {hasDark && (
                  <span
                    data-element={`badge-${style}-dark`}
                    title="Dark variant"
                    className={css({
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#21262d',
                      border: '1px solid #484f58',
                    })}
                  />
                )}
              </span>
            )
          })}
        </div>
      </div>

      {/* Image slots */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1px',
          backgroundColor: '#21262d',
        })}
      >
        <ImageSlot
          constant={constant}
          style="metaphor"
          info={constant.metaphor}
          isGenerating={isGenerating}
          isCurrentlyGenerating={generatingSet.has(`${constant.id}-metaphor`)}
          isExpanded={expandedPrompts.has(`${constant.id}-metaphor`)}
          onTogglePrompt={() => onTogglePrompt(`${constant.id}-metaphor`)}
          onRegenerate={() => onRegenerate(constant.id, 'metaphor')}
          provider={provider}
        />
        <ImageSlot
          constant={constant}
          style="math"
          info={constant.math}
          isGenerating={isGenerating}
          isCurrentlyGenerating={generatingSet.has(`${constant.id}-math`)}
          isExpanded={expandedPrompts.has(`${constant.id}-math`)}
          onTogglePrompt={() => onTogglePrompt(`${constant.id}-math`)}
          onRegenerate={() => onRegenerate(constant.id, 'math')}
          provider={provider}
        />
      </div>
    </div>
  )
}

function ImageSlot({
  constant,
  style,
  info,
  isGenerating,
  isCurrentlyGenerating,
  isExpanded,
  onTogglePrompt,
  onRegenerate,
  provider,
}: {
  constant: ConstantImageStatus
  style: 'metaphor' | 'math'
  info: ImageStyleStatus
  isGenerating: boolean
  isCurrentlyGenerating: boolean
  isExpanded: boolean
  onTogglePrompt: () => void
  onRegenerate: () => void
  provider: string
}) {
  const variants: Array<{ key: string; label: string; suffix: string; exists: boolean }> = [
    { key: 'base', label: 'base', suffix: '', exists: info.exists },
    { key: 'light', label: 'light', suffix: '-light', exists: info.lightExists },
    { key: 'dark', label: 'dark', suffix: '-dark', exists: info.darkExists },
  ]

  return (
    <div
      data-element="image-slot"
      data-style={style}
      className={css({
        backgroundColor: '#0d1117',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      })}
    >
      {/* Style label */}
      <div
        className={css({
          fontSize: '11px',
          fontWeight: '600',
          color: '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        })}
      >
        {style}
      </div>

      {/* Variant thumbnails row */}
      <div
        data-element="variant-thumbnails"
        className={css({
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
        })}
      >
        {variants.map((variant) => {
          const imagePath = `/images/constants/${constant.id}-${style}${variant.suffix}.png`
          return (
            <div key={variant.key} data-element={`variant-${variant.key}`}>
              <div
                className={css({
                  aspectRatio: '1',
                  backgroundColor: '#161b22',
                  borderRadius: '4px',
                  border: '1px solid #30363d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                })}
              >
                {isCurrentlyGenerating && variant.key === 'base' ? (
                  <div className={css({ textAlign: 'center', color: '#58a6ff' })}>
                    <div
                      className={css({
                        width: '16px',
                        height: '16px',
                        border: '2px solid #58a6ff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 4px',
                      })}
                    />
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  </div>
                ) : variant.exists ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`${imagePath}?t=${Date.now()}`}
                    alt={`${constant.name} ${style} (${variant.label})`}
                    className={css({
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    })}
                  />
                ) : (
                  <div className={css({ textAlign: 'center', color: '#484f58' })}>
                    <div className={css({ fontSize: '14px' })}>
                      {style === 'metaphor' ? '\u{1F3A8}' : '\u{1F4D0}'}
                    </div>
                  </div>
                )}
              </div>
              <div
                className={css({
                  fontSize: '9px',
                  color: variant.exists ? '#8b949e' : '#484f58',
                  textAlign: 'center',
                  marginTop: '2px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                })}
              >
                {variant.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* File info (base image size) */}
      {info.exists && info.sizeBytes && (
        <div className={css({ fontSize: '10px', color: '#484f58' })}>
          {(info.sizeBytes / 1024).toFixed(0)} KB
        </div>
      )}

      {/* Actions */}
      <div className={css({ display: 'flex', gap: '4px' })}>
        <button
          data-action={`regenerate-${constant.id}-${style}`}
          onClick={onRegenerate}
          disabled={isGenerating || !provider}
          className={css({
            flex: 1,
            fontSize: '11px',
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#30363d' },
            '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {info.exists ? 'Regenerate' : 'Generate'}
        </button>
        <button
          data-action={`toggle-prompt-${constant.id}-${style}`}
          onClick={onTogglePrompt}
          className={css({
            fontSize: '11px',
            backgroundColor: '#21262d',
            color: '#8b949e',
            border: '1px solid #30363d',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#30363d' },
          })}
        >
          Prompt
        </button>
      </div>

      {/* Expanded prompt */}
      {isExpanded && (
        <div
          className={css({
            fontSize: '11px',
            color: '#8b949e',
            backgroundColor: '#161b22',
            borderRadius: '4px',
            padding: '8px',
            lineHeight: '1.5',
            wordBreak: 'break-word',
            border: '1px solid #21262d',
          })}
        >
          {info.prompt}
        </div>
      )}
    </div>
  )
}

function PhiExploreCard({
  subject,
  isGenerating,
  isCurrentlyGenerating,
  isExpanded,
  onTogglePrompt,
  onRegenerate,
  provider,
  aligningTheme,
  onToggleAlign,
}: {
  subject: PhiExploreImageStatus
  isGenerating: boolean
  isCurrentlyGenerating: boolean
  isExpanded: boolean
  onTogglePrompt: () => void
  onRegenerate: () => void
  provider: string
  aligningTheme: 'light' | 'dark' | null
  onToggleAlign: (theme: 'light' | 'dark') => void
}) {
  const variants: Array<{ key: string; label: string; suffix: string; exists: boolean }> = [
    { key: 'base', label: 'base', suffix: '', exists: subject.exists },
    { key: 'light', label: 'light', suffix: '-light', exists: subject.lightExists },
    { key: 'dark', label: 'dark', suffix: '-dark', exists: subject.darkExists },
  ]

  return (
    <div
      data-element="phi-explore-card"
      data-subject-id={subject.id}
      className={css({
        backgroundColor: '#161b22',
        borderRadius: '8px',
        border: '1px solid #30363d',
        overflow: 'hidden',
      })}
    >
      {/* Card header */}
      <div
        className={css({
          padding: '12px 16px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        })}
      >
        <span className={css({ fontSize: '14px', fontWeight: 'bold', color: '#f0f6fc' })}>
          {subject.name}
        </span>
        <div className={css({ marginLeft: 'auto', display: 'flex', gap: '4px' })}>
          {subject.exists && (
            <span
              className={css({
                fontSize: '10px',
                color: '#3fb950',
                padding: '2px 6px',
                backgroundColor: '#23863533',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              })}
            >
              base
              {subject.lightExists && (
                <span
                  title="Light variant"
                  className={css({
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#f0f6fc',
                    border: '1px solid #484f58',
                  })}
                />
              )}
              {subject.darkExists && (
                <span
                  title="Dark variant"
                  className={css({
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#21262d',
                    border: '1px solid #484f58',
                  })}
                />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Thumbnails row */}
      <div
        className={css({
          padding: '12px',
          backgroundColor: '#0d1117',
        })}
      >
        <div
          data-element="phi-variant-thumbnails"
          className={css({
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '6px',
          })}
        >
          {variants.map((variant) => {
            const imagePath = `/images/constants/phi-explore/${subject.id}${variant.suffix}.png`
            return (
              <div key={variant.key} data-element={`variant-${variant.key}`}>
                <div
                  className={css({
                    aspectRatio: '1',
                    backgroundColor: '#161b22',
                    borderRadius: '4px',
                    border: '1px solid #30363d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                  })}
                >
                  {isCurrentlyGenerating && variant.key === 'base' ? (
                    <div className={css({ textAlign: 'center', color: '#58a6ff' })}>
                      <div
                        className={css({
                          width: '16px',
                          height: '16px',
                          border: '2px solid #58a6ff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 4px',
                        })}
                      />
                      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    </div>
                  ) : variant.exists ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`${imagePath}?t=${Date.now()}`}
                      alt={`${subject.name} (${variant.label})`}
                      className={css({
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      })}
                    />
                  ) : (
                    <div className={css({ textAlign: 'center', color: '#484f58' })}>
                      <div className={css({ fontSize: '14px' })}>{'\u{1F300}'}</div>
                    </div>
                  )}
                </div>
                <div
                  className={css({
                    fontSize: '9px',
                    color: variant.exists ? '#8b949e' : '#484f58',
                    textAlign: 'center',
                    marginTop: '2px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  })}
                >
                  {variant.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* File info */}
        {subject.exists && subject.sizeBytes && (
          <div className={css({ fontSize: '10px', color: '#484f58', marginTop: '8px' })}>
            {(subject.sizeBytes / 1024).toFixed(0)} KB
          </div>
        )}

        {/* Actions */}
        <div className={css({ display: 'flex', gap: '4px', marginTop: '8px' })}>
          <button
            data-action={`regenerate-phi-${subject.id}`}
            onClick={onRegenerate}
            disabled={isGenerating || !provider}
            className={css({
              flex: 1,
              fontSize: '11px',
              backgroundColor: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#30363d' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {subject.exists ? 'Regenerate' : 'Generate'}
          </button>
          <button
            data-action={`toggle-prompt-phi-${subject.id}`}
            onClick={onTogglePrompt}
            className={css({
              fontSize: '11px',
              backgroundColor: '#21262d',
              color: '#8b949e',
              border: '1px solid #30363d',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#30363d' },
            })}
          >
            Prompt
          </button>
          {subject.lightExists && (
            <button
              data-action={`align-phi-${subject.id}-light`}
              onClick={() => onToggleAlign('light')}
              className={css({
                fontSize: '11px',
                backgroundColor: aligningTheme === 'light' ? '#1f6feb' : '#21262d',
                color: aligningTheme === 'light' ? '#fff' : '#8b949e',
                border: '1px solid',
                borderColor: aligningTheme === 'light' ? '#1f6feb' : '#30363d',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                '&:hover': { backgroundColor: aligningTheme === 'light' ? '#388bfd' : '#30363d' },
              })}
            >
              Align L
            </button>
          )}
          {subject.darkExists && (
            <button
              data-action={`align-phi-${subject.id}-dark`}
              onClick={() => onToggleAlign('dark')}
              className={css({
                fontSize: '11px',
                backgroundColor: aligningTheme === 'dark' ? '#1f6feb' : '#21262d',
                color: aligningTheme === 'dark' ? '#fff' : '#8b949e',
                border: '1px solid',
                borderColor: aligningTheme === 'dark' ? '#1f6feb' : '#30363d',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                '&:hover': { backgroundColor: aligningTheme === 'dark' ? '#388bfd' : '#30363d' },
              })}
            >
              Align D
            </button>
          )}
        </div>

        {/* Expanded prompt */}
        {isExpanded && (
          <div
            className={css({
              fontSize: '11px',
              color: '#8b949e',
              backgroundColor: '#161b22',
              borderRadius: '4px',
              padding: '8px',
              lineHeight: '1.5',
              wordBreak: 'break-word',
              border: '1px solid #21262d',
              marginTop: '8px',
            })}
          >
            {subject.prompt}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Alignment Editor ---

const ARC_SWEEP = Math.PI / 2
const CANVAS_WIDTH = 600
const CANVAS_HEIGHT = Math.round(CANVAS_WIDTH / RECT_RATIO)

function PhiAlignmentEditor({
  subjectId,
  theme,
  alignment,
  onSave,
  onClose,
}: {
  subjectId: string
  theme: 'light' | 'dark'
  alignment: AlignmentConfig
  onSave: (alignment: AlignmentConfig) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<AlignmentConfig>(alignment)
  const [saveError, setSaveError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const imgLoadedRef = useRef(false)
  const lastSavedRef = useRef<string>(JSON.stringify(alignment))

  // Refs for mouse interaction (avoid re-renders during drag)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const layoutRef = useRef<{
    convCx: number
    convCy: number
    mapScale: number
    boxH: number
    spiralW: number
    ox: number
    oy: number
  } | null>(null)

  const dragRef = useRef<{
    mode: 'pan' | 'rotate'
    startClientX: number
    startClientY: number
    startOffsetX: number
    startOffsetY: number
    startRotation: number
    startAngle: number
    capturedScale: number
    capturedRotationRad: number
  } | null>(null)

  // Debounced auto-save: persist draft to server 500ms after last change
  useEffect(() => {
    const serialized = JSON.stringify(draft)
    if (serialized === lastSavedRef.current) return

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/constant-images/phi-explore/alignment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId, theme, alignment: draft }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        lastSavedRef.current = serialized
        setSaveError(null)
        onSave(draft)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Save failed')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [draft, subjectId, theme, onSave])

  // Load the themed image
  useEffect(() => {
    imgLoadedRef.current = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      imgLoadedRef.current = true
      redraw()
    }
    img.src = `/images/constants/phi-explore/${subjectId}-${theme}.png?t=${Date.now()}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, theme])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_WIDTH * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Map subdivision coords [0, RECT_RATIO] × [-1, 0] to canvas with padding
    const pad = 20
    const drawW = CANVAS_WIDTH - pad * 2
    const drawH = CANVAS_HEIGHT - pad * 2
    const mapScale = Math.min(drawW / RECT_RATIO, drawH / 1)
    const ox = pad + (drawW - RECT_RATIO * mapScale) / 2
    const oy = pad + (drawH - 1 * mapScale) / 2

    const toCanvasX = (x: number) => ox + x * mapScale
    const toCanvasY = (y: number) => oy + -y * mapScale

    // Spiral convergence point in canvas coords
    const convCx = toCanvasX(SPIRAL_CONVERGENCE.x)
    const convCy = toCanvasY(SPIRAL_CONVERGENCE.y)
    const boxH = 1 * mapScale
    const spiralW = RECT_RATIO * mapScale

    // Store layout for mouse handlers
    layoutRef.current = { convCx, convCy, mapScale, boxH, spiralW, ox, oy }

    // --- Draw image with transforms ---
    // Transform: rotate + scale around convergence point, then image at offset position
    if (imgRef.current && imgLoadedRef.current) {
      ctx.save()

      // Clip to golden rectangle area (with margin)
      ctx.beginPath()
      ctx.rect(ox - 2, oy - 2, spiralW + 4, boxH + 4)
      ctx.clip()

      // Rotate + scale around the convergence point
      ctx.translate(convCx, convCy)
      ctx.rotate((draft.rotation * Math.PI) / 180)
      ctx.scale(draft.scale, draft.scale)
      ctx.translate(-convCx, -convCy)

      // Draw image at its offset position
      const img = imgRef.current
      const imgAspect = img.naturalWidth / img.naturalHeight
      const boxAspect = spiralW / boxH
      let imgDrawW: number, imgDrawH: number
      if (imgAspect > boxAspect) {
        imgDrawH = boxH
        imgDrawW = boxH * imgAspect
      } else {
        imgDrawW = spiralW
        imgDrawH = spiralW / imgAspect
      }
      const imgCx = convCx + draft.offsetX * boxH
      const imgCy = convCy + draft.offsetY * boxH
      ctx.drawImage(img, imgCx - imgDrawW / 2, imgCy - imgDrawH / 2, imgDrawW, imgDrawH)
      ctx.restore()
    }

    // --- Draw spiral overlay ---
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)'
    ctx.lineWidth = 2
    for (const sub of SUBDIVISIONS) {
      const r = sub.side * mapScale
      if (r < 1) continue
      const cx = toCanvasX(sub.arcCx)
      const cy = toCanvasY(sub.arcCy)
      const startAngle = -sub.arcStartAngle
      const endAngle = -(sub.arcStartAngle + ARC_SWEEP)
      ctx.beginPath()
      ctx.arc(cx, cy, r, startAngle, endAngle, true)
      ctx.stroke()
    }

    // Bounding rectangle outline
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)'
    ctx.lineWidth = 1
    ctx.strokeRect(toCanvasX(0), toCanvasY(0), spiralW, boxH)

    // Convergence point crosshair
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
    ctx.lineWidth = 1.5
    const crossSize = 10
    ctx.beginPath()
    ctx.moveTo(convCx - crossSize, convCy)
    ctx.lineTo(convCx + crossSize, convCy)
    ctx.moveTo(convCx, convCy - crossSize)
    ctx.lineTo(convCx, convCy + crossSize)
    ctx.stroke()
    // Small circle at convergence
    ctx.beginPath()
    ctx.arc(convCx, convCy, 3, 0, Math.PI * 2)
    ctx.stroke()
  }, [draft])

  // Redraw on draft changes
  useEffect(() => {
    redraw()
  }, [redraw])

  // --- Mouse event handlers ---
  // Use a capture-phase window listener so clicks always work even when
  // other DOM elements (e.g. adjacent grid cells) overlap the canvas.

  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const isInCanvasArea =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      if (!isInCanvasArea) return

      e.preventDefault()

      const layout = layoutRef.current
      if (!layout) return

      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const d = draftRef.current

      if (e.altKey) {
        // Alt+click: position the clicked image point at the convergence point
        const { convCx, convCy, boxH } = layout
        const s = d.scale
        const r = (d.rotation * Math.PI) / 180
        const u = (cx - convCx) / s
        const v = (cy - convCy) / s
        const newOffsetXPx = d.offsetX * boxH - u * Math.cos(r) - v * Math.sin(r)
        const newOffsetYPx = d.offsetY * boxH + u * Math.sin(r) - v * Math.cos(r)
        setDraft((prev) => ({
          ...prev,
          offsetX: newOffsetXPx / boxH,
          offsetY: newOffsetYPx / boxH,
        }))
        return
      }

      const mode = e.shiftKey ? 'rotate' : 'pan'
      const startAngle = mode === 'rotate' ? Math.atan2(cy - layout.convCy, cx - layout.convCx) : 0

      dragRef.current = {
        mode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startOffsetX: d.offsetX,
        startOffsetY: d.offsetY,
        startRotation: d.rotation,
        startAngle,
        capturedScale: d.scale,
        capturedRotationRad: (d.rotation * Math.PI) / 180,
      }
    }
    // Capture phase ensures we see the event before any overlapping element
    window.addEventListener('mousedown', handleGlobalMouseDown, true)
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown, true)
  }, [])

  // Window-level move/up listeners for drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      const layout = layoutRef.current
      const canvas = canvasRef.current
      if (!drag || !layout || !canvas) return

      if (drag.mode === 'pan') {
        const dx = e.clientX - drag.startClientX
        const dy = e.clientY - drag.startClientY
        const { boxH } = layout
        const s = drag.capturedScale
        const r = drag.capturedRotationRad
        // Convert screen delta to offset delta (accounting for rotation+scale)
        const dox = (dx * Math.cos(r) + dy * Math.sin(r)) / (boxH * s)
        const doy = (-dx * Math.sin(r) + dy * Math.cos(r)) / (boxH * s)
        setDraft((prev) => ({
          ...prev,
          offsetX: drag.startOffsetX + dox,
          offsetY: drag.startOffsetY + doy,
        }))
      } else {
        const rect = canvas.getBoundingClientRect()
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        const currentAngle = Math.atan2(cy - layout.convCy, cx - layout.convCx)
        const delta = ((currentAngle - drag.startAngle) * 180) / Math.PI
        setDraft((prev) => ({
          ...prev,
          rotation: drag.startRotation + delta,
        }))
      }
    }

    const handleMouseUp = () => {
      dragRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Capture-phase wheel handler (same reason as mousedown — overlapping elements)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const isInCanvasArea =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      if (!isInCanvasArea) return

      e.preventDefault()
      const factor = e.deltaY > 0 ? 0.95 : 1.05
      setDraft((prev) => ({
        ...prev,
        scale: Math.max(0.1, Math.min(5, prev.scale * factor)),
      }))
    }
    window.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    return () => window.removeEventListener('wheel', handleWheel, true)
  }, [])

  const handleReset = () => {
    setDraft({ scale: 1, rotation: 0, offsetX: 0, offsetY: 0 })
  }

  const dirty = JSON.stringify(draft) !== lastSavedRef.current

  return (
    <div
      data-element="phi-alignment-editor"
      data-subject-id={subjectId}
      data-theme={theme}
      className={css({
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        padding: '16px',
      })}
    >
      {/* Interaction hints */}
      <div
        data-element="alignment-hints"
        className={css({
          fontSize: '11px',
          color: '#8b949e',
          marginBottom: '8px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        })}
      >
        <span>Drag: pan</span>
        <span>Scroll: scale</span>
        <span>Shift+drag: rotate</span>
        <span>Alt+click: set spiral center</span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, cursor: 'grab', touchAction: 'none' }}
        className={css({
          display: 'block',
          margin: '0 auto 12px',
          backgroundColor: '#0d1117',
          borderRadius: '4px',
          border: '1px solid #30363d',
        })}
        onDragStart={(e) => e.preventDefault()}
      />

      {/* Readout + status + buttons */}
      <div className={css({ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' })}>
        <span
          data-element="alignment-readout"
          className={css({
            fontSize: '11px',
            color: '#8b949e',
            fontFamily: 'monospace',
          })}
        >
          S:{draft.scale.toFixed(2)} R:{draft.rotation.toFixed(1)} X:{draft.offsetX.toFixed(2)} Y:
          {draft.offsetY.toFixed(2)}
        </span>
        {saveError && (
          <span
            data-element="save-error"
            className={css({
              fontSize: '11px',
              color: '#f85149',
              fontWeight: '600',
            })}
          >
            Save failed: {saveError}
          </span>
        )}
        {dirty && !saveError && (
          <span
            data-element="save-pending"
            className={css({
              fontSize: '11px',
              color: '#d29922',
            })}
          >
            Saving...
          </span>
        )}
        <div className={css({ marginLeft: 'auto', display: 'flex', gap: '8px' })}>
          <button
            data-action="reset-alignment"
            onClick={handleReset}
            className={css({
              fontSize: '12px',
              backgroundColor: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '6px 16px',
              cursor: 'pointer',
              fontWeight: '600',
              '&:hover': { backgroundColor: '#30363d' },
            })}
          >
            Reset
          </button>
          <button
            data-action="close-alignment"
            onClick={onClose}
            className={css({
              fontSize: '12px',
              backgroundColor: '#21262d',
              color: '#8b949e',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '6px 16px',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#30363d' },
            })}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

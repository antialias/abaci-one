'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'
import type { ImageGenerateOutput } from '@/lib/tasks/image-generate'

type ThemeMode = 'base' | 'light' | 'dark'

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

interface ProviderInfo {
  id: string
  name: string
  available: boolean
  models: Array<{ id: string; name: string }>
}

interface StatusResponse {
  constants: ConstantImageStatus[]
  providers: ProviderInfo[]
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
  const [themeMode, setThemeMode] = useState<ThemeMode>('base')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())
  // REST-polled task state as fallback when socket is slow to connect
  const [polledTaskError, setPolledTaskError] = useState<string | null>(null)
  const [polledTaskStatus, setPolledTaskStatus] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ImageGenerateOutput | null>(null)
  const providerInitRef = useRef(false)

  const { state: taskState, cancel } = useBackgroundTask<ImageGenerateOutput>(taskId)

  const isGenerating = taskState?.status === 'pending' || taskState?.status === 'running'
    || (!!taskId && !taskState && polledTaskStatus !== 'completed' && polledTaskStatus !== 'failed')

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

  // Effective error: from socket, REST poll, or local fetch error
  const effectiveError = error || taskState?.error || polledTaskError

  // Fetch status on mount and after task completes
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/constant-images/status')
      if (!res.ok) throw new Error(`Failed to fetch status: ${res.status}`)
      const data: StatusResponse = await res.json()
      setStatus(data)

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

  // Derive stats based on selected theme mode
  const stats = useMemo(() => {
    if (!status) return { total: 0, existing: 0, missing: 0 }
    const total = status.constants.length * 2
    const existing = status.constants.reduce((acc, c) => {
      const metaphorExists = themeMode === 'base' ? c.metaphor.exists
        : themeMode === 'light' ? c.metaphor.lightExists
        : c.metaphor.darkExists
      const mathExists = themeMode === 'base' ? c.math.exists
        : themeMode === 'light' ? c.math.lightExists
        : c.math.darkExists
      return acc + (metaphorExists ? 1 : 0) + (mathExists ? 1 : 0)
    }, 0)
    return { total, existing, missing: total - existing }
  }, [status, themeMode])

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

  const handleGenerate = async (
    targets?: Array<{ constantId: string; style: 'metaphor' | 'math'; theme?: 'light' | 'dark' }>,
    forceRegenerate?: boolean
  ) => {
    setError(null)
    setPolledTaskError(null)
    setPolledTaskStatus(null)
    setLastResult(null)
    // Apply theme from selector: for individual targets, set per-target; for "all", set top-level
    const activeTheme = themeMode !== 'base' ? themeMode : undefined
    const themedTargets = targets
      ? targets.map((t) => ({ ...t, theme: t.theme ?? activeTheme }))
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
          ...(activeTheme && !themedTargets && { theme: activeTheme }),
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
    }
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
            {stats.total > 0 && ` ${stats.existing}/${stats.total} images generated.`}
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

          {/* Theme mode selector */}
          <select
            data-action="select-theme"
            value={themeMode}
            onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
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
            <option value="base">Base images</option>
            <option value="light">Light theme</option>
            <option value="dark">Dark theme</option>
          </select>

          {/* Generate All Missing button */}
          <button
            data-action="generate-all-missing"
            onClick={() => handleGenerate()}
            disabled={isGenerating || stats.missing === 0 || !provider}
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
            Generate {stats.missing} Missing
          </button>

          {/* Force regenerate all */}
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
              onClick={cancel}
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

        {/* Task result summary */}
        {lastResult && !isGenerating && (
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
                {taskState ? 'Generating images...' : 'Starting generation...'}
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
                  backgroundColor: '#58a6ff',
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
                themeMode={themeMode}
                isGenerating={isGenerating}
                generatingSet={generatingSet}
                expandedPrompts={expandedPrompts}
                onTogglePrompt={togglePrompt}
                onRegenerate={(constantId, style) =>
                  handleGenerate([{ constantId, style }], true)
                }
                provider={provider}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ConstantCard({
  constant,
  themeMode,
  isGenerating,
  generatingSet,
  expandedPrompts,
  onTogglePrompt,
  onRegenerate,
  provider,
}: {
  constant: ConstantImageStatus
  themeMode: ThemeMode
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
                className={css({ fontSize: '10px', color: '#3fb950', padding: '2px 6px', backgroundColor: '#23863533', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '3px' })}
              >
                {style}
                {hasLight && (
                  <span data-element={`badge-${style}-light`} title="Light variant" className={css({ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f0f6fc', border: '1px solid #484f58' })} />
                )}
                {hasDark && (
                  <span data-element={`badge-${style}-dark`} title="Dark variant" className={css({ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#21262d', border: '1px solid #484f58' })} />
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
          themeMode={themeMode}
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
          themeMode={themeMode}
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
  themeMode,
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
  themeMode: ThemeMode
  isGenerating: boolean
  isCurrentlyGenerating: boolean
  isExpanded: boolean
  onTogglePrompt: () => void
  onRegenerate: () => void
  provider: string
}) {
  const themeSuffix = themeMode !== 'base' ? `-${themeMode}` : ''
  const imagePath = `/images/constants/${constant.id}-${style}${themeSuffix}.png`
  const imageExists = themeMode === 'base' ? info.exists
    : themeMode === 'light' ? info.lightExists
    : info.darkExists

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

      {/* Image area */}
      <div
        className={css({
          aspectRatio: '1',
          backgroundColor: '#161b22',
          borderRadius: '6px',
          border: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        })}
      >
        {isCurrentlyGenerating ? (
          <div className={css({ textAlign: 'center', color: '#58a6ff' })}>
            <div
              className={css({
                width: '24px',
                height: '24px',
                border: '2px solid #58a6ff',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 8px',
              })}
            />
            <span className={css({ fontSize: '11px' })}>Generating...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : imageExists ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`${imagePath}?t=${Date.now()}`}
            alt={`${constant.name} ${style}${themeMode !== 'base' ? ` (${themeMode})` : ''}`}
            className={css({
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            })}
          />
        ) : (
          <div className={css({ textAlign: 'center', color: '#484f58' })}>
            <div className={css({ fontSize: '24px', marginBottom: '4px' })}>
              {style === 'metaphor' ? '\u{1F3A8}' : '\u{1F4D0}'}
            </div>
            <span className={css({ fontSize: '11px' })}>Not generated</span>
          </div>
        )}
      </div>

      {/* File info (only shown for base images which have size data) */}
      {themeMode === 'base' && info.exists && info.sizeBytes && (
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
          {imageExists ? 'Regenerate' : 'Generate'}
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

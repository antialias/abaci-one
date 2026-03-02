'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'
import type { TaskState } from '@/hooks/useBackgroundTask'
import type {
  ProfileImageGenerateOutput,
  ProfileSize,
  ProfileTheme,
  ProfileState,
} from '@/lib/tasks/profile-image-generate'
import type {
  CharacterData,
  CharacterSummary,
  ModeData,
  PersonalityBlock,
  ToolData,
  ModeTransition,
  VoiceConfig,
} from '@/lib/character/characters'
import type { PromptBreakdown, PromptSection } from '@/lib/character/promptBreakdown'

// ── Styles ──────────────────────────────────────────────────────────

const pageStyle = css({
  minHeight: '100vh',
  backgroundColor: '#0d1117',
  color: '#c9d1d9',
  paddingTop: 'var(--app-nav-height)',
})

const containerStyle = css({
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '24px',
})

const headingStyle = css({
  fontSize: '24px',
  fontWeight: '600',
  color: '#f0f6fc',
  marginBottom: '24px',
})

const cardStyle = css({
  backgroundColor: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '6px',
  marginBottom: '16px',
  overflow: 'hidden',
})

const cardHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  cursor: 'pointer',
  '&:hover': { backgroundColor: '#1c2128' },
})

const cardContentStyle = css({
  padding: '16px',
  borderTop: '1px solid #30363d',
})

const labelStyle = css({
  fontSize: '12px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#8b949e',
  marginBottom: '4px',
})

const valueStyle = css({
  fontSize: '14px',
  color: '#c9d1d9',
})

const preStyle = css({
  fontSize: '12px',
  lineHeight: '1.5',
  color: '#c9d1d9',
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '4px',
  padding: '12px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: '400px',
  overflowY: 'auto',
  fontFamily: 'monospace',
})

const badgeStyle = (color: string) =>
  css({
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: color,
    color: '#f0f6fc',
    marginRight: '4px',
  })

const buttonStyle = css({
  padding: '6px 12px',
  fontSize: '13px',
  fontWeight: '500',
  borderRadius: '6px',
  border: '1px solid #30363d',
  backgroundColor: '#21262d',
  color: '#c9d1d9',
  cursor: 'pointer',
  '&:hover': { backgroundColor: '#30363d' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
})

const primaryButtonStyle = css({
  padding: '6px 12px',
  fontSize: '13px',
  fontWeight: '500',
  borderRadius: '6px',
  border: '1px solid #238636',
  backgroundColor: '#238636',
  color: '#ffffff',
  cursor: 'pointer',
  '&:hover': { backgroundColor: '#2ea043' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
})

const textareaStyle = css({
  width: '100%',
  minHeight: '120px',
  fontSize: '12px',
  lineHeight: '1.5',
  fontFamily: 'monospace',
  color: '#c9d1d9',
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '4px',
  padding: '12px',
  resize: 'vertical',
  '&:focus': { borderColor: '#58a6ff', outline: 'none' },
})

const inputStyle = css({
  width: '100%',
  fontSize: '13px',
  color: '#c9d1d9',
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '4px',
  padding: '6px 8px',
  '&:focus': { borderColor: '#58a6ff', outline: 'none' },
})

const selectStyle = css({
  fontSize: '13px',
  color: '#c9d1d9',
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '4px',
  padding: '4px 8px',
  '&:focus': { borderColor: '#58a6ff', outline: 'none' },
})

const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '16px',
  marginBottom: '24px',
})

const characterCardStyle = css({
  backgroundColor: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '8px',
  padding: '16px',
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'border-color 0.15s',
  '&:hover': { borderColor: '#58a6ff' },
})

// ── Layer colors ────────────────────────────────────────────────────

const LAYER_COLORS: Record<string, string> = {
  'core-personality': '#1f6feb',
  'voice-greeting': '#238636',
  'voice-conversing': '#238636',
  'voice-thinking': '#238636',
  'text-chat': '#8957e5',
  'dynamic-context': '#da3633',
}

function getLayerColor(layerId: string): string {
  return LAYER_COLORS[layerId] ?? '#484f58'
}

// ── Components ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cardStyle} data-component="collapsible-section">
      <div className={cardHeaderStyle} onClick={() => setOpen(!open)} data-action="toggle-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>{title}</span>
          {badge && <span className={badgeStyle('#30363d')}>{badge}</span>}
        </div>
        <span style={{ color: '#8b949e', fontSize: 12 }}>{open ? '▼' : '▶'}</span>
      </div>
      {open && <div className={cardContentStyle}>{children}</div>}
    </div>
  )
}

function TokenBar({ breakdown }: { breakdown: PromptBreakdown }) {
  const { tokensByLayer, totalTokens } = breakdown
  if (totalTokens === 0) return null

  return (
    <div style={{ marginBottom: 12 }}>
      <div className={labelStyle}>Token Budget (~{totalTokens.toLocaleString()} tokens)</div>
      <div
        style={{
          display: 'flex',
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: '#21262d',
        }}
      >
        {Object.entries(tokensByLayer).map(([layerId, tokens]) => (
          <div
            key={layerId}
            style={{
              width: `${(tokens / totalTokens) * 100}%`,
              backgroundColor: getLayerColor(layerId),
              minWidth: 2,
            }}
            title={`${layerId}: ~${tokens} tokens`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {Object.entries(tokensByLayer).map(([layerId, tokens]) => (
          <span
            key={layerId}
            style={{
              fontSize: 11,
              color: '#8b949e',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: getLayerColor(layerId),
                display: 'inline-block',
              }}
            />
            {layerId} (~{tokens})
          </span>
        ))}
      </div>
    </div>
  )
}

function PromptBreakdownView({ breakdown }: { breakdown: PromptBreakdown }) {
  return (
    <div>
      <TokenBar breakdown={breakdown} />
      {breakdown.sections.map((section, i) => (
        <PromptSectionView key={i} section={section} />
      ))}
    </div>
  )
}

function PromptSectionView({ section }: { section: PromptSection }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        borderLeft: `3px solid ${getLayerColor(section.layerId)}`,
        paddingLeft: 12,
        marginBottom: 8,
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={badgeStyle(getLayerColor(section.layerId))}>{section.layerLabel}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f6fc' }}>{section.label}</span>
        <span style={{ fontSize: 11, color: '#8b949e' }}>~{section.tokenEstimate} tokens</span>
        {section.sourceExport && (
          <span style={{ fontSize: 11, color: '#484f58' }}>{section.sourceExport}</span>
        )}
        <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 'auto' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>
      {expanded && (
        <div style={{ marginTop: 8 }}>
          <pre className={preStyle}>{section.text}</pre>
          <div style={{ fontSize: 11, color: '#484f58', marginTop: 4 }}>{section.sourceFile}</div>
        </div>
      )}
    </div>
  )
}

function ModeFlowDiagram({ transitions }: { transitions: ModeTransition[] }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        backgroundColor: '#0d1117',
        borderRadius: 6,
        overflowX: 'auto',
        marginBottom: 16,
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      {transitions.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {i === 0 && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                backgroundColor: '#238636',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              {t.from}
            </span>
          )}
          <span style={{ color: '#8b949e' }}>—{t.trigger}→</span>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 4,
              backgroundColor: '#1f6feb',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {t.to}
          </span>
        </div>
      ))}
    </div>
  )
}

function ToolCard({ tool }: { tool: ToolData }) {
  const [showSchema, setShowSchema] = useState(false)

  return (
    <div className={cardStyle}>
      <div className={cardHeaderStyle} onClick={() => setShowSchema(!showSchema)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', fontFamily: 'monospace' }}
          >
            {tool.name}
          </span>
          {tool.modes.map((m) => (
            <span key={m} className={badgeStyle('#1f6feb')}>
              {m}
            </span>
          ))}
          <span className={badgeStyle(tool.promptResponse ? '#238636' : '#da3633')}>
            {tool.promptResponse ? 'prompts response' : 'no response'}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#8b949e' }}>{showSchema ? '▼' : '▶'}</span>
      </div>
      {showSchema && (
        <div className={cardContentStyle}>
          <p style={{ fontSize: 13, color: '#c9d1d9', marginBottom: 8 }}>{tool.description}</p>
          <div className={labelStyle}>Behavior</div>
          <p className={valueStyle} style={{ marginBottom: 8 }}>
            {tool.behavior}
          </p>
          <div className={labelStyle}>Parameters</div>
          <pre className={preStyle}>{JSON.stringify(tool.parameters, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function ModeCard({ mode }: { mode: ModeData }) {
  const [showPrompt, setShowPrompt] = useState(false)

  return (
    <CollapsibleSection title={mode.label} badge={mode.api ?? `${mode.tools.length} tools`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
        <div>
          <div className={labelStyle}>Trigger</div>
          <div className={valueStyle}>{mode.trigger}</div>
        </div>
        <div>
          <div className={labelStyle}>Exit</div>
          <div className={valueStyle}>{mode.exit}</div>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div className={labelStyle}>Tools</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {mode.tools.length > 0 ? (
            mode.tools.map((t) => (
              <span key={t} className={badgeStyle('#1f6feb')}>
                {t}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 12, color: '#484f58' }}>None</span>
          )}
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div className={labelStyle}>Source</div>
        <div style={{ fontSize: 12, color: '#484f58', fontFamily: 'monospace' }}>
          {mode.sourceFile}
        </div>
      </div>

      <PromptBreakdownView breakdown={mode.promptBreakdown} />

      <button
        className={buttonStyle}
        onClick={() => setShowPrompt(!showPrompt)}
        style={{ marginTop: 8 }}
      >
        {showPrompt ? 'Hide Full Prompt' : 'View Full Prompt'}
      </button>
      {showPrompt && (
        <pre className={preStyle} style={{ marginTop: 8 }}>
          {mode.prompt}
        </pre>
      )}
    </CollapsibleSection>
  )
}

/** Unique key for a size+theme+state combination. */
function variantKey(size: ProfileSize, theme: ProfileTheme, state: ProfileState = 'idle'): string {
  return `${size}:${theme}:${state}`
}

/** Human-readable label for a variant. */
function variantLabel(
  size: ProfileSize,
  theme: ProfileTheme,
  state: ProfileState = 'idle'
): string {
  if (size === 'default' && theme === 'default' && state === 'idle') return 'Base'
  const parts: string[] = []
  if (size !== 'default') parts.push(size === 'sm' ? 'Small' : 'Large')
  if (state !== 'idle') parts.push(state.charAt(0).toUpperCase() + state.slice(1))
  if (theme !== 'default') parts.push(theme.charAt(0).toUpperCase() + theme.slice(1))
  return parts.join(' ')
}

/** Background color for a variant cell based on theme. */
function variantBgColor(theme: ProfileTheme): string | undefined {
  if (theme === 'dark') return '#0d1117'
  if (theme === 'light') return '#f0f6fc'
  return undefined
}

const SIZE_LABELS: ProfileSize[] = ['default', 'sm', 'lg']
const THEME_LABELS: ProfileTheme[] = ['default', 'light', 'dark']
const SIZE_DISPLAY: Record<ProfileSize, string> = { default: 'Default', sm: 'Small', lg: 'Large' }
const THEME_DISPLAY: Record<ProfileTheme, string> = {
  default: 'Default',
  light: 'Light',
  dark: 'Dark',
}

/** Zero-render component that subscribes to a single task and reports state changes. */
function TaskTracker({
  taskId,
  onStateChange,
}: {
  taskId: string
  onStateChange: (taskId: string, state: TaskState<ProfileImageGenerateOutput>) => void
}) {
  const { state } = useBackgroundTask<ProfileImageGenerateOutput>(taskId)
  useEffect(() => {
    if (state) onStateChange(taskId, state)
  }, [taskId, state, onStateChange])
  return null
}

function IdentityCard({
  data,
  onSave,
  saving,
}: {
  data: CharacterData
  onSave: (field: string, value: Record<string, string> | string) => void
  saving: boolean
}) {
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [profilePrompt, setProfilePrompt] = useState(data.identity.profilePrompt)
  const [genProvider, setGenProvider] = useState('gemini')
  const [genModel, setGenModel] = useState('')

  // Tab state for idle vs speaking grid view
  const [viewState, setViewState] = useState<ProfileState>('idle')

  // Map of variantKey → { taskId, size, theme, state }
  const [trackedTasks, setTrackedTasks] = useState<
    Map<string, { taskId: string; size: ProfileSize; theme: ProfileTheme; state: ProfileState }>
  >(new Map())
  // Map of taskId → TaskState
  const [taskStates, setTaskStates] = useState<Map<string, TaskState<ProfileImageGenerateOutput>>>(
    new Map()
  )
  // Cache bust counter — increments when any task completes
  const [imageCacheBust, setImageCacheBust] = useState(0)

  const resolvedModel =
    genModel || (genProvider === 'gemini' ? 'gemini-3-pro-image-preview' : 'gpt-image-1')

  const fireGenerate = useCallback(
    async (opts: {
      size: ProfileSize
      theme: ProfileTheme
      state?: ProfileState
      cascade: boolean
    }): Promise<string | null> => {
      try {
        const res = await fetch(`/api/admin/characters/${data.identity.id}/profile/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: genProvider,
            model: resolvedModel,
            size: opts.size,
            theme: opts.theme,
            state: opts.state ?? 'idle',
            cascade: opts.cascade,
            forceRegenerate: true,
          }),
        })
        const result = await res.json()
        if (result.error) return null
        return result.taskId as string
      } catch {
        return null
      }
    },
    [data.identity.id, genProvider, resolvedModel]
  )

  // Handle state changes from TaskTracker instances
  const handleTaskStateChange = useCallback(
    (taskId: string, state: TaskState<ProfileImageGenerateOutput>) => {
      setTaskStates((prev) => {
        const next = new Map(prev)
        next.set(taskId, state)
        return next
      })

      // Discover child tasks from events
      for (const event of state.events) {
        const payload = event.payload as Record<string, unknown> | undefined
        if (payload && payload.type === 'children_started') {
          const children = payload.children as Array<{
            taskId: string
            size: ProfileSize
            theme: ProfileTheme
            state: ProfileState
          }>
          setTrackedTasks((prev) => {
            const next = new Map(prev)
            for (const child of children) {
              const key = variantKey(child.size, child.theme, child.state)
              if (!next.has(key)) {
                next.set(key, child)
              }
            }
            return next
          })
        }
      }

      // Bump cache bust when any task completes
      if (state.status === 'completed') {
        setImageCacheBust((n) => n + 1)
      }
    },
    []
  )

  // "Generate All" — fires base idle with cascade=true, cascades to all 18
  const handleGenerateAll = useCallback(async () => {
    setTrackedTasks(new Map())
    setTaskStates(new Map())
    const taskId = await fireGenerate({
      size: 'default',
      theme: 'default',
      state: 'idle',
      cascade: true,
    })
    if (taskId) {
      const key = variantKey('default', 'default', 'idle')
      setTrackedTasks(
        new Map([[key, { taskId, size: 'default', theme: 'default', state: 'idle' }]])
      )
    }
  }, [fireGenerate])

  // Regenerate a single variant (no cascade)
  const handleRegenerateSingle = useCallback(
    async (size: ProfileSize, theme: ProfileTheme, state: ProfileState = 'idle') => {
      const taskId = await fireGenerate({ size, theme, state, cascade: false })
      if (taskId) {
        const key = variantKey(size, theme, state)
        setTrackedTasks((prev) => new Map(prev).set(key, { taskId, size, theme, state }))
      }
    },
    [fireGenerate]
  )

  // Compute aggregate status
  const isGenerating = [...taskStates.values()].some((s) => s.status === 'running')
  const completedCount = [...taskStates.values()].filter((s) => s.status === 'completed').length
  const failedCount = [...taskStates.values()].filter((s) => s.status === 'failed').length
  const totalTracked = trackedTasks.size

  // Get task state for a specific variant
  const getVariantTaskState = (size: ProfileSize, theme: ProfileTheme, state: ProfileState) => {
    const key = variantKey(size, theme, state)
    const tracked = trackedTasks.get(key)
    if (!tracked) return null
    return taskStates.get(tracked.taskId) ?? null
  }

  // Variant status indicator
  const getStatusIndicator = (size: ProfileSize, theme: ProfileTheme, state: ProfileState) => {
    const taskState = getVariantTaskState(size, theme, state)
    if (!taskState) return null
    if (taskState.status === 'running')
      return { symbol: '\u25cb', color: '#58a6ff', label: 'Generating...' }
    if (taskState.status === 'completed')
      return { symbol: '\u2713', color: '#3fb950', label: 'Done' }
    if (taskState.status === 'failed')
      return { symbol: '\u2717', color: '#f85149', label: taskState.error ?? 'Failed' }
    return { symbol: '\u2026', color: '#8b949e', label: 'Pending' }
  }

  // Build variant paths from character data
  const getVariantPath = (
    size: ProfileSize,
    theme: ProfileTheme,
    state: ProfileState = 'idle'
  ): string => {
    const found = data.identity.profileVariants?.find(
      (v) => v.size === size && v.theme === theme && v.state === state
    )
    return found?.path ?? data.identity.profileImage
  }

  return (
    <CollapsibleSection title="Identity" defaultOpen>
      {/* Zero-render TaskTracker instances for all discovered tasks */}
      {[...trackedTasks.values()].map(({ taskId }) => (
        <TaskTracker key={taskId} taskId={taskId} onStateChange={handleTaskStateChange} />
      ))}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          {/* Idle / Speaking tab toggle */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 8 }}>
            {(['idle', 'speaking'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setViewState(s)}
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid #30363d',
                  borderRadius: s === 'idle' ? '4px 0 0 4px' : '0 4px 4px 0',
                  backgroundColor: viewState === s ? '#238636' : '#21262d',
                  color: viewState === s ? '#fff' : '#8b949e',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          {/* 3×3 variant grid (filtered by viewState) */}
          <div>
            {/* Column headers */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 4, paddingLeft: 44 }}>
              {THEME_LABELS.map((theme) => (
                <div
                  key={theme}
                  style={{
                    width: 64,
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#8b949e',
                    textTransform: 'uppercase',
                  }}
                >
                  {THEME_DISPLAY[theme]}
                </div>
              ))}
            </div>
            {/* Rows */}
            {SIZE_LABELS.map((size) => (
              <div
                key={size}
                style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}
              >
                {/* Row label */}
                <div
                  style={{
                    width: 40,
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#8b949e',
                    textTransform: 'uppercase',
                    textAlign: 'right',
                    paddingRight: 4,
                  }}
                >
                  {SIZE_DISPLAY[size]}
                </div>
                {/* Cells */}
                {THEME_LABELS.map((theme) => {
                  const status = getStatusIndicator(size, theme, viewState)
                  return (
                    <div key={`${size}:${theme}:${viewState}`} style={{ position: 'relative' }}>
                      <VariantThumbnail
                        src={getVariantPath(size, theme, viewState)}
                        alt={`${data.identity.displayName} (${variantLabel(size, theme, viewState)})`}
                        label=""
                        bgColor={variantBgColor(theme)}
                        cacheBust={imageCacheBust}
                        size={64}
                      />
                      {/* Status overlay */}
                      {status && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            backgroundColor: '#161b22',
                            border: `1.5px solid ${status.color}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9,
                            fontWeight: 700,
                            color: status.color,
                          }}
                          title={status.label}
                        >
                          {status.symbol}
                        </div>
                      )}
                      {/* Regenerate overlay button */}
                      <button
                        onClick={() => handleRegenerateSingle(size, theme, viewState)}
                        disabled={isGenerating}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: '#21262d',
                          border: '1px solid #30363d',
                          color: '#8b949e',
                          fontSize: 10,
                          cursor: isGenerating ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          opacity: isGenerating ? 0.5 : 1,
                        }}
                        title={`Regenerate ${variantLabel(size, theme, viewState)}`}
                      >
                        &#x21bb;
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#f0f6fc' }}>
            {data.identity.displayName}
          </div>
          {data.identity.nativeDisplayName && (
            <div style={{ fontSize: 16, color: '#8b949e', marginTop: 2 }}>
              {data.identity.nativeDisplayName}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <span className={badgeStyle('#1f6feb')}>{data.identity.type}</span>
          </div>

          {/* Profile Image Prompt */}
          <div style={{ marginTop: 16 }}>
            <div className={labelStyle}>Profile Image Prompt</div>
            {editingPrompt ? (
              <div>
                <textarea
                  className={textareaStyle}
                  value={profilePrompt}
                  onChange={(e) => setProfilePrompt(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    className={primaryButtonStyle}
                    disabled={saving}
                    onClick={() => {
                      onSave('profilePrompt', profilePrompt)
                      setEditingPrompt(false)
                    }}
                  >
                    Save
                  </button>
                  <button className={buttonStyle} onClick={() => setEditingPrompt(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.5 }}>
                  {data.identity.profilePrompt}
                </p>
                <button
                  className={buttonStyle}
                  onClick={() => setEditingPrompt(true)}
                  style={{ marginTop: 8 }}
                >
                  Edit Prompt
                </button>
              </div>
            )}
          </div>

          {/* Generation controls */}
          <div style={{ marginTop: 16 }}>
            <div className={labelStyle}>Generate Profile Image</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select
                className={selectStyle}
                value={genProvider}
                onChange={(e) => setGenProvider(e.target.value)}
                disabled={isGenerating}
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
              <input
                className={inputStyle}
                style={{ width: 220 }}
                placeholder={resolvedModel}
                value={genModel}
                onChange={(e) => setGenModel(e.target.value)}
                disabled={isGenerating}
              />

              {/* Generate All (cascade) button */}
              <button
                className={primaryButtonStyle}
                onClick={handleGenerateAll}
                disabled={isGenerating}
                data-action="generate-all-pipeline"
              >
                Generate All (18 variants)
              </button>
            </div>

            {/* Progress summary */}
            {totalTracked > 0 && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  backgroundColor: '#0d1117',
                  border: '1px solid #30363d',
                  fontSize: 12,
                }}
              >
                {isGenerating ? (
                  <span style={{ color: '#8957e5' }}>
                    Generating {completedCount}/{totalTracked}...
                    {failedCount > 0 && (
                      <span style={{ color: '#f85149', marginLeft: 8 }}>
                        ({failedCount} failed)
                      </span>
                    )}
                  </span>
                ) : (
                  <span
                    style={{
                      color: failedCount > 0 ? '#f85149' : '#3fb950',
                    }}
                  >
                    {completedCount}/{totalTracked} completed
                    {failedCount > 0 && ` (${failedCount} failed)`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}

/** Thumbnail that shows the image at full opacity, or a placeholder if it fails to load. */
function VariantThumbnail({
  src,
  alt,
  label,
  bgColor,
  cacheBust,
  size = 80,
}: {
  src: string
  alt: string
  label: string
  bgColor?: string
  cacheBust?: number
  size?: number
}) {
  const [failed, setFailed] = useState(false)

  // Reset failed state when cacheBust changes (new image was generated)
  useEffect(() => {
    if (cacheBust) setFailed(false)
  }, [cacheBust])

  const imgSrc = cacheBust ? `${src}?v=${cacheBust}` : src

  return (
    <div style={{ textAlign: 'center' }}>
      {failed ? (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: '2px dashed #30363d',
            backgroundColor: bgColor ?? '#161b22',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: '#484f58',
          }}
        >
          No image
        </div>
      ) : (
        <Image
          src={imgSrc}
          alt={alt}
          width={size}
          height={size}
          style={{
            borderRadius: '50%',
            border: '2px solid #30363d',
            backgroundColor: bgColor,
          }}
          onError={() => setFailed(true)}
        />
      )}
      {label && <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>{label}</div>}
    </div>
  )
}

function PersonalityBlockCard({
  block,
  onSave,
  saving,
}: {
  block: PersonalityBlock
  onSave: (key: string, value: string) => void
  saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(block.text)

  return (
    <div
      style={{
        borderLeft: `3px solid ${getLayerColor('core-personality')}`,
        paddingLeft: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f6fc' }}>{block.label}</span>
        <span style={{ fontSize: 11, color: '#8b949e' }}>~{block.tokenEstimate} tokens</span>
        <span style={{ fontSize: 11, color: '#484f58', fontFamily: 'monospace' }}>
          {block.sourceExport}
        </span>
      </div>

      {editing ? (
        <div>
          <textarea
            className={textareaStyle}
            style={{ minHeight: 200 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className={primaryButtonStyle}
              disabled={saving}
              onClick={() => {
                onSave(block.key, text)
                setEditing(false)
              }}
            >
              Save
            </button>
            <button
              className={buttonStyle}
              onClick={() => {
                setText(block.text)
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <pre className={preStyle} style={{ maxHeight: 200 }}>
            {block.text}
          </pre>
          <button className={buttonStyle} onClick={() => setEditing(true)} style={{ marginTop: 4 }}>
            Edit
          </button>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#484f58', marginTop: 4 }}>{block.sourceFile}</div>
    </div>
  )
}

function ChatConfigCard({
  config,
  onSave,
  saving,
}: {
  config: CharacterData['chatConfig']
  onSave: (updates: Record<string, string>) => void
  saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [placeholder, setPlaceholder] = useState(config.placeholder)
  const [emptyPrompt, setEmptyPrompt] = useState(config.emptyPrompt)
  const [streamingLabel, setStreamingLabel] = useState(config.streamingLabel)

  return (
    <CollapsibleSection title="Chat Configuration">
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className={labelStyle}>Placeholder</div>
            <input
              className={inputStyle}
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
            />
          </div>
          <div>
            <div className={labelStyle}>Empty Prompt</div>
            <input
              className={inputStyle}
              value={emptyPrompt}
              onChange={(e) => setEmptyPrompt(e.target.value)}
            />
          </div>
          <div>
            <div className={labelStyle}>Streaming Label</div>
            <input
              className={inputStyle}
              value={streamingLabel}
              onChange={(e) => setStreamingLabel(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={primaryButtonStyle}
              disabled={saving}
              onClick={() => {
                onSave({ placeholder, emptyPrompt, streamingLabel })
                setEditing(false)
              }}
            >
              Save
            </button>
            <button className={buttonStyle} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div className={labelStyle}>Placeholder</div>
              <div className={valueStyle}>{config.placeholder}</div>
            </div>
            <div>
              <div className={labelStyle}>Empty Prompt</div>
              <div className={valueStyle}>{config.emptyPrompt}</div>
            </div>
            <div>
              <div className={labelStyle}>Streaming Label</div>
              <div className={valueStyle}>{config.streamingLabel}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#484f58', fontFamily: 'monospace', marginTop: 8 }}>
            {config.sourceFile}
          </div>
          <button className={buttonStyle} onClick={() => setEditing(true)} style={{ marginTop: 8 }}>
            Edit
          </button>
        </div>
      )}
    </CollapsibleSection>
  )
}

function ContextSelector({
  propositions,
  currentProp,
  currentStep,
  totalSteps,
  onChange,
}: {
  propositions: CharacterData['availablePropositions']
  currentProp: number
  currentStep: number
  totalSteps: number
  onChange: (propId: number, step: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 6,
        marginBottom: 16,
      }}
    >
      <div className={labelStyle} style={{ marginBottom: 0 }}>
        Context:
      </div>
      <select
        className={selectStyle}
        value={currentProp}
        onChange={(e) => onChange(Number(e.target.value), 0)}
      >
        {propositions.map((p) => (
          <option key={p.id} value={p.id}>
            I.{p.id} — {p.title} ({p.type})
          </option>
        ))}
      </select>
      <div className={labelStyle} style={{ marginBottom: 0 }}>
        Step:
      </div>
      <select
        className={selectStyle}
        value={currentStep}
        onChange={(e) => onChange(currentProp, Number(e.target.value))}
      >
        {Array.from({ length: totalSteps || 1 }, (_, i) => (
          <option key={i} value={i}>
            {i + 1}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Voice Config Card ────────────────────────────────────────────────

function VoiceConfigCard({ config }: { config: VoiceConfig }) {
  const voiceItemStyle = css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #21262d',
    _last: { borderBottom: 'none' },
  })

  return (
    <CollapsibleSection title="Voice Config" defaultOpen>
      <div className={cardContentStyle}>
        <div className={voiceItemStyle}>
          <span className={labelStyle} style={{ marginBottom: 0 }}>
            Realtime Voice
          </span>
          <span className={badgeStyle('#238636')}>{config.realtimeVoice}</span>
        </div>
        <div className={voiceItemStyle}>
          <span className={labelStyle} style={{ marginBottom: 0 }}>
            TTS Narration Voice
          </span>
          <span className={badgeStyle('#1f6feb')}>{config.ttsVoice}</span>
        </div>
        <div className={voiceItemStyle}>
          <span className={labelStyle} style={{ marginBottom: 0 }}>
            Base Duration
          </span>
          <span className={valueStyle}>{(config.baseDurationMs / 1000).toFixed(0)}s</span>
        </div>
        <div className={voiceItemStyle}>
          <span className={labelStyle} style={{ marginBottom: 0 }}>
            Extension
          </span>
          <span className={valueStyle}>{(config.extensionMs / 1000).toFixed(0)}s</span>
        </div>
        <div className={voiceItemStyle}>
          <span className={labelStyle} style={{ marginBottom: 0 }}>
            Session Endpoint
          </span>
          <span className={valueStyle} style={{ fontSize: 11 }}>
            {config.sessionEndpoint}
          </span>
        </div>
        <div className={voiceItemStyle}>
          <span className={labelStyle} style={{ marginBottom: 0 }}>
            Chat Endpoint
          </span>
          <span className={valueStyle} style={{ fontSize: 11 }}>
            {config.chatEndpoint}
          </span>
        </div>
        <div className={voiceItemStyle}>
          <span className={labelStyle} style={{ marginBottom: 0 }}>
            Think Hard Endpoint
          </span>
          <span className={valueStyle} style={{ fontSize: 11 }}>
            {config.thinkHardEndpoint}
          </span>
        </div>
      </div>
    </CollapsibleSection>
  )
}

// ── Main Page ───────────────────────────────────────────────────────

export default function CharactersAdminPage() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [characterData, setCharacterData] = useState<CharacterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [propId, setPropId] = useState(1)
  const [step, setStep] = useState(0)

  // Load character list
  useEffect(() => {
    fetch('/api/admin/characters')
      .then((r) => r.json())
      .then((d) => {
        setCharacters(d.characters)
        // Auto-select if only one character
        if (d.characters.length === 1) {
          setSelectedId(d.characters[0].id)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Load character detail
  const loadCharacterData = useCallback((id: string, propositionId: number, stepNum: number) => {
    setLoading(true)
    fetch(`/api/admin/characters/${id}?propositionId=${propositionId}&step=${stepNum}`)
      .then((r) => r.json())
      .then((d) => {
        setCharacterData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadCharacterData(selectedId, propId, step)
    }
  }, [selectedId, propId, step, loadCharacterData])

  const handleContextChange = (newPropId: number, newStep: number) => {
    setPropId(newPropId)
    setStep(newStep)
  }

  const handleSave = async (field: string, value: Record<string, string> | string) => {
    if (!selectedId) return
    setSaving(true)
    try {
      await fetch(`/api/admin/characters/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      // Reload data
      loadCharacterData(selectedId, propId, step)
    } finally {
      setSaving(false)
    }
  }

  const handlePersonalitySave = (key: string, text: string) => {
    handleSave('personality', { [key]: text })
  }

  const handleChatSave = (updates: Record<string, string>) => {
    handleSave('chat', updates)
  }

  // Compute total steps for the current proposition (from the data)
  const totalSteps = characterData?.modes.conversing?.promptBreakdown.sections.length
    ? Object.keys(characterData.modes).length > 0
      ? characterData.availablePropositions.find((p) => p.id === propId)
        ? 10
        : 1
      : 1
    : 1

  return (
    <div className={pageStyle} data-component="characters-admin">
      <AppNavBar />
      <AdminNav />
      <div className={containerStyle}>
        <h1 className={headingStyle}>Characters</h1>

        {loading && !characterData && (
          <div style={{ color: '#8b949e', fontSize: 14 }}>Loading...</div>
        )}

        {/* Character List */}
        {!selectedId && characters.length > 0 && (
          <div className={gridStyle}>
            {characters.map((c) => (
              <div
                key={c.id}
                className={characterCardStyle}
                onClick={() => setSelectedId(c.id)}
                data-action="select-character"
              >
                <Image
                  src={c.profileImage}
                  alt={c.displayName}
                  width={80}
                  height={80}
                  style={{ borderRadius: '50%', marginBottom: 8 }}
                />
                <div style={{ fontSize: 16, fontWeight: 600, color: '#f0f6fc' }}>
                  {c.displayName}
                </div>
                {c.nativeDisplayName && (
                  <div style={{ fontSize: 12, color: '#8b949e' }}>{c.nativeDisplayName}</div>
                )}
                <span className={badgeStyle('#1f6feb')} style={{ marginTop: 8 }}>
                  {c.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Character Detail */}
        {selectedId && characterData && (
          <div>
            {characters.length > 1 && (
              <button
                className={buttonStyle}
                onClick={() => {
                  setSelectedId(null)
                  setCharacterData(null)
                }}
                style={{ marginBottom: 16 }}
              >
                Back to List
              </button>
            )}

            {/* Context Selector */}
            <ContextSelector
              propositions={characterData.availablePropositions}
              currentProp={propId}
              currentStep={step}
              totalSteps={totalSteps}
              onChange={handleContextChange}
            />

            {/* A. Identity Card */}
            <IdentityCard data={characterData} onSave={handleSave} saving={saving} />

            {/* A2. Voice Config */}
            {characterData.voiceConfig && <VoiceConfigCard config={characterData.voiceConfig} />}

            {/* B. Personality Blocks */}
            <CollapsibleSection
              title="Core Personality"
              badge={`${characterData.personalityBlocks.length} blocks`}
              defaultOpen
            >
              {characterData.personalityBlocks.map((block) => (
                <PersonalityBlockCard
                  key={block.key}
                  block={block}
                  onSave={handlePersonalitySave}
                  saving={saving}
                />
              ))}
            </CollapsibleSection>

            {/* C. Chat Config */}
            <ChatConfigCard
              config={characterData.chatConfig}
              onSave={handleChatSave}
              saving={saving}
            />

            {/* D. Mode System */}
            <CollapsibleSection
              title="Mode System"
              badge={`${Object.keys(characterData.modes).length} modes`}
              defaultOpen
            >
              <ModeFlowDiagram transitions={characterData.modeTransitions} />
              {Object.values(characterData.modes).map((mode) => (
                <ModeCard key={mode.id} mode={mode} />
              ))}
            </CollapsibleSection>

            {/* E. Tools */}
            <CollapsibleSection title="Tools" badge={`${characterData.tools.length} tools`}>
              {characterData.tools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </CollapsibleSection>
          </div>
        )}
      </div>
    </div>
  )
}

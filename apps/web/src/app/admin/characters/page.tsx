'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import type {
  CharacterData,
  CharacterSummary,
  ModeData,
  PersonalityBlock,
  ToolData,
  ModeTransition,
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
          <span key={layerId} style={{ fontSize: 11, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getLayerColor(layerId), display: 'inline-block' }} />
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
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', fontFamily: 'monospace' }}>
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
          <p className={valueStyle} style={{ marginBottom: 8 }}>{tool.behavior}</p>
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
    <CollapsibleSection
      title={mode.label}
      badge={mode.api ?? `${mode.tools.length} tools`}
    >
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
          {mode.tools.length > 0
            ? mode.tools.map((t) => (
                <span key={t} className={badgeStyle('#1f6feb')}>
                  {t}
                </span>
              ))
            : <span style={{ fontSize: 12, color: '#484f58' }}>None</span>
          }
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div className={labelStyle}>Source</div>
        <div style={{ fontSize: 12, color: '#484f58', fontFamily: 'monospace' }}>{mode.sourceFile}</div>
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
  const [generating, setGenerating] = useState(false)
  const [genProvider, setGenProvider] = useState('gemini')
  const [genVariant, setGenVariant] = useState<'default' | 'light' | 'dark'>('default')

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/admin/characters/${data.identity.id}/profile/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: genProvider, variant: genVariant, forceRegenerate: true }),
      })
      const result = await res.json()
      if (result.error) {
        alert(`Generation failed: ${result.error}`)
      } else {
        alert(`Image ${result.status}: ${result.publicUrl}`)
      }
    } catch (err) {
      alert(`Error: ${err}`)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <CollapsibleSection title="Identity" defaultOpen>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          <Image
            src={data.identity.profileImage}
            alt={data.identity.displayName}
            width={120}
            height={120}
            style={{ borderRadius: '50%', border: '2px solid #30363d' }}
          />
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

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className={selectStyle}
              value={genProvider}
              onChange={(e) => setGenProvider(e.target.value)}
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
            <select
              className={selectStyle}
              value={genVariant}
              onChange={(e) => setGenVariant(e.target.value as 'default' | 'light' | 'dark')}
            >
              <option value="default">Default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <button
              className={primaryButtonStyle}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Image'}
            </button>
          </div>
        </div>
      </div>
    </CollapsibleSection>
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
  const loadCharacterData = useCallback(
    (id: string, propositionId: number, stepNum: number) => {
      setLoading(true)
      fetch(`/api/admin/characters/${id}?propositionId=${propositionId}&step=${stepNum}`)
        .then((r) => r.json())
        .then((d) => {
          setCharacterData(d)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    },
    []
  )

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
  const totalSteps =
    characterData?.modes.conversing?.promptBreakdown.sections.length
      ? Object.keys(characterData.modes).length > 0
        ? (characterData.availablePropositions.find((p) => p.id === propId) ? 10 : 1)
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
            <CollapsibleSection
              title="Tools"
              badge={`${characterData.tools.length} tools`}
            >
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

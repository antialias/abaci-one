'use client'

import { useCallback, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'
import { ContentSpot } from '@/components/page-spots/ContentSpot'
import { pageSpotKeys } from '@/lib/queryKeys'
import type { SpotConfig } from '@/lib/page-spots/types'

// ---------------------------------------------------------------------------
// Types for the status API response
// ---------------------------------------------------------------------------

interface SpotStatus {
  id: string
  label: string
  description: string
  aspectRatio: string | null
  config: SpotConfig | null
  imageUrl: string | null
  imageSizeBytes?: number
  htmlExists: boolean
}

interface PageStatus {
  pageId: string
  label: string
  spots: SpotStatus[]
}

interface ProviderInfo {
  id: string
  name: string
  available: boolean
  models: Array<{ id: string; name: string }>
}

interface StatusResponse {
  pages: PageStatus[]
  providers: ProviderInfo[]
  components: Array<{ id: string; label: string; description: string }>
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const segmentBtnStyle = (active: boolean) =>
  css({
    backgroundColor: active ? '#30363d' : 'transparent',
    color: active ? '#f0f6fc' : '#8b949e',
    border: '1px solid #30363d',
    borderRadius: '0',
    padding: '3px 12px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    '&:first-of-type': { borderRadius: '6px 0 0 6px' },
    '&:last-of-type': { borderRadius: '0 6px 6px 0' },
    '&:hover': { color: '#c9d1d9' },
  })

const smallBtnStyle = css({
  backgroundColor: '#21262d',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: '6px',
  padding: '4px 12px',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  '&:hover': { backgroundColor: '#30363d' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
})

const primaryBtnStyle = css({
  backgroundColor: '#238636',
  color: '#ffffff',
  border: '1px solid #2ea043',
  borderRadius: '6px',
  padding: '4px 12px',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  '&:hover': { backgroundColor: '#2ea043' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
})

const inputStyle = css({
  backgroundColor: '#0d1117',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '13px',
  width: '100%',
  '&:focus': { outline: 'none', borderColor: '#58a6ff' },
})

const selectStyle = css({
  backgroundColor: '#0d1117',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '13px',
  '&:focus': { outline: 'none', borderColor: '#58a6ff' },
})

const cardStyle = css({
  backgroundColor: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '12px',
})

const labelStyle = css({
  fontSize: '11px',
  color: '#8b949e',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '4px',
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PageSpotsAdmin() {
  const queryClient = useQueryClient()
  const [activePageId, setActivePageId] = useState<string>('home')

  const { data, isLoading } = useQuery<StatusResponse>({
    queryKey: pageSpotKeys.status(),
    queryFn: async () => {
      const res = await fetch('/api/admin/page-spots/status')
      if (!res.ok) throw new Error('Failed to fetch status')
      return res.json()
    },
  })

  const activePage = data?.pages.find((p) => p.pageId === activePageId)

  return (
    <div
      data-component="page-spots-admin"
      className={css({ minHeight: '100vh', backgroundColor: '#0d1117' })}
    >
      <AppNavBar />
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>
      <div className={css({ maxWidth: '1200px', margin: '0 auto', padding: '24px' })}>
        <h1
          className={css({
            fontSize: '20px',
            fontWeight: '600',
            color: '#f0f6fc',
            marginBottom: '16px',
          })}
        >
          Page Content Spots
        </h1>

        {isLoading && <div className={css({ color: '#8b949e', padding: '24px' })}>Loading...</div>}

        {data && (
          <>
            {/* Page tabs */}
            <div className={css({ display: 'flex', gap: '4px', marginBottom: '20px' })}>
              {data.pages.map((page) => (
                <button
                  key={page.pageId}
                  onClick={() => setActivePageId(page.pageId)}
                  className={segmentBtnStyle(page.pageId === activePageId)}
                >
                  {page.label}
                </button>
              ))}
            </div>

            {/* Spots for active page */}
            {activePage?.spots.map((spot) => (
              <SpotCard
                key={spot.id}
                pageId={activePageId}
                spot={spot}
                providers={data.providers}
                components={data.components}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: pageSpotKeys.status() })}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SpotCard
// ---------------------------------------------------------------------------

function SpotCard({
  pageId,
  spot,
  providers,
  components,
  onRefresh,
}: {
  pageId: string
  spot: SpotStatus
  providers: ProviderInfo[]
  components: Array<{ id: string; label: string; description: string }>
  onRefresh: () => void
}) {
  const spotType = spot.config?.type ?? null
  const [pendingType, setPendingType] = useState<string | null>(null)
  const activeType = pendingType ?? spotType

  const setTypeMutation = useMutation({
    mutationFn: async (type: string) => {
      let config: SpotConfig
      if (type === 'generated') {
        config = { type: 'generated', prompt: '' }
      } else if (type === 'component') {
        config = { type: 'component', componentId: components[0]?.id ?? '' }
      } else {
        config = { type: 'html' }
      }
      const res = await fetch(`/api/admin/page-spots/${pageId}/${spot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json()
    },
    onSuccess: () => {
      setPendingType(null)
      onRefresh()
    },
  })

  const handleTypeChange = (type: string) => {
    if (type === spotType) return
    setPendingType(type)
    setTypeMutation.mutate(type)
  }

  return (
    <div className={cardStyle} data-element="spot-card">
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '12px',
        })}
      >
        <div>
          <div className={css({ fontSize: '15px', fontWeight: '600', color: '#f0f6fc' })}>
            {spot.label}
          </div>
          <div className={css({ fontSize: '12px', color: '#8b949e' })}>
            {spot.description}
            {spot.aspectRatio && <span> &middot; {spot.aspectRatio}</span>}
          </div>
        </div>

        {/* Type selector */}
        <div className={css({ display: 'flex' })}>
          {(['generated', 'component', 'html'] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={segmentBtnStyle(activeType === type)}
              disabled={setTypeMutation.isPending}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Type-specific editor */}
      {spot.config?.type === 'generated' && (
        <GeneratedSpotEditor
          pageId={pageId}
          spotId={spot.id}
          config={spot.config}
          imageUrl={spot.imageUrl}
          imageSizeBytes={spot.imageSizeBytes}
          providers={providers}
          aspectRatio={spot.aspectRatio}
          onRefresh={onRefresh}
        />
      )}

      {spot.config?.type === 'component' && (
        <ComponentSpotEditor
          pageId={pageId}
          spotId={spot.id}
          config={spot.config}
          components={components}
          aspectRatio={spot.aspectRatio}
          onRefresh={onRefresh}
        />
      )}

      {spot.config?.type === 'html' && (
        <HtmlSpotEditor
          pageId={pageId}
          spotId={spot.id}
          config={spot.config}
          htmlExists={spot.htmlExists}
          aspectRatio={spot.aspectRatio}
          onRefresh={onRefresh}
        />
      )}

      {!spot.config && (
        <div className={css({ color: '#8b949e', fontSize: '13px', fontStyle: 'italic' })}>
          Select a type above to configure this spot.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generated Spot Editor
// ---------------------------------------------------------------------------

function GeneratedSpotEditor({
  pageId,
  spotId,
  config,
  imageUrl,
  imageSizeBytes,
  providers,
  aspectRatio,
  onRefresh,
}: {
  pageId: string
  spotId: string
  config: {
    type: 'generated'
    prompt: string
    provider?: 'gemini' | 'openai'
    model?: string
    focalPoint?: { x: number; y: number }
  }
  imageUrl: string | null
  imageSizeBytes?: number
  providers: ProviderInfo[]
  aspectRatio: string | null
  onRefresh: () => void
}) {
  const [prompt, setPrompt] = useState(config.prompt)
  const [provider, setProvider] = useState(
    config.provider ?? providers.find((p) => p.available)?.id ?? ''
  )
  const [model, setModel] = useState(config.model ?? '')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [focalX, setFocalX] = useState(config.focalPoint?.x ?? 50)
  const [focalY, setFocalY] = useState(config.focalPoint?.y ?? 50)

  const selectedProvider = providers.find((p) => p.id === provider)
  const availableModels = selectedProvider?.models ?? []

  // Auto-select first model if none selected
  if (!model && availableModels.length > 0) {
    setModel(availableModels[0].id)
  }

  const task = useBackgroundTask(taskId)

  const saveConfigMutation = useMutation({
    mutationFn: async (updatedConfig: SpotConfig) => {
      const res = await fetch(`/api/admin/page-spots/${pageId}/${spotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: () => onRefresh(),
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Save config first
      await saveConfigMutation.mutateAsync({
        type: 'generated',
        prompt,
        provider: provider as 'gemini' | 'openai',
        model,
        focalPoint: { x: focalX, y: focalY },
      })

      const res = await fetch('/api/admin/page-spots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, spotId, provider, model, forceRegenerate: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to start generation')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setTaskId(data.taskId)
    },
  })

  const refineMutation = useMutation({
    mutationFn: async () => {
      // Save current prompt first
      await saveConfigMutation.mutateAsync({
        type: 'generated',
        prompt,
        provider: provider as 'gemini' | 'openai',
        model,
        focalPoint: { x: focalX, y: focalY },
      })

      const res = await fetch(`/api/admin/page-spots/${pageId}/${spotId}/refine-prompt`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to refine')
      return res.json()
    },
    onSuccess: (data) => {
      if (data.refined) {
        setPrompt(data.refined)
      }
    },
  })

  const handleSave = useCallback(() => {
    saveConfigMutation.mutate({
      type: 'generated',
      prompt,
      provider: provider as 'gemini' | 'openai',
      model,
      focalPoint: { x: focalX, y: focalY },
    })
  }, [prompt, provider, model, focalX, focalY, saveConfigMutation])

  const isGenerating = task.state?.status === 'pending' || task.state?.status === 'running'

  // Auto-refresh on task completion
  if (task.state?.status === 'completed' && taskId) {
    setTaskId(null)
    onRefresh()
  }

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
      {/* Prompt */}
      <div>
        <div className={labelStyle}>Prompt</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className={css({
            backgroundColor: '#0d1117',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '13px',
            width: '100%',
            resize: 'vertical',
            fontFamily: 'inherit',
            '&:focus': { outline: 'none', borderColor: '#58a6ff' },
          })}
        />
        <div className={css({ display: 'flex', gap: '8px', marginTop: '6px' })}>
          <button
            onClick={handleSave}
            className={smallBtnStyle}
            disabled={saveConfigMutation.isPending}
          >
            {saveConfigMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => refineMutation.mutate()}
            className={smallBtnStyle}
            disabled={refineMutation.isPending || !prompt}
          >
            {refineMutation.isPending ? 'Refining...' : 'Refine with AI'}
          </button>
        </div>
      </div>

      {/* Provider / Model */}
      <div className={css({ display: 'flex', gap: '12px' })}>
        <div className={css({ flex: 1 })}>
          <div className={labelStyle}>Provider</div>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value)
              setModel('')
            }}
            className={selectStyle}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.name} {!p.available && '(no key)'}
              </option>
            ))}
          </select>
        </div>
        <div className={css({ flex: 1 })}>
          <div className={labelStyle}>Model</div>
          <select value={model} onChange={(e) => setModel(e.target.value)} className={selectStyle}>
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Focal point */}
      <div className={css({ display: 'flex', gap: '12px' })}>
        <div className={css({ flex: 1 })}>
          <div className={labelStyle}>Focal X (%)</div>
          <input
            type="number"
            min={0}
            max={100}
            value={focalX}
            onChange={(e) => setFocalX(Number(e.target.value))}
            className={inputStyle}
          />
        </div>
        <div className={css({ flex: 1 })}>
          <div className={labelStyle}>Focal Y (%)</div>
          <input
            type="number"
            min={0}
            max={100}
            value={focalY}
            onChange={(e) => setFocalY(Number(e.target.value))}
            className={inputStyle}
          />
        </div>
      </div>

      {/* Generate button */}
      <div>
        <button
          onClick={() => generateMutation.mutate()}
          className={primaryBtnStyle}
          disabled={isGenerating || !prompt || !provider || !model}
        >
          {isGenerating
            ? `Generating... ${task.state?.progress ?? 0}%`
            : generateMutation.isPending
              ? 'Starting...'
              : 'Generate Image'}
        </button>
        {generateMutation.isError && (
          <div className={css({ color: '#f85149', fontSize: '12px', marginTop: '4px' })}>
            {generateMutation.error.message}
          </div>
        )}
        {task.state?.status === 'failed' && (
          <div className={css({ color: '#f85149', fontSize: '12px', marginTop: '4px' })}>
            Generation failed: {task.state.error}
          </div>
        )}
      </div>

      {/* Preview */}
      {imageUrl && (
        <div>
          <div className={labelStyle}>
            Preview {imageSizeBytes ? `(${formatBytes(imageSizeBytes)})` : ''}
          </div>
          <div
            className={css({
              maxWidth: '400px',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid #30363d',
            })}
          >
            <ContentSpot
              config={config}
              aspectRatio={aspectRatio ?? undefined}
              imageUrl={imageUrl}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component Spot Editor
// ---------------------------------------------------------------------------

function ComponentSpotEditor({
  pageId,
  spotId,
  config,
  components,
  aspectRatio,
  onRefresh,
}: {
  pageId: string
  spotId: string
  config: { type: 'component'; componentId: string }
  components: Array<{ id: string; label: string; description: string }>
  aspectRatio: string | null
  onRefresh: () => void
}) {
  const [componentId, setComponentId] = useState(config.componentId)

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/page-spots/${pageId}/${spotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'component', componentId: id }),
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: () => onRefresh(),
  })

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
      <div>
        <div className={labelStyle}>Component</div>
        <div className={css({ display: 'flex', gap: '8px' })}>
          <select
            value={componentId}
            onChange={(e) => {
              setComponentId(e.target.value)
              saveMutation.mutate(e.target.value)
            }}
            className={selectStyle}
          >
            {components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live preview */}
      {componentId && (
        <div>
          <div className={labelStyle}>Preview</div>
          <div
            className={css({
              maxWidth: '400px',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid #30363d',
            })}
          >
            <ContentSpot
              config={{ type: 'component', componentId }}
              aspectRatio={aspectRatio ?? undefined}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HTML Spot Editor
// ---------------------------------------------------------------------------

function HtmlSpotEditor({
  pageId,
  spotId,
  config,
  htmlExists,
  aspectRatio,
  onRefresh,
}: {
  pageId: string
  spotId: string
  config: {
    type: 'html'
    captureUrl?: string
    captureMethod?: string
    captureBody?: unknown
    captureExtractPath?: string
  }
  htmlExists: boolean
  aspectRatio: string | null
  onRefresh: () => void
}) {
  const [html, setHtml] = useState('')
  const [htmlLoaded, setHtmlLoaded] = useState(false)
  const [captureUrl, setCaptureUrl] = useState(config.captureUrl ?? '')
  const [captureMethod, setCaptureMethod] = useState(config.captureMethod ?? 'GET')
  const [captureExtractPath, setCaptureExtractPath] = useState(config.captureExtractPath ?? '')

  const queryClient = useQueryClient()

  // Load HTML on first mount
  const htmlQuery = useQuery({
    queryKey: pageSpotKeys.html(pageId, spotId),
    queryFn: async () => {
      const res = await fetch(`/api/admin/page-spots/${pageId}/${spotId}/html`)
      if (!res.ok) throw new Error('Failed to load HTML')
      const data = await res.json()
      return data.html as string | null
    },
    enabled: !htmlLoaded,
  })

  if (htmlQuery.data !== undefined && !htmlLoaded) {
    setHtml(htmlQuery.data ?? '')
    setHtmlLoaded(true)
  }

  const saveHtmlMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/page-spots/${pageId}/${spotId}/html`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      })
      if (!res.ok) throw new Error('Failed to save')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageSpotKeys.html(pageId, spotId) })
      onRefresh()
    },
  })

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const updatedConfig: SpotConfig = {
        type: 'html',
        ...(captureUrl ? { captureUrl } : {}),
        ...(captureMethod !== 'GET' ? { captureMethod: captureMethod as 'GET' | 'POST' } : {}),
        ...(captureExtractPath ? { captureExtractPath } : {}),
      }
      const res = await fetch(`/api/admin/page-spots/${pageId}/${spotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      })
      if (!res.ok) throw new Error('Failed to save config')
      return res.json()
    },
    onSuccess: () => onRefresh(),
  })

  const captureMutation = useMutation({
    mutationFn: async () => {
      // Save config with capture URL first
      await saveConfigMutation.mutateAsync()

      const res = await fetch('/api/admin/page-spots/capture-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          spotId,
          url: captureUrl,
          method: captureMethod,
          extractPath: captureExtractPath || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Capture failed')
      }
      return res.json()
    },
    onSuccess: () => {
      setHtmlLoaded(false) // reload
      queryClient.invalidateQueries({ queryKey: pageSpotKeys.html(pageId, spotId) })
      onRefresh()
    },
  })

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
      {/* HTML textarea */}
      <div>
        <div className={labelStyle}>HTML Content</div>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={6}
          className={css({
            backgroundColor: '#0d1117',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '12px',
            width: '100%',
            resize: 'vertical',
            fontFamily: 'monospace',
            '&:focus': { outline: 'none', borderColor: '#58a6ff' },
          })}
        />
        <button
          onClick={() => saveHtmlMutation.mutate()}
          className={smallBtnStyle}
          style={{ marginTop: '6px' }}
          disabled={saveHtmlMutation.isPending}
        >
          {saveHtmlMutation.isPending ? 'Saving...' : 'Save HTML'}
        </button>
      </div>

      {/* URL capture */}
      <div className={css({ borderTop: '1px solid #21262d', paddingTop: '12px' })}>
        <div className={labelStyle}>Capture from URL</div>
        <div className={css({ display: 'flex', gap: '8px', marginBottom: '6px' })}>
          <select
            value={captureMethod}
            onChange={(e) => setCaptureMethod(e.target.value)}
            className={selectStyle}
            style={{ width: '80px' }}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
          <input
            value={captureUrl}
            onChange={(e) => setCaptureUrl(e.target.value)}
            placeholder="/api/some/endpoint"
            className={inputStyle}
          />
        </div>
        <div className={css({ marginBottom: '6px' })}>
          <input
            value={captureExtractPath}
            onChange={(e) => setCaptureExtractPath(e.target.value)}
            placeholder="extractPath (e.g. pages.0)"
            className={inputStyle}
          />
        </div>
        <button
          onClick={() => captureMutation.mutate()}
          className={smallBtnStyle}
          disabled={captureMutation.isPending || !captureUrl}
        >
          {captureMutation.isPending ? 'Capturing...' : 'Capture'}
        </button>
        {captureMutation.isError && (
          <div className={css({ color: '#f85149', fontSize: '12px', marginTop: '4px' })}>
            {captureMutation.error.message}
          </div>
        )}
      </div>

      {/* Preview */}
      {htmlLoaded && html && (
        <div>
          <div className={labelStyle}>Preview</div>
          <div
            className={css({
              maxWidth: '400px',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid #30363d',
            })}
          >
            <ContentSpot
              config={{ type: 'html' }}
              aspectRatio={aspectRatio ?? undefined}
              html={html}
            />
          </div>
        </div>
      )}
    </div>
  )
}

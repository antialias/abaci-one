'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import type { CanvasPreviewTarget, AIPreviewTarget, PreviewTarget } from '@/lib/homepage-previews'

// Dynamic import: the registry imports render functions that reference browser APIs
// (Canvas 2D). We only need them client-side for canvas capture.
const loadRegistry = () => import('@/lib/homepage-previews')

interface TargetStatus {
  id: string
  type: 'canvas' | 'ai'
  label: string
  width: number
  height: number
  prompt?: string
  imageExists: boolean
  sizeBytes?: number
}

interface ProviderInfo {
  id: string
  name: string
  available: boolean
  models: Array<{ id: string; name: string }>
}

interface StatusResponse {
  targets: TargetStatus[]
  providers: ProviderInfo[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function HomepagePreviewsAdmin() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [generating, setGenerating] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())
  const [selectedValue, setSelectedValue] = useState('')
  const registryRef = useRef<Awaited<ReturnType<typeof loadRegistry>> | null>(null)

  const [selectedProvider, selectedModel] = selectedValue.includes(':')
    ? selectedValue.split(':')
    : ['', '']

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/homepage-previews/status')
      if (!res.ok) throw new Error('Failed to fetch status')
      const data: StatusResponse = await res.json()
      setStatus(data)

      // Auto-select first available provider
      if (!selectedValue && data.providers.length > 0) {
        const available = data.providers.find((p) => p.available)
        if (available && available.models.length > 0) {
          setSelectedValue(`${available.id}:${available.models[0].id}`)
        }
      }
    } catch (err) {
      console.error('Failed to fetch homepage preview status:', err)
    }
  }, [selectedValue])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Ensure registry is loaded for canvas rendering
  async function getRegistry() {
    if (!registryRef.current) {
      registryRef.current = await loadRegistry()
    }
    return registryRef.current
  }

  // Generate a canvas preview client-side
  async function generateCanvas(targetId: string) {
    setGenerating((prev) => new Set(prev).add(targetId))
    setErrors((prev) => {
      const next = new Map(prev)
      next.delete(targetId)
      return next
    })

    try {
      const registry = await getRegistry()
      const target = registry.getPreviewTarget(targetId)
      if (!target || target.type !== 'canvas') throw new Error('Not a canvas target')

      const canvasTarget = target as CanvasPreviewTarget
      const canvas = document.createElement('canvas')
      const dpr = 2 // Render at 2x for crisp previews
      canvas.width = canvasTarget.width * dpr
      canvas.height = canvasTarget.height * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.scale(dpr, dpr)
      canvasTarget.render(ctx, canvasTarget.width, canvasTarget.height)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Failed to create PNG blob')

      // Convert to base64 data URL
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      // POST to API
      const res = await fetch('/api/admin/homepage-previews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId, imageData: dataUrl }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      await fetchStatus()
    } catch (err) {
      setErrors((prev) => {
        const next = new Map(prev)
        next.set(targetId, err instanceof Error ? err.message : 'Unknown error')
        return next
      })
    } finally {
      setGenerating((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
    }
  }

  // Generate an AI preview
  async function generateAI(targetId: string) {
    if (!selectedProvider || !selectedModel) {
      setErrors((prev) => {
        const next = new Map(prev)
        next.set(targetId, 'Select an AI provider first')
        return next
      })
      return
    }

    setGenerating((prev) => new Set(prev).add(targetId))
    setErrors((prev) => {
      const next = new Map(prev)
      next.delete(targetId)
      return next
    })

    try {
      const res = await fetch('/api/admin/homepage-previews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetId,
          provider: selectedProvider,
          model: selectedModel,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Generation failed')
      }

      await fetchStatus()
    } catch (err) {
      setErrors((prev) => {
        const next = new Map(prev)
        next.set(targetId, err instanceof Error ? err.message : 'Unknown error')
        return next
      })
    } finally {
      setGenerating((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
    }
  }

  function handleGenerate(target: TargetStatus) {
    if (target.type === 'canvas') {
      generateCanvas(target.id)
    } else {
      generateAI(target.id)
    }
  }

  async function handleGenerateAllCanvas() {
    const canvasTargets = status?.targets.filter((t) => t.type === 'canvas') ?? []
    for (const target of canvasTargets) {
      await generateCanvas(target.id)
    }
  }

  const canvasTargets = status?.targets.filter((t) => t.type === 'canvas') ?? []
  const aiTargets = status?.targets.filter((t) => t.type === 'ai') ?? []
  const allGenerated = status?.targets.every((t) => t.imageExists) ?? false

  const selectStyle = css({
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    padding: '6px 12px',
    color: '#c9d1d9',
    fontSize: '13px',
    cursor: 'pointer',
    '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
  })

  return (
    <div
      data-component="homepage-previews-admin"
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

      <div className={css({ maxWidth: '1200px', margin: '0 auto', padding: '24px' })}>
        {/* Header */}
        <div className={css({ marginBottom: '24px' })}>
          <h1 className={css({ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' })}>
            Homepage Preview Images
          </h1>
          <p className={css({ fontSize: '13px', color: '#8b949e' })}>
            Generate preview images for homepage exploration cards. Canvas targets render
            client-side; AI targets use image generation providers.
            {status && (
              <>
                {' '}
                {status.targets.filter((t) => t.imageExists).length}/{status.targets.length}{' '}
                generated.
              </>
            )}
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
          {/* Provider selector (for AI targets) */}
          <select
            data-action="select-provider"
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            disabled={generating.size > 0}
            className={selectStyle}
          >
            <option value="">AI Provider...</option>
            {status?.providers.map((p) =>
              p.models.map((m) => (
                <option key={`${p.id}:${m.id}`} value={`${p.id}:${m.id}`} disabled={!p.available}>
                  {p.name} / {m.name}
                  {!p.available ? ' (no key)' : ''}
                </option>
              ))
            )}
          </select>

          {/* Generate All Canvas */}
          <button
            data-action="generate-all-canvas"
            onClick={handleGenerateAllCanvas}
            disabled={generating.size > 0}
            className={css({
              backgroundColor: '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#2ea043' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Generate All Canvas ({canvasTargets.length})
          </button>

          {/* Refresh */}
          <button
            data-action="refresh"
            onClick={fetchStatus}
            disabled={generating.size > 0}
            className={css({
              backgroundColor: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#30363d' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Refresh
          </button>

          {allGenerated && (
            <span className={css({ fontSize: '12px', color: '#3fb950' })}>
              All images generated
            </span>
          )}
        </div>

        {/* Canvas targets */}
        {canvasTargets.length > 0 && (
          <div className={css({ marginBottom: '32px' })}>
            <h2
              className={css({
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#f0f6fc',
              })}
            >
              Canvas Targets (client-side render)
            </h2>
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '12px',
              })}
            >
              {canvasTargets.map((target) => (
                <TargetCard
                  key={target.id}
                  target={target}
                  isGenerating={generating.has(target.id)}
                  error={errors.get(target.id)}
                  onGenerate={() => handleGenerate(target)}
                />
              ))}
            </div>
          </div>
        )}

        {/* AI targets */}
        {aiTargets.length > 0 && (
          <div className={css({ marginBottom: '32px' })}>
            <h2
              className={css({
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#f0f6fc',
              })}
            >
              AI Targets (provider-generated)
            </h2>
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '12px',
              })}
            >
              {aiTargets.map((target) => (
                <TargetCard
                  key={target.id}
                  target={target}
                  isGenerating={generating.has(target.id)}
                  error={errors.get(target.id)}
                  onGenerate={() => handleGenerate(target)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {!status && (
          <div className={css({ textAlign: 'center', padding: '48px', color: '#8b949e' })}>
            Loading...
          </div>
        )}
      </div>
    </div>
  )
}

function TargetCard({
  target,
  isGenerating,
  error,
  onGenerate,
}: {
  target: TargetStatus
  isGenerating: boolean
  error?: string
  onGenerate: () => void
}) {
  return (
    <div
      data-element="target-card"
      data-target-id={target.id}
      className={css({
        padding: '16px',
        backgroundColor: '#161b22',
        borderRadius: '8px',
        border: error ? '1px solid #f85149' : '1px solid #30363d',
      })}
    >
      {/* Thumbnail */}
      <div
        className={css({
          width: '100%',
          aspectRatio: '8 / 5',
          borderRadius: '6px',
          overflow: 'hidden',
          backgroundColor: '#0d1117',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #21262d',
          marginBottom: '12px',
        })}
      >
        {target.imageExists ? (
          <img
            src={`/images/homepage/${target.id}.png?t=${Date.now()}`}
            alt={target.label}
            className={css({
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            })}
          />
        ) : isGenerating ? (
          <span className={css({ fontSize: '14px', color: '#58a6ff' })}>Generating...</span>
        ) : (
          <span className={css({ fontSize: '12px', color: '#484f58' })}>No image</span>
        )}
      </div>

      {/* Info */}
      <div className={css({ marginBottom: '12px' })}>
        <div
          className={css({
            fontSize: '14px',
            fontWeight: '600',
            color: '#f0f6fc',
            marginBottom: '2px',
          })}
        >
          {target.label}
        </div>
        <div className={css({ fontSize: '12px', color: '#8b949e' })}>
          {target.id} &middot; {target.type} &middot; {target.width}&times;{target.height}
          {target.imageExists && target.sizeBytes && <> &middot; {formatBytes(target.sizeBytes)}</>}
        </div>
        {target.prompt && (
          <div
            className={css({
              fontSize: '11px',
              color: '#484f58',
              marginTop: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            })}
          >
            {target.prompt}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className={css({
            padding: '6px 10px',
            backgroundColor: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.3)',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#f85149',
            marginBottom: '8px',
            wordBreak: 'break-word',
          })}
        >
          {error}
        </div>
      )}

      {/* Action */}
      <button
        data-action={target.imageExists ? 'regenerate' : 'generate'}
        onClick={onGenerate}
        disabled={isGenerating}
        className={css({
          backgroundColor: target.imageExists ? '#21262d' : '#238636',
          color: target.imageExists ? '#c9d1d9' : '#fff',
          border: target.imageExists ? '1px solid #30363d' : 'none',
          borderRadius: '6px',
          padding: '6px 16px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          width: '100%',
          '&:hover': {
            backgroundColor: target.imageExists ? '#30363d' : '#2ea043',
          },
          '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {isGenerating ? 'Generating...' : target.imageExists ? 'Regenerate' : 'Generate'}
      </button>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'
import type { BlogImageGenerateOutput } from '@/lib/tasks/blog-image-generate'

interface BlogPostStatus {
  slug: string
  title: string
  heroPrompt: string | null
  heroImage: string | null
  heroAspectRatio: string | null
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
  posts: BlogPostStatus[]
  providers: ProviderInfo[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function BlogImagesAdmin() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [selectedValue, setSelectedValue] = useState('')
  const [fallbackValue, setFallbackValue] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { state: taskState } = useBackgroundTask<BlogImageGenerateOutput>(taskId)

  const isGenerating = taskState?.status === 'running' || taskState?.status === 'pending'

  // Parse selected provider/model
  const [selectedProvider, selectedModel] = selectedValue.includes(':')
    ? selectedValue.split(':')
    : ['', '']

  const [fallbackProvider, fallbackModel] = fallbackValue.includes(':')
    ? fallbackValue.split(':')
    : ['', '']

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/blog-images/status')
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
      console.error('Failed to fetch blog image status:', err)
    }
  }, [selectedValue])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Re-fetch status when task completes
  useEffect(() => {
    if (taskState?.status === 'completed') {
      fetchStatus()
    }
  }, [taskState?.status, fetchStatus])

  // Poll status while generating (catch any missed socket updates)
  useEffect(() => {
    if (!isGenerating) return
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [isGenerating, fetchStatus])

  const postsWithPrompt = status?.posts.filter((p) => p.heroPrompt) ?? []
  const postsWithoutPrompt = status?.posts.filter((p) => !p.heroPrompt) ?? []
  const missingImages = postsWithPrompt.filter((p) => !p.imageExists)

  async function generate(targets: Array<{ slug: string; prompt: string }>, forceRegenerate = false) {
    if (!selectedProvider || !selectedModel) {
      setError('Select a provider and model first')
      return
    }
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        provider: selectedProvider,
        model: selectedModel,
        targets,
        forceRegenerate,
      }
      if (fallbackProvider && fallbackModel) {
        payload.fallbackProvider = fallbackProvider
        payload.fallbackModel = fallbackModel
      }
      const res = await fetch('/api/admin/blog-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Generation failed')
        return
      }
      const data = await res.json()
      setTaskId(data.taskId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  function handleGenerateAll() {
    const targets = missingImages.map((p) => ({ slug: p.slug, prompt: p.heroPrompt! }))
    if (targets.length === 0) {
      setError('All posts with heroPrompt already have images')
      return
    }
    generate(targets)
  }

  function handleGenerateSingle(post: BlogPostStatus, force = false) {
    generate([{ slug: post.slug, prompt: post.heroPrompt! }], force)
  }

  function handleRetryFailed() {
    if (!failedResults.length || !postsWithPrompt.length) return
    const promptMap = new Map(postsWithPrompt.map((p) => [p.slug, p.heroPrompt!]))
    const targets = failedResults
      .filter((r) => promptMap.has(r.slug))
      .map((r) => ({ slug: r.slug, prompt: promptMap.get(r.slug)! }))
    if (targets.length > 0) generate(targets, true)
  }

  // Build per-slug error and fallback maps from task events
  const slugErrors = new Map<string, string>()
  const slugFallbacks = new Map<string, string>()
  const currentSlugRef = { value: '' }
  for (const event of taskState?.events ?? []) {
    if (event.eventType === 'image_started') {
      currentSlugRef.value = (event.payload as { slug?: string })?.slug ?? ''
    } else if (event.eventType === 'image_error') {
      const payload = event.payload as { slug?: string; error?: string }
      if (payload.slug && payload.error) {
        slugErrors.set(payload.slug, payload.error)
      }
    } else if (event.eventType === 'image_fallback') {
      const payload = event.payload as {
        slug?: string
        primaryError?: string
        fallbackProvider?: string
      }
      if (payload.slug) {
        slugFallbacks.set(
          payload.slug,
          `Primary failed: ${payload.primaryError} — trying ${payload.fallbackProvider}...`
        )
      }
    } else if (event.eventType === 'image_complete') {
      // Clear error/fallback on success
      const payload = event.payload as { slug?: string }
      if (payload.slug) {
        slugErrors.delete(payload.slug)
        slugFallbacks.delete(payload.slug)
      }
    }
  }
  const currentSlug = isGenerating ? currentSlugRef.value : ''

  const hasFailures = (taskState?.output?.failed ?? 0) > 0
  const failedResults = taskState?.output?.results?.filter((r) => r.status === 'failed') ?? []

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
      data-component="blog-images-admin"
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
            Blog Hero Images
          </h1>
          <p className={css({ fontSize: '13px', color: '#8b949e' })}>
            Generate AI hero images for blog posts. Posts need a <code>heroPrompt</code> in
            frontmatter.
            {postsWithPrompt.length > 0 && (
              <>
                {' '}
                {postsWithPrompt.filter((p) => p.imageExists).length}/{postsWithPrompt.length}{' '}
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
          {/* Provider/model selector */}
          <select
            data-action="select-provider"
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            disabled={isGenerating}
            className={selectStyle}
          >
            <option value="">Provider...</option>
            {status?.providers.map((p) =>
              p.models.map((m) => (
                <option
                  key={`${p.id}:${m.id}`}
                  value={`${p.id}:${m.id}`}
                  disabled={!p.available}
                >
                  {p.name} / {m.name}
                  {!p.available ? ' (no key)' : ''}
                </option>
              ))
            )}
          </select>

          {/* Fallback provider/model selector */}
          <select
            data-action="select-fallback"
            value={fallbackValue}
            onChange={(e) => setFallbackValue(e.target.value)}
            disabled={isGenerating}
            className={selectStyle}
          >
            <option value="">No fallback</option>
            {status?.providers.map((p) =>
              p.models.map((m) => {
                const val = `${p.id}:${m.id}`
                return (
                  <option
                    key={`fb-${val}`}
                    value={val}
                    disabled={!p.available || val === selectedValue}
                  >
                    Fallback: {p.name} / {m.name}
                    {!p.available ? ' (no key)' : ''}
                  </option>
                )
              })
            )}
          </select>

          {/* Generate All Missing */}
          <button
            data-action="generate-all-missing"
            onClick={handleGenerateAll}
            disabled={isGenerating || missingImages.length === 0}
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
            Generate Missing ({missingImages.length})
          </button>

          {/* Refresh */}
          <button
            data-action="refresh"
            onClick={fetchStatus}
            disabled={isGenerating}
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
        </div>

        {/* Error display — local errors and task-level failures */}
        {(error || taskState?.status === 'failed') && (
          <div
            className={css({
              padding: '12px 16px',
              backgroundColor: '#3d1f28',
              border: '1px solid #f85149',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#f85149',
            })}
          >
            <div>{error || taskState?.error || 'Task failed'}</div>
            {taskState?.status === 'failed' && slugErrors.size > 0 && (
              <div className={css({ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' })}>
                {[...slugErrors.entries()].map(([slug, err]) => (
                  <div
                    key={slug}
                    className={css({
                      fontSize: '12px',
                      color: '#f0a8a8',
                      padding: '4px 8px',
                      backgroundColor: 'rgba(248, 81, 73, 0.1)',
                      borderRadius: '4px',
                    })}
                  >
                    <strong>{slug}:</strong> {err}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {isGenerating && taskState && (
          <div
            data-element="progress"
            className={css({
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: '#161b22',
              borderRadius: '6px',
              border: '1px solid #30363d',
            })}
          >
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '13px',
              })}
            >
              <span>{taskState.progressMessage || 'Generating...'}</span>
              <span>{taskState.progress}%</span>
            </div>
            <div
              className={css({
                height: '6px',
                backgroundColor: '#21262d',
                borderRadius: '3px',
                overflow: 'hidden',
              })}
            >
              <div
                className={css({
                  height: '100%',
                  backgroundColor: '#58a6ff',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease',
                })}
                style={{ width: `${taskState.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Completion summary */}
        {taskState?.status === 'completed' && taskState.output && (
          <div
            className={css({
              padding: '12px 16px',
              backgroundColor: hasFailures ? '#3d1f28' : '#1b2e1f',
              border: `1px solid ${hasFailures ? '#f85149' : '#238636'}`,
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              color: hasFailures ? '#f85149' : '#3fb950',
            })}
          >
            <div>
              {hasFailures ? 'Completed with errors' : 'Done'}:{' '}
              {taskState.output.generated} generated, {taskState.output.skipped} skipped,{' '}
              {taskState.output.failed} failed
            </div>
            {failedResults.length > 0 && (
              <div className={css({ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' })}>
                {failedResults.map((r) => (
                  <div
                    key={r.slug}
                    className={css({
                      fontSize: '12px',
                      color: '#f0a8a8',
                      padding: '4px 8px',
                      backgroundColor: 'rgba(248, 81, 73, 0.1)',
                      borderRadius: '4px',
                    })}
                  >
                    <strong>{r.slug}:</strong> {r.error}
                  </div>
                ))}
                <div className={css({ marginTop: '4px' })}>
                  <button
                    data-action="retry-failed"
                    onClick={handleRetryFailed}
                    className={css({
                      backgroundColor: '#da3633',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 14px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: '#f85149' },
                    })}
                  >
                    Retry Failed ({failedResults.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Posts with heroPrompt */}
        {postsWithPrompt.length > 0 && (
          <div className={css({ marginBottom: '32px' })}>
            <h2
              className={css({
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#f0f6fc',
              })}
            >
              Posts with Hero Prompt
            </h2>

            <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
              {postsWithPrompt.map((post) => {
                const isCurrentlyGenerating = isGenerating && currentSlug === post.slug
                const slugError = slugErrors.get(post.slug)
                return (
                  <div
                    key={post.slug}
                    data-element="post-card"
                    className={css({
                      display: 'flex',
                      gap: '16px',
                      padding: '16px',
                      backgroundColor: '#161b22',
                      borderRadius: '8px',
                      border: slugError ? '1px solid #f85149' : '1px solid #30363d',
                      alignItems: 'flex-start',
                    })}
                  >
                    {/* Thumbnail */}
                    <div
                      className={css({
                        width: '120px',
                        height: '80px',
                        flexShrink: 0,
                        borderRadius: '6px',
                        overflow: 'hidden',
                        backgroundColor: '#0d1117',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #21262d',
                      })}
                    >
                      {post.imageExists ? (
                        <img
                          src={`${post.heroImage || `/blog/${post.slug}.png`}?t=${Date.now()}`}
                          alt={post.title}
                          className={css({
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          })}
                        />
                      ) : isCurrentlyGenerating ? (
                        <span className={css({ fontSize: '24px' })}>...</span>
                      ) : (
                        <span className={css({ fontSize: '11px', color: '#484f58' })}>
                          No image
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className={css({ flex: 1, minWidth: 0 })}>
                      <div
                        className={css({
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#f0f6fc',
                          marginBottom: '4px',
                        })}
                      >
                        {post.title}
                      </div>
                      <div
                        className={css({
                          fontSize: '12px',
                          color: '#8b949e',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        })}
                      >
                        {post.heroPrompt}
                      </div>
                      {post.imageExists && post.sizeBytes && (
                        <div className={css({ fontSize: '11px', color: '#484f58', marginTop: '4px' })}>
                          {formatBytes(post.sizeBytes)}
                        </div>
                      )}
                      {slugFallbacks.get(post.slug) && !slugError && (
                        <div
                          className={css({
                            marginTop: '8px',
                            padding: '6px 10px',
                            backgroundColor: 'rgba(210, 153, 34, 0.1)',
                            border: '1px solid rgba(210, 153, 34, 0.3)',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#d29922',
                            wordBreak: 'break-word',
                          })}
                        >
                          {slugFallbacks.get(post.slug)}
                        </div>
                      )}
                      {slugError && (
                        <div
                          className={css({
                            marginTop: '8px',
                            padding: '6px 10px',
                            backgroundColor: 'rgba(248, 81, 73, 0.1)',
                            border: '1px solid rgba(248, 81, 73, 0.3)',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#f85149',
                            wordBreak: 'break-word',
                          })}
                        >
                          {slugError}
                        </div>
                      )}
                    </div>

                    {/* Status + actions */}
                    <div className={css({ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 })}>
                      {post.imageExists && (
                        <span className={css({ fontSize: '11px', color: '#3fb950' })}>
                          exists
                        </span>
                      )}
                      <button
                        data-action="generate-single"
                        onClick={() => handleGenerateSingle(post, post.imageExists)}
                        disabled={isGenerating}
                        className={css({
                          backgroundColor: post.imageExists ? '#21262d' : '#238636',
                          color: post.imageExists ? '#c9d1d9' : '#fff',
                          border: post.imageExists ? '1px solid #30363d' : 'none',
                          borderRadius: '6px',
                          padding: '4px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: post.imageExists ? '#30363d' : '#2ea043',
                          },
                          '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                        })}
                      >
                        {post.imageExists ? 'Regenerate' : 'Generate'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Posts without heroPrompt */}
        {postsWithoutPrompt.length > 0 && (
          <div>
            <h2
              className={css({
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#8b949e',
              })}
            >
              Posts without Hero Prompt ({postsWithoutPrompt.length})
            </h2>
            <div
              className={css({
                fontSize: '13px',
                color: '#484f58',
                padding: '12px 16px',
                backgroundColor: '#161b22',
                borderRadius: '8px',
                border: '1px solid #21262d',
              })}
            >
              {postsWithoutPrompt.map((p) => p.title).join(', ')}
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

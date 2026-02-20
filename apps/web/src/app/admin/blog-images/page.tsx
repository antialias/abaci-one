'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'
import { BlogCropEditor } from '@/components/admin/BlogCropEditor'
import { RefinePromptModal } from '@/components/admin/RefinePromptModal'
import { useBackgroundTask } from '@/hooks/useBackgroundTask'
import type { BlogImageGenerateOutput } from '@/lib/tasks/blog-image-generate'
import { getHeroComponentList } from '@/lib/blog/heroComponentRegistry'
import { HeroComponentBanner } from '@/components/blog/HeroComponentBanner'

type HeroType = 'generated' | 'storybook' | 'component' | 'html'

interface BlogPostStatus {
  slug: string
  title: string
  heroPrompt: string | null
  heroImage: string | null
  heroAspectRatio: string | null
  featured: boolean
  heroCrop: string | null
  heroImageUrl: string | null
  heroType: string | null
  heroStoryId: string | null
  heroComponentId: string | null
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

/** Determine effective hero type: explicit heroType, or inferred from heroPrompt */
function getEffectiveHeroType(post: BlogPostStatus): HeroType | null {
  if (post.heroType) return post.heroType as HeroType
  if (post.heroPrompt) return 'generated'
  return null
}

/** A post is "configured" if it has a heroType or heroPrompt */
function isConfigured(post: BlogPostStatus): boolean {
  return getEffectiveHeroType(post) !== null
}

const HERO_TYPE_OPTIONS: { value: HeroType; label: string }[] = [
  { value: 'generated', label: 'Generated' },
  { value: 'storybook', label: 'Storybook' },
  { value: 'component', label: 'Component' },
  { value: 'html', label: 'HTML' },
]

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

/** Pre-populated capture bodies for known blog posts */
const CAPTURE_BODY_DEFAULTS: Record<string, string> = {
  'ten-frames-for-regrouping': JSON.stringify({
    config: {
      version: 4,
      mode: 'custom',
      problemsPerPage: 6,
      cols: 3,
      pages: 1,
      orientation: 'landscape',
      name: '',
      digitRange: { min: 2, max: 2 },
      operator: 'addition',
      pAnyStart: 0.75,
      pAllStart: 0.25,
      interpolate: false,
      displayRules: {
        carryBoxes: 'always',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'always',
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      },
      fontSize: 16,
      seed: 42,
      includeAnswerKey: false,
      includeQRCode: false,
    },
  }, null, 2),
  'multi-digit-worksheets': JSON.stringify({
    config: {
      version: 4,
      mode: 'custom',
      problemsPerPage: 8,
      cols: 4,
      pages: 1,
      orientation: 'landscape',
      name: '',
      digitRange: { min: 3, max: 4 },
      operator: 'addition',
      pAnyStart: 0.6,
      pAllStart: 0.15,
      interpolate: false,
      displayRules: {
        carryBoxes: 'always',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'never',
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'never',
        borrowingHints: 'never',
      },
      fontSize: 16,
      seed: 77,
      includeAnswerKey: false,
      includeQRCode: false,
    },
  }, null, 2),
}

export default function BlogImagesAdmin() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [selectedValue, setSelectedValue] = useState('')
  const [fallbackValue, setFallbackValue] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cropEditorSlug, setCropEditorSlug] = useState<string | null>(null)
  const [editingPromptSlug, setEditingPromptSlug] = useState<string | null>(null)
  const [promptDraft, setPromptDraft] = useState('')
  const [savingPromptSlug, setSavingPromptSlug] = useState<string | null>(null)

  // Refine modal state
  const [refineModalOpen, setRefineModalOpen] = useState(false)
  const [refineLoading, setRefineLoading] = useState(false)
  const [refineOriginal, setRefineOriginal] = useState('')
  const [refineRefined, setRefineRefined] = useState('')
  const [refineSlug, setRefineSlug] = useState<string | null>(null)

  // Storybook state
  const [storyIdDrafts, setStoryIdDrafts] = useState<Record<string, string>>({})
  const [capturingSlug, setCapturingSlug] = useState<string | null>(null)

  // HTML state (was "component" before rename)
  const [htmlDrafts, setHtmlDrafts] = useState<Record<string, string>>({})
  const [loadedHtmlSlugs, setLoadedHtmlSlugs] = useState<Set<string>>(new Set())
  const htmlSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Capture-from-URL state
  const [captureUrl, setCaptureUrl] = useState('/api/worksheets/preview')
  const [captureMethod, setCaptureMethod] = useState<'GET' | 'POST'>('POST')
  const [captureBodyDrafts, setCaptureBodyDrafts] = useState<Record<string, string>>(CAPTURE_BODY_DEFAULTS)
  const [captureExtractPath, setCaptureExtractPath] = useState('pages.0')
  const [capturingSnapshotSlug, setCapturingSnapshotSlug] = useState<string | null>(null)

  // Component registry state
  const [componentIdDrafts, setComponentIdDrafts] = useState<Record<string, string>>({})

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

  const configuredPosts = status?.posts.filter(isConfigured) ?? []
  const unconfiguredPosts = status?.posts.filter((p) => !isConfigured(p)) ?? []
  const generatedPosts = configuredPosts.filter((p) => getEffectiveHeroType(p) === 'generated')
  const missingImages = generatedPosts.filter((p) => !p.imageExists)

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
    if (!failedResults.length || !generatedPosts.length) return
    const promptMap = new Map(generatedPosts.map((p) => [p.slug, p.heroPrompt!]))
    const targets = failedResults
      .filter((r) => promptMap.has(r.slug))
      .map((r) => ({ slug: r.slug, prompt: promptMap.get(r.slug)! }))
    if (targets.length > 0) generate(targets, true)
  }

  async function handleToggleFeatured(post: BlogPostStatus) {
    const newFeatured = !post.featured
    setStatus((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        posts: prev.posts.map((p) =>
          p.slug === post.slug ? { ...p, featured: newFeatured } : p
        ),
      }
    })
    try {
      const res = await fetch(`/api/admin/blog/${post.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: newFeatured }),
      })
      if (!res.ok) {
        setStatus((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            posts: prev.posts.map((p) =>
              p.slug === post.slug ? { ...p, featured: !newFeatured } : p
            ),
          }
        })
      }
    } catch {
      setStatus((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          posts: prev.posts.map((p) =>
            p.slug === post.slug ? { ...p, featured: !newFeatured } : p
          ),
        }
      })
    }
  }

  function handleCropSave(slug: string, crop: string) {
    setStatus((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        posts: prev.posts.map((p) =>
          p.slug === slug ? { ...p, heroCrop: crop } : p
        ),
      }
    })
  }

  function startEditingPrompt(post: BlogPostStatus) {
    setEditingPromptSlug(post.slug)
    setPromptDraft(post.heroPrompt ?? '')
  }

  async function handleSavePrompt(slug: string) {
    const trimmed = promptDraft.trim()
    setSavingPromptSlug(slug)
    try {
      const res = await fetch(`/api/admin/blog/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroPrompt: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save prompt')
        return
      }
      setEditingPromptSlug(null)
      setPromptDraft('')
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingPromptSlug(null)
    }
  }

  async function handleChangeHeroType(post: BlogPostStatus, newType: HeroType) {
    setStatus((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        posts: prev.posts.map((p) =>
          p.slug === post.slug ? { ...p, heroType: newType } : p
        ),
      }
    })
    try {
      const res = await fetch(`/api/admin/blog/${post.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroType: newType }),
      })
      if (!res.ok) {
        // Revert
        setStatus((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            posts: prev.posts.map((p) =>
              p.slug === post.slug ? { ...p, heroType: post.heroType } : p
            ),
          }
        })
      }
    } catch {
      setStatus((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          posts: prev.posts.map((p) =>
            p.slug === post.slug ? { ...p, heroType: post.heroType } : p
          ),
        }
      })
    }
  }

  // Refine prompt
  async function handleRefine(post: BlogPostStatus) {
    setRefineSlug(post.slug)
    setRefineOriginal(post.heroPrompt ?? '')
    setRefineRefined('')
    setRefineLoading(true)
    setRefineModalOpen(true)
    try {
      const res = await fetch(`/api/admin/blog/${post.slug}/refine-prompt`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Refine failed')
        setRefineModalOpen(false)
        return
      }
      const data = await res.json()
      setRefineRefined(data.refined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refine failed')
      setRefineModalOpen(false)
    } finally {
      setRefineLoading(false)
    }
  }

  async function handleAcceptRefined(refined: string) {
    if (!refineSlug) return
    setSavingPromptSlug(refineSlug)
    try {
      const res = await fetch(`/api/admin/blog/${refineSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroPrompt: refined }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save refined prompt')
        return
      }
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingPromptSlug(null)
      setRefineSlug(null)
    }
  }

  // Storybook capture
  async function handleSaveStoryId(post: BlogPostStatus) {
    const storyId = storyIdDrafts[post.slug]?.trim()
    if (!storyId) return
    try {
      const res = await fetch(`/api/admin/blog/${post.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroStoryId: storyId }),
      })
      if (res.ok) {
        setStatus((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            posts: prev.posts.map((p) =>
              p.slug === post.slug ? { ...p, heroStoryId: storyId } : p
            ),
          }
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save story ID')
    }
  }

  async function handleCaptureStorybook(post: BlogPostStatus) {
    const storyId = post.heroStoryId || storyIdDrafts[post.slug]?.trim()
    if (!storyId) {
      setError('Set a Story ID first')
      return
    }
    setCapturingSlug(post.slug)
    try {
      const res = await fetch('/api/admin/blog-images/capture-storybook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: post.slug, storyId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Capture failed')
        return
      }
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed')
    } finally {
      setCapturingSlug(null)
    }
  }

  // Component HTML
  async function loadHeroHtml(slug: string) {
    if (loadedHtmlSlugs.has(slug)) return
    try {
      const res = await fetch(`/api/admin/blog/${slug}/hero-html`)
      if (res.ok) {
        const data = await res.json()
        if (data.html !== null) {
          setHtmlDrafts((prev) => ({ ...prev, [slug]: data.html }))
        }
      }
    } catch {
      // ignore
    }
    setLoadedHtmlSlugs((prev) => new Set([...prev, slug]))
  }

  function handleHtmlChange(slug: string, html: string) {
    setHtmlDrafts((prev) => ({ ...prev, [slug]: html }))
    // Debounce save
    if (htmlSaveTimers.current[slug]) {
      clearTimeout(htmlSaveTimers.current[slug])
    }
    htmlSaveTimers.current[slug] = setTimeout(() => {
      fetch(`/api/admin/blog/${slug}/hero-html`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      }).catch(() => {
        // ignore
      })
    }, 500)
  }

  async function handleCaptureSnapshot(slug: string) {
    if (!captureUrl.trim()) {
      setError('Enter a URL to capture')
      return
    }
    setCapturingSnapshotSlug(slug)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        slug,
        url: captureUrl.trim(),
        method: captureMethod,
      }
      const bodyText = captureBodyDrafts[slug] ?? ''
      if (captureMethod === 'POST' && bodyText.trim()) {
        try {
          payload.body = JSON.parse(bodyText)
        } catch {
          setError('Invalid JSON in request body')
          setCapturingSnapshotSlug(null)
          return
        }
      }
      if (captureExtractPath.trim()) {
        payload.extractPath = captureExtractPath.trim()
      }
      const res = await fetch('/api/admin/blog-images/capture-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Capture failed')
        return
      }
      // Re-load the hero HTML into the draft so the textarea + preview update
      const htmlRes = await fetch(`/api/admin/blog/${slug}/hero-html`)
      if (htmlRes.ok) {
        const data = await htmlRes.json()
        if (data.html !== null) {
          setHtmlDrafts((prev) => ({ ...prev, [slug]: data.html }))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed')
    } finally {
      setCapturingSnapshotSlug(null)
    }
  }

  async function handleSaveComponentId(post: BlogPostStatus) {
    const componentId = componentIdDrafts[post.slug]?.trim() || ''
    try {
      const res = await fetch(`/api/admin/blog/${post.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroComponentId: componentId }),
      })
      if (res.ok) {
        setStatus((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            posts: prev.posts.map((p) =>
              p.slug === post.slug ? { ...p, heroComponentId: componentId || null } : p
            ),
          }
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save component ID')
    }
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

      <RefinePromptModal
        open={refineModalOpen}
        onOpenChange={setRefineModalOpen}
        original={refineOriginal}
        refined={refineRefined}
        loading={refineLoading}
        onAccept={handleAcceptRefined}
      />

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
            Manage hero images for blog posts. Supports AI-generated, Storybook screenshots, and
            HTML/CSS components.
            {generatedPosts.length > 0 && (
              <>
                {' '}
                {generatedPosts.filter((p) => p.imageExists).length}/{generatedPosts.length}{' '}
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

        {/* Error display */}
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

        {/* Posts with Hero Config */}
        {configuredPosts.length > 0 && (
          <div className={css({ marginBottom: '32px' })}>
            <h2
              className={css({
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#f0f6fc',
              })}
            >
              Posts with Hero Config
            </h2>

            <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
              {configuredPosts.map((post) => {
                const effectiveType = getEffectiveHeroType(post)!
                const isCurrentlyGenerating = isGenerating && currentSlug === post.slug
                const slugError = slugErrors.get(post.slug)
                const imageUrl = post.heroImageUrl || post.heroImage || `/blog/${post.slug}.png`
                return (
                  <div key={post.slug}>
                    <div
                      data-element="post-card"
                      className={css({
                        display: 'flex',
                        gap: '16px',
                        padding: '16px',
                        backgroundColor: '#161b22',
                        borderRadius: cropEditorSlug === post.slug ? '8px 8px 0 0' : '8px',
                        border: slugError ? '1px solid #f85149' : '1px solid #30363d',
                        alignItems: 'flex-start',
                      })}
                    >
                      {/* Featured checkbox */}
                      <label
                        data-element="featured-toggle"
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0,
                          cursor: 'pointer',
                          alignSelf: 'center',
                        })}
                        title={post.featured ? 'Featured — click to unfeature' : 'Not featured — click to feature'}
                      >
                        <input
                          data-action="toggle-featured"
                          type="checkbox"
                          checked={post.featured}
                          onChange={() => handleToggleFeatured(post)}
                          className={css({
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#58a6ff',
                          })}
                        />
                      </label>

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
                            src={`${imageUrl}?t=${Date.now()}`}
                            alt={post.title}
                            style={post.heroCrop ? { objectPosition: post.heroCrop } : undefined}
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          })}
                        >
                          {post.title}
                          {post.featured && (
                            <span
                              className={css({
                                fontSize: '10px',
                                fontWeight: '600',
                                color: '#58a6ff',
                                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                                border: '1px solid rgba(88, 166, 255, 0.3)',
                                borderRadius: '4px',
                                padding: '1px 6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              })}
                            >
                              Featured
                            </span>
                          )}
                        </div>

                        {/* Hero type selector */}
                        <div
                          data-element="hero-type-selector"
                          className={css({
                            display: 'flex',
                            marginBottom: '8px',
                          })}
                        >
                          {HERO_TYPE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              data-action={`select-hero-type-${opt.value}`}
                              onClick={() => handleChangeHeroType(post, opt.value)}
                              className={segmentBtnStyle(effectiveType === opt.value)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Type-specific UI */}
                        {effectiveType === 'generated' && (
                          <GeneratedUI
                            post={post}
                            editingPromptSlug={editingPromptSlug}
                            promptDraft={promptDraft}
                            setPromptDraft={setPromptDraft}
                            savingPromptSlug={savingPromptSlug}
                            onStartEditing={() => startEditingPrompt(post)}
                            onCancelEditing={() => { setEditingPromptSlug(null); setPromptDraft('') }}
                            onSavePrompt={() => handleSavePrompt(post.slug)}
                            onRefine={() => handleRefine(post)}
                          />
                        )}

                        {effectiveType === 'storybook' && (
                          <StorybookUI
                            post={post}
                            storyIdDraft={storyIdDrafts[post.slug] ?? post.heroStoryId ?? ''}
                            onStoryIdChange={(val) => setStoryIdDrafts((prev) => ({ ...prev, [post.slug]: val }))}
                            onSaveStoryId={() => handleSaveStoryId(post)}
                            onCapture={() => handleCaptureStorybook(post)}
                            capturing={capturingSlug === post.slug}
                          />
                        )}

                        {effectiveType === 'component' && (
                          <ComponentRegistryUI
                            post={post}
                            componentIdDraft={componentIdDrafts[post.slug] ?? post.heroComponentId ?? ''}
                            onComponentIdChange={(val) => setComponentIdDrafts((prev) => ({ ...prev, [post.slug]: val }))}
                            onSave={() => handleSaveComponentId(post)}
                          />
                        )}

                        {effectiveType === 'html' && (
                          <HtmlUI
                            post={post}
                            htmlDraft={htmlDrafts[post.slug] ?? ''}
                            onHtmlChange={(val) => handleHtmlChange(post.slug, val)}
                            onLoad={() => loadHeroHtml(post.slug)}
                            captureUrl={captureUrl}
                            onCaptureUrlChange={setCaptureUrl}
                            captureMethod={captureMethod}
                            onCaptureMethodChange={setCaptureMethod}
                            captureBody={captureBodyDrafts[post.slug] ?? ''}
                            onCaptureBodyChange={(val) => setCaptureBodyDrafts((prev) => ({ ...prev, [post.slug]: val }))}
                            captureExtractPath={captureExtractPath}
                            onCaptureExtractPathChange={setCaptureExtractPath}
                            capturing={capturingSnapshotSlug === post.slug}
                            onCapture={() => handleCaptureSnapshot(post.slug)}
                          />
                        )}

                        {/* Status line */}
                        {post.imageExists && post.sizeBytes && effectiveType === 'generated' && (
                          <div className={css({ fontSize: '11px', color: '#484f58', marginTop: '4px' })}>
                            {formatBytes(post.sizeBytes)}
                            {post.heroCrop && (
                              <span className={css({ marginLeft: '8px' })}>
                                crop: {post.heroCrop}
                              </span>
                            )}
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
                        {effectiveType === 'generated' && (
                          <>
                            {post.imageExists && (
                              <>
                                <span className={css({ fontSize: '11px', color: '#3fb950' })}>
                                  exists
                                </span>
                                <button
                                  data-action="open-crop-editor"
                                  onClick={() =>
                                    setCropEditorSlug(cropEditorSlug === post.slug ? null : post.slug)
                                  }
                                  className={css({
                                    backgroundColor: cropEditorSlug === post.slug ? '#30363d' : '#21262d',
                                    color: '#c9d1d9',
                                    border: '1px solid #30363d',
                                    borderRadius: '6px',
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#30363d' },
                                  })}
                                >
                                  Crop
                                </button>
                              </>
                            )}
                            {post.heroPrompt && (
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
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Crop editor expansion */}
                    {cropEditorSlug === post.slug && post.imageExists && (
                      <div
                        className={css({
                          borderLeft: '1px solid #30363d',
                          borderRight: '1px solid #30363d',
                          borderBottom: '1px solid #30363d',
                          borderRadius: '0 0 8px 8px',
                          backgroundColor: '#161b22',
                        })}
                      >
                        <BlogCropEditor
                          slug={post.slug}
                          imageUrl={imageUrl}
                          currentCrop={post.heroCrop}
                          onSave={(crop) => handleCropSave(post.slug, crop)}
                          onClose={() => setCropEditorSlug(null)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Posts without Hero Config */}
        {unconfiguredPosts.length > 0 && (
          <div>
            <h2
              className={css({
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#8b949e',
              })}
            >
              Posts without Hero Config ({unconfiguredPosts.length})
            </h2>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '8px' })}>
              {unconfiguredPosts.map((post) => (
                <div
                  key={post.slug}
                  data-element="post-card-no-config"
                  className={css({
                    padding: '16px',
                    backgroundColor: '#161b22',
                    borderRadius: '8px',
                    border: '1px solid #21262d',
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: editingPromptSlug === post.slug ? '12px' : '0',
                    })}
                  >
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
                      <label
                        data-element="featured-toggle"
                        className={css({ cursor: 'pointer' })}
                        title={post.featured ? 'Featured — click to unfeature' : 'Not featured — click to feature'}
                      >
                        <input
                          data-action="toggle-featured"
                          type="checkbox"
                          checked={post.featured}
                          onChange={() => handleToggleFeatured(post)}
                          className={css({
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: '#58a6ff',
                          })}
                        />
                      </label>
                      <div>
                        <div
                          className={css({
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#f0f6fc',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          })}
                        >
                          {post.title}
                          {post.featured && (
                            <span
                              className={css({
                                fontSize: '10px',
                                fontWeight: '600',
                                color: '#58a6ff',
                                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                                border: '1px solid rgba(88, 166, 255, 0.3)',
                                borderRadius: '4px',
                                padding: '1px 6px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              })}
                            >
                              Featured
                            </span>
                          )}
                        </div>
                        <div className={css({ fontSize: '11px', color: '#484f58' })}>
                          {post.slug}
                        </div>
                      </div>
                    </div>
                    <div className={css({ display: 'flex', gap: '8px' })}>
                      {editingPromptSlug !== post.slug && (
                        <button
                          data-action="add-prompt"
                          onClick={() => startEditingPrompt(post)}
                          className={smallBtnStyle}
                        >
                          Add Prompt
                        </button>
                      )}
                      {HERO_TYPE_OPTIONS.filter((o) => o.value !== 'generated').map((opt) => (
                        <button
                          key={opt.value}
                          data-action={`set-hero-type-${opt.value}`}
                          onClick={() => handleChangeHeroType(post, opt.value)}
                          className={smallBtnStyle}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt editor */}
                  {editingPromptSlug === post.slug && (
                    <div data-element="prompt-editor">
                      <textarea
                        data-element="prompt-textarea"
                        value={promptDraft}
                        onChange={(e) => setPromptDraft(e.target.value)}
                        placeholder="Describe the hero image to generate..."
                        rows={3}
                        className={css({
                          width: '100%',
                          backgroundColor: '#0d1117',
                          border: '1px solid #30363d',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          color: '#c9d1d9',
                          fontSize: '13px',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          '&:focus': {
                            outline: 'none',
                            borderColor: '#58a6ff',
                          },
                        })}
                      />
                      <div
                        className={css({
                          display: 'flex',
                          gap: '8px',
                          marginTop: '8px',
                          justifyContent: 'flex-end',
                        })}
                      >
                        <button
                          data-action="cancel-prompt"
                          onClick={() => {
                            setEditingPromptSlug(null)
                            setPromptDraft('')
                          }}
                          className={smallBtnStyle}
                        >
                          Cancel
                        </button>
                        <button
                          data-action="save-prompt"
                          onClick={() => handleSavePrompt(post.slug)}
                          disabled={!promptDraft.trim() || savingPromptSlug === post.slug}
                          className={css({
                            backgroundColor: '#238636',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: '#2ea043' },
                            '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                          })}
                        >
                          {savingPromptSlug === post.slug ? 'Saving...' : 'Save Prompt'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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

/* -------------------------------------------------------------------------- */
/*  Type-specific sub-components                                               */
/* -------------------------------------------------------------------------- */

function GeneratedUI({
  post,
  editingPromptSlug,
  promptDraft,
  setPromptDraft,
  savingPromptSlug,
  onStartEditing,
  onCancelEditing,
  onSavePrompt,
  onRefine,
}: {
  post: BlogPostStatus
  editingPromptSlug: string | null
  promptDraft: string
  setPromptDraft: (v: string) => void
  savingPromptSlug: string | null
  onStartEditing: () => void
  onCancelEditing: () => void
  onSavePrompt: () => void
  onRefine: () => void
}) {
  if (editingPromptSlug === post.slug) {
    return (
      <div data-element="prompt-editor-inline">
        <textarea
          data-element="prompt-textarea"
          value={promptDraft}
          onChange={(e) => setPromptDraft(e.target.value)}
          rows={3}
          className={css({
            width: '100%',
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '8px 12px',
            color: '#c9d1d9',
            fontSize: '12px',
            resize: 'vertical',
            fontFamily: 'inherit',
            '&:focus': { outline: 'none', borderColor: '#58a6ff' },
          })}
        />
        <div className={css({ display: 'flex', gap: '8px', marginTop: '4px' })}>
          <button
            data-action="cancel-prompt"
            onClick={onCancelEditing}
            className={smallBtnStyle}
          >
            Cancel
          </button>
          <button
            data-action="save-prompt"
            onClick={onSavePrompt}
            disabled={!promptDraft.trim() || savingPromptSlug === post.slug}
            className={css({
              backgroundColor: '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '2px 10px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              '&:hover': { backgroundColor: '#2ea043' },
              '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {savingPromptSlug === post.slug ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
      <div
        data-action="edit-prompt"
        onClick={onStartEditing}
        title="Click to edit prompt"
        className={css({
          fontSize: '12px',
          color: '#8b949e',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          flex: 1,
          '&:hover': { color: '#c9d1d9' },
        })}
      >
        {post.heroPrompt || 'No prompt — click to add'}
      </div>
      {post.heroPrompt && (
        <button
          data-action="refine-prompt"
          onClick={onRefine}
          className={css({
            backgroundColor: '#1f2937',
            color: '#a78bfa',
            border: '1px solid #4c1d95',
            borderRadius: '6px',
            padding: '2px 10px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            flexShrink: 0,
            '&:hover': { backgroundColor: '#2d1b69', borderColor: '#7c3aed' },
          })}
        >
          Refine
        </button>
      )}
    </div>
  )
}

function StorybookUI({
  post,
  storyIdDraft,
  onStoryIdChange,
  onSaveStoryId,
  onCapture,
  capturing,
}: {
  post: BlogPostStatus
  storyIdDraft: string
  onStoryIdChange: (val: string) => void
  onSaveStoryId: () => void
  onCapture: () => void
  capturing: boolean
}) {
  const storyId = post.heroStoryId || storyIdDraft

  return (
    <div data-element="storybook-ui">
      <div className={css({ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' })}>
        <input
          data-element="story-id-input"
          type="text"
          value={storyIdDraft}
          onChange={(e) => onStoryIdChange(e.target.value)}
          placeholder="Story ID (e.g. components-abacus--default)"
          className={css({
            flex: 1,
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '4px 8px',
            color: '#c9d1d9',
            fontSize: '12px',
            '&:focus': { outline: 'none', borderColor: '#58a6ff' },
          })}
        />
        <button
          data-action="save-story-id"
          onClick={onSaveStoryId}
          disabled={!storyIdDraft.trim()}
          className={smallBtnStyle}
        >
          Save ID
        </button>
        <button
          data-action="capture-storybook"
          onClick={onCapture}
          disabled={!storyId || capturing}
          className={css({
            backgroundColor: '#238636',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#2ea043' },
            '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {capturing ? 'Capturing...' : 'Capture Screenshot'}
        </button>
      </div>
      {storyId && (
        <div
          data-element="storybook-preview"
          className={css({
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #21262d',
            aspectRatio: '2.4 / 1',
            maxHeight: '200px',
          })}
        >
          <iframe
            src={`http://localhost:6006/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`}
            title="Storybook preview"
            className={css({
              width: '100%',
              height: '100%',
              border: 'none',
            })}
          />
        </div>
      )}
    </div>
  )
}

function HtmlUI({
  post,
  htmlDraft,
  onHtmlChange,
  onLoad,
  captureUrl,
  onCaptureUrlChange,
  captureMethod,
  onCaptureMethodChange,
  captureBody,
  onCaptureBodyChange,
  captureExtractPath,
  onCaptureExtractPathChange,
  capturing,
  onCapture,
}: {
  post: BlogPostStatus
  htmlDraft: string
  onHtmlChange: (val: string) => void
  onLoad: () => void
  captureUrl: string
  onCaptureUrlChange: (val: string) => void
  captureMethod: 'GET' | 'POST'
  onCaptureMethodChange: (val: 'GET' | 'POST') => void
  captureBody: string
  onCaptureBodyChange: (val: string) => void
  captureExtractPath: string
  onCaptureExtractPathChange: (val: string) => void
  capturing: boolean
  onCapture: () => void
}) {
  const hasCapture = !!captureBody.trim()
  const [captureOpen, setCaptureOpen] = useState(hasCapture)

  useEffect(() => {
    onLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.slug])

  return (
    <div data-element="html-ui">
      {/* Capture from URL section */}
      <div
        data-element="capture-section"
        className={css({
          marginBottom: '8px',
          border: hasCapture ? '1px solid #30363d' : '1px solid #21262d',
          borderRadius: '6px',
          overflow: 'hidden',
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#161b22',
          })}
        >
          <button
            data-action="toggle-capture"
            onClick={() => setCaptureOpen(!captureOpen)}
            className={css({
              flex: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 10px',
              backgroundColor: 'transparent',
              border: 'none',
              color: hasCapture ? '#c9d1d9' : '#8b949e',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              '&:hover': { color: '#c9d1d9' },
            })}
          >
            <span>
              Capture from URL
              {hasCapture && (
                <span className={css({ color: '#3fb950', marginLeft: '6px', fontSize: '10px' })}>
                  configured
                </span>
              )}
            </span>
            <span>{captureOpen ? '\u25B2' : '\u25BC'}</span>
          </button>
          {hasCapture && (
            <button
              data-action="clear-capture"
              onClick={() => {
                onCaptureBodyChange('')
                setCaptureOpen(false)
              }}
              title="Clear capture config"
              className={css({
                backgroundColor: 'transparent',
                border: 'none',
                color: '#484f58',
                fontSize: '11px',
                padding: '4px 8px',
                cursor: 'pointer',
                '&:hover': { color: '#f85149' },
              })}
            >
              Clear
            </button>
          )}
        </div>
        {captureOpen && (
          <div
            data-element="capture-fields"
            className={css({
              padding: '10px',
              backgroundColor: '#0d1117',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            })}
          >
            <div className={css({ display: 'flex', gap: '8px', alignItems: 'center' })}>
              <input
                data-element="capture-url-input"
                type="text"
                value={captureUrl}
                onChange={(e) => onCaptureUrlChange(e.target.value)}
                placeholder="/api/worksheets/preview"
                className={css({
                  flex: 1,
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: '#c9d1d9',
                  fontSize: '12px',
                  '&:focus': { outline: 'none', borderColor: '#58a6ff' },
                })}
              />
              <div className={css({ display: 'flex' })}>
                {(['GET', 'POST'] as const).map((m) => (
                  <button
                    key={m}
                    data-action={`capture-method-${m.toLowerCase()}`}
                    onClick={() => onCaptureMethodChange(m)}
                    className={segmentBtnStyle(captureMethod === m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {captureMethod === 'POST' && (
              <textarea
                data-element="capture-body-textarea"
                value={captureBody}
                onChange={(e) => onCaptureBodyChange(e.target.value)}
                placeholder='{"key": "value"}'
                rows={3}
                className={css({
                  width: '100%',
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  color: '#c9d1d9',
                  fontSize: '11px',
                  resize: 'vertical',
                  fontFamily: 'monospace',
                  '&:focus': { outline: 'none', borderColor: '#58a6ff' },
                })}
              />
            )}
            <div className={css({ display: 'flex', gap: '8px', alignItems: 'center' })}>
              <input
                data-element="capture-extract-path-input"
                type="text"
                value={captureExtractPath}
                onChange={(e) => onCaptureExtractPathChange(e.target.value)}
                placeholder="Extract path (e.g. pages.0)"
                className={css({
                  flex: 1,
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: '#c9d1d9',
                  fontSize: '12px',
                  '&:focus': { outline: 'none', borderColor: '#58a6ff' },
                })}
              />
              <button
                data-action="capture-snapshot"
                onClick={onCapture}
                disabled={capturing || !captureUrl.trim()}
                className={css({
                  backgroundColor: '#238636',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 14px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flexShrink: 0,
                  '&:hover': { backgroundColor: '#2ea043' },
                  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                {capturing ? 'Capturing...' : 'Capture'}
              </button>
            </div>
          </div>
        )}
      </div>

      <textarea
        data-element="html-textarea"
        value={htmlDraft}
        onChange={(e) => onHtmlChange(e.target.value)}
        placeholder="<div style='...'>\n  Your hero HTML + CSS here\n</div>"
        rows={6}
        className={css({
          width: '100%',
          backgroundColor: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '6px',
          padding: '8px 12px',
          color: '#c9d1d9',
          fontSize: '12px',
          resize: 'vertical',
          fontFamily: 'monospace',
          '&:focus': { outline: 'none', borderColor: '#58a6ff' },
        })}
      />
      <div className={css({ fontSize: '11px', color: '#484f58', marginTop: '4px', marginBottom: '8px' })}>
        Auto-saves after 500ms
      </div>
      {htmlDraft && (
        <div
          data-element="html-preview"
          className={css({
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #21262d',
            aspectRatio: '2.4 / 1',
            maxHeight: '200px',
            backgroundColor: '#0d1117',
          })}
        >
          <div
            dangerouslySetInnerHTML={{ __html: htmlDraft }}
            className={css({
              width: '100%',
              height: '100%',
            })}
          />
        </div>
      )}
    </div>
  )
}

const heroComponentList = getHeroComponentList()

function ComponentRegistryUI({
  post,
  componentIdDraft,
  onComponentIdChange,
  onSave,
}: {
  post: BlogPostStatus
  componentIdDraft: string
  onComponentIdChange: (val: string) => void
  onSave: () => void
}) {
  const currentId = componentIdDraft || post.heroComponentId || ''

  return (
    <div data-element="component-registry-ui">
      <div className={css({ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' })}>
        <select
          data-action="select-hero-component"
          value={componentIdDraft}
          onChange={(e) => onComponentIdChange(e.target.value)}
          className={css({
            flex: 1,
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '4px 8px',
            color: '#c9d1d9',
            fontSize: '12px',
            cursor: 'pointer',
            '&:focus': { outline: 'none', borderColor: '#58a6ff' },
          })}
        >
          <option value="">Select a component...</option>
          {heroComponentList.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        <button
          data-action="save-component-id"
          onClick={onSave}
          disabled={!componentIdDraft.trim()}
          className={smallBtnStyle}
        >
          Save
        </button>
      </div>
      {currentId && (
        <div
          data-element="component-preview"
          className={css({
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #21262d',
            aspectRatio: '2.4 / 1',
            maxHeight: '200px',
            backgroundColor: '#0d1117',
          })}
        >
          <HeroComponentBanner componentId={currentId} />
        </div>
      )}
    </div>
  )
}

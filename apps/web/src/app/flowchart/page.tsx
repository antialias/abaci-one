'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { loadFlowchart, type GeneratedExample } from '@/lib/flowcharts/loader'
import type { FlowchartDefinition } from '@/lib/flowcharts/schema'
import { downloadFlowchartPDF } from '@/lib/flowcharts/pdf-export'
import type { ExecutableFlowchart, ProblemValue } from '@/lib/flowcharts/schema'
import { generateExamplesAsync } from '@/lib/flowcharts/example-generator-client'
import { diagnoseFlowchart, type DiagnosticReport } from '@/lib/flowcharts/doctor'
import {
  FlowchartModal,
  FlowchartCard,
  DeleteToastContainer,
  SeedManagerPanel,
  type PendingDeletion,
} from '@/components/flowchart'
import { useCreateWorkshopSession } from '@/hooks/useWorkshopSession'
import { useVisualDebug } from '@/contexts/VisualDebugContext'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

type ModalState =
  | { type: 'closed' }
  | { type: 'loading'; flowchartId: string }
  | { type: 'inputting'; flowchartId: string; flowchart: ExecutableFlowchart }
  | { type: 'error'; flowchartId: string; message: string }

type FilterType = 'all' | 'published' | 'drafts'

interface WorkshopSession {
  id: string
  state: string
  topicDescription: string | null
  draftTitle: string | null
  draftEmoji: string | null
  draftDefinitionJson: string | null
  draftMermaidContent: string | null
  createdAt: string
  updatedAt: string
}

interface EmbeddingSearchResult {
  id: string
  title: string
  description: string
  emoji: string
  difficulty: string
  similarity: number
  source: 'hardcoded' | 'database'
}

interface KeywordSearchResult {
  id: string
  title: string
  description: string
  emoji: string
  type: 'draft' | 'published'
  sessionId?: string // For drafts, to navigate to workshop
}

interface PublishedFlowchart {
  id: string
  title: string
  description: string
  emoji: string
  difficulty: string
  source: 'hardcoded' | 'database'
  authorId?: string // Only for database flowcharts
  publishedAt: string | null
}

export default function FlowchartPickerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isVisualDebugEnabled } = useVisualDebug()

  // The selected flowchart ID from URL query param
  const selectedId = searchParams.get('select')

  // Internal modal state (loading/inputting/error) - derived from URL + async loading
  const [modalState, setModalState] = useState<ModalState>({ type: 'closed' })

  // Create workshop session mutation
  const { mutate: createSession, isPending: isCreatingFromSearch } = useCreateWorkshopSession()

  // Filter state
  const [filter, setFilter] = useState<FilterType>('all')

  // Published flowcharts state (both hardcoded and user-created)
  const [publishedFlowcharts, setPublishedFlowcharts] = useState<PublishedFlowchart[]>([])
  const [isLoadingPublished, setIsLoadingPublished] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Draft sessions state
  const [draftSessions, setDraftSessions] = useState<WorkshopSession[]>([])
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(true)

  // Pending deletions for undo functionality
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([])

  // PDF download state (tracks which flowchart is currently being exported)
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [embeddingResults, setEmbeddingResults] = useState<EmbeddingSearchResult[]>([])
  const [keywordResults, setKeywordResults] = useState<KeywordSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Examples for animated card backgrounds (generated client-side)
  // Unified map for both published flowcharts (keyed by flowchart ID) and drafts (keyed by session ID)
  const [cardExamples, setCardExamples] = useState<
    Map<
      string,
      {
        flowchart: ExecutableFlowchart
        examples: GeneratedExample[]
        diagnosticReport: DiagnosticReport
      }
    >
  >(new Map())

  // Track IDs currently being generated to prevent duplicate work
  const generatingIdsRef = useRef<Set<string>>(new Set())

  // Compute diagnostics for draft sessions (memoized)
  const draftDiagnostics = useMemo(() => {
    const diagnosticsMap = new Map<string, DiagnosticReport>()
    for (const session of draftSessions) {
      if (session.draftDefinitionJson) {
        try {
          const definition: FlowchartDefinition = JSON.parse(session.draftDefinitionJson)
          const report = diagnoseFlowchart(definition, session.draftMermaidContent || undefined)
          diagnosticsMap.set(session.id, report)
        } catch {
          // Invalid JSON, skip
        }
      }
    }
    return diagnosticsMap
  }, [draftSessions])

  // Load published flowcharts (hardcoded + user-created)
  const loadPublished = useCallback(async () => {
    try {
      const response = await fetch('/api/flowcharts/browse')
      if (response.ok) {
        const data = await response.json()
        setPublishedFlowcharts(data.flowcharts || [])
        setCurrentUserId(data.currentUserId || null)
      }
    } catch (err) {
      console.error('Failed to load published flowcharts:', err)
    } finally {
      setIsLoadingPublished(false)
    }
  }, [])

  useEffect(() => {
    loadPublished()
  }, [loadPublished])

  // Load draft sessions
  useEffect(() => {
    async function loadDrafts() {
      try {
        const response = await fetch('/api/flowchart-workshop/sessions')
        if (response.ok) {
          const data = await response.json()
          setDraftSessions(data.sessions || [])
        }
      } catch (err) {
        console.error('Failed to load draft sessions:', err)
      } finally {
        setIsLoadingDrafts(false)
      }
    }
    loadDrafts()
  }, [])

  // Generate examples for ALL flowcharts (published + drafts) in a single unified effect
  // Uses concurrent generation - the worker pool properly queues requests via request IDs
  useEffect(() => {
    if (isLoadingPublished || isLoadingDrafts) return

    // Collect all items that need examples generated
    type ItemToGenerate = {
      id: string
      title: string
      type: 'published' | 'draft'
      // For drafts only:
      definitionJson?: string
      mermaidContent?: string
    }

    const itemsToGenerate: ItemToGenerate[] = []

    // Add published flowcharts (all from database now)
    for (const fc of publishedFlowcharts) {
      if (cardExamples.has(fc.id) || generatingIdsRef.current.has(fc.id)) continue
      itemsToGenerate.push({
        id: fc.id,
        title: fc.title,
        type: 'published',
      })
    }

    // Add healthy drafts with valid definitions
    for (const session of draftSessions) {
      if (cardExamples.has(session.id) || generatingIdsRef.current.has(session.id)) continue
      if (!session.draftDefinitionJson || !session.draftMermaidContent) continue

      // Only include healthy drafts
      const report = draftDiagnostics.get(session.id)
      if (report && !report.isHealthy) continue

      itemsToGenerate.push({
        id: session.id,
        title: session.draftTitle || 'Untitled Draft',
        type: 'draft',
        definitionJson: session.draftDefinitionJson,
        mermaidContent: session.draftMermaidContent,
      })
    }

    if (itemsToGenerate.length === 0) return

    // Mark all as generating before starting
    for (const item of itemsToGenerate) {
      generatingIdsRef.current.add(item.id)
    }

    // Generate examples for a single item
    async function generateForItem(item: ItemToGenerate): Promise<void> {
      try {
        let executable: ExecutableFlowchart
        let mermaidContent: string | undefined

        if (item.type === 'published') {
          // All published flowcharts are loaded from database via API
          const response = await fetch(`/api/flowcharts/${item.id}`)
          if (!response.ok) return
          const data = await response.json()
          const { definition, mermaid } = data.flowchart as {
            definition: FlowchartDefinition
            mermaid: string
          }
          executable = await loadFlowchart(definition, mermaid)
          mermaidContent = mermaid
        } else {
          // Draft - use local JSON from session
          const definition: FlowchartDefinition = JSON.parse(item.definitionJson!)
          executable = await loadFlowchart(definition, item.mermaidContent!)
          mermaidContent = item.mermaidContent
        }

        const diagnosticReport = diagnoseFlowchart(executable.definition, mermaidContent)
        const examples = await generateExamplesAsync(executable, 10, {})

        setCardExamples((prev) =>
          new Map(prev).set(item.id, { flowchart: executable, examples, diagnosticReport })
        )
      } catch (err) {
        console.error(`[Examples] Failed to generate for ${item.title}:`, err)
      } finally {
        generatingIdsRef.current.delete(item.id)
      }
    }

    // Generate all examples concurrently - the worker pool handles queuing
    Promise.all(itemsToGenerate.map(generateForItem))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingPublished, isLoadingDrafts, publishedFlowcharts, draftSessions, draftDiagnostics])

  // Debounced search for flowcharts
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search if query is too short
    if (searchQuery.trim().length < 3) {
      setEmbeddingResults([])
      setKeywordResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    // Debounce the search by 500ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // 1. Embedding search via API (semantic matching)
        const response = await fetch('/api/flowcharts/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, limit: 10 }),
        })

        let embeddingMatches: EmbeddingSearchResult[] = []
        if (response.ok) {
          const data = await response.json()
          embeddingMatches = data.suggestions || []
        }
        setEmbeddingResults(embeddingMatches)

        // 2. Keyword search on drafts (local matching)
        const queryLower = searchQuery.toLowerCase()
        const embeddingIds = new Set(embeddingMatches.map((r) => r.id))

        const keywordMatches: KeywordSearchResult[] = []

        // Search drafts by keyword
        for (const draft of draftSessions) {
          const title = draft.draftTitle || draft.topicDescription || ''
          if (title.toLowerCase().includes(queryLower)) {
            keywordMatches.push({
              id: draft.id,
              title: title || 'Untitled',
              description: draft.topicDescription || '',
              emoji: draft.draftEmoji || '📝',
              type: 'draft',
              sessionId: draft.id,
            })
          }
        }

        // Search published flowcharts that weren't in embedding results
        for (const fc of publishedFlowcharts) {
          if (embeddingIds.has(fc.id)) continue // Already matched by embedding
          const inTitle = fc.title.toLowerCase().includes(queryLower)
          const inDescription = fc.description?.toLowerCase().includes(queryLower)
          if (inTitle || inDescription) {
            keywordMatches.push({
              id: fc.id,
              title: fc.title,
              description: fc.description,
              emoji: fc.emoji,
              type: 'published',
            })
          }
        }

        setKeywordResults(keywordMatches)
      } catch (err) {
        console.error('Failed to search flowcharts:', err)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, draftSessions, publishedFlowcharts])

  // Handle draft session actions
  const handleResumeDraft = useCallback(
    (sessionId: string) => {
      router.push(`/flowchart/workshop/${sessionId}`)
    },
    [router]
  )

  // Handle remixing a built-in flowchart
  const handleRemix = useCallback(
    async (flowchartId: string) => {
      try {
        const response = await fetch('/api/flowchart-workshop/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ remixFromId: flowchartId }),
        })

        if (!response.ok) {
          throw new Error('Failed to create remix session')
        }

        const { session } = await response.json()
        router.push(`/flowchart/workshop/${session.id}`)
      } catch (err) {
        console.error('Failed to remix flowchart:', err)
      }
    },
    [router]
  )

  // Handle editing user's own published flowchart
  const handleEditPublished = useCallback(
    async (flowchartId: string) => {
      try {
        const response = await fetch('/api/flowchart-workshop/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editPublishedId: flowchartId }),
        })

        if (!response.ok) {
          throw new Error('Failed to create edit session')
        }

        const { session } = await response.json()
        router.push(`/flowchart/workshop/${session.id}`)
      } catch (err) {
        console.error('Failed to start editing flowchart:', err)
      }
    },
    [router]
  )

  // Handle creating a new flowchart from the search bar query
  const handleCreateFromSearch = useCallback(() => {
    if (!searchQuery.trim()) return
    createSession({ topicDescription: searchQuery.trim() })
  }, [searchQuery, createSession])

  // Handle PDF download for a built-in flowchart
  const handleDownloadPDF = useCallback(async (flowchartId: string) => {
    setExportingPdfId(flowchartId)
    try {
      // Fetch flowchart from API (all flowcharts are in database now)
      const response = await fetch(`/api/flowcharts/${flowchartId}`)
      if (!response.ok) {
        console.error('Flowchart not found:', flowchartId)
        return
      }
      const data = await response.json()
      const { mermaid, meta } = data.flowchart as {
        mermaid: string
        meta: { title: string; description: string }
      }

      await downloadFlowchartPDF(mermaid, {
        title: meta.title,
        description: meta.description,
        flowchartId,
      })
    } catch (err) {
      console.error('Failed to export PDF:', err)
    } finally {
      setExportingPdfId(null)
    }
  }, [])

  // Start deletion with undo option
  const handleDeleteDraft = useCallback(
    (sessionId: string) => {
      const session = draftSessions.find((s) => s.id === sessionId)
      if (!session) return

      // Add to pending deletions
      setPendingDeletions((prev) => [
        ...prev,
        {
          id: sessionId,
          title: session.draftTitle || session.topicDescription || 'Untitled',
          createdAt: Date.now(),
        },
      ])

      // Hide from list immediately
      setDraftSessions((prev) => prev.filter((s) => s.id !== sessionId))
    },
    [draftSessions]
  )

  // Undo deletion
  const handleUndoDelete = useCallback((deletion: PendingDeletion) => {
    // Remove from pending
    setPendingDeletions((prev) => prev.filter((d) => d.id !== deletion.id))

    // Re-fetch sessions to restore the item
    fetch('/api/flowchart-workshop/sessions')
      .then((res) => res.json())
      .then((data) => setDraftSessions(data.sessions || []))
      .catch(console.error)
  }, [])

  // Confirm deletion (actually delete)
  const handleConfirmDelete = useCallback(async (deletion: PendingDeletion) => {
    // Remove from pending
    setPendingDeletions((prev) => prev.filter((d) => d.id !== deletion.id))

    // Actually delete
    try {
      await fetch(`/api/flowchart-workshop/sessions/${deletion.id}`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }, [])

  // Sync modal state with URL query param
  useEffect(() => {
    if (!selectedId) {
      // URL has no selection - close modal
      setModalState({ type: 'closed' })
      return
    }

    // URL has a selection - check if we need to load it
    const needsLoad = modalState.type === 'closed' || modalState.flowchartId !== selectedId
    if (needsLoad) {
      // Start loading the newly selected flowchart
      setModalState({ type: 'loading', flowchartId: selectedId })
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load flowchart when modal enters loading state
  useEffect(() => {
    if (modalState.type !== 'loading') return

    const flowchartId = modalState.flowchartId

    async function load() {
      try {
        // Fetch from API (supports both hardcoded and database flowcharts)
        const response = await fetch(`/api/flowcharts/${flowchartId}`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          setModalState({
            type: 'error',
            flowchartId,
            message: errorData.error || 'Flowchart not found',
          })
          return
        }

        const data = await response.json()
        const { definition, mermaid } = data.flowchart as {
          definition: FlowchartDefinition
          mermaid: string
        }

        const flowchart = await loadFlowchart(definition, mermaid)
        setModalState({ type: 'inputting', flowchartId, flowchart })
      } catch (error) {
        console.error('Error loading flowchart:', error)
        setModalState({ type: 'error', flowchartId, message: 'Failed to load flowchart' })
      }
    }

    load()
  }, [modalState])

  // Open modal by updating URL (adds to browser history)
  const handleCardClick = useCallback(
    (flowchartId: string) => {
      router.push(`/flowchart?select=${flowchartId}`, { scroll: false })
    },
    [router]
  )

  const handleProblemSubmit = useCallback(
    (values: Record<string, ProblemValue>) => {
      if (modalState.type !== 'inputting') return

      // Store problem values in sessionStorage for the walker page to pick up
      const storageKey = `flowchart-problem-${modalState.flowchartId}`
      sessionStorage.setItem(storageKey, JSON.stringify(values))

      // Navigate to the walker page
      router.push(`/flowchart/${modalState.flowchartId}`)
    },
    [modalState, router]
  )

  // Close modal by updating URL (replaces current history entry to avoid back-to-modal loop)
  const handleClose = useCallback(() => {
    router.replace('/flowchart', { scroll: false })
  }, [router])

  const isModalOpen = modalState.type !== 'closed'

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh' })}>
      {/* Seed Manager Panel - only shown in debug mode */}
      {isVisualDebugEnabled && <SeedManagerPanel onSeedComplete={loadPublished} />}

      {/* Outer wrapper: full-width edge-to-edge */}
      <div
        className={css({
          width: '100%',
        })}
      >
        {/* Sticky search/filter bar — top "lid" of the container */}
        <header
          className={css({
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            borderBottom: '2px solid',
            borderBottomColor: { base: 'gray.200', _dark: 'gray.700' },
            backgroundColor: { base: 'white', _dark: 'gray.800' },
            transition: 'border-color 0.15s, box-shadow 0.15s',
            _focusWithin: {
              borderColor: { base: 'blue.500', _dark: 'blue.400' },
              boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)',
            },
          })}
        >
        <div
          className={css({
            display: 'flex',
            flexDirection: { base: 'column', md: 'row' },
            alignItems: { base: 'stretch', md: 'center' },
            width: '100%',
            maxWidth: '1200px',
            paddingX: '4',
            overflow: 'hidden',
          })}
        >
          {/* Search input area */}
          <div
            className={css({
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
            })}
          >
            <span
              className={css({
                position: 'absolute',
                left: '3',
                top: '50%',
                transform: 'translateY(-50%)',
                color: { base: 'gray.400', _dark: 'gray.500' },
                pointerEvents: 'none',
              })}
            >
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="What do you want to learn?"
              className={css({
                width: '100%',
                paddingY: '3',
                paddingLeft: '10',
                paddingRight: searchQuery ? '9' : '3',
                border: 'none',
                backgroundColor: 'transparent',
                color: { base: 'gray.900', _dark: 'gray.100' },
                fontSize: 'md',
                _focus: {
                  outline: 'none',
                },
                _placeholder: {
                  color: { base: 'gray.400', _dark: 'gray.500' },
                },
              })}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={css({
                  position: 'absolute',
                  right: '2',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '1',
                  borderRadius: 'full',
                  border: 'none',
                  backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
                  color: { base: 'gray.600', _dark: 'gray.300' },
                  cursor: 'pointer',
                  fontSize: 'xs',
                  lineHeight: 1,
                  _hover: {
                    backgroundColor: { base: 'gray.300', _dark: 'gray.500' },
                  },
                })}
              >
                ✕
              </button>
            )}
          </div>

          {/* Divider: vertical on md+, horizontal on mobile */}
          <div
            className={css({
              width: { base: '100%', md: '1px' },
              height: { base: '1px', md: '60%' },
              alignSelf: { base: 'stretch', md: 'center' },
              backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
              flexShrink: 0,
            })}
          />

          {/* Filter buttons */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: { base: 'stretch', md: 'flex-start' },
              gap: '1',
              padding: '1',
              flexShrink: 0,
            })}
          >
            {[
              { value: 'all' as const, label: 'All' },
              {
                value: 'published' as const,
                label: `Published${publishedFlowcharts.length > 0 ? ` (${publishedFlowcharts.length})` : ''}`,
              },
              {
                value: 'drafts' as const,
                label: `Drafts${draftSessions.length > 0 ? ` (${draftSessions.length})` : ''}`,
              },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={css({
                  flex: { base: 1, md: 'initial' },
                  paddingY: '1.5',
                  paddingX: '3',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  backgroundColor:
                    filter === option.value ? { base: 'gray.100', _dark: 'gray.700' } : 'transparent',
                  color:
                    filter === option.value
                      ? { base: 'gray.900', _dark: 'gray.100' }
                      : { base: 'gray.600', _dark: 'gray.400' },
                  boxShadow: filter === option.value ? 'sm' : 'none',
                  _hover: {
                    color: { base: 'gray.900', _dark: 'gray.100' },
                  },
                })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        </header>

        {/* Recessed card well — cards sit in this subtle "well" below the sticky header */}
        <div
          className={css({
            backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
            paddingX: '4',
            paddingY: '6',
            display: 'flex',
            justifyContent: 'center',
            minHeight: 0,
            flex: 1,
          })}
        >
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '4',
            width: '100%',
            maxWidth: '1200px',
          })}
        >
        {/* Search results header */}
        {searchQuery.trim().length >= 3 && (
          <div
            className={css({
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: { base: 'gray.600', _dark: 'gray.400' },
              fontSize: 'sm',
            })}
          >
            {isSearching ? (
              'Searching...'
            ) : embeddingResults.length > 0 || keywordResults.length > 0 ? (
              <>
                Found <strong>{embeddingResults.length + keywordResults.length}</strong> result
                {embeddingResults.length + keywordResults.length !== 1 ? 's' : ''} for &ldquo;
                {searchQuery}&rdquo;
              </>
            ) : (
              <>No flowcharts found matching &ldquo;{searchQuery}&rdquo;</>
            )}
          </div>
        )}
        {/* Show search results when search is active */}
        {searchQuery.trim().length >= 3 ? (
          <>
            {/* Prominent create card when best match < 0.55 or no results */}
            {(() => {
              const bestSimilarity =
                embeddingResults.length > 0
                  ? Math.max(...embeddingResults.map((r) => r.similarity))
                  : 0
              return bestSimilarity < 0.55 ? (
                <div
                  className={css({
                    gridColumn: '1 / -1',
                    paddingY: '3',
                    paddingX: '4',
                    borderRadius: 'lg',
                    border: '2px dashed',
                    borderColor: { base: 'blue.300', _dark: 'blue.600' },
                    backgroundColor: { base: 'blue.50', _dark: 'blue.950' },
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3',
                  })}
                >
                  <span className={css({ fontSize: 'lg', flexShrink: 0 })}>&#10024;</span>
                  <span
                    className={css({
                      fontSize: 'sm',
                      color: { base: 'gray.700', _dark: 'gray.300' },
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    })}
                  >
                    Create &ldquo;{searchQuery}&rdquo;
                  </span>
                  <button
                    onClick={handleCreateFromSearch}
                    disabled={isCreatingFromSearch}
                    className={css({
                      paddingY: '1.5',
                      paddingX: '4',
                      borderRadius: 'md',
                      backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
                      color: 'white',
                      fontWeight: 'semibold',
                      fontSize: 'sm',
                      border: 'none',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.2s',
                      _hover: {
                        backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
                      },
                      _disabled: {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      },
                    })}
                  >
                    {isCreatingFromSearch ? 'Creating...' : 'Create'}
                  </button>
                </div>
              ) : null
            })()}

            {/* Semantic matches (embedding-based) */}
            {embeddingResults.length > 0 && (
              <>
                <div
                  className={css({
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3',
                    color: { base: 'gray.500', _dark: 'gray.400' },
                    fontSize: 'sm',
                    marginBottom: '2',
                  })}
                >
                  <span>🧠</span>
                  <span>Semantic matches</span>
                  <div
                    className={css({
                      flex: 1,
                      height: '1px',
                      backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                    })}
                  />
                </div>
                {embeddingResults.map((result) => {
                  // Check if this is the user's own flowchart by looking up in publishedFlowcharts
                  const publishedMatch = publishedFlowcharts.find((fc) => fc.id === result.id)
                  const isOwnFlowchart =
                    result.source === 'database' &&
                    currentUserId &&
                    publishedMatch?.authorId === currentUserId

                  return (
                    <FlowchartCard
                      key={result.id}
                      title={result.title}
                      description={result.description}
                      emoji={result.emoji}
                      difficulty={result.difficulty}
                      subtitle={`${Math.round(result.similarity * 100)}% match`}
                      onClick={() => handleCardClick(result.id)}
                      actions={
                        result.source === 'hardcoded'
                          ? [
                              {
                                label: exportingPdfId === result.id ? 'Exporting...' : 'PDF',
                                onClick: () => handleDownloadPDF(result.id),
                                variant: 'secondary' as const,
                                disabled: exportingPdfId === result.id,
                              },
                              {
                                label: 'Remix',
                                onClick: () => handleRemix(result.id),
                                variant: 'secondary' as const,
                              },
                            ]
                          : isOwnFlowchart
                            ? [
                                {
                                  label: 'Edit',
                                  onClick: () => handleEditPublished(result.id),
                                  variant: 'primary' as const,
                                },
                                {
                                  label: 'Remix',
                                  onClick: () => handleRemix(result.id),
                                  variant: 'secondary' as const,
                                },
                              ]
                            : [
                                {
                                  label: 'Remix',
                                  onClick: () => handleRemix(result.id),
                                  variant: 'secondary' as const,
                                },
                              ]
                      }
                    />
                  )
                })}
              </>
            )}

            {/* Keyword matches */}
            {keywordResults.length > 0 && (
              <>
                <div
                  className={css({
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3',
                    color: { base: 'gray.500', _dark: 'gray.400' },
                    fontSize: 'sm',
                    marginTop: embeddingResults.length > 0 ? '4' : '0',
                    marginBottom: '2',
                  })}
                >
                  <span>🔤</span>
                  <span>Keyword matches</span>
                  <div
                    className={css({
                      flex: 1,
                      height: '1px',
                      backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                    })}
                  />
                </div>
                {keywordResults.map((result) => {
                  // For published keyword matches, check if user owns this flowchart
                  const publishedMatch =
                    result.type === 'published'
                      ? publishedFlowcharts.find((fc) => fc.id === result.id)
                      : null
                  const isOwnFlowchart =
                    result.type === 'published' &&
                    currentUserId &&
                    publishedMatch?.authorId === currentUserId

                  return (
                    <FlowchartCard
                      key={`keyword-${result.id}`}
                      title={result.title}
                      description={result.description}
                      emoji={result.emoji}
                      status={result.type === 'draft' ? 'Draft' : undefined}
                      onClick={() =>
                        result.type === 'draft' && result.sessionId
                          ? handleResumeDraft(result.sessionId)
                          : handleCardClick(result.id)
                      }
                      actions={
                        result.type === 'draft' && result.sessionId
                          ? [
                              {
                                label: 'Edit',
                                href: `/flowchart/workshop/${result.sessionId}`,
                                variant: 'primary' as const,
                              },
                            ]
                          : isOwnFlowchart
                            ? [
                                {
                                  label: 'Edit',
                                  onClick: () => handleEditPublished(result.id),
                                  variant: 'primary' as const,
                                },
                                {
                                  label: 'Remix',
                                  onClick: () => handleRemix(result.id),
                                  variant: 'secondary' as const,
                                },
                              ]
                            : [
                                {
                                  label: 'Remix',
                                  onClick: () => handleRemix(result.id),
                                  variant: 'secondary' as const,
                                },
                              ]
                      }
                    />
                  )
                })}
              </>
            )}

            {/* Create link when good matches exist */}
            {embeddingResults.length > 0 &&
              Math.max(...embeddingResults.map((r) => r.similarity)) >= 0.55 && (
                <div
                  className={css({
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    paddingY: '5',
                    marginTop: '2',
                  })}
                >
                  <button
                    onClick={handleCreateFromSearch}
                    disabled={isCreatingFromSearch}
                    className={css({
                      backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
                      border: '1px solid',
                      borderColor: { base: 'gray.300', _dark: 'gray.600' },
                      borderRadius: 'lg',
                      cursor: 'pointer',
                      color: { base: 'gray.700', _dark: 'gray.300' },
                      fontSize: 'sm',
                      fontWeight: 'medium',
                      paddingY: '3',
                      paddingX: '5',
                      transition: 'all 0.15s',
                      _hover: {
                        backgroundColor: { base: 'blue.50', _dark: 'blue.950' },
                        borderColor: { base: 'blue.300', _dark: 'blue.600' },
                        color: { base: 'blue.700', _dark: 'blue.300' },
                      },
                      _disabled: {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      },
                    })}
                  >
                    {isCreatingFromSearch
                      ? 'Creating...'
                      : `Don\u2019t see what you need? Create \u201C${searchQuery}\u201D \u2192`}
                  </button>
                </div>
              )}
          </>
        ) : (
          <>
            {/* Published flowcharts (hardcoded + user-created) */}
            {filter !== 'drafts' &&
              publishedFlowcharts.map((flowchart) => {
                const isOwnFlowchart =
                  flowchart.source === 'database' &&
                  currentUserId &&
                  flowchart.authorId === currentUserId

                const cardData = cardExamples.get(flowchart.id)

                return (
                  <FlowchartCard
                    key={flowchart.id}
                    title={flowchart.title}
                    description={flowchart.description}
                    emoji={flowchart.emoji}
                    difficulty={flowchart.difficulty}
                    flowchart={cardData?.flowchart}
                    examples={cardData?.examples}
                    diagnosticReport={cardData?.diagnosticReport}
                    onClick={() => handleCardClick(flowchart.id)}
                    actions={
                      flowchart.source === 'hardcoded'
                        ? [
                            {
                              label: exportingPdfId === flowchart.id ? 'Exporting...' : 'PDF',
                              onClick: () => handleDownloadPDF(flowchart.id),
                              variant: 'secondary' as const,
                              disabled: exportingPdfId === flowchart.id,
                            },
                            {
                              label: 'Remix',
                              onClick: () => handleRemix(flowchart.id),
                              variant: 'secondary' as const,
                            },
                          ]
                        : isOwnFlowchart
                          ? [
                              {
                                label: 'Edit',
                                onClick: () => handleEditPublished(flowchart.id),
                                variant: 'primary' as const,
                              },
                              {
                                label: 'Remix',
                                onClick: () => handleRemix(flowchart.id),
                                variant: 'secondary' as const,
                              },
                            ]
                          : [
                              {
                                label: 'Remix',
                                onClick: () => handleRemix(flowchart.id),
                                variant: 'secondary' as const,
                              },
                            ]
                    }
                  />
                )
              })}

            {/* Draft flowcharts */}
            {filter !== 'published' &&
              draftSessions.map((session) => {
                const cardData = cardExamples.get(session.id)

                return (
                  <FlowchartCard
                    key={session.id}
                    title={session.draftTitle || session.topicDescription || 'Untitled'}
                    emoji={session.draftEmoji || '📝'}
                    status={session.state === 'refining' ? 'In Progress' : 'Draft'}
                    subtitle={`Updated ${new Date(session.updatedAt).toLocaleDateString()}`}
                    onClick={() => handleResumeDraft(session.id)}
                    flowchart={cardData?.flowchart}
                    examples={cardData?.examples}
                    diagnosticReport={
                      cardData?.diagnosticReport ?? draftDiagnostics.get(session.id)
                    }
                    actions={[
                      {
                        label: 'Edit',
                        href: `/flowchart/workshop/${session.id}`,
                        variant: 'primary',
                      },
                      {
                        label: 'Delete',
                        onClick: () => handleDeleteDraft(session.id),
                        variant: 'danger',
                      },
                    ]}
                  />
                )
              })}

            {/* Empty state for drafts filter */}
            {filter === 'drafts' && !isLoadingDrafts && draftSessions.length === 0 && (
              <div
                className={css({
                  gridColumn: '1 / -1',
                  padding: '8',
                  textAlign: 'center',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                })}
              >
                <p>No drafts yet. Search for a topic above to create your first flowchart!</p>
              </div>
            )}
          </>
        )}
      </div>
      {/* Close grid */}
      </div>
      {/* Close recessed well */}
      </div>
      {/* Close outer wrapper */}

      {/* Delete toast for undo functionality */}
      <DeleteToastContainer
        deletions={pendingDeletions}
        onUndo={handleUndoDelete}
        onConfirm={handleConfirmDelete}
      />

      {/* Modal for problem selection - state driven by URL query param */}
      <Dialog.Root
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) handleClose()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            className={css({
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              position: 'fixed',
              inset: 0,
              zIndex: 100,
            })}
          />

          {modalState.type === 'loading' && (
            <Dialog.Content
              className={css({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: { base: 'white', _dark: 'gray.800' },
                borderRadius: '2xl',
                padding: '8',
                zIndex: 101,
                _focus: { outline: 'none' },
              })}
            >
              <Dialog.Title className={css({ srOnly: true })}>Loading Flowchart</Dialog.Title>
              <Dialog.Description className={css({ srOnly: true })}>
                Please wait while the flowchart loads
              </Dialog.Description>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                })}
              >
                Loading...
              </div>
            </Dialog.Content>
          )}

          {modalState.type === 'error' && (
            <Dialog.Content
              className={css({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: { base: 'white', _dark: 'gray.800' },
                borderRadius: '2xl',
                padding: '8',
                zIndex: 101,
                _focus: { outline: 'none' },
              })}
            >
              <Dialog.Title className={css({ srOnly: true })}>Error Loading Flowchart</Dialog.Title>
              <Dialog.Description className={css({ srOnly: true })}>
                An error occurred while loading the flowchart
              </Dialog.Description>
              <div className={vstack({ gap: '4', alignItems: 'center' })}>
                <p className={css({ color: { base: 'red.600', _dark: 'red.400' } })}>
                  {modalState.message}
                </p>
                <button
                  onClick={handleClose}
                  className={css({
                    paddingX: '4',
                    paddingY: '2',
                    borderRadius: 'md',
                    backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                    color: { base: 'gray.800', _dark: 'gray.200' },
                    border: 'none',
                    cursor: 'pointer',
                  })}
                >
                  Close
                </button>
              </div>
            </Dialog.Content>
          )}

          {modalState.type === 'inputting' &&
            (() => {
              const flowchartInfo = publishedFlowcharts.find(
                (fc) => fc.id === modalState.flowchartId
              )
              return (
                <FlowchartModal
                  flowchart={modalState.flowchart}
                  onSubmit={handleProblemSubmit}
                  onClose={handleClose}
                  shareUrl={
                    // Show share button for published flowcharts (hardcoded or database)
                    flowchartInfo
                      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/flowchart?select=${modalState.flowchartId}`
                      : undefined
                  }
                  diagnosticReport={cardExamples.get(modalState.flowchartId)?.diagnosticReport}
                  flowchartId={modalState.flowchartId}
                  source={flowchartInfo?.source}
                  isOwnedByUser={flowchartInfo?.authorId === currentUserId}
                />
              )
            })()}
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

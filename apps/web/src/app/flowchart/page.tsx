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
  type PendingDeletion,
} from '@/components/flowchart'
import { Tooltip } from '@/components/ui/Tooltip'
import { useCreateWorkshopSession } from '@/hooks/useWorkshopSession'
import { agglomerativeClustering, subsetDistanceMatrix, distIndex } from '@/lib/flowcharts/clustering'
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
  hasEmbedding?: boolean
}

const CLUSTER_COLORS = [
  { border: { base: 'purple.400', _dark: 'purple.500' }, bg: { base: 'purple.50', _dark: 'purple.950' }, text: { base: 'purple.600', _dark: 'purple.400' }, line: { base: 'purple.200', _dark: 'purple.800' } },
  { border: { base: 'teal.400', _dark: 'teal.500' }, bg: { base: 'teal.50', _dark: 'teal.950' }, text: { base: 'teal.600', _dark: 'teal.400' }, line: { base: 'teal.200', _dark: 'teal.800' } },
  { border: { base: 'orange.400', _dark: 'orange.500' }, bg: { base: 'orange.50', _dark: 'orange.950' }, text: { base: 'orange.600', _dark: 'orange.400' }, line: { base: 'orange.200', _dark: 'orange.800' } },
  { border: { base: 'pink.400', _dark: 'pink.500' }, bg: { base: 'pink.50', _dark: 'pink.950' }, text: { base: 'pink.600', _dark: 'pink.400' }, line: { base: 'pink.200', _dark: 'pink.800' } },
]

export default function FlowchartPickerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

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

  // Distance matrix for clustering (from browse API)
  const [distanceData, setDistanceData] = useState<{ ids: string[]; matrix: number[] } | null>(null)

  // Label breadth scores for diversity-aware label assignment
  const [labelBreadths, setLabelBreadths] = useState<Record<string, number> | null>(null)

  // Pending deletions for undo functionality
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([])

  // PDF download state (tracks which flowchart is currently being exported)
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null)

  // Embedding generation state
  const [isGeneratingEmbeddings, setIsGeneratingEmbeddings] = useState(false)
  const [generatingEmbeddingIds, setGeneratingEmbeddingIds] = useState<Set<string>>(new Set())

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [embeddingResults, setEmbeddingResults] = useState<EmbeddingSearchResult[]>([])
  const [keywordResults, setKeywordResults] = useState<KeywordSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Taxonomy navigation path - supports full breadcrumb trail
  // Stored in URL as JSON-encoded array of {label, ids} objects
  type ScopeLevel = { label: string; ids: string[] }
  const scopePath = useMemo<ScopeLevel[]>(() => {
    const encoded = searchParams.get('scopePath')
    if (!encoded) return []
    try {
      return JSON.parse(decodeURIComponent(encoded))
    } catch {
      return []
    }
  }, [searchParams])

  // Current scope is the deepest level in the path
  const scopedFlowchartIds = scopePath.length > 0 ? scopePath[scopePath.length - 1].ids : null
  const scopeLabel = scopePath.length > 0 ? scopePath[scopePath.length - 1].label : null

  // Helper to navigate deeper into a scope
  const navigateToScope = useCallback(
    (ids: string[], label: string) => {
      const newPath = [...scopePath, { label, ids }]
      const params = new URLSearchParams(searchParams.toString())
      params.set('scopePath', encodeURIComponent(JSON.stringify(newPath)))
      router.push(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams, scopePath]
  )

  // Navigate to a specific level in the breadcrumb (0 = root/all)
  const navigateToLevel = useCallback(
    (level: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (level === 0) {
        params.delete('scopePath')
      } else {
        const newPath = scopePath.slice(0, level)
        params.set('scopePath', encodeURIComponent(JSON.stringify(newPath)))
      }
      const queryString = params.toString()
      router.push(queryString ? `?${queryString}` : '/flowchart', { scroll: false })
    },
    [router, searchParams, scopePath]
  )

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

  // Grid ref and column count for responsive "Explore" button visibility
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridColumnCount, setGridColumnCount] = useState(4) // Default to 4 columns

  // Measure grid column count on resize
  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const measureColumns = () => {
      const style = window.getComputedStyle(grid)
      const columns = style.gridTemplateColumns.split(' ').length
      setGridColumnCount(columns)
    }

    measureColumns()
    const observer = new ResizeObserver(measureColumns)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

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

  // Memoized clustering: recompute when filter or distance data changes
  const clusterAssignments = useMemo(() => {
    if (!distanceData) return null

    // Partition IDs into flowchart IDs and label IDs
    const LABEL_PREFIX = 'label:'
    const flowchartDistIds = distanceData.ids.filter((id) => !id.startsWith(LABEL_PREFIX))
    const labelDistIds = distanceData.ids.filter((id) => id.startsWith(LABEL_PREFIX))

    // Only cluster published flowcharts (drafts don't have embeddings)
    // When scoped, only include flowcharts in the scope
    const baseIds = filter === 'drafts' ? [] : publishedFlowcharts.map((fc) => fc.id)
    const visibleIds = scopedFlowchartIds
      ? baseIds.filter((id) => scopedFlowchartIds.includes(id))
      : baseIds

    // Subset distance matrix to visible flowchart IDs that have embeddings
    const subset = subsetDistanceMatrix(distanceData.ids, distanceData.matrix, visibleIds)
    if (subset.ids.length < 2) return null

    const result = agglomerativeClustering(subset.ids.length, subset.matrix)

    // Build Map<flowchartId, clusterIndex> for O(1) lookup
    const map = new Map<string, number>()
    subset.ids.forEach((id, i) => map.set(id, result.assignments[i]))

    // Collect unique emojis per cluster (max 5)
    const clusterEmojis: string[][] = Array.from({ length: result.k }, () => [])
    subset.ids.forEach((id, i) => {
      const ci = result.assignments[i]
      const fc = publishedFlowcharts.find((f) => f.id === id)
      const emoji = fc?.emoji || '📊'
      if (!clusterEmojis[ci].includes(emoji) && clusterEmojis[ci].length < 5) {
        clusterEmojis[ci].push(emoji)
      }
    })

    // Assign topic labels to clusters using the full distance matrix
    const clusterLabels: (string | null)[] = Array.from({ length: result.k }, () => null)
    const clusterRunnerUps: { label: string; score: number }[][] = Array.from({ length: result.k }, () => [])
    const clusterDiversityScores: number[] = Array.from({ length: result.k }, () => 0)
    const flowchartMatchStrengths = new Map<string, number>() // flowchartId -> 0-100 match strength

    if (labelDistIds.length > 0) {
      const fullN = distanceData.ids.length
      const fullIdxMap = new Map<string, number>()
      distanceData.ids.forEach((id, i) => fullIdxMap.set(id, i))


      // Compute cluster diversity (avg pairwise distance within cluster)
      // Used to bias toward broader labels for diverse clusters
      const clusterDiversities: number[] = []
      for (let ci = 0; ci < result.k; ci++) {
        const members = subset.ids.filter((_, i) => result.assignments[i] === ci)
        if (members.length < 2) {
          clusterDiversities.push(0)
          continue
        }
        let totalDist = 0
        let pairCount = 0
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const idxI = fullIdxMap.get(members[i])!
            const idxJ = fullIdxMap.get(members[j])!
            totalDist += distanceData.matrix[distIndex(idxI, idxJ, fullN)]
            pairCount++
          }
        }
        const diversity = pairCount > 0 ? totalDist / pairCount : 0
        clusterDiversities.push(diversity)
        clusterDiversityScores[ci] = diversity
      }

      // Find max breadth for normalization
      const maxBreadth = labelBreadths
        ? Math.max(1, ...Object.values(labelBreadths))
        : 1

      // For each label, compute MAX distance to cluster members (worst match).
      // For diverse clusters, give a bonus to broad labels.
      type LabelScore = { label: string; clusterIdx: number; maxDist: number; adjustedDist: number }
      const scores: LabelScore[] = []
      const DIVERSITY_THRESHOLD = 0.35 // Clusters more diverse than this get breadth bonus

      for (const lid of labelDistIds) {
        const labelIdx = fullIdxMap.get(lid)!
        const labelName = lid.slice(LABEL_PREFIX.length)
        const breadth = labelBreadths?.[labelName] ?? 0
        const normalizedBreadth = breadth / maxBreadth // 0 to 1

        for (let ci = 0; ci < result.k; ci++) {
          const members = subset.ids.filter((_, i) => result.assignments[i] === ci)
          if (members.length === 0) continue

          let maxDist = 0
          for (const mid of members) {
            const memberIdx = fullIdxMap.get(mid)!
            const dist = distanceData.matrix[distIndex(labelIdx, memberIdx, fullN)]
            if (dist > maxDist) maxDist = dist
          }

          // For diverse clusters, give bonus to broad labels
          const isDiverse = clusterDiversities[ci] > DIVERSITY_THRESHOLD
          const breadthBonus = isDiverse ? normalizedBreadth * 0.15 : 0
          const adjustedDist = maxDist - breadthBonus

          scores.push({ label: labelName, clusterIdx: ci, maxDist, adjustedDist })
        }
      }

      // Sort by adjusted distance (best matches first = lowest adjusted distance)
      scores.sort((a, b) => a.adjustedDist - b.adjustedDist)

      // Collect top 3 labels per cluster (before greedy assignment removes options)
      const clusterTopLabels: Map<number, { label: string; score: number }[]> = new Map()
      for (const score of scores) {
        if (score.maxDist > 0.75) continue // Skip poor matches
        const existing = clusterTopLabels.get(score.clusterIdx) || []
        if (existing.length < 4) {
          existing.push({ label: score.label, score: Math.round((1 - score.adjustedDist) * 100) })
          clusterTopLabels.set(score.clusterIdx, existing)
        }
      }

      // Greedy assignment: best label first, no label reuse
      const usedLabels = new Set<string>()
      const assignedClusters = new Set<number>()
      for (const score of scores) {
        if (usedLabels.has(score.label) || assignedClusters.has(score.clusterIdx)) continue
        // Only assign if the worst match is still reasonable (threshold 0.75)
        if (score.maxDist > 0.75) continue
        clusterLabels[score.clusterIdx] = score.label
        usedLabels.add(score.label)
        assignedClusters.add(score.clusterIdx)
        if (assignedClusters.size === result.k) break
      }

      // Set runner-ups (exclude the assigned label)
      for (let ci = 0; ci < result.k; ci++) {
        const topLabels = clusterTopLabels.get(ci) || []
        const assignedLabel = clusterLabels[ci]
        clusterRunnerUps[ci] = topLabels.filter(l => l.label !== assignedLabel).slice(0, 3)
      }

      // Compute match strength per flowchart (how well it fits its assigned label)
      for (let ci = 0; ci < result.k; ci++) {
        const assignedLabel = clusterLabels[ci]
        if (!assignedLabel) continue
        const labelIdx = fullIdxMap.get(`${LABEL_PREFIX}${assignedLabel}`)
        if (labelIdx === undefined) continue

        const members = subset.ids.filter((_, i) => result.assignments[i] === ci)
        for (const mid of members) {
          const memberIdx = fullIdxMap.get(mid)!
          const dist = distanceData.matrix[distIndex(labelIdx, memberIdx, fullN)]
          // Convert distance (0-1) to match strength (100-0), clamped
          const strength = Math.round(Math.max(0, Math.min(100, (1 - dist) * 125 - 10)))
          flowchartMatchStrengths.set(mid, strength)
        }
      }

    }

    return {
      map,
      k: result.k,
      centroids: result.centroids,
      ids: subset.ids,
      clusterEmojis,
      clusterLabels,
      clusterRunnerUps,
      clusterDiversityScores,
      flowchartMatchStrengths,
    }
  }, [distanceData, publishedFlowcharts, filter, scopedFlowchartIds, labelBreadths])

  // Memoized clustering for semantic search results
  const semanticClusterAssignments = useMemo(() => {
    if (!distanceData || embeddingResults.length < 2) return null

    const LABEL_PREFIX = 'label:'
    const labelDistIds = distanceData.ids.filter((id) => id.startsWith(LABEL_PREFIX))

    // Get IDs from embedding results that exist in the distance data
    const resultIds = embeddingResults.map((r) => r.id)

    // Subset distance matrix to search result IDs
    const subset = subsetDistanceMatrix(distanceData.ids, distanceData.matrix, resultIds)
    if (subset.ids.length < 2) return null

    const result = agglomerativeClustering(subset.ids.length, subset.matrix)

    // Build Map<flowchartId, clusterIndex> for O(1) lookup
    const map = new Map<string, number>()
    subset.ids.forEach((id, i) => map.set(id, result.assignments[i]))

    // Collect unique emojis per cluster (max 5)
    const clusterEmojis: string[][] = Array.from({ length: result.k }, () => [])
    subset.ids.forEach((id, i) => {
      const ci = result.assignments[i]
      const sr = embeddingResults.find((r) => r.id === id)
      const emoji = sr?.emoji || '📊'
      if (!clusterEmojis[ci].includes(emoji) && clusterEmojis[ci].length < 5) {
        clusterEmojis[ci].push(emoji)
      }
    })

    // Assign topic labels to clusters using diversity-aware scoring
    const clusterLabels: (string | null)[] = Array.from({ length: result.k }, () => null)
    if (labelDistIds.length > 0) {
      const fullN = distanceData.ids.length
      const fullIdxMap = new Map<string, number>()
      distanceData.ids.forEach((id, i) => fullIdxMap.set(id, i))

      // Compute cluster diversity
      const clusterDiversities: number[] = []
      for (let ci = 0; ci < result.k; ci++) {
        const members = subset.ids.filter((_, i) => result.assignments[i] === ci)
        if (members.length < 2) {
          clusterDiversities.push(0)
          continue
        }
        let totalDist = 0
        let pairCount = 0
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const idxI = fullIdxMap.get(members[i])
            const idxJ = fullIdxMap.get(members[j])
            if (idxI !== undefined && idxJ !== undefined) {
              totalDist += distanceData.matrix[distIndex(idxI, idxJ, fullN)]
              pairCount++
            }
          }
        }
        clusterDiversities.push(pairCount > 0 ? totalDist / pairCount : 0)
      }

      const maxBreadth = labelBreadths ? Math.max(1, ...Object.values(labelBreadths)) : 1
      const DIVERSITY_THRESHOLD = 0.35

      type LabelScore = { label: string; clusterIdx: number; maxDist: number; adjustedDist: number }
      const scores: LabelScore[] = []

      for (const lid of labelDistIds) {
        const labelIdx = fullIdxMap.get(lid)!
        const labelName = lid.slice(LABEL_PREFIX.length)
        const breadth = labelBreadths?.[labelName] ?? 0
        const normalizedBreadth = breadth / maxBreadth

        for (let ci = 0; ci < result.k; ci++) {
          const members = subset.ids.filter((_, i) => result.assignments[i] === ci)
          if (members.length === 0) continue

          let maxDist = 0
          for (const mid of members) {
            const memberIdx = fullIdxMap.get(mid)
            if (memberIdx === undefined) continue
            const dist = distanceData.matrix[distIndex(labelIdx, memberIdx, fullN)]
            if (dist > maxDist) maxDist = dist
          }

          const isDiverse = clusterDiversities[ci] > DIVERSITY_THRESHOLD
          const breadthBonus = isDiverse ? normalizedBreadth * 0.15 : 0
          const adjustedDist = maxDist - breadthBonus

          scores.push({ label: labelName, clusterIdx: ci, maxDist, adjustedDist })
        }
      }

      scores.sort((a, b) => a.adjustedDist - b.adjustedDist)

      const usedLabels = new Set<string>()
      const assignedClusters = new Set<number>()
      for (const score of scores) {
        if (usedLabels.has(score.label) || assignedClusters.has(score.clusterIdx)) continue
        if (score.maxDist > 0.75) continue
        clusterLabels[score.clusterIdx] = score.label
        usedLabels.add(score.label)
        assignedClusters.add(score.clusterIdx)
        if (assignedClusters.size === result.k) break
      }
    }

    return { map, k: result.k, ids: subset.ids, clusterEmojis, clusterLabels }
  }, [distanceData, embeddingResults, labelBreadths])

  // Load published flowcharts (hardcoded + user-created)
  const loadPublished = useCallback(async () => {
    try {
      const response = await fetch('/api/flowcharts/browse')
      if (response.ok) {
        const data = await response.json()
        setPublishedFlowcharts(data.flowcharts || [])
        setCurrentUserId(data.currentUserId || null)
        setDistanceData(data.distances ?? null)
        setLabelBreadths(data.labelBreadths ?? null)
      }
    } catch (err) {
      console.error('Failed to load published flowcharts:', err)
    } finally {
      setIsLoadingPublished(false)
    }
  }, [])

  const handleGenerateEmbeddings = useCallback(async () => {
    setIsGeneratingEmbeddings(true)
    try {
      const res = await fetch('/api/flowcharts/seed-embeddings', { method: 'POST' })
      if (res.ok) {
        await loadPublished()
      }
    } catch (err) {
      console.error('Failed to generate embeddings:', err)
    } finally {
      setIsGeneratingEmbeddings(false)
    }
  }, [loadPublished])

  const handleGenerateCardEmbedding = useCallback(async (id: string) => {
    setGeneratingEmbeddingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/flowcharts/${id}/embedding`, { method: 'POST' })
      if (res.ok) {
        await loadPublished()
      }
    } catch (err) {
      console.error('Failed to generate embedding for', id, err)
    } finally {
      setGeneratingEmbeddingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [loadPublished])

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
            {(() => {
              // Check if we should show inline create UI (no results, query >= 3 chars, not searching)
              const hasNoResults = searchQuery.trim().length >= 3 && !isSearching && embeddingResults.length === 0 && keywordResults.length === 0
              return (
                <>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && hasNoResults && !isCreatingFromSearch) {
                        e.preventDefault()
                        handleCreateFromSearch()
                      }
                    }}
                    placeholder="What do you want to learn?"
                    className={css({
                      width: '100%',
                      paddingY: '3',
                      paddingLeft: '10',
                      paddingRight: hasNoResults ? '120px' : searchQuery ? '9' : '3',
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
                  {hasNoResults ? (
                    <div
                      className={css({
                        position: 'absolute',
                        right: '2',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2',
                      })}
                    >
                      <button
                        onClick={() => setSearchQuery('')}
                        className={css({
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
                      <button
                        onClick={handleCreateFromSearch}
                        disabled={isCreatingFromSearch}
                        className={css({
                          paddingY: '1.5',
                          paddingX: '3',
                          borderRadius: 'md',
                          backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
                          color: 'white',
                          fontWeight: 'semibold',
                          fontSize: 'sm',
                          border: 'none',
                          cursor: 'pointer',
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
                  ) : searchQuery ? (
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
                  ) : null}
                </>
              )
            })()}
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
          ref={gridRef}
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '4',
            width: '100%',
            maxWidth: '1200px',
          })}
        >
        {/* Search results header */}
        {searchQuery.trim().length >= 3 && (embeddingResults.length > 0 || keywordResults.length > 0 || isSearching) && (
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
            ) : (
              <>
                Found <strong>{embeddingResults.length + keywordResults.length}</strong> result
                {embeddingResults.length + keywordResults.length !== 1 ? 's' : ''} for &ldquo;
                {searchQuery}&rdquo;
              </>
            )}
          </div>
        )}
        {/* Show search results when search is active */}
        {searchQuery.trim().length >= 3 ? (
          <>
            {/* Prominent create card when there ARE results but best match < 0.55 */}
            {/* (When there are NO results, the create button is in the search bar) */}
            {(() => {
              const hasResults = embeddingResults.length > 0 || keywordResults.length > 0
              if (!hasResults) return null // Create is in search bar when no results
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
            {embeddingResults.length > 0 && (() => {
              const renderSemanticCard = (result: EmbeddingSearchResult, clusterColorIndex?: number) => {
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
                    clusterColorIndex={clusterColorIndex}
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
              }

              // If we have clustering data, render by clusters
              if (semanticClusterAssignments && semanticClusterAssignments.k > 1) {
                const elements: React.ReactNode[] = []
                const clusteredIds = new Set(semanticClusterAssignments.ids)

                for (let ci = 0; ci < semanticClusterAssignments.k; ci++) {
                  const color = CLUSTER_COLORS[ci % CLUSTER_COLORS.length]
                  const emojis = semanticClusterAssignments.clusterEmojis[ci]
                  const topicLabel = semanticClusterAssignments.clusterLabels[ci]
                  const clusterResults = embeddingResults.filter(
                    (r) => semanticClusterAssignments.map.get(r.id) === ci
                  )
                  if (clusterResults.length === 0) continue

                  elements.push(
                    <div
                      key={`semantic-header-${ci}`}
                      className={css({
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3',
                        color: color.text,
                        fontSize: 'sm',
                        marginTop: ci > 0 ? '4' : '0',
                        marginBottom: '2',
                      })}
                    >
                      <span>{emojis.join(' ')}</span>
                      {topicLabel && (
                        <span className={css({ fontWeight: 'medium' })}>{topicLabel}</span>
                      )}
                      <div
                        className={css({
                          flex: 1,
                          height: '1px',
                          backgroundColor: color.line,
                        })}
                      />
                    </div>
                  )

                  for (const result of clusterResults) {
                    elements.push(renderSemanticCard(result, ci))
                  }
                }

                // Render unclustered results (if any)
                const unclustered = embeddingResults.filter((r) => !clusteredIds.has(r.id))
                if (unclustered.length > 0) {
                  elements.push(
                    <div
                      key="semantic-header-unclustered"
                      className={css({
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3',
                        color: { base: 'gray.500', _dark: 'gray.400' },
                        fontSize: 'sm',
                        marginTop: '4',
                        marginBottom: '2',
                      })}
                    >
                      <span>More</span>
                      <div
                        className={css({
                          flex: 1,
                          height: '1px',
                          backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                        })}
                      />
                    </div>
                  )
                  for (const result of unclustered) {
                    elements.push(renderSemanticCard(result))
                  }
                }

                return elements
              }

              // Fallback: flat list with header
              return (
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
                  {embeddingResults.map((result) => renderSemanticCard(result))}
                </>
              )
            })()}

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
            {filter !== 'drafts' && (() => {
              const renderPublishedCard = (flowchart: PublishedFlowchart, clusterColorIndex?: number) => {
                const isOwnFlowchart =
                  flowchart.source === 'database' &&
                  currentUserId &&
                  flowchart.authorId === currentUserId

                const cardData = cardExamples.get(flowchart.id)

                const actions =
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

                if (flowchart.hasEmbedding === false) {
                  const isGenerating = generatingEmbeddingIds.has(flowchart.id)
                  actions.push({
                    label: isGenerating ? 'Generating...' : 'Generate Embedding',
                    onClick: () => handleGenerateCardEmbedding(flowchart.id),
                    variant: 'secondary' as const,
                    disabled: isGenerating,
                  })
                }

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
                    clusterColorIndex={clusterColorIndex}
                    onClick={() => handleCardClick(flowchart.id)}
                    actions={actions}
                  />
                )
              }

              if (clusterAssignments) {
                const clusteredIds = new Set(clusterAssignments.ids)
                const elements: React.ReactNode[] = []

                // Breadcrumb navigation (shows full path when drilled in)
                if (scopePath.length > 0) {
                  elements.push(
                    <div
                      key="scope-nav"
                      className={css({
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2',
                        marginBottom: '3',
                        flexWrap: 'wrap',
                      })}
                    >
                      {/* Root "All" link */}
                      <button
                        onClick={() => navigateToLevel(0)}
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1.5',
                          paddingX: '3',
                          paddingY: '1.5',
                          borderRadius: 'lg',
                          fontSize: 'sm',
                          fontWeight: 'medium',
                          color: { base: 'gray.600', _dark: 'gray.300' },
                          backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          _hover: {
                            backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                          },
                        })}
                      >
                        <span className={css({ fontSize: '12px' })}>←</span>
                        All
                      </button>
                      {/* Breadcrumb trail */}
                      {scopePath.map((level, index) => (
                        <div key={index} className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                          <span
                            className={css({
                              fontSize: 'sm',
                              color: { base: 'gray.400', _dark: 'gray.500' },
                            })}
                          >
                            /
                          </span>
                          {index < scopePath.length - 1 ? (
                            // Clickable intermediate breadcrumb
                            <button
                              onClick={() => navigateToLevel(index + 1)}
                              className={css({
                                fontSize: 'sm',
                                fontWeight: 'medium',
                                color: { base: 'gray.500', _dark: 'gray.400' },
                                cursor: 'pointer',
                                transition: 'color 0.15s',
                                _hover: {
                                  color: { base: 'gray.700', _dark: 'gray.200' },
                                },
                              })}
                            >
                              {level.label}
                            </button>
                          ) : (
                            // Current level (not clickable)
                            <span
                              className={css({
                                fontSize: 'sm',
                                fontWeight: 'medium',
                                color: { base: 'gray.700', _dark: 'gray.200' },
                              })}
                            >
                              {level.label}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                }

                // First pass: separate singleton clusters from multi-item clusters
                const singletonFlowcharts: PublishedFlowchart[] = []
                const multiItemClusters: { ci: number; flowcharts: PublishedFlowchart[] }[] = []

                for (let ci = 0; ci < clusterAssignments.k; ci++) {
                  const clusterFlowcharts = publishedFlowcharts.filter(
                    (fc) => clusterAssignments.map.get(fc.id) === ci
                  )
                  if (clusterFlowcharts.length === 0) continue

                  if (clusterFlowcharts.length === 1) {
                    singletonFlowcharts.push(clusterFlowcharts[0])
                  } else {
                    multiItemClusters.push({ ci, flowcharts: clusterFlowcharts })
                  }
                }

                // Render multi-item clusters with headers
                for (const { ci, flowcharts: clusterFlowcharts } of multiItemClusters) {
                  const color = CLUSTER_COLORS[ci % CLUSTER_COLORS.length]
                  const emojis = clusterAssignments.clusterEmojis[ci]

                  // Section header with insights
                  const topicLabel = clusterAssignments.clusterLabels[ci]
                  const runnerUps = clusterAssignments.clusterRunnerUps[ci]
                  const diversity = clusterAssignments.clusterDiversityScores[ci]
                  const isDiverse = diversity > 0.35
                  const clusterIds = clusterFlowcharts.map((fc) => fc.id)

                  // Build tooltip content
                  const tooltipContent = (
                    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2.5' })}>
                      {/* Diversity indicator */}
                      <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                        <span className={css({ fontSize: 'xs', opacity: 0.7 })}>
                          {isDiverse ? '🌐' : '🎯'}
                        </span>
                        <span className={css({ fontSize: 'xs', color: 'gray.300' })}>
                          {isDiverse ? 'Diverse topics grouped together' : 'Focused on a specific topic'}
                        </span>
                      </div>

                      {/* Runner-up labels */}
                      {runnerUps.length > 0 && (
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
                          <span className={css({ fontSize: 'xs', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' })}>
                            Also related to
                          </span>
                          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '1.5' })}>
                            {runnerUps.map((ru, i) => (
                              <span
                                key={i}
                                className={css({
                                  fontSize: 'xs',
                                  paddingX: '2',
                                  paddingY: '0.5',
                                  borderRadius: 'full',
                                  backgroundColor: 'rgba(255,255,255,0.1)',
                                  color: 'gray.300',
                                })}
                              >
                                {ru.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cluster stats */}
                      <div className={css({ fontSize: 'xs', opacity: 0.5, paddingTop: '1', borderTop: '1px solid rgba(255,255,255,0.1)' })}>
                        {clusterFlowcharts.length} flowchart{clusterFlowcharts.length !== 1 ? 's' : ''} in this group
                      </div>
                    </div>
                  )

                  elements.push(
                    <div
                      key={`cluster-header-${ci}`}
                      className={css({
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3',
                        color: color.text,
                        fontSize: 'sm',
                        marginTop: ci > 0 ? '4' : '0',
                        marginBottom: '2',
                      })}
                    >
                      <span>{emojis.join(' ')}</span>
                      {topicLabel && (
                        <Tooltip content={tooltipContent} side="bottom" align="start" delayDuration={300}>
                          <button
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              gap: '1.5',
                              fontWeight: 'medium',
                              cursor: 'help',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'inherit',
                              transition: 'opacity 0.15s',
                              _hover: { opacity: 0.8 },
                            })}
                          >
                            {topicLabel}
                            <span
                              className={css({
                                fontSize: '10px',
                                opacity: 0.5,
                                transition: 'opacity 0.15s',
                              })}
                            >
                              {isDiverse ? '🌐' : '🎯'}
                            </span>
                          </button>
                        </Tooltip>
                      )}
                      <div
                        className={css({
                          flex: 1,
                          height: '1px',
                          backgroundColor: color.line,
                        })}
                      />
                      {clusterFlowcharts.length > gridColumnCount && (
                        <button
                          onClick={() => {
                            navigateToScope(clusterIds, topicLabel || `${emojis[0] || ''} Cluster`)
                          }}
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1',
                            paddingX: '2',
                            paddingY: '1',
                            borderRadius: 'md',
                            fontSize: 'xs',
                            fontWeight: 'medium',
                            color: color.text,
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            _hover: {
                              backgroundColor: color.bg,
                            },
                          })}
                        >
                          Explore
                          <span className={css({ fontSize: '10px' })}>→</span>
                        </button>
                      )}
                    </div>
                  )

                  // Cards in this cluster, sorted by match strength (best matches first)
                  const sortedClusterFlowcharts = [...clusterFlowcharts].sort((a, b) => {
                    const strengthA = clusterAssignments.flowchartMatchStrengths.get(a.id) ?? 0
                    const strengthB = clusterAssignments.flowchartMatchStrengths.get(b.id) ?? 0
                    return strengthB - strengthA // Descending order
                  })
                  for (const fc of sortedClusterFlowcharts) {
                    elements.push(renderPublishedCard(fc, ci))
                  }
                }

                // Render singletons under "Other topics" section
                if (singletonFlowcharts.length > 0) {
                  elements.push(
                    <div
                      key="cluster-header-singletons"
                      className={css({
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3',
                        color: { base: 'gray.500', _dark: 'gray.400' },
                        fontSize: 'sm',
                        marginTop: multiItemClusters.length > 0 ? '4' : '0',
                        marginBottom: '2',
                      })}
                    >
                      <span>Other topics</span>
                      <div
                        className={css({
                          flex: 1,
                          height: '1px',
                          backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                        })}
                      />
                    </div>
                  )
                  for (const fc of singletonFlowcharts) {
                    elements.push(renderPublishedCard(fc))
                  }
                }

                // Unclustered flowcharts (no embedding)
                // When scoped, only show unclustered items within the scope
                const scopeSet = scopedFlowchartIds ? new Set(scopedFlowchartIds) : null
                const unclustered = publishedFlowcharts.filter(
                  (fc) => !clusteredIds.has(fc.id) && (!scopeSet || scopeSet.has(fc.id))
                )
                if (unclustered.length > 0) {
                  const missingEmbeddings = unclustered.some((fc) => !fc.hasEmbedding)
                  elements.push(
                    <div
                      key="cluster-header-unclustered"
                      className={css({
                        gridColumn: '1 / -1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3',
                        color: { base: 'gray.500', _dark: 'gray.400' },
                        fontSize: 'sm',
                        marginTop: '4',
                        marginBottom: '2',
                      })}
                    >
                      <span>{missingEmbeddings ? 'Unclustered \u2014 missing embeddings' : 'More'}</span>
                      <div
                        className={css({
                          flex: 1,
                          height: '1px',
                          backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                        })}
                      />
                      {missingEmbeddings && (
                        <button
                          onClick={handleGenerateEmbeddings}
                          disabled={isGeneratingEmbeddings}
                          className={css({
                            paddingY: '1',
                            paddingX: '3',
                            borderRadius: 'md',
                            fontSize: 'xs',
                            fontWeight: 'medium',
                            border: '1px solid',
                            borderColor: { base: 'gray.300', _dark: 'gray.600' },
                            backgroundColor: { base: 'white', _dark: 'gray.800' },
                            color: { base: 'gray.700', _dark: 'gray.300' },
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s',
                            _hover: {
                              backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                            },
                            _disabled: {
                              opacity: 0.5,
                              cursor: 'not-allowed',
                            },
                          })}
                        >
                          {isGeneratingEmbeddings ? 'Generating...' : 'Generate Embeddings'}
                        </button>
                      )}
                    </div>
                  )
                  for (const fc of unclustered) {
                    elements.push(renderPublishedCard(fc))
                  }
                }

                return elements
              }

              // Fallback: no clustering data, render flat
              return publishedFlowcharts.map((fc) => renderPublishedCard(fc))
            })()}

            {/* Draft flowcharts */}
            {filter !== 'published' && draftSessions.length > 0 && (
              <div
                className={css({
                  gridColumn: '1 / -1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                  fontSize: 'sm',
                  marginTop: filter !== 'drafts' && publishedFlowcharts.length > 0 ? '4' : '0',
                  marginBottom: '2',
                })}
              >
                <span>Drafts</span>
                <div
                  className={css({
                    flex: 1,
                    height: '1px',
                    backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                  })}
                />
              </div>
            )}
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

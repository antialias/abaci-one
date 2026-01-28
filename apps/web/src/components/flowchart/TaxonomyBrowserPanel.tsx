'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'
import { agglomerativeClustering, subsetDistanceMatrix, distIndex } from '@/lib/flowcharts/clustering'

interface TaxonomyStatus {
  labelCount: number
  labels: string[]
}

interface ClusterTestResult {
  ids: string[]
  matrix: number[]
  topicCount: number
  topics: string[]
}

interface ClusterAssignment {
  topic: string
  topicIndex: number
  clusterIndex: number
  clusterLabel: string
  clusterEmojis: string
}

const CLUSTER_COLORS = [
  { bg: 'purple.100', text: 'purple.700', border: 'purple.300', darkBg: 'purple.900', darkText: 'purple.300', darkBorder: 'purple.700' },
  { bg: 'teal.100', text: 'teal.700', border: 'teal.300', darkBg: 'teal.900', darkText: 'teal.300', darkBorder: 'teal.700' },
  { bg: 'orange.100', text: 'orange.700', border: 'orange.300', darkBg: 'orange.900', darkText: 'orange.300', darkBorder: 'orange.700' },
  { bg: 'pink.100', text: 'pink.700', border: 'pink.300', darkBg: 'pink.900', darkText: 'pink.300', darkBorder: 'pink.700' },
  { bg: 'blue.100', text: 'blue.700', border: 'blue.300', darkBg: 'blue.900', darkText: 'blue.300', darkBorder: 'blue.700' },
  { bg: 'green.100', text: 'green.700', border: 'green.300', darkBg: 'green.900', darkText: 'green.300', darkBorder: 'green.700' },
]

// Helper to check if an ID is a label
function isLabelId(id: string): boolean {
  return id.startsWith('label:')
}

function labelFromId(id: string): string {
  return id.slice('label:'.length)
}

function isTopicId(id: string): boolean {
  return id.startsWith('topic:')
}

function topicIndexFromId(id: string): number {
  return parseInt(id.slice('topic:'.length), 10)
}

interface TaxonomyBrowserPanelProps {
  onRegenerateComplete?: () => void
}

/**
 * Debug panel for browsing topic taxonomy and testing clustering.
 * Shows all taxonomy labels and allows inputting test topics to see
 * how they would be clustered using the same algorithm as /flowchart.
 */
export function TaxonomyBrowserPanel({ onRegenerateComplete }: TaxonomyBrowserPanelProps) {
  const [status, setStatus] = useState<TaxonomyStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'browse' | 'test'>('browse')

  // Browse tab state
  const [searchFilter, setSearchFilter] = useState('')

  // Test tab state
  const [testInput, setTestInput] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<ClusterTestResult | null>(null)

  // Fetch current taxonomy status
  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/admin/taxonomy')
      if (!response.ok) {
        throw new Error('Failed to fetch taxonomy status')
      }
      const data = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch taxonomy')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Regenerate taxonomy
  const handleRegenerate = useCallback(async () => {
    try {
      setIsRegenerating(true)
      setError(null)
      const response = await fetch('/api/admin/taxonomy', {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to regenerate taxonomy')
      }

      await fetchStatus()
      onRegenerateComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate')
    } finally {
      setIsRegenerating(false)
    }
  }, [fetchStatus, onRegenerateComplete])

  // Filter labels based on search
  const filteredLabels = useMemo(() => {
    if (!status?.labels) return []
    if (!searchFilter.trim()) return status.labels
    const lower = searchFilter.toLowerCase()
    return status.labels.filter((label) => label.toLowerCase().includes(lower))
  }, [status?.labels, searchFilter])

  // Test clustering
  const handleTestClustering = useCallback(async () => {
    const topics = testInput
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    if (topics.length === 0) {
      setError('Enter at least one topic to test')
      return
    }

    try {
      setIsTesting(true)
      setError(null)
      const response = await fetch('/api/admin/taxonomy/test-cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to test clustering')
      }

      const data = await response.json()
      setTestResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test clustering')
    } finally {
      setIsTesting(false)
    }
  }, [testInput])

  // Compute cluster assignments from test result
  const clusterAssignments = useMemo((): ClusterAssignment[] | null => {
    if (!testResult) return null

    const { ids, matrix, topicCount, topics } = testResult

    // Extract only topic IDs for clustering
    const topicIds = ids.filter(isTopicId)
    if (topicIds.length < 2) {
      // Single topic - just find nearest label
      if (topicIds.length === 1) {
        const topicIdx = 0
        const labelIds = ids.filter(isLabelId)
        let bestLabel = labelIds[0] ? labelFromId(labelIds[0]) : 'Unknown'
        let bestDist = Infinity

        const fullN = ids.length
        const fullIdxMap = new Map(ids.map((id, i) => [id, i]))
        const topicFullIdx = fullIdxMap.get(topicIds[0])!

        for (const lid of labelIds) {
          const labelFullIdx = fullIdxMap.get(lid)!
          const dist = matrix[distIndex(topicFullIdx, labelFullIdx, fullN)]
          if (dist < bestDist) {
            bestDist = dist
            bestLabel = labelFromId(lid)
          }
        }

        return [{
          topic: topics[0],
          topicIndex: 0,
          clusterIndex: 0,
          clusterLabel: bestLabel,
          clusterEmojis: '',
        }]
      }
      return null
    }

    // Subset distance matrix for just topics
    const subset = subsetDistanceMatrix(ids, matrix, topicIds)
    if (subset.ids.length < 2) return null

    // Run clustering
    const result = agglomerativeClustering(subset.ids.length, subset.matrix)

    // Build cluster assignments map
    const topicToCluster = new Map<string, number>()
    for (let i = 0; i < subset.ids.length; i++) {
      topicToCluster.set(subset.ids[i], result.assignments[i])
    }

    // Assign labels to clusters using MAX distance (same as /flowchart)
    const fullN = ids.length
    const fullIdxMap = new Map(ids.map((id, i) => [id, i]))
    const labelIds = ids.filter(isLabelId)

    const clusterLabels: string[] = []
    const clusterEmojis: string[] = []
    const usedLabels = new Set<string>()

    for (let ci = 0; ci < result.k; ci++) {
      const members = subset.ids.filter((_, i) => result.assignments[i] === ci)
      if (members.length === 0) {
        clusterLabels.push('Unknown')
        clusterEmojis.push('')
        continue
      }

      // Collect emojis from topic names
      const emojiSet = new Set<string>()
      for (const mid of members) {
        const topicIndex = topicIndexFromId(mid)
        const topic = topics[topicIndex]
        // Extract emojis from topic string
        const emojis = topic.match(/\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu) || []
        for (const e of emojis) emojiSet.add(e)
      }
      clusterEmojis.push(Array.from(emojiSet).slice(0, 3).join(''))

      // Find best label using MAX distance
      let bestLabel = ''
      let bestMaxDist = Infinity

      for (const lid of labelIds) {
        const labelText = labelFromId(lid)
        if (usedLabels.has(labelText)) continue

        const labelIdx = fullIdxMap.get(lid)!
        let maxDist = 0

        for (const mid of members) {
          const memberIdx = fullIdxMap.get(mid)!
          const dist = matrix[distIndex(labelIdx, memberIdx, fullN)]
          if (dist > maxDist) maxDist = dist
        }

        if (maxDist < bestMaxDist) {
          bestMaxDist = maxDist
          bestLabel = labelText
        }
      }

      if (bestLabel && bestMaxDist <= 0.7) {
        usedLabels.add(bestLabel)
        clusterLabels.push(bestLabel)
      } else {
        clusterLabels.push('')
      }
    }

    // Build final assignments
    const assignments: ClusterAssignment[] = []
    for (let i = 0; i < topics.length; i++) {
      const topicId = `topic:${i}`
      const clusterIndex = topicToCluster.get(topicId) ?? 0
      assignments.push({
        topic: topics[i],
        topicIndex: i,
        clusterIndex,
        clusterLabel: clusterLabels[clusterIndex] || '',
        clusterEmojis: clusterEmojis[clusterIndex] || '',
      })
    }

    return assignments
  }, [testResult])

  // Group assignments by cluster for display
  const groupedClusters = useMemo(() => {
    if (!clusterAssignments) return null

    const groups = new Map<number, ClusterAssignment[]>()
    for (const a of clusterAssignments) {
      if (!groups.has(a.clusterIndex)) {
        groups.set(a.clusterIndex, [])
      }
      groups.get(a.clusterIndex)!.push(a)
    }

    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0])
  }, [clusterAssignments])

  if (isLoading) {
    return (
      <div
        data-component="TaxonomyBrowserPanel"
        className={css({
          position: 'fixed',
          bottom: '4',
          left: '4',
          zIndex: 90,
          padding: '4',
          borderRadius: 'lg',
          backgroundColor: { base: 'purple.50', _dark: 'purple.950' },
          border: '2px dashed',
          borderColor: { base: 'purple.300', _dark: 'purple.700' },
          boxShadow: 'lg',
        })}
      >
        <div className={css({ color: { base: 'purple.700', _dark: 'purple.300' } })}>
          Loading taxonomy...
        </div>
      </div>
    )
  }

  return (
    <div
      data-component="TaxonomyBrowserPanel"
      className={css({
        position: 'fixed',
        bottom: '4',
        left: '4',
        zIndex: 90,
        width: '500px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'lg',
        backgroundColor: { base: 'purple.50', _dark: 'purple.950' },
        border: '2px dashed',
        borderColor: { base: 'purple.300', _dark: 'purple.700' },
        boxShadow: 'lg',
      })}
    >
      {/* Header with tabs */}
      <div className={css({ padding: '3', borderBottom: '1px solid', borderColor: { base: 'purple.200', _dark: 'purple.800' } })}>
        <div className={hstack({ justify: 'space-between', marginBottom: '2' })}>
          <span
            className={css({
              fontWeight: 'semibold',
              color: { base: 'purple.800', _dark: 'purple.200' },
            })}
          >
            Topic Taxonomy
          </span>
          <span
            className={css({
              fontSize: 'sm',
              color: { base: 'purple.600', _dark: 'purple.400' },
            })}
          >
            {status?.labelCount || 0} labels
          </span>
        </div>

        {/* Tabs */}
        <div className={hstack({ gap: '2' })}>
          <button
            onClick={() => setActiveTab('browse')}
            className={css({
              paddingX: '3',
              paddingY: '1',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'medium',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'browse'
                ? { base: 'purple.600', _dark: 'purple.500' }
                : { base: 'purple.200', _dark: 'purple.800' },
              color: activeTab === 'browse'
                ? 'white'
                : { base: 'purple.700', _dark: 'purple.300' },
            })}
          >
            Browse
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={css({
              paddingX: '3',
              paddingY: '1',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'medium',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'test'
                ? { base: 'purple.600', _dark: 'purple.500' }
                : { base: 'purple.200', _dark: 'purple.800' },
              color: activeTab === 'test'
                ? 'white'
                : { base: 'purple.700', _dark: 'purple.300' },
            })}
          >
            Test Clustering
          </button>
          <div className={css({ flex: 1 })} />
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className={css({
              paddingX: '2',
              paddingY: '1',
              borderRadius: 'md',
              fontSize: 'xs',
              fontWeight: 'medium',
              backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
              color: { base: 'gray.700', _dark: 'gray.300' },
              border: 'none',
              cursor: 'pointer',
              _hover: {
                backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className={css({
            margin: '2',
            padding: '2',
            borderRadius: 'md',
            backgroundColor: { base: 'red.100', _dark: 'red.900' },
            color: { base: 'red.700', _dark: 'red.300' },
            fontSize: 'sm',
          })}
        >
          {error}
        </div>
      )}

      {/* Content area */}
      <div className={css({ flex: 1, overflow: 'auto', padding: '3' })}>
        {activeTab === 'browse' && (
          <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
            {/* Search filter */}
            <input
              type="text"
              placeholder="Filter labels..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className={css({
                width: '100%',
                padding: '2',
                borderRadius: 'md',
                border: '1px solid',
                borderColor: { base: 'purple.300', _dark: 'purple.700' },
                backgroundColor: { base: 'white', _dark: 'gray.800' },
                color: { base: 'gray.900', _dark: 'gray.100' },
                fontSize: 'sm',
                _focus: {
                  outline: 'none',
                  borderColor: { base: 'purple.500', _dark: 'purple.500' },
                },
              })}
            />

            {/* Labels grid */}
            <div
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1',
              })}
            >
              {filteredLabels.map((label) => (
                <span
                  key={label}
                  className={css({
                    display: 'inline-block',
                    paddingX: '2',
                    paddingY: '0.5',
                    borderRadius: 'full',
                    fontSize: 'xs',
                    backgroundColor: { base: 'purple.100', _dark: 'purple.900' },
                    color: { base: 'purple.700', _dark: 'purple.300' },
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: { base: 'purple.200', _dark: 'purple.800' },
                    },
                  })}
                  onClick={() => {
                    setTestInput((prev) => (prev ? prev + '\n' + label : label))
                    setActiveTab('test')
                  }}
                  title="Click to add to test input"
                >
                  {label}
                </span>
              ))}
            </div>

            {filteredLabels.length === 0 && (
              <div className={css({ color: { base: 'gray.500', _dark: 'gray.400' }, fontSize: 'sm', textAlign: 'center' })}>
                No labels match your filter
              </div>
            )}
          </div>
        )}

        {activeTab === 'test' && (
          <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
            {/* Input area */}
            <div>
              <label
                className={css({
                  display: 'block',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: { base: 'purple.700', _dark: 'purple.300' },
                  marginBottom: '1',
                })}
              >
                Enter topics (one per line):
              </label>
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Adding fractions with unlike denominators&#10;Multiplying decimals&#10;Solving two-step equations&#10;..."
                className={css({
                  width: '100%',
                  height: '120px',
                  padding: '2',
                  borderRadius: 'md',
                  border: '1px solid',
                  borderColor: { base: 'purple.300', _dark: 'purple.700' },
                  backgroundColor: { base: 'white', _dark: 'gray.800' },
                  color: { base: 'gray.900', _dark: 'gray.100' },
                  fontSize: 'sm',
                  fontFamily: 'mono',
                  resize: 'vertical',
                  _focus: {
                    outline: 'none',
                    borderColor: { base: 'purple.500', _dark: 'purple.500' },
                  },
                })}
              />
            </div>

            {/* Test button */}
            <button
              onClick={handleTestClustering}
              disabled={isTesting || !testInput.trim()}
              className={css({
                paddingX: '4',
                paddingY: '2',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'medium',
                backgroundColor: { base: 'purple.600', _dark: 'purple.500' },
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                _hover: {
                  backgroundColor: { base: 'purple.700', _dark: 'purple.600' },
                },
                _disabled: {
                  opacity: 0.5,
                  cursor: 'not-allowed',
                },
              })}
            >
              {isTesting ? 'Testing...' : 'Test Clustering'}
            </button>

            {/* Results */}
            {groupedClusters && (
              <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
                <div
                  className={css({
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    color: { base: 'purple.700', _dark: 'purple.300' },
                  })}
                >
                  Clustering Results ({groupedClusters.length} clusters):
                </div>

                {groupedClusters.map(([clusterIndex, items]) => {
                  const color = CLUSTER_COLORS[clusterIndex % CLUSTER_COLORS.length]
                  const label = items[0]?.clusterLabel || ''
                  const emojis = items[0]?.clusterEmojis || ''

                  return (
                    <div
                      key={clusterIndex}
                      className={css({
                        padding: '3',
                        borderRadius: 'md',
                        backgroundColor: { base: color.bg, _dark: color.darkBg },
                        border: '1px solid',
                        borderColor: { base: color.border, _dark: color.darkBorder },
                      })}
                    >
                      {/* Cluster header */}
                      <div
                        className={css({
                          fontSize: 'sm',
                          fontWeight: 'semibold',
                          color: { base: color.text, _dark: color.darkText },
                          marginBottom: '2',
                        })}
                      >
                        {label || `Cluster ${clusterIndex + 1}`}
                        {emojis && <span className={css({ marginLeft: '2' })}>{emojis}</span>}
                      </div>

                      {/* Cluster items */}
                      <div className={vstack({ gap: '1', alignItems: 'stretch' })}>
                        {items.map((item) => (
                          <div
                            key={item.topicIndex}
                            className={css({
                              paddingX: '2',
                              paddingY: '1',
                              borderRadius: 'md',
                              backgroundColor: { base: 'white', _dark: 'gray.800' },
                              fontSize: 'sm',
                              color: { base: 'gray.900', _dark: 'gray.100' },
                            })}
                          >
                            {item.topic}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Help text */}
            <div
              className={css({
                fontSize: 'xs',
                color: { base: 'purple.600', _dark: 'purple.400' },
                lineHeight: '1.5',
              })}
            >
              <p>
                This uses the same agglomerative clustering algorithm as the /flowchart page.
                Topics are embedded and compared against the taxonomy labels.
              </p>
              <p className={css({ marginTop: '1' })}>
                Tip: Click on a label in the Browse tab to add it to the test input.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

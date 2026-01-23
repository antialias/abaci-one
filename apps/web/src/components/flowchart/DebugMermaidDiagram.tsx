'use client'

import { useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'
import type { StateSnapshot } from '../../lib/flowcharts/schema'

interface DebugMermaidDiagramProps {
  /** Raw mermaid content */
  mermaidContent: string
  /** Current node ID to highlight (amber fill - walker progress) */
  currentNodeId?: string
  /** Snapshots from the walk to highlight - extracts both path nodes and edge info */
  highlightedSnapshots?: StateSnapshot[]
  /** Focused node ID within the path (strong cyan - the specific step being hovered) */
  highlightedNodeId?: string
  /** Callback when regeneration is requested (shown when there's a render error) */
  onRegenerate?: () => void
  /** Whether regeneration is currently in progress */
  isRegenerating?: boolean
}

/**
 * DebugMermaidDiagram - Renders a mermaid flowchart with the current node highlighted.
 *
 * Only rendered when visual debug mode is enabled.
 * Uses mermaid.js to render the flowchart SVG with custom styling for the current node.
 */
export function DebugMermaidDiagram({
  mermaidContent,
  currentNodeId,
  highlightedSnapshots,
  highlightedNodeId,
  onRegenerate,
  isRegenerating,
}: DebugMermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function renderDiagram() {
      if (!containerRef.current) return

      setIsLoading(true)
      setError(null)

      try {
        // Dynamic import to avoid SSR issues
        const mermaid = (await import('mermaid')).default

        // Initialize mermaid with custom config
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
          },
        })

        // Generate unique ID for this render (before try so it's accessible in catch)
        const id = `mermaid-debug-${Date.now()}`

        // Sanitize content: convert escaped quotes that might have leaked through JSON parsing
        const sanitizedContent = mermaidContent
          .replace(/\\"/g, "'") // Convert \" to '
          .replace(/\\'/g, "'") // Convert \' to '

        // Add style definitions for current node highlighting (walker progress)
        let highlightStyles = ''
        if (currentNodeId) {
          highlightStyles += `\n    style ${currentNodeId} fill:#fbbf24,stroke:#d97706,stroke-width:4px,color:#000`
        }

        const contentWithHighlight = sanitizedContent + highlightStyles

        // Render the diagram
        const { svg } = await mermaid.render(id, contentWithHighlight)

        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg

          // Make the SVG responsive
          const svgElement = containerRef.current.querySelector('svg')
          if (svgElement) {
            svgElement.style.maxWidth = '100%'
            svgElement.style.height = 'auto'

            // Apply path and node highlighting post-render
            // Extract path info from snapshots
            const highlightedPath = highlightedSnapshots?.map(s => s.nodeId) || []
            const hasPathHighlight = highlightedPath.length > 0
            const hasNodeHighlight = highlightedNodeId && highlightedNodeId !== currentNodeId

            if (hasPathHighlight || hasNodeHighlight) {
              // Dim all nodes when we have any highlighting
              const allNodes = svgElement.querySelectorAll('[id^="flowchart-"]')
              allNodes.forEach((node) => {
                ;(node as SVGElement).style.opacity = '0.5'
              })

              // Dim all edge paths (the lines) - use multiple selectors for robustness
              const allEdgePathElements = svgElement.querySelectorAll('.edgePath path, .edgePaths path')
              allEdgePathElements.forEach((edge) => {
                ;(edge as SVGElement).style.opacity = '0.2'
                ;(edge as SVGElement).style.stroke = '#9ca3af' // gray-400
              })

              // Dim all edge labels
              const allEdgeLabels = svgElement.querySelectorAll('.edgeLabel')
              allEdgeLabels.forEach((label) => {
                ;(label as SVGElement).style.opacity = '0.2'
              })

              // Get edge containers for matching
              const edgePathsContainer = svgElement.querySelector('.edgePaths')
              const edgeLabelsContainer = svgElement.querySelector('.edgeLabels')
              const edgePathElements = edgePathsContainer ? Array.from(edgePathsContainer.children) : []
              const edgeLabelElements = edgeLabelsContainer ? Array.from(edgeLabelsContainer.children) : []

              // Collect edge IDs and indices from snapshots for highlighting
              // We support two matching modes:
              // 1. ID-based: If edges use `id@-->` syntax, SVG elements have custom IDs
              // 2. Index-based: Fallback using parse order (mermaid renders in parse order)
              const highlightedEdgeIds = new Set<string>()
              const highlightedEdgeIndices = new Set<number>()
              let focusedIncomingEdgeId: string | undefined
              let focusedIncomingEdgeIndex: number | undefined
              let focusedOutgoingEdgeId: string | undefined
              let focusedOutgoingEdgeIndex: number | undefined

              if (highlightedSnapshots) {
                for (let i = 0; i < highlightedSnapshots.length; i++) {
                  const snapshot = highlightedSnapshots[i]

                  // Collect edge ID if available
                  if (snapshot.edgeId) {
                    highlightedEdgeIds.add(snapshot.edgeId)
                  }
                  // Also collect index for fallback
                  if (snapshot.edgeIndex !== undefined) {
                    highlightedEdgeIndices.add(snapshot.edgeIndex)
                  }

                  // Track edges for focused node highlighting
                  if (highlightedNodeId) {
                    // If this snapshot's next node is the focused node, this is the incoming edge
                    if (snapshot.nextNodeId === highlightedNodeId) {
                      focusedIncomingEdgeId = snapshot.edgeId
                      focusedIncomingEdgeIndex = snapshot.edgeIndex
                    }
                    // If this snapshot IS the focused node, this is the outgoing edge
                    if (snapshot.nodeId === highlightedNodeId) {
                      focusedOutgoingEdgeId = snapshot.edgeId
                      focusedOutgoingEdgeIndex = snapshot.edgeIndex
                    }
                  }
                }
              }

              // Helper to check if an edge element should be highlighted
              const shouldHighlightEdge = (edgeGroup: Element, index: number): boolean => {
                // Try ID-based matching first (for `id@-->` syntax)
                if (edgeGroup.id && highlightedEdgeIds.has(edgeGroup.id)) {
                  return true
                }
                // Fall back to index-based matching
                return highlightedEdgeIndices.has(index)
              }

              // Helper to check if an edge is the focused incoming edge
              const isFocusedIncoming = (edgeGroup: Element, index: number): boolean => {
                if (focusedIncomingEdgeId && edgeGroup.id === focusedIncomingEdgeId) return true
                return focusedIncomingEdgeIndex !== undefined && index === focusedIncomingEdgeIndex
              }

              // Helper to check if an edge is the focused outgoing edge
              const isFocusedOutgoing = (edgeGroup: Element, index: number): boolean => {
                if (focusedOutgoingEdgeId && edgeGroup.id === focusedOutgoingEdgeId) return true
                return focusedOutgoingEdgeIndex !== undefined && index === focusedOutgoingEdgeIndex
              }

              // Highlight path nodes (light cyan background)
              if (hasPathHighlight) {
                for (const nodeId of highlightedPath) {
                  if (nodeId === 'initial') continue // Skip pseudo-node
                  const nodeElement = svgElement.querySelector(`[id*="flowchart-${nodeId}-"]`)
                  if (nodeElement) {
                    const svgNode = nodeElement as SVGElement
                    svgNode.style.opacity = '1'

                    // Add light cyan border for path nodes
                    const shape = nodeElement.querySelector('rect, polygon, circle, ellipse, path')
                    if (shape) {
                      shape.setAttribute('stroke', '#06b6d4') // cyan-500
                      shape.setAttribute('stroke-width', '2')
                      shape.setAttribute('vector-effect', 'non-scaling-stroke')
                    }
                  }
                }

                // Highlight edges using ID (preferred) or index (fallback)
                edgePathElements.forEach((edgeGroup, index) => {
                  if (shouldHighlightEdge(edgeGroup, index)) {
                    // Find the path element inside this group
                    const pathElement = edgeGroup.querySelector('path') || edgeGroup
                    const svgEdge = pathElement as SVGElement
                    svgEdge.style.opacity = '1'
                    svgEdge.style.stroke = '#06b6d4' // cyan-500
                    svgEdge.style.strokeWidth = '3px'
                    svgEdge.setAttribute('stroke', '#06b6d4')
                    svgEdge.setAttribute('stroke-width', '3')
                    svgEdge.setAttribute('vector-effect', 'non-scaling-stroke')

                    // Also highlight the corresponding label
                    if (edgeLabelElements[index]) {
                      ;(edgeLabelElements[index] as SVGElement).style.opacity = '1'
                    }
                  }
                })
              }

              // Highlight the focused node more strongly (overrides path highlight)
              if (hasNodeHighlight) {
                const nodeElement = svgElement.querySelector(`[id*="flowchart-${highlightedNodeId}-"]`)
                if (nodeElement) {
                  const svgNode = nodeElement as SVGElement
                  svgNode.style.opacity = '1'

                  // Add thick cyan border with non-scaling stroke
                  const shape = nodeElement.querySelector('rect, polygon, circle, ellipse, path')
                  if (shape) {
                    shape.setAttribute('stroke', '#0891b2') // cyan-600
                    shape.setAttribute('stroke-width', '5')
                    shape.setAttribute('vector-effect', 'non-scaling-stroke')
                  }
                }

                // Highlight edges to/from focused node more strongly
                edgePathElements.forEach((edgeGroup, index) => {
                  if (isFocusedIncoming(edgeGroup, index)) {
                    const pathElement = edgeGroup.querySelector('path') || edgeGroup
                    const svgEdge = pathElement as SVGElement
                    svgEdge.style.opacity = '1'
                    svgEdge.style.stroke = '#0891b2' // cyan-600
                    svgEdge.style.strokeWidth = '5px'
                    svgEdge.setAttribute('stroke', '#0891b2')
                    svgEdge.setAttribute('stroke-width', '5')
                  }
                  if (isFocusedOutgoing(edgeGroup, index)) {
                    const pathElement = edgeGroup.querySelector('path') || edgeGroup
                    const svgEdge = pathElement as SVGElement
                    svgEdge.style.opacity = '1'
                    svgEdge.style.stroke = '#22d3ee' // cyan-400
                    svgEdge.style.strokeWidth = '4px'
                    svgEdge.setAttribute('stroke', '#22d3ee')
                    svgEdge.setAttribute('stroke-width', '4')
                  }
                })
              }
            }
          }
        }

        // Clean up the render element (mermaid leaves these in document.body)
        const renderElement = document.getElementById(id)
        if (renderElement && renderElement.parentElement === document.body) {
          renderElement.remove()
        }
      } catch (err) {
        console.error('Mermaid render error:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    renderDiagram()

    return () => {
      mounted = false
    }
  }, [mermaidContent, currentNodeId, highlightedSnapshots, highlightedNodeId])

  if (error) {
    return (
      <div
        data-element="mermaid-error"
        className={css({
          padding: '6',
          backgroundColor: { base: 'red.50', _dark: 'red.900/30' },
          borderRadius: 'lg',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4',
        })}
      >
        <div
          className={css({
            color: { base: 'red.700', _dark: 'red.300' },
            fontSize: 'sm',
            textAlign: 'center',
          })}
        >
          <strong>Failed to render flowchart</strong>
          <br />
          <span className={css({ fontFamily: 'mono', fontSize: 'xs' })}>{error}</span>
        </div>
        {onRegenerate && (
          <button
            data-action="regenerate-from-error"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className={css({
              paddingY: '3',
              paddingX: '6',
              borderRadius: 'lg',
              backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
              color: 'white',
              fontWeight: 'medium',
              border: 'none',
              cursor: 'pointer',
              _hover: {
                backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            {isRegenerating ? 'Regenerating...' : '🔄 Regenerate Flowchart'}
          </button>
        )}
        <p
          className={css({
            color: { base: 'gray.500', _dark: 'gray.400' },
            fontSize: 'xs',
            textAlign: 'center',
            maxWidth: '300px',
          })}
        >
          The AI sometimes generates invalid mermaid syntax. Regenerating will create a new
          flowchart from scratch.
        </p>
      </div>
    )
  }

  return (
    <div
      data-testid="debug-mermaid-diagram"
      className={css({
        padding: '4',
        backgroundColor: { base: 'white', _dark: 'gray.800' },
        borderRadius: 'lg',
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      {isLoading && (
        <div
          className={css({
            textAlign: 'center',
            padding: '4',
            color: { base: 'gray.500', _dark: 'gray.400' },
            fontSize: 'sm',
          })}
        >
          Loading flowchart...
        </div>
      )}
      <div
        ref={containerRef}
        className={css({
          display: isLoading ? 'none' : 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          alignItems: 'center',
          justifyContent: 'center',
          '& svg': {
            maxWidth: '100%',
            maxHeight: '100%',
            height: 'auto',
          },
        })}
      />
    </div>
  )
}

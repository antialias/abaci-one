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
              // Mermaid v11+ uses .flowchart-link, older versions use .edgePath path
              const allEdgePathElements = svgElement.querySelectorAll('.flowchart-link, .edgePath path, .edgePaths path')
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
              // Mermaid v11+ uses .flowchart-link class for edge paths
              // inside a container with class .edgePaths (plural)
              const allEdgePaths = svgElement.querySelectorAll('.flowchart-link')
              const edgePathElements = Array.from(allEdgePaths)
              const edgeLabelElements = Array.from(allEdgeLabels)


              // Collect path nodes for highlighting
              const pathNodeSet = new Set(highlightedPath.filter(n => n !== 'initial'))

              /**
               * Build a graph from SVG edges for BFS traversal.
               * Extracts from/to from L_FROM_TO_INDEX format.
               */
              const mermaidGraph = new Map<string, Array<{ to: string; edgeId: string; element: Element }>>()
              const allSvgNodeIds = new Set<string>()

              for (const edge of edgePathElements) {
                const svgEdgeId = edge.id
                if (!svgEdgeId) continue

                // Parse L_FROM_TO_INDEX format
                if (svgEdgeId.startsWith('L_')) {
                  const withoutPrefix = svgEdgeId.slice(2) // Remove 'L_'
                  const lastUnderscore = withoutPrefix.lastIndexOf('_')
                  if (lastUnderscore > 0) {
                    const fromTo = withoutPrefix.slice(0, lastUnderscore) // Remove '_INDEX'

                    // Find all node elements to know valid node IDs
                    const allNodeElements = svgElement.querySelectorAll('[id^="flowchart-"]')
                    const nodeIds = new Set(
                      Array.from(allNodeElements)
                        .map(e => e.id.match(/flowchart-([^-]+)-/)?.[1])
                        .filter(Boolean) as string[]
                    )

                    // Try to split FROM_TO by finding a valid node ID prefix
                    for (const nodeId of nodeIds) {
                      if (fromTo.startsWith(`${nodeId}_`)) {
                        const toNode = fromTo.slice(nodeId.length + 1)
                        if (nodeIds.has(toNode)) {
                          allSvgNodeIds.add(nodeId)
                          allSvgNodeIds.add(toNode)

                          if (!mermaidGraph.has(nodeId)) {
                            mermaidGraph.set(nodeId, [])
                          }
                          mermaidGraph.get(nodeId)!.push({ to: toNode, edgeId: svgEdgeId, element: edge })
                          break
                        }
                      }
                    }
                  }
                }
              }

              /**
               * BFS to find path from `start` to `end` through mermaid graph.
               * Returns edges and intermediate nodes on the path.
               *
               * If direct path not found (due to phase boundaries), falls back to
               * finding all nodes reachable from start + all nodes that can reach end.
               */
              const findPathBFS = (start: string, end: string): { edges: Element[]; intermediateNodes: string[] } => {
                if (start === end) return { edges: [], intermediateNodes: [] }

                // Try direct BFS first
                const queue: Array<{ node: string; path: Array<{ to: string; edgeId: string; element: Element }> }> = [
                  { node: start, path: [] }
                ]
                const visited = new Set<string>([start])

                while (queue.length > 0) {
                  const { node, path } = queue.shift()!
                  const neighbors = mermaidGraph.get(node) || []

                  for (const neighbor of neighbors) {
                    if (neighbor.to === end) {
                      // Found the path!
                      const fullPath = [...path, neighbor]
                      return {
                        edges: fullPath.map(p => p.element),
                        intermediateNodes: fullPath.slice(0, -1).map(p => p.to)
                      }
                    }

                    if (!visited.has(neighbor.to)) {
                      visited.add(neighbor.to)
                      queue.push({ node: neighbor.to, path: [...path, neighbor] })
                    }
                  }
                }

                // Direct path not found - likely a phase boundary
                // Find all reachable from start (forward BFS)
                const reachableFromStart = new Set<string>([start])
                const edgesFromStart: Element[] = []
                let frontier = [start]
                while (frontier.length > 0) {
                  const node = frontier.shift()!
                  for (const neighbor of mermaidGraph.get(node) || []) {
                    if (!reachableFromStart.has(neighbor.to)) {
                      reachableFromStart.add(neighbor.to)
                      edgesFromStart.push(neighbor.element)
                      frontier.push(neighbor.to)
                    }
                  }
                }

                // Build reverse graph for backward BFS
                const reverseGraph = new Map<string, Array<{ from: string; element: Element }>>()
                for (const [from, neighbors] of mermaidGraph) {
                  for (const n of neighbors) {
                    if (!reverseGraph.has(n.to)) reverseGraph.set(n.to, [])
                    reverseGraph.get(n.to)!.push({ from, element: n.element })
                  }
                }

                // Find all that can reach end (backward BFS)
                const canReachEnd = new Set<string>([end])
                const edgesToEnd: Element[] = []
                frontier = [end]
                while (frontier.length > 0) {
                  const node = frontier.shift()!
                  for (const neighbor of reverseGraph.get(node) || []) {
                    if (!canReachEnd.has(neighbor.from)) {
                      canReachEnd.add(neighbor.from)
                      edgesToEnd.push(neighbor.element)
                      frontier.push(neighbor.from)
                    }
                  }
                }

                // Combine: nodes reachable from start + nodes that can reach end
                // minus start and end themselves
                const intermediateNodes = new Set<string>()
                for (const node of reachableFromStart) {
                  if (node !== start && node !== end) intermediateNodes.add(node)
                }
                for (const node of canReachEnd) {
                  if (node !== start && node !== end) intermediateNodes.add(node)
                }

                return {
                  edges: [...edgesFromStart, ...edgesToEnd],
                  intermediateNodes: [...intermediateNodes]
                }
              }


              // Find focused node's neighbors in the path for edge highlighting
              let focusedPrevNode: string | undefined
              let focusedNextNode: string | undefined

              if (highlightedSnapshots && highlightedNodeId) {
                for (let i = 0; i < highlightedSnapshots.length; i++) {
                  const snapshot = highlightedSnapshots[i]
                  // If this snapshot's next node is the focused node, this is the predecessor
                  if (snapshot.nextNodeId === highlightedNodeId && snapshot.nodeId !== 'initial') {
                    focusedPrevNode = snapshot.nodeId
                  }
                  // If this snapshot IS the focused node, its next is the successor
                  if (snapshot.nodeId === highlightedNodeId) {
                    focusedNextNode = snapshot.nextNodeId
                  }
                }
              }

              // Find edges leading to/from focused node (using BFS to handle intermediates)
              const focusedIncomingEdges = new Set<Element>()
              const focusedOutgoingEdges = new Set<Element>()

              if (focusedPrevNode && highlightedNodeId) {
                const { edges } = findPathBFS(focusedPrevNode, highlightedNodeId)
                edges.forEach(e => focusedIncomingEdges.add(e))
              }
              if (highlightedNodeId && focusedNextNode) {
                const { edges } = findPathBFS(highlightedNodeId, focusedNextNode)
                edges.forEach(e => focusedOutgoingEdges.add(e))
              }

              // Highlight path nodes and edges
              if (hasPathHighlight) {
                // Start with path nodes from simulation
                const nodesToHighlight = new Set(highlightedPath.filter(n => n !== 'initial'))
                const edgesToHighlight = new Set<Element>()

                // For each consecutive pair of path nodes, find the path through mermaid graph
                const pathArray = highlightedPath.filter(n => n !== 'initial')
                for (let i = 0; i < pathArray.length - 1; i++) {
                  const from = pathArray[i]
                  const to = pathArray[i + 1]

                  const { edges, intermediateNodes } = findPathBFS(from, to)

                  // Add intermediate nodes
                  for (const node of intermediateNodes) {
                    nodesToHighlight.add(node)
                  }

                  // Add edges
                  for (const edge of edges) {
                    edgesToHighlight.add(edge)
                  }
                }


                // Highlight all nodes (path + intermediate)
                for (const nodeId of nodesToHighlight) {
                  const nodeElement = svgElement.querySelector(`[id*="flowchart-${nodeId}-"]`)
                  if (nodeElement) {
                    const svgNode = nodeElement as SVGElement
                    svgNode.style.opacity = '1'

                    // Add light cyan border
                    const shape = nodeElement.querySelector('rect, polygon, circle, ellipse, path') as SVGElement | null
                    if (shape) {
                      shape.style.stroke = '#06b6d4' // cyan-500
                      shape.style.strokeWidth = '3px'
                      shape.setAttribute('stroke', '#06b6d4')
                      shape.setAttribute('stroke-width', '3')
                      shape.setAttribute('vector-effect', 'non-scaling-stroke')
                    }
                  }
                }

                // Highlight edges
                edgesToHighlight.forEach((edgeElement) => {
                  const svgEdge = edgeElement as SVGElement
                  svgEdge.style.opacity = '1'
                  svgEdge.style.stroke = '#06b6d4' // cyan-500
                  svgEdge.style.strokeWidth = '3px'
                  svgEdge.setAttribute('stroke', '#06b6d4')
                  svgEdge.setAttribute('stroke-width', '3')
                  svgEdge.setAttribute('vector-effect', 'non-scaling-stroke')
                })
              }

              // Highlight the focused node more strongly (overrides path highlight)
              if (hasNodeHighlight) {
                const nodeElement = svgElement.querySelector(`[id*="flowchart-${highlightedNodeId}-"]`)
                if (nodeElement) {
                  const svgNode = nodeElement as SVGElement
                  svgNode.style.opacity = '1'

                  // Add thick cyan border with non-scaling stroke
                  const shape = nodeElement.querySelector('rect, polygon, circle, ellipse, path') as SVGElement | null
                  if (shape) {
                    shape.style.stroke = '#0891b2' // cyan-600
                    shape.style.strokeWidth = '5px'
                    shape.setAttribute('stroke', '#0891b2')
                    shape.setAttribute('stroke-width', '5')
                    shape.setAttribute('vector-effect', 'non-scaling-stroke')
                  }
                }

                // Highlight edges to/from focused node more strongly
                focusedIncomingEdges.forEach((edgeElement) => {
                  const svgEdge = edgeElement as SVGElement
                  svgEdge.style.opacity = '1'
                  svgEdge.style.stroke = '#0891b2' // cyan-600
                  svgEdge.style.strokeWidth = '5px'
                  svgEdge.setAttribute('stroke', '#0891b2')
                  svgEdge.setAttribute('stroke-width', '5')
                })
                focusedOutgoingEdges.forEach((edgeElement) => {
                  const svgEdge = edgeElement as SVGElement
                  svgEdge.style.opacity = '1'
                  svgEdge.style.stroke = '#22d3ee' // cyan-400
                  svgEdge.style.strokeWidth = '4px'
                  svgEdge.setAttribute('stroke', '#22d3ee')
                  svgEdge.setAttribute('stroke-width', '4')
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

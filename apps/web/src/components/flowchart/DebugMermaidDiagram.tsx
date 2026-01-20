'use client'

import { useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

interface DebugMermaidDiagramProps {
  /** Raw mermaid content */
  mermaidContent: string
  /** Current node ID to highlight */
  currentNodeId: string
}

/**
 * DebugMermaidDiagram - Renders a mermaid flowchart with the current node highlighted.
 *
 * Only rendered when visual debug mode is enabled.
 * Uses mermaid.js to render the flowchart SVG with custom styling for the current node.
 */
export function DebugMermaidDiagram({ mermaidContent, currentNodeId }: DebugMermaidDiagramProps) {
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

        // Add style definition to highlight the current node (only if a node ID is provided)
        // We append this to the mermaid content
        const highlightStyle = currentNodeId
          ? `\n    style ${currentNodeId} fill:#fbbf24,stroke:#d97706,stroke-width:4px,color:#000`
          : ''
        const contentWithHighlight = mermaidContent + highlightStyle

        // Generate unique ID for this render
        const id = `mermaid-debug-${Date.now()}`

        // Render the diagram
        const { svg } = await mermaid.render(id, contentWithHighlight)

        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg

          // Make the SVG responsive
          const svgElement = containerRef.current.querySelector('svg')
          if (svgElement) {
            svgElement.style.maxWidth = '100%'
            svgElement.style.height = 'auto'
          }
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
  }, [mermaidContent, currentNodeId])

  if (error) {
    return (
      <div
        className={css({
          padding: '4',
          backgroundColor: { base: 'red.50', _dark: 'red.900/30' },
          borderRadius: 'lg',
          color: { base: 'red.700', _dark: 'red.300' },
          fontSize: 'sm',
        })}
      >
        Failed to render flowchart: {error}
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

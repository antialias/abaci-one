'use client'

import { useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

interface DebugMermaidDiagramProps {
  /** Raw mermaid content */
  mermaidContent: string
  /** Current node ID to highlight */
  currentNodeId: string
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

        // Add style definition to highlight the current node (only if a node ID is provided)
        // We append this to the mermaid content
        const highlightStyle = currentNodeId
          ? `\n    style ${currentNodeId} fill:#fbbf24,stroke:#d97706,stroke-width:4px,color:#000`
          : ''
        const contentWithHighlight = sanitizedContent + highlightStyle

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
  }, [mermaidContent, currentNodeId])

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
              paddingY: '3', paddingX: '6',
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

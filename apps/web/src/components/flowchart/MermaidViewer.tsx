'use client'

import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { css } from '../../../styled-system/css'

interface MermaidViewerProps {
  /** Raw mermaid content */
  mermaidContent: string
}

/**
 * Simple mermaid diagram viewer without node highlighting.
 * Used for static display of flowcharts.
 */
export function MermaidViewer({ mermaidContent }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || !mermaidContent) return

    // Initialize mermaid with basic settings
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#e3f2fd',
        primaryTextColor: '#1a1a1a',
        primaryBorderColor: '#90caf9',
        lineColor: '#444444',
        secondaryColor: '#fff8e1',
        tertiaryColor: '#e8f5e9',
      },
      flowchart: {
        curve: 'basis',
        nodeSpacing: 30,
        rankSpacing: 50,
        padding: 20,
      },
      securityLevel: 'loose',
    })

    const render = async () => {
      try {
        const id = `mermaid-${Date.now()}`
        const { svg } = await mermaid.render(id, mermaidContent)
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          setError(null)
        }
      } catch (err) {
        console.error('Mermaid render error:', err)
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
      }
    }

    render()
  }, [mermaidContent])

  if (error) {
    return (
      <div
        className={css({
          padding: '4',
          color: { base: 'red.600', _dark: 'red.400' },
          fontSize: 'sm',
          textAlign: 'center',
        })}
      >
        <p>Failed to render flowchart:</p>
        <p className={css({ fontSize: 'xs', marginTop: '1' })}>{error}</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-component="mermaid-viewer"
      className={css({
        width: '100%',
        minHeight: '200px',
        display: 'flex',
        justifyContent: 'center',
        '& svg': {
          maxWidth: '100%',
          height: 'auto',
        },
      })}
    />
  )
}

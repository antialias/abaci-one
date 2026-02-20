'use client'

import { useEffect, useState } from 'react'
import { css } from '../../../../styled-system/css'

export interface TriptychPanel {
  label: string
  description: string
  body: Record<string, unknown>
}

interface WorksheetTriptychHeroProps {
  panels: TriptychPanel[]
  componentName: string
}

/**
 * Shared hero layout for worksheet blog posts.
 * Fetches the same problem at different scaffolding levels from the
 * Typst example API and displays them side by side in a 3-panel triptych.
 */
export function WorksheetTriptychHero({ panels, componentName }: WorksheetTriptychHeroProps) {
  const [svgs, setSvgs] = useState<(string | null)[]>(panels.map(() => null))

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      const results = await Promise.all(
        panels.map(async (panel) => {
          try {
            const res = await fetch('/api/create/worksheets/addition/example', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(panel.body),
            })
            if (!res.ok) return null
            const data = await res.json()
            return data.svg as string
          } catch {
            return null
          }
        })
      )

      if (!cancelled) {
        setSvgs(results)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [panels])

  return (
    <div
      data-component={componentName}
      className={css({
        display: 'flex',
        width: '100%',
        height: '100%',
        bg: '#0d1117',
        overflow: 'hidden',
      })}
    >
      {panels.map((panel, i) => (
        <div
          key={panel.label}
          data-element="scaffolding-panel"
          className={css({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: i < panels.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
            overflow: 'hidden',
          })}
        >
          <div
            data-element="panel-label"
            className={css({
              px: '8px',
              py: '3px',
              bg: 'rgba(255,255,255,0.05)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              fontSize: '10px',
              fontWeight: 600,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textAlign: 'center',
            })}
          >
            {panel.label}
          </div>
          <div
            data-element="svg-container"
            className={css({
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: 'white',
              m: '8px',
              mb: '4px',
              rounded: 'md',
              overflow: 'hidden',
              '& svg': {
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
              },
            })}
          >
            {svgs[i] ? (
              <div dangerouslySetInnerHTML={{ __html: svgs[i]! }} />
            ) : (
              <div
                className={css({
                  width: '60%',
                  height: '60%',
                  bg: '#f3f4f6',
                  rounded: 'md',
                  animation: 'pulse 2s infinite',
                })}
              />
            )}
          </div>
          <div
            data-element="panel-description"
            className={css({
              textAlign: 'center',
              fontSize: '10px',
              color: '#6b7280',
              pb: '6px',
            })}
          >
            {panel.description}
          </div>
        </div>
      ))}
    </div>
  )
}

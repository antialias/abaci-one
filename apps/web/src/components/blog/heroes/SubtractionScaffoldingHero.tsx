'use client'

import { useEffect, useState } from 'react'
import { css } from '../../../../styled-system/css'

interface PanelConfig {
  label: string
  description: string
  body: Record<string, unknown>
}

/**
 * Three scaffolding levels for 352 − 117 = 235.
 * Ones-column borrowing only — demonstrates conditional scaffolding.
 */
const PANELS: PanelConfig[] = [
  {
    label: 'No Scaffolding',
    description: 'Standard format',
    body: {
      operator: 'subtraction',
      minuend: 352,
      subtrahend: 117,
      fontSize: 18,
      showCarryBoxes: false,
      showAnswerBoxes: false,
      showPlaceValueColors: false,
      showBorrowNotation: false,
      showBorrowingHints: false,
      showTenFrames: false,
    },
  },
  {
    label: 'Colors + Boxes',
    description: 'Visual structure',
    body: {
      operator: 'subtraction',
      minuend: 352,
      subtrahend: 117,
      fontSize: 18,
      showCarryBoxes: false,
      showAnswerBoxes: true,
      showPlaceValueColors: true,
      showBorrowNotation: false,
      showBorrowingHints: false,
      showTenFrames: false,
    },
  },
  {
    label: 'Full Scaffolding',
    description: 'Guided borrowing',
    body: {
      operator: 'subtraction',
      minuend: 352,
      subtrahend: 117,
      fontSize: 18,
      showCarryBoxes: true,
      showAnswerBoxes: true,
      showPlaceValueColors: true,
      showBorrowNotation: true,
      showBorrowingHints: true,
      showTenFrames: true,
    },
  },
]

/**
 * Hero component for the subtraction scaffolding blog post.
 * Fetches the same problem (352 − 117) at three scaffolding levels
 * from the live Typst renderer and displays them side by side.
 */
export default function SubtractionScaffoldingHero() {
  const [svgs, setSvgs] = useState<(string | null)[]>(PANELS.map(() => null))

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      const results = await Promise.all(
        PANELS.map(async (panel) => {
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
  }, [])

  return (
    <div
      data-component="subtraction-scaffolding-hero"
      className={css({
        display: 'flex',
        width: '100%',
        height: '100%',
        bg: '#0d1117',
        overflow: 'hidden',
      })}
    >
      {PANELS.map((panel, i) => (
        <div
          key={panel.label}
          data-element="scaffolding-panel"
          className={css({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: i < PANELS.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
            overflow: 'hidden',
          })}
        >
          <PanelLabel>{panel.label}</PanelLabel>
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

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  )
}

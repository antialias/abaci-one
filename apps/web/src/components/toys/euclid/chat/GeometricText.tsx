'use client'

/**
 * Renders chat text with geometric entity references (△ABC, ∠DEF, AB)
 * as hoverable spans that highlight the corresponding construction elements.
 */

import { useMemo } from 'react'
import {
  parseGeometricEntities,
  type GeometricEntityRef,
} from './parseGeometricEntities'

interface GeometricTextProps {
  text: string
  knownLabels: Set<string>
  onHighlight: (entity: GeometricEntityRef | null) => void
}

export function GeometricText({ text, knownLabels, onHighlight }: GeometricTextProps) {
  const segments = useMemo(
    () => parseGeometricEntities(text, knownLabels),
    [text, knownLabels]
  )

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return <span key={i}>{seg.text}</span>
        }
        return (
          <span
            key={i}
            data-element="geometric-ref"
            style={{
              color: '#4E79A7',
              fontWeight: 600,
              cursor: 'pointer',
              borderBottom: '1px dotted rgba(78, 121, 167, 0.4)',
            }}
            onMouseEnter={() => onHighlight(seg.entity)}
            onMouseLeave={() => onHighlight(null)}
          >
            {seg.text}
          </span>
        )
      })}
    </>
  )
}

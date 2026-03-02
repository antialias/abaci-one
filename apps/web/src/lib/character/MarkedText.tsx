'use client'

/**
 * Renders text with entity markers as hoverable highlighted spans.
 *
 * Generic version of GeometricText — parameterized on entity ref type
 * via EntityMarkerConfig.
 */

import React, { useMemo } from 'react'
import type { EntityMarkerConfig } from './types'
import { parseEntityMarkers } from './parseEntityMarkers'

interface MarkedTextProps<TEntityRef> {
  text: string
  markers: EntityMarkerConfig<TEntityRef>
  onHighlight: (entity: TEntityRef | null) => void
  /** Optional custom renderer per entity. When absent, uses default blue/bold styling. */
  renderEntity?: (entity: TEntityRef, displayText: string, index: number) => React.ReactNode
}

export function MarkedText<TEntityRef>({
  text,
  markers,
  onHighlight,
  renderEntity,
}: MarkedTextProps<TEntityRef>) {
  const segments = useMemo(() => parseEntityMarkers(text, markers), [text, markers])

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return <span key={i}>{seg.text}</span>
        }
        if (renderEntity) {
          return <React.Fragment key={i}>{renderEntity(seg.entity, seg.text, i)}</React.Fragment>
        }
        return (
          <span
            key={i}
            data-element="entity-ref"
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

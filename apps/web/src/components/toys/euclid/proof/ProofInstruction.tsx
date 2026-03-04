'use client'

import type React from 'react'
import { MarkedText } from '@/lib/character/MarkedText'
import { stripEntityMarkers } from '@/lib/character/parseEntityMarkers'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'
import type { EuclidEntityRef } from '../chat/parseGeometricEntities'

interface ProofInstructionProps {
  text: string
  renderEntity?: (entity: EuclidEntityRef, displayText: string, index: number) => React.ReactNode
  onHighlight?: (entity: EuclidEntityRef | null) => void
  style?: React.CSSProperties
}

/**
 * Renders instruction text with optional entity markup highlighting.
 *
 * When `renderEntity` is provided, renders via MarkedText with EUCLID_ENTITY_MARKERS.
 * When absent, strips markers and renders plain text.
 */
export function ProofInstruction({
  text,
  renderEntity,
  onHighlight,
  style,
}: ProofInstructionProps) {
  if (!renderEntity) {
    return <span style={style}>{stripEntityMarkers(text, EUCLID_ENTITY_MARKERS)}</span>
  }

  return (
    <span style={style}>
      <MarkedText
        text={text}
        markers={EUCLID_ENTITY_MARKERS}
        onHighlight={onHighlight ?? (() => {})}
        renderEntity={renderEntity}
      />
    </span>
  )
}

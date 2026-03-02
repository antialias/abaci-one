'use client'

/**
 * Renders a single Euclid entity span with per-type styling.
 *
 * - Geometric entities (seg, tri, ang, pt): blue, dotted underline → canvas glow on hover
 * - Definitions: red → CitationPopover on hover
 * - Postulates: gold → CitationPopover on hover
 * - Common Notions: blue → CitationPopover on hover
 * - Propositions: dark → CitationPopover on hover
 */

import { useRef, useState, useCallback } from 'react'
import { BYRNE } from '../types'
import type { EuclidEntityRef, FoundationEntityRef } from './parseGeometricEntities'
import { isGeometricEntity, isFoundationEntity, foundationToCitationKey } from './parseGeometricEntities'

/** Color for each entity type, using the Byrne palette. */
function entityColor(entity: EuclidEntityRef): string {
  if (isGeometricEntity(entity)) return BYRNE.blue
  switch (entity.type) {
    case 'definition': return BYRNE.red
    case 'postulate': return BYRNE.yellow
    case 'commonNotion': return BYRNE.blue
    case 'proposition': return BYRNE.given
  }
}

/** Underline opacity — geometric gets dotted, foundations get solid but subtle */
function entityUnderline(entity: EuclidEntityRef): string {
  const color = entityColor(entity)
  if (isGeometricEntity(entity)) return `1px dotted ${color}66`
  return `1px solid ${color}55`
}

interface EuclidEntitySpanProps {
  entity: EuclidEntityRef
  displayText: string
  onHighlightGeometric: (entity: EuclidEntityRef | null) => void
  onHighlightFoundation: (entity: FoundationEntityRef, anchorRect: DOMRect) => void
  onUnhighlightFoundation: () => void
  /** When true, inherit parent styling but still trigger glow/popover on hover */
  subtle?: boolean
}

export function EuclidEntitySpan({
  entity,
  displayText,
  onHighlightGeometric,
  onHighlightFoundation,
  onUnhighlightFoundation,
  subtle,
}: EuclidEntitySpanProps) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    if (isGeometricEntity(entity)) {
      onHighlightGeometric(entity)
    } else if (isFoundationEntity(entity)) {
      const rect = spanRef.current?.getBoundingClientRect()
      if (rect) onHighlightFoundation(entity, rect)
    }
  }, [entity, onHighlightGeometric, onHighlightFoundation])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    if (isGeometricEntity(entity)) {
      onHighlightGeometric(null)
    } else if (isFoundationEntity(entity)) {
      onUnhighlightFoundation()
    }
  }, [entity, onHighlightGeometric, onUnhighlightFoundation])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Mobile: tap foundation entities to show popover
    if (!isFoundationEntity(entity)) return
    e.stopPropagation()
    const rect = spanRef.current?.getBoundingClientRect()
    if (rect) onHighlightFoundation(entity, rect)
  }, [entity, onHighlightFoundation])

  const color = entityColor(entity)

  const style: React.CSSProperties = subtle
    ? {
        color: hovered ? color : 'inherit',
        fontWeight: 'inherit',
        cursor: 'pointer',
        borderBottom: 'none',
        transition: 'color 0.15s ease',
      }
    : {
        color,
        fontWeight: 600,
        cursor: 'pointer',
        borderBottom: entityUnderline(entity),
      }

  return (
    <span
      ref={spanRef}
      data-element="entity-ref"
      data-entity-type={entity.type}
      data-citation-key={isFoundationEntity(entity) ? foundationToCitationKey(entity) : undefined}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
    >
      {displayText}
    </span>
  )
}

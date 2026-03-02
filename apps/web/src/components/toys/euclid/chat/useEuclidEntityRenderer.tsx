'use client'

/**
 * Hook that creates a stable `renderEntity` callback for MarkedText.
 *
 * Wires EuclidEntitySpan to the right highlight handlers so geometric
 * entities trigger canvas glow and foundation entities trigger CitationPopover.
 */

import { useCallback } from 'react'
import type { EuclidEntityRef, FoundationEntityRef } from './parseGeometricEntities'
import { EuclidEntitySpan } from './EuclidEntitySpan'

interface UseEuclidEntityRendererOptions {
  onHighlightGeometric: (entity: EuclidEntityRef | null) => void
  onHighlightFoundation: (entity: FoundationEntityRef, anchorRect: DOMRect) => void
  onUnhighlightFoundation: () => void
  /** When true, entities inherit parent styling but still trigger glow/popover on hover */
  subtle?: boolean
}

export function useEuclidEntityRenderer({
  onHighlightGeometric,
  onHighlightFoundation,
  onUnhighlightFoundation,
  subtle,
}: UseEuclidEntityRendererOptions) {
  const renderEntity = useCallback(
    (entity: EuclidEntityRef, displayText: string, _index: number) => (
      <EuclidEntitySpan
        entity={entity}
        displayText={displayText}
        onHighlightGeometric={onHighlightGeometric}
        onHighlightFoundation={onHighlightFoundation}
        onUnhighlightFoundation={onUnhighlightFoundation}
        subtle={subtle}
      />
    ),
    [onHighlightGeometric, onHighlightFoundation, onUnhighlightFoundation, subtle],
  )

  return renderEntity
}

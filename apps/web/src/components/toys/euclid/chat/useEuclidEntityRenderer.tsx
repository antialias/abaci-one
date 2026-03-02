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
}

export function useEuclidEntityRenderer({
  onHighlightGeometric,
  onHighlightFoundation,
  onUnhighlightFoundation,
}: UseEuclidEntityRendererOptions) {
  const renderEntity = useCallback(
    (entity: EuclidEntityRef, displayText: string, _index: number) => (
      <EuclidEntitySpan
        entity={entity}
        displayText={displayText}
        onHighlightGeometric={onHighlightGeometric}
        onHighlightFoundation={onHighlightFoundation}
        onUnhighlightFoundation={onUnhighlightFoundation}
      />
    ),
    [onHighlightGeometric, onHighlightFoundation, onUnhighlightFoundation],
  )

  return renderEntity
}

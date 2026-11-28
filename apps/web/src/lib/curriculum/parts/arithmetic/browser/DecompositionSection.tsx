'use client'

import { DecompositionDisplay } from '@/components/decomposition'
import { useDecomposition } from '@/contexts/DecompositionContext'

/**
 * DecompositionSection - A self-contained section with label that hides when decomposition is not meaningful
 *
 * Use this when you want the entire section (including "Step-by-Step" label) to disappear
 * when the decomposition is trivial (e.g., "5 = 5").
 *
 * Must be used inside a DecompositionProvider.
 */
export function DecompositionSection({
  label = 'Step-by-Step',
  className,
  labelClassName,
  contentClassName,
}: {
  label?: string
  className?: string
  labelClassName?: string
  contentClassName?: string
}) {
  const { isMeaningfulDecomposition } = useDecomposition()

  if (!isMeaningfulDecomposition) {
    return null
  }

  return (
    <div data-element="decomposition-section" className={className}>
      <div data-element="decomposition-label" className={labelClassName}>
        {label}
      </div>
      <div data-element="decomposition-content" className={contentClassName}>
        <DecompositionDisplay />
      </div>
    </div>
  )
}

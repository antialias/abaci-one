'use client'

import { NumberLine } from '@/components/toys/number-line/NumberLine'
import { useConstantExplorerConfig } from './Provider'

/**
 * Renders the NumberLine in exploration-break mode.
 * Reads the selected constant from ConstantExplorerProvider context.
 */
export function ConstantExplorerGame() {
  const { constantId } = useConstantExplorerConfig()

  return <NumberLine mode="exploration-break" autoPlayDemo={constantId} />
}

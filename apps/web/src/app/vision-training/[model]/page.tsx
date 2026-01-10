'use client'

import { css } from '../../../../styled-system/css'
import { useModelType } from '../hooks/useModelType'
import { BoundaryDataPanel } from '../train/components/BoundaryDataPanel'
import { ColumnClassifierDataPanel } from '../train/components/ColumnClassifierDataPanel'

/**
 * Vision Training Data Hub
 *
 * Main page for /vision-training/[model].
 * Renders the appropriate data panel based on the model type.
 *
 * - boundary-detector: BoundaryDataPanel
 * - column-classifier: ColumnClassifierDataPanel
 */
export default function VisionTrainingDataPage() {
  const modelType = useModelType()

  return (
    <div
      data-component="vision-data-hub"
      className={css({
        height: 'calc(100vh - var(--nav-height))',
        overflow: 'hidden',
      })}
    >
      {modelType === 'boundary-detector' && <BoundaryDataPanel showHeader />}
      {modelType === 'column-classifier' && <ColumnClassifierDataPanel showHeader />}
    </div>
  )
}

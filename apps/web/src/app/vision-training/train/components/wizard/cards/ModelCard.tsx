'use client'

import { css } from '../../../../../../../styled-system/css'
import type { ModelType, ModelsSummary, DataQuality } from '../types'

interface ModelCardProps {
  modelsSummary: ModelsSummary | null
  summaryLoading: boolean
  selectedModel: ModelType | null
  onSelectModel: (model: ModelType) => void
  onProgress: () => void
}

const QUALITY_CONFIG: Record<DataQuality, { color: string; label: string }> = {
  none: { color: 'gray.500', label: 'No Data' },
  insufficient: { color: 'red.400', label: 'Insufficient' },
  minimal: { color: 'yellow.400', label: 'Minimal' },
  good: { color: 'green.400', label: 'Good' },
  excellent: { color: 'green.300', label: 'Excellent' },
}

interface ModelOptionProps {
  icon: string
  title: string
  description: string
  sampleCount: number
  sampleLabel: string
  dataQuality: DataQuality
  hasData: boolean
  isSelected: boolean
  onClick: () => void
}

function ModelOption({
  icon,
  title,
  description,
  sampleCount,
  sampleLabel,
  dataQuality,
  hasData,
  isSelected,
  onClick,
}: ModelOptionProps) {
  const qualityConfig = QUALITY_CONFIG[dataQuality]

  return (
    <button
      type="button"
      onClick={onClick}
      data-element="model-option"
      data-model={title.toLowerCase().replace(' ', '-')}
      data-selected={isSelected}
      className={css({
        flex: 1,
        p: 4,
        bg: isSelected ? 'blue.900/50' : 'gray.800',
        border: '2px solid',
        borderColor: isSelected ? 'blue.500' : 'gray.700',
        borderRadius: 'xl',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s',
        _hover: {
          borderColor: isSelected ? 'blue.400' : 'gray.600',
          bg: isSelected ? 'blue.900/60' : 'gray.750',
        },
      })}
    >
      {/* Icon and title */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 2,
        })}
      >
        <span className={css({ fontSize: 'xl' })}>{icon}</span>
        <span
          className={css({
            fontWeight: 'semibold',
            color: isSelected ? 'blue.300' : 'gray.200',
          })}
        >
          {title}
        </span>
      </div>

      {/* Description */}
      <div
        className={css({
          fontSize: 'sm',
          color: 'gray.400',
          mb: 3,
          lineHeight: 1.4,
        })}
      >
        {description}
      </div>

      {/* Sample count */}
      <div
        className={css({
          fontSize: 'lg',
          fontWeight: 'bold',
          color: 'gray.200',
          mb: 1,
        })}
      >
        {sampleCount.toLocaleString()} {sampleLabel}
      </div>

      {/* Quality indicator */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          fontSize: 'sm',
        })}
      >
        {hasData ? (
          <>
            <span
              className={css({
                width: '8px',
                height: '8px',
                borderRadius: 'full',
                bg: qualityConfig.color,
              })}
            />
            <span style={{ color: `var(--colors-${qualityConfig.color.replace('.', '-')})` }}>
              {qualityConfig.label}
            </span>
          </>
        ) : (
          <span className={css({ color: 'gray.500' })}>No data collected</span>
        )}
      </div>
    </button>
  )
}

export function ModelCard({
  modelsSummary,
  summaryLoading,
  selectedModel,
  onSelectModel,
  onProgress,
}: ModelCardProps) {
  if (summaryLoading) {
    return (
      <div className={css({ textAlign: 'center', py: 6 })}>
        <span
          className={css({
            fontSize: '2xl',
            animation: 'spin 1s linear infinite',
          })}
        >
          ⏳
        </span>
        <div className={css({ color: 'gray.400', mt: 2 })}>Loading model info...</div>
      </div>
    )
  }

  const handleSelectAndProgress = (model: ModelType) => {
    onSelectModel(model)
    // Auto-progress after selection
    setTimeout(() => {
      onProgress()
    }, 300)
  }

  return (
    <div data-element="model-card-content">
      {/* Description */}
      <div
        className={css({
          fontSize: 'sm',
          color: 'gray.400',
          mb: 4,
          textAlign: 'center',
        })}
      >
        Select which vision model you want to train
      </div>

      {/* Model options */}
      <div
        className={css({
          display: 'flex',
          gap: 3,
          flexDirection: { base: 'column', sm: 'row' },
        })}
      >
        <ModelOption
          icon="📊"
          title="Column Classifier"
          description="Recognizes digit values (0-9) from abacus column images"
          sampleCount={modelsSummary?.columnClassifier.totalImages ?? 0}
          sampleLabel="images"
          dataQuality={modelsSummary?.columnClassifier.dataQuality ?? 'none'}
          hasData={modelsSummary?.columnClassifier.hasData ?? false}
          isSelected={selectedModel === 'column-classifier'}
          onClick={() => handleSelectAndProgress('column-classifier')}
        />

        <ModelOption
          icon="🖼️"
          title="Boundary Detector"
          description="Detects abacus corners for marker-free calibration"
          sampleCount={modelsSummary?.boundaryDetector.totalFrames ?? 0}
          sampleLabel="frames"
          dataQuality={modelsSummary?.boundaryDetector.dataQuality ?? 'none'}
          hasData={modelsSummary?.boundaryDetector.hasData ?? false}
          isSelected={selectedModel === 'boundary-detector'}
          onClick={() => handleSelectAndProgress('boundary-detector')}
        />
      </div>

      {/* Current selection info */}
      {selectedModel && (
        <div
          className={css({
            mt: 4,
            p: 3,
            bg: 'blue.900/30',
            border: '1px solid',
            borderColor: 'blue.700/50',
            borderRadius: 'lg',
            fontSize: 'sm',
            color: 'blue.300',
            textAlign: 'center',
          })}
        >
          {selectedModel === 'column-classifier' ? (
            <>
              <strong>Column Classifier</strong> selected — trains on cropped column images to
              recognize digits
            </>
          ) : (
            <>
              <strong>Boundary Detector</strong> selected — trains on full frames to detect abacus
              corners
            </>
          )}
        </div>
      )}
    </div>
  )
}

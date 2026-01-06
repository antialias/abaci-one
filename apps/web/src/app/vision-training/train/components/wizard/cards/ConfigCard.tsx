'use client'

import { css } from '../../../../../../../styled-system/css'
import type { TrainingConfig } from '../types'

interface ConfigCardProps {
  config: TrainingConfig
  setConfig: (config: TrainingConfig | ((prev: TrainingConfig) => TrainingConfig)) => void
  isGpu: boolean
  onStartTraining: () => void
  canStart: boolean
}

interface Preset {
  epochs: number
  batchSize: number
  label: string
  desc: string
}

export function ConfigCard({
  config,
  setConfig,
  isGpu,
  onStartTraining,
  canStart,
}: ConfigCardProps) {
  // Hardware-aware presets
  const presets: Record<string, Preset> = isGpu
    ? {
        quick: { epochs: 10, batchSize: 32, label: '⚡ Quick', desc: '~2 min' },
        balanced: { epochs: 50, batchSize: 64, label: '⚖️ Balanced', desc: '~10 min' },
        best: { epochs: 100, batchSize: 64, label: '✨ Best', desc: '~20 min' },
      }
    : {
        quick: { epochs: 5, batchSize: 16, label: '⚡ Quick', desc: '~5 min' },
        balanced: { epochs: 25, batchSize: 32, label: '⚖️ Balanced', desc: '~15 min' },
        best: { epochs: 50, batchSize: 32, label: '✨ Best', desc: '~30 min' },
      }

  const applyPreset = (preset: Preset) => {
    setConfig((prev) => ({
      ...prev,
      epochs: preset.epochs,
      batchSize: preset.batchSize,
    }))
  }

  const isPresetActive = (preset: Preset) =>
    config.epochs === preset.epochs && config.batchSize === preset.batchSize

  return (
    <div>
      {/* Presets */}
      <div className={css({ mb: 4 })}>
        <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 2 })}>Presets</div>
        <div className={css({ display: 'flex', gap: 2 })}>
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(preset)}
              className={css({
                flex: 1,
                py: 2,
                px: 2,
                borderRadius: 'lg',
                border: '2px solid',
                borderColor: isPresetActive(preset) ? 'blue.500' : 'gray.700',
                bg: isPresetActive(preset) ? 'blue.900' : 'gray.800',
                color: isPresetActive(preset) ? 'blue.300' : 'gray.300',
                cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: { borderColor: 'blue.400' },
              })}
            >
              <div className={css({ fontSize: 'sm', fontWeight: 'medium' })}>{preset.label}</div>
              <div className={css({ fontSize: 'xs', color: 'gray.500' })}>{preset.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Epochs slider */}
      <div className={css({ mb: 4 })}>
        <div className={css({ display: 'flex', justifyContent: 'space-between', mb: 1 })}>
          <span className={css({ fontSize: 'xs', color: 'gray.500' })}>Training Rounds</span>
          <span className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.200' })}>
            {config.epochs}
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={isGpu ? 150 : 75}
          value={config.epochs}
          onChange={(e) => setConfig((prev) => ({ ...prev, epochs: parseInt(e.target.value, 10) }))}
          className={css({
            width: '100%',
            height: '6px',
            borderRadius: 'full',
            bg: 'gray.700',
            appearance: 'none',
            cursor: 'pointer',
            '&::-webkit-slider-thumb': {
              appearance: 'none',
              width: '16px',
              height: '16px',
              borderRadius: 'full',
              bg: 'blue.500',
              cursor: 'pointer',
            },
          })}
        />
      </div>

      {/* Batch size */}
      <div className={css({ mb: 4 })}>
        <div className={css({ display: 'flex', justifyContent: 'space-between', mb: 1 })}>
          <span className={css({ fontSize: 'xs', color: 'gray.500' })}>Batch Size</span>
          <span className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.200' })}>
            {config.batchSize}
          </span>
        </div>
        <div className={css({ display: 'flex', gap: 2 })}>
          {(isGpu ? [32, 64, 128] : [16, 32, 64]).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, batchSize: size }))}
              className={css({
                flex: 1,
                py: 1.5,
                borderRadius: 'md',
                border: '1px solid',
                borderColor: config.batchSize === size ? 'blue.500' : 'gray.700',
                bg: config.batchSize === size ? 'blue.900' : 'transparent',
                color: config.batchSize === size ? 'blue.300' : 'gray.400',
                fontSize: 'sm',
                cursor: 'pointer',
                _hover: { borderColor: 'blue.400' },
              })}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Augmentation toggle */}
      <div className={css({ mb: 6 })}>
        <label
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            cursor: 'pointer',
          })}
        >
          <input
            type="checkbox"
            checked={config.augmentation}
            onChange={(e) => setConfig((prev) => ({ ...prev, augmentation: e.target.checked }))}
            className={css({
              width: '18px',
              height: '18px',
              accentColor: 'rgb(59, 130, 246)',
            })}
          />
          <span className={css({ fontSize: 'sm', color: 'gray.200' })}>Data Augmentation</span>
        </label>
        <div className={css({ fontSize: 'xs', color: 'gray.500', ml: 6, mt: 0.5 })}>
          {isGpu
            ? 'Recommended - your GPU handles extra data easily'
            : 'Adds processing time but improves results'}
        </div>
      </div>

      {/* Start button */}
      <button
        type="button"
        onClick={onStartTraining}
        disabled={!canStart}
        className={css({
          width: '100%',
          py: 3,
          bg: canStart ? 'green.600' : 'gray.700',
          color: canStart ? 'white' : 'gray.500',
          borderRadius: 'lg',
          border: 'none',
          cursor: canStart ? 'pointer' : 'not-allowed',
          fontWeight: 'bold',
          fontSize: 'md',
          transition: 'all 0.2s',
          _hover: canStart ? { bg: 'green.500' } : {},
        })}
      >
        {canStart ? 'Start Training →' : 'Complete previous steps first'}
      </button>
    </div>
  )
}

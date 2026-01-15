'use client'

import { useCallback } from 'react'
import { css } from '../../../styled-system/css'
import type { QuadDetectorConfig, PreprocessingStrategy } from '@/lib/vision/quadDetector'

// Presets for common scanning scenarios
const PRESETS: Record<string, { config: Partial<QuadDetectorConfig>; label: string }> = {
  normal: {
    label: 'Normal',
    config: {
      preprocessing: 'multi',
      enableHistogramEqualization: true,
      enableAdaptiveThreshold: true,
      enableMorphGradient: true,
      cannyThresholds: [50, 150],
      adaptiveBlockSize: 11,
      adaptiveC: 2,
      enableHoughLines: true,
    },
  },
  lowLight: {
    label: 'Low Light',
    config: {
      preprocessing: 'multi',
      enableHistogramEqualization: true,
      enableAdaptiveThreshold: true,
      enableMorphGradient: true,
      cannyThresholds: [30, 100],
      adaptiveBlockSize: 15,
      adaptiveC: 5,
      enableHoughLines: true,
    },
  },
  fingers: {
    label: 'Fingers',
    config: {
      preprocessing: 'multi',
      enableHistogramEqualization: true,
      enableAdaptiveThreshold: true,
      enableMorphGradient: true,
      cannyThresholds: [40, 120],
      adaptiveBlockSize: 11,
      adaptiveC: 2,
      enableHoughLines: true,
    },
  },
  bright: {
    label: 'Bright',
    config: {
      preprocessing: 'enhanced',
      enableHistogramEqualization: true,
      enableAdaptiveThreshold: false,
      enableMorphGradient: false,
      cannyThresholds: [80, 200],
      adaptiveBlockSize: 11,
      adaptiveC: 2,
      enableHoughLines: false,
    },
  },
}

interface ScannerControlsDrawerProps {
  isOpen: boolean
  onClose: () => void
  onOpen: () => void
  config: Partial<QuadDetectorConfig>
  onConfigChange: (config: Partial<QuadDetectorConfig>) => void
}

export function ScannerControlsDrawer({
  isOpen,
  onClose,
  onOpen,
  config,
  onConfigChange,
}: ScannerControlsDrawerProps) {
  const handlePreset = useCallback(
    (presetName: keyof typeof PRESETS) => {
      onConfigChange(PRESETS[presetName].config)
    },
    [onConfigChange]
  )

  const updateField = useCallback(
    <K extends keyof QuadDetectorConfig>(field: K, value: QuadDetectorConfig[K]) => {
      onConfigChange({ [field]: value })
    },
    [onConfigChange]
  )

  // Get current values with defaults
  const preprocessing = (config.preprocessing ?? 'multi') as PreprocessingStrategy
  const enableHistogramEqualization = config.enableHistogramEqualization ?? true
  const enableAdaptiveThreshold = config.enableAdaptiveThreshold ?? true
  const enableMorphGradient = config.enableMorphGradient ?? true
  const enableHoughLines = config.enableHoughLines ?? true
  const cannyThresholds = config.cannyThresholds ?? [50, 150]
  const adaptiveBlockSize = config.adaptiveBlockSize ?? 11
  const adaptiveC = config.adaptiveC ?? 2

  return (
    <>
      {/* Backdrop - click to close */}
      <div
        data-element="drawer-backdrop"
        onClick={onClose}
        className={css({
          position: 'absolute',
          inset: 0,
          bg: 'rgba(0, 0, 0, 0.3)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
          zIndex: 50,
        })}
      />

      {/* Drawer - responsive width: narrow on small screens, wider on tablets+ */}
      <div
        data-component="scanner-controls-drawer"
        className={css({
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'min(180px, 55vw)',
          bg: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(16px)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          // Wider on tablets and up
          '@media (min-width: 480px)': {
            width: 'min(240px, 60vw)',
          },
        })}
      >
        {/* Header - compact */}
        <div
          className={css({
            px: 2,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            '@media (min-width: 480px)': {
              px: 3,
              py: 2,
            },
          })}
        >
          <span
            className={css({
              color: 'white',
              fontWeight: 'bold',
              fontSize: 'xs',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            })}
          >
            Scanner
          </span>
          <button
            type="button"
            onClick={onClose}
            className={css({
              color: 'gray.400',
              fontSize: 'lg',
              lineHeight: 1,
              cursor: 'pointer',
              p: 1,
              _hover: { color: 'white' },
            })}
          >
            ×
          </button>
        </div>

        {/* Scrollable content - responsive spacing */}
        <div
          className={css({
            flex: 1,
            overflowY: 'auto',
            px: 2,
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            '@media (min-width: 480px)': {
              px: 3,
              py: 2,
              gap: 3,
            },
          })}
        >
          {/* Presets - 2x2 grid */}
          <Section title="Presets">
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
                '@media (min-width: 480px)': { gap: 1.5 },
              })}
            >
              {Object.entries(PRESETS).map(([key, preset]) => (
                <PresetButton
                  key={key}
                  label={preset.label}
                  onClick={() => handlePreset(key as keyof typeof PRESETS)}
                />
              ))}
            </div>
          </Section>

          {/* Strategy dropdown */}
          <Section title="Strategy">
            <select
              value={preprocessing}
              onChange={(e) =>
                updateField('preprocessing', e.target.value as PreprocessingStrategy)
              }
              className={css({
                width: '100%',
                bg: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: '1px solid',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 'sm',
                px: 2,
                py: 1.5,
                fontSize: 'xs',
                cursor: 'pointer',
                _focus: { outline: 'none', borderColor: 'blue.400' },
              })}
            >
              <option value="standard">Standard</option>
              <option value="enhanced">Enhanced</option>
              <option value="adaptive">Adaptive</option>
              <option value="multi">Multi (best)</option>
            </select>
          </Section>

          {/* Preprocessing toggles - compact */}
          <Section title="Processing">
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                '@media (min-width: 480px)': { gap: 2 },
              })}
            >
              <Toggle
                label="Histogram EQ"
                sublabel="Stretches contrast for low-light/washed-out images"
                checked={enableHistogramEqualization}
                onChange={(v) => updateField('enableHistogramEqualization', v)}
              />
              <Toggle
                label="Adaptive Threshold"
                sublabel="Local thresholding for uneven lighting & shadows"
                checked={enableAdaptiveThreshold}
                onChange={(v) => updateField('enableAdaptiveThreshold', v)}
              />
              <Toggle
                label="Morph Gradient"
                sublabel="Dilation minus erosion to find thick edges"
                checked={enableMorphGradient}
                onChange={(v) => updateField('enableMorphGradient', v)}
              />
              <Toggle
                label="Hough Lines"
                sublabel="Finds lines even when edges are broken by fingers"
                checked={enableHoughLines}
                onChange={(v) => updateField('enableHoughLines', v)}
              />
            </div>
          </Section>

          {/* Edge detection sliders */}
          <Section title="Canny Edge Detection">
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                '@media (min-width: 480px)': { gap: 3 },
              })}
            >
              <Slider
                label="Low Threshold"
                sublabel="Min gradient to start edge. Lower = more sensitive"
                value={cannyThresholds[0]}
                min={10}
                max={150}
                step={5}
                onChange={(v) => updateField('cannyThresholds', [v, cannyThresholds[1]])}
              />
              <Slider
                label="High Threshold"
                sublabel="Min gradient to confirm edge. Higher = stronger edges only"
                value={cannyThresholds[1]}
                min={50}
                max={300}
                step={10}
                onChange={(v) => updateField('cannyThresholds', [cannyThresholds[0], v])}
              />
            </div>
          </Section>

          {/* Adaptive settings */}
          <Section title="Adaptive Threshold">
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                '@media (min-width: 480px)': { gap: 3 },
              })}
            >
              <Slider
                label="Block Size"
                sublabel="Neighborhood size. Larger = smoother, may miss details"
                value={adaptiveBlockSize}
                min={3}
                max={31}
                step={2}
                onChange={(v) => updateField('adaptiveBlockSize', v)}
              />
              <Slider
                label="Constant C"
                sublabel="Subtracted from mean. Higher = darker pixels needed"
                value={adaptiveC}
                min={-10}
                max={20}
                step={1}
                onChange={(v) => updateField('adaptiveC', v)}
              />
            </div>
          </Section>
        </div>
      </div>

      {/* Edge hint when closed */}
      {!isOpen && (
        <div
          data-element="drawer-hint"
          onClick={onOpen}
          className={css({
            position: 'absolute',
            top: '50%',
            left: 0,
            transform: 'translateY(-50%)',
            width: '4px',
            height: '48px',
            bg: 'rgba(255, 255, 255, 0.25)',
            borderRadius: '0 4px 4px 0',
            cursor: 'pointer',
            transition: 'all 0.2s',
            zIndex: 20,
            _hover: {
              width: '6px',
              height: '64px',
              bg: 'rgba(255, 255, 255, 0.4)',
            },
          })}
        />
      )}
    </>
  )
}

// Helper components - ultra compact

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className={css({
          color: 'gray.500',
          fontSize: '9px',
          fontWeight: 'medium',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          mb: 1,
          '@media (min-width: 480px)': {
            fontSize: '10px',
            mb: 1.5,
          },
        })}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={css({
        px: 1.5,
        py: 1,
        fontSize: '10px',
        fontWeight: 'medium',
        borderRadius: 'sm',
        border: '1px solid',
        cursor: 'pointer',
        transition: 'all 0.15s',
        bg: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        color: 'gray.300',
        '@media (min-width: 480px)': {
          px: 2,
          py: 1.5,
          fontSize: '11px',
        },
        _hover: {
          bg: 'rgba(255, 255, 255, 0.12)',
          borderColor: 'rgba(255, 255, 255, 0.25)',
        },
        _active: {
          bg: 'rgba(255, 255, 255, 0.15)',
        },
      })}
    >
      {label}
    </button>
  )
}

function Toggle({
  label,
  sublabel,
  checked,
  onChange,
}: {
  label: string
  sublabel?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        '@media (min-width: 480px)': {
          gap: 2,
        },
      })}
    >
      <div
        className={css({
          position: 'relative',
          width: '28px',
          height: '16px',
          flexShrink: 0,
          bg: checked ? 'green.600' : 'rgba(255, 255, 255, 0.15)',
          borderRadius: 'full',
          transition: 'background-color 0.2s',
          '@media (min-width: 480px)': {
            width: '32px',
            height: '18px',
          },
        })}
      >
        <div
          className={css({
            position: 'absolute',
            top: '2px',
            left: checked ? '14px' : '2px',
            width: '12px',
            height: '12px',
            bg: 'white',
            borderRadius: 'full',
            transition: 'left 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            '@media (min-width: 480px)': {
              left: checked ? '16px' : '2px',
              width: '14px',
              height: '14px',
            },
          })}
        />
      </div>
      <div className={css({ flex: 1, minWidth: 0 })}>
        <div
          className={css({
            color: 'white',
            fontSize: '10px',
            '@media (min-width: 480px)': {
              fontSize: '11px',
            },
          })}
        >
          {label}
        </div>
        {sublabel && (
          <div
            className={css({
              color: 'gray.500',
              fontSize: '9px',
              lineHeight: '1.3',
              mt: '1px',
              // Hide on very small screens, show on tablets+
              display: 'none',
              '@media (min-width: 480px)': {
                display: 'block',
                fontSize: '10px',
              },
            })}
          >
            {sublabel}
          </div>
        )}
      </div>
    </div>
  )
}

function Slider({
  label,
  sublabel,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  sublabel?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 0.5,
          '@media (min-width: 480px)': {
            mb: sublabel ? 0.5 : 1,
          },
        })}
      >
        <span
          className={css({
            color: 'gray.300',
            fontSize: '10px',
            '@media (min-width: 480px)': { fontSize: '11px' },
          })}
        >
          {label}
        </span>
        <span
          className={css({
            color: 'white',
            fontSize: '10px',
            fontFamily: 'mono',
            '@media (min-width: 480px)': { fontSize: '11px' },
          })}
        >
          {value}
        </span>
      </div>
      {sublabel && (
        <div
          className={css({
            color: 'gray.500',
            fontSize: '9px',
            mb: 1,
            lineHeight: '1.3',
            // Hide on small screens
            display: 'none',
            '@media (min-width: 480px)': {
              display: 'block',
              fontSize: '10px',
            },
          })}
        >
          {sublabel}
        </div>
      )}
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className={css({
          width: '100%',
          height: '4px',
          bg: 'rgba(255, 255, 255, 0.15)',
          borderRadius: 'full',
          appearance: 'none',
          cursor: 'pointer',
          '&::-webkit-slider-thumb': {
            appearance: 'none',
            width: '14px',
            height: '14px',
            bg: 'white',
            borderRadius: 'full',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          },
          '&::-moz-range-thumb': {
            width: '14px',
            height: '14px',
            bg: 'white',
            borderRadius: 'full',
            cursor: 'pointer',
            border: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          },
        })}
      />
    </div>
  )
}

export default ScannerControlsDrawer

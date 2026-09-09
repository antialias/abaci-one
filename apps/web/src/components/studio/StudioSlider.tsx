'use client'

// StudioSlider — the studio's numeric slider (Gitea #43). Same shape and props
// as the toy debug panel's `DebugSlider`, which the design and fabrication rails
// borrowed wholesale; the borrowing is why a printing studio wore the debug
// panel's indigo. This is the studio's own copy, styled from theme.ts: one cyan
// accent, a 4 px track, and a 16 px thumb that is a plain accent disc inside an
// accent halo rather than a white-ringed dot.
//
// The header row is the reason a slider needs a component at all: the LABEL and
// the VALUE sit on one line above the track, label muted and value primary, so a
// column of sliders reads as a table of settings you can scan without touching
// anything.

import * as Slider from '@radix-ui/react-slider'
import { STUDIO } from './theme'

export interface StudioSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** Custom value formatter for display (e.g. toFixed(3) for floats) */
  formatValue?: (value: number) => string
  dataElement?: string
  dataAction?: string
  disabled?: boolean
}

export function StudioSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  dataElement = 'debug-slider',
  dataAction,
  disabled = false,
}: StudioSliderProps) {
  return (
    <div
      data-component="studio-slider"
      data-element={dataElement}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: STUDIO.space.field,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={STUDIO.type.label}>{label}</span>
        <span style={STUDIO.type.value}>{formatValue ? formatValue(value) : value}</span>
      </div>
      <Slider.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        data-action={dataAction}
        onValueChange={([v]) => onChange(v)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: 16,
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <Slider.Track
          style={{
            position: 'relative',
            flexGrow: 1,
            height: 4,
            borderRadius: 2,
            background: STUDIO.color.track,
          }}
        >
          <Slider.Range
            style={{
              position: 'absolute',
              height: '100%',
              borderRadius: 2,
              background: STUDIO.color.accent,
            }}
          />
        </Slider.Track>
        <Slider.Thumb
          aria-label={label}
          style={{
            display: 'block',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: STUDIO.color.accent,
            border: 'none',
            boxShadow: `${STUDIO.shadow.thumb}, 0 0 0 4px ${STUDIO.color.accentRing}`,
            cursor: disabled ? 'default' : 'grab',
          }}
        />
      </Slider.Root>
    </div>
  )
}

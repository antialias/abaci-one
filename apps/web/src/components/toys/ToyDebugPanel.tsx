'use client'

import type { ReactNode } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'

interface DebugSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  /** Custom value formatter for display (e.g. toFixed(3) for floats) */
  formatValue?: (value: number) => string
}

export function DebugSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: DebugSliderProps) {
  return (
    <div data-element="debug-slider" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 500 }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <Slider.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
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
            height: 3,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.2)',
          }}
        >
          <Slider.Range
            style={{
              position: 'absolute',
              height: '100%',
              borderRadius: 2,
              background: 'rgba(129,140,248,0.8)',
            }}
          />
        </Slider.Track>
        <Slider.Thumb
          style={{
            display: 'block',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#818cf8',
            border: '2px solid rgba(255,255,255,0.6)',
            cursor: 'grab',
          }}
        />
      </Slider.Root>
    </div>
  )
}

interface DebugCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function DebugCheckbox({ label, checked, onChange }: DebugCheckboxProps) {
  return (
    <label
      data-element="debug-checkbox"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          accentColor: '#818cf8',
          width: 14,
          height: 14,
          cursor: 'pointer',
        }}
      />
      {label}
    </label>
  )
}

interface ToyDebugPanelProps {
  title: string
  children: ReactNode
}

export function ToyDebugPanel({ title, children }: ToyDebugPanelProps) {
  const { isVisualDebugEnabled } = useVisualDebugSafe()

  if (!isVisualDebugEnabled) return null

  return (
    <div
      data-component="toy-debug-panel"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: 'rgba(17,24,39,0.9)',
        backdropFilter: 'blur(8px)',
        borderRadius: 8,
        padding: '12px 16px',
        color: 'rgba(243,244,246,1)',
        fontSize: 12,
        minWidth: 200,
        maxWidth: 280,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
      }}
    >
      <div
        data-element="debug-panel-title"
        style={{
          fontWeight: 700,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          opacity: 0.6,
        }}
      >
        {title} Debug
      </div>
      {children}
    </div>
  )
}

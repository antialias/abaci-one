import type { ReactNode } from 'react'

/**
 * Generic option type for thermometer components
 */
export interface ThermometerOption<T extends string> {
  value: T
  label: string
  shortLabel?: string
  emoji?: string
}

/**
 * Common props shared between single and range thermometers
 */
export interface ThermometerBaseProps {
  orientation?: 'horizontal' | 'vertical'
  isDark?: boolean
  label?: string
  description?: string
}

/**
 * Props for single-selection thermometer
 */
export interface SingleThermometerProps<T extends string> extends ThermometerBaseProps {
  options: ThermometerOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Render custom content over an option (e.g., auto-resolve indicator) */
  renderOverlay?: (option: ThermometerOption<T>, index: number, isSelected: boolean) => ReactNode
}

/**
 * Preview state when hovering over a range thermometer option
 */
export interface RangePreviewState<T extends string> {
  /** The previewed min value (what would be selected if clicked) */
  previewMin: T
  /** The previewed max value (what would be selected if clicked) */
  previewMax: T
}

/**
 * Props for range (dual-handle) thermometer
 */
export interface RangeThermometerProps<T extends string> extends ThermometerBaseProps {
  options: ThermometerOption<T>[]
  minValue: T
  maxValue: T
  onChange: (min: T, max: T) => void
  /** Optional counts to show per option */
  counts?: Partial<Record<T, number>>
  /** Show total count of selected range */
  showTotalCount?: boolean
  /** Called when hovering over an option to preview what would be selected */
  onHoverPreview?: (preview: RangePreviewState<T> | null) => void
  /** Region names per category for tooltip display (power user feature) */
  regionNamesByCategory?: Partial<Record<T, string[]>>
  /** All selected region names for the total count popover */
  selectedRegionNames?: string[]
  /** Callback when hovering over a region name in the popover (for map preview) */
  onRegionNameHover?: (regionName: string | null) => void
  /** Hide the total count on md+ breakpoints (use when inline list is shown on desktop) */
  hideCountOnMd?: boolean
}

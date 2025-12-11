'use client'

import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from 'react'
import { useMyAbacus, type DockConfig } from '@/contexts/MyAbacusContext'

export interface AbacusDockProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Optional identifier for debugging */
  id?: string
  /** Number of columns to display (default: 5) */
  columns?: number
  /** Whether the abacus is interactive (default: true) */
  interactive?: boolean
  /** Whether to show numbers below columns (default: true) */
  showNumbers?: boolean
  /** Whether to animate bead movements (default: true) */
  animated?: boolean
  /** Scale factor for the abacus (default: auto-fit to container) */
  scaleFactor?: number
  /** Controlled value - when provided, dock controls the abacus value */
  value?: number
  /** Default value for uncontrolled mode */
  defaultValue?: number
  /** Callback when value changes (for controlled mode) */
  onValueChange?: (newValue: number) => void
}

/**
 * AbacusDock - A container that the global MyAbacus will render into
 *
 * Place this component anywhere you want the abacus to appear docked.
 * When mounted, the global abacus will portal into this container instead
 * of showing as a floating button.
 *
 * @example
 * ```tsx
 * // Basic usage - abacus will auto-fit to the container
 * <AbacusDock className={css({ width: '300px', height: '400px' })} />
 *
 * // With custom configuration
 * <AbacusDock
 *   columns={4}
 *   interactive={true}
 *   showNumbers={true}
 *   className={css({ width: '250px', height: '350px' })}
 * />
 * ```
 */
export function AbacusDock({
  id,
  columns = 5,
  interactive = true,
  showNumbers = true,
  animated = true,
  scaleFactor,
  value,
  defaultValue,
  onValueChange,
  style,
  ...divProps
}: AbacusDockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { registerDock, unregisterDock, updateDockVisibility } = useMyAbacus()

  // Register the dock
  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const config: DockConfig = {
      element,
      id,
      columns,
      interactive,
      showNumbers,
      animated,
      scaleFactor,
      value,
      defaultValue,
      onValueChange,
      isVisible: false, // Will be updated by IntersectionObserver
    }

    registerDock(config)

    return () => {
      unregisterDock(element)
    }
  }, [
    id,
    columns,
    interactive,
    showNumbers,
    animated,
    scaleFactor,
    value,
    defaultValue,
    onValueChange,
    registerDock,
    unregisterDock,
  ])

  // Track visibility with IntersectionObserver
  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Consider visible if at least 20% is in view
          updateDockVisibility(element, entry.isIntersecting && entry.intersectionRatio >= 0.2)
        }
      },
      {
        threshold: [0, 0.2, 0.5, 1.0],
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [updateDockVisibility])

  // Default styles for the dock container
  const defaultStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style,
  }

  return (
    <div
      ref={containerRef}
      data-component="abacus-dock"
      data-dock-id={id}
      style={defaultStyle}
      {...divProps}
    />
  )
}

export default AbacusDock

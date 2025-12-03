/**
 * CompassCrosshair Component
 *
 * A compass-style crosshair SVG with rotating outer ring and fixed north indicator.
 * Used in both the custom cursor and heat crosshair overlay.
 *
 * Features:
 * - Outer ring with 12 tick marks (cardinal directions emphasized)
 * - Center dot
 * - North indicator (red triangle) that stays fixed while ring rotates
 * - Configurable size and heat-based styling
 */

'use client'

import { animated, type SpringValue } from '@react-spring/web'
import { memo } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface CrosshairStyle {
  color: string
  strokeWidth: number
  opacity: number
}

export interface CompassCrosshairProps {
  /** Size of the crosshair (width and height in pixels) */
  size: number
  /** Heat-based styling (color, strokeWidth, opacity) */
  style: CrosshairStyle
  /** Spring value for rotation angle in degrees */
  rotationAngle: SpringValue<number>
  /** Optional drop shadow filter */
  dropShadow?: string
}

// ============================================================================
// Constants
// ============================================================================

const TICK_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a compass-style crosshair that rotates based on heat feedback.
 *
 * The crosshair has:
 * - An outer ring that rotates with the animation
 * - 12 tick marks (cardinal directions are longer and white)
 * - A center dot
 * - A north indicator (red triangle) that counter-rotates to stay fixed
 */
export const CompassCrosshair = memo(function CompassCrosshair({
  size,
  style,
  rotationAngle,
  dropShadow = 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
}: CompassCrosshairProps) {
  // Calculate dimensions based on size
  const center = size / 2
  const outerR = size * 0.4 // Outer ring radius (40% of size)
  const cardinalInnerR = size * 0.28 // Cardinal tick inner radius
  const normalInnerR = size * 0.34 // Normal tick inner radius

  // North triangle points (relative to center)
  const triangleTop = center - outerR - 2
  const triangleBase = center - outerR + 3
  const triangleHalfWidth = size * 0.08

  return (
    <animated.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        filter: dropShadow,
        transform: rotationAngle.to((a) => `rotate(${a}deg)`),
      }}
    >
      {/* Outer ring */}
      <circle
        cx={center}
        cy={center}
        r={outerR}
        fill="none"
        stroke={style.color}
        strokeWidth={style.strokeWidth}
        opacity={style.opacity}
      />

      {/* Compass tick marks - 12 ticks around the ring */}
      {TICK_ANGLES.map((angle) => {
        const isCardinal = angle % 90 === 0
        const rad = (angle * Math.PI) / 180
        const innerR = isCardinal ? cardinalInnerR : normalInnerR

        return (
          <line
            key={angle}
            x1={center + innerR * Math.sin(rad)}
            y1={center - innerR * Math.cos(rad)}
            x2={center + outerR * Math.sin(rad)}
            y2={center - outerR * Math.cos(rad)}
            stroke={isCardinal ? 'white' : style.color}
            strokeWidth={isCardinal ? size * 0.06 : 1}
            strokeLinecap="round"
            opacity={style.opacity}
          />
        )
      })}

      {/* Center dot */}
      <circle cx={center} cy={center} r={size * 0.05} fill={style.color} opacity={style.opacity} />

      {/* Counter-rotating group to keep N fixed pointing up */}
      <animated.g
        style={{
          transformOrigin: `${center}px ${center}px`,
          transform: rotationAngle.to((a) => `rotate(${-a}deg)`),
        }}
      >
        {/* North indicator - red triangle pointing up */}
        <polygon
          points={`${center},${triangleTop} ${center - triangleHalfWidth},${triangleBase} ${center + triangleHalfWidth},${triangleBase}`}
          fill="#ef4444"
          opacity={0.9}
        />
      </animated.g>
    </animated.svg>
  )
})

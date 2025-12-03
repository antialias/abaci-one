/**
 * MagnifierCrosshair Component
 *
 * Renders a compass-style crosshair in the magnifier view.
 * Features:
 * - Animated rotation with spring physics
 * - Cardinal direction tick marks
 * - North indicator (red triangle)
 * - Heat-based coloring for hot/cold feedback
 */

import { animated, type SpringValue } from '@react-spring/web'

import type { CrosshairStyle } from './types'

export interface MagnifierCrosshairProps {
  /** Cursor X position in SVG coordinates */
  cursorSvgX: number
  /** Cursor Y position in SVG coordinates */
  cursorSvgY: number
  /** ViewBox width for calculating crosshair size */
  viewBoxWidth: number
  /** Spring value for rotation animation */
  rotationAngle: SpringValue<number>
  /** Heat-based crosshair style */
  heatStyle: CrosshairStyle
}

export function MagnifierCrosshair({
  cursorSvgX,
  cursorSvgY,
  viewBoxWidth,
  rotationAngle,
  heatStyle,
}: MagnifierCrosshairProps) {
  const crosshairRadius = viewBoxWidth / 100
  const crosshairLineLength = viewBoxWidth / 50

  const tickInnerR = crosshairRadius * 0.7
  const tickOuterR = crosshairRadius
  const northIndicatorSize = crosshairRadius * 0.35

  return (
    <g data-element="magnifier-crosshair">
      {/* Compass-style crosshair with separate translation and rotation */}
      {/* Outer <g> handles translation (follows cursor) */}
      {/* Inner animated.g handles rotation via spring-driven animation */}
      <g transform={`translate(${cursorSvgX}, ${cursorSvgY})`}>
        <animated.g
          style={{
            transform: rotationAngle.to((a) => `rotate(${a}deg)`),
            transformOrigin: '0 0',
          }}
        >
          {/* Main crosshair circle - drawn at origin */}
          <circle
            cx={0}
            cy={0}
            r={crosshairRadius}
            fill="none"
            stroke={heatStyle.color}
            strokeWidth={(viewBoxWidth / 500) * (heatStyle.strokeWidth / 2)}
            vectorEffect="non-scaling-stroke"
            opacity={heatStyle.opacity}
          />
          {/* Compass tick marks - 12 ticks around the ring */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
            const isCardinal = angle % 90 === 0
            const rad = (angle * Math.PI) / 180
            // Cardinals extend much further inward for prominence
            const innerR = isCardinal ? tickInnerR * 0.5 : tickInnerR
            const outerR = isCardinal ? tickOuterR * 1.15 : tickOuterR
            return (
              <g key={angle}>
                {/* Dark shadow for cardinal ticks */}
                {isCardinal && (
                  <line
                    x1={innerR * Math.sin(rad)}
                    y1={-innerR * Math.cos(rad)}
                    x2={outerR * Math.sin(rad)}
                    y2={-outerR * Math.cos(rad)}
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth={(viewBoxWidth / 800) * 4}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                  />
                )}
                {/* Main tick */}
                <line
                  x1={innerR * Math.sin(rad)}
                  y1={-innerR * Math.cos(rad)}
                  x2={outerR * Math.sin(rad)}
                  y2={-outerR * Math.cos(rad)}
                  stroke={isCardinal ? 'white' : heatStyle.color}
                  strokeWidth={
                    isCardinal
                      ? (viewBoxWidth / 800) * 2.5
                      : (viewBoxWidth / 1000) * (heatStyle.strokeWidth / 2)
                  }
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  opacity={heatStyle.opacity}
                />
              </g>
            )
          })}
          {/* Horizontal crosshair line - precise targeting */}
          <line
            x1={-crosshairLineLength}
            y1={0}
            x2={crosshairLineLength}
            y2={0}
            stroke={heatStyle.color}
            strokeWidth={(viewBoxWidth / 1000) * (heatStyle.strokeWidth / 2)}
            vectorEffect="non-scaling-stroke"
            opacity={heatStyle.opacity}
          />
          {/* Vertical crosshair line - precise targeting */}
          <line
            x1={0}
            y1={-crosshairLineLength}
            x2={0}
            y2={crosshairLineLength}
            stroke={heatStyle.color}
            strokeWidth={(viewBoxWidth / 1000) * (heatStyle.strokeWidth / 2)}
            vectorEffect="non-scaling-stroke"
            opacity={heatStyle.opacity}
          />
          {/* Counter-rotating group to keep N fixed pointing up */}
          <animated.g
            style={{
              transform: rotationAngle.to((a) => `rotate(${-a}deg)`),
              transformOrigin: '0 0',
            }}
          >
            {/* North indicator - red triangle pointing up */}
            <polygon
              points={`0,${-crosshairRadius - northIndicatorSize * 0.5} ${-northIndicatorSize * 0.5},${-crosshairRadius + northIndicatorSize * 0.5} ${northIndicatorSize * 0.5},${-crosshairRadius + northIndicatorSize * 0.5}`}
              fill="#ef4444"
              opacity={0.9}
            />
          </animated.g>
        </animated.g>
      </g>
    </g>
  )
}

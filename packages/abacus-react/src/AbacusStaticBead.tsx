/**
 * StaticBead - Pure SVG bead with no animations or interactions
 * Used by AbacusStatic for server-side rendering
 */

import type { BeadConfig, BeadStyle } from './AbacusReact'

export interface StaticBeadProps {
  bead: BeadConfig
  x: number
  y: number
  size: number
  shape: 'diamond' | 'square' | 'circle'
  color: string
  customStyle?: BeadStyle
  hideInactiveBeads?: boolean
}

export function AbacusStaticBead({
  bead,
  x,
  y,
  size,
  shape,
  color,
  customStyle,
  hideInactiveBeads = false,
}: StaticBeadProps) {
  // Don't render inactive beads if hideInactiveBeads is true
  if (!bead.active && hideInactiveBeads) {
    return null
  }

  const halfSize = size / 2
  const opacity = bead.active ? (customStyle?.opacity ?? 1) : 0.3
  const fill = customStyle?.fill || color
  const stroke = customStyle?.stroke || '#000'
  const strokeWidth = customStyle?.strokeWidth || 0.5

  // Calculate offset based on shape (matching AbacusReact positioning)
  const getXOffset = () => {
    return shape === 'diamond' ? size * 0.7 : halfSize
  }

  const getYOffset = () => {
    return halfSize
  }

  const transform = `translate(${x - getXOffset()}, ${y - getYOffset()})`

  const renderShape = () => {
    switch (shape) {
      case 'diamond':
        return (
          <polygon
            points={`${size * 0.7},0 ${size * 1.4},${halfSize} ${size * 0.7},${size} 0,${halfSize}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        )
      case 'square':
        return (
          <rect
            width={size}
            height={size}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            rx="1"
            opacity={opacity}
          />
        )
      case 'circle':
      default:
        return (
          <circle
            cx={halfSize}
            cy={halfSize}
            r={halfSize}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        )
    }
  }

  return (
    <g
      className={`abacus-bead ${bead.active ? 'active' : 'inactive'} ${hideInactiveBeads && !bead.active ? 'hidden-inactive' : ''}`}
      transform={transform}
      style={{ transition: 'opacity 0.2s ease-in-out' }}
    >
      {renderShape()}
    </g>
  )
}

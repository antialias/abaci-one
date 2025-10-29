import type { Color, PieceType } from '../types'

interface PieceRendererProps {
  type: PieceType
  color: Color
  value: number | string
  size?: number
}

/**
 * SVG-based piece renderer with precise color control.
 * BLACK pieces: dark fill, point RIGHT (towards white)
 * WHITE pieces: light fill, point LEFT (towards black)
 */
export function PieceRenderer({ type, color, value, size = 48 }: PieceRendererProps) {
  const isDark = color === 'B'
  const fillColor = isDark ? '#1a1a1a' : '#e8e8e8'
  const strokeColor = isDark ? '#000000' : '#333333'
  const textColor = isDark ? '#ffffff' : '#000000'

  // Calculate responsive font size based on value length
  const valueStr = value.toString()
  const baseSize = type === 'P' ? size * 0.18 : size * 0.28
  let fontSize = baseSize
  if (valueStr.length >= 3) {
    fontSize = baseSize * 0.7 // 3+ digits: smaller
  } else if (valueStr.length === 2) {
    fontSize = baseSize * 0.85 // 2 digits: slightly smaller
  }

  const renderShape = () => {
    switch (type) {
      case 'C': // Circle
        return (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.38}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={2}
          />
        )

      case 'T': // Triangle - BLACK points RIGHT, WHITE points LEFT
        if (isDark) {
          // Black triangle points RIGHT (towards white)
          return (
            <polygon
              points={`${size * 0.15},${size * 0.15} ${size * 0.85},${size / 2} ${size * 0.15},${size * 0.85}`}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
            />
          )
        } else {
          // White triangle points LEFT (towards black)
          return (
            <polygon
              points={`${size * 0.85},${size * 0.15} ${size * 0.15},${size / 2} ${size * 0.85},${size * 0.85}`}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={2}
            />
          )
        }

      case 'S': // Square
        return (
          <rect
            x={size * 0.15}
            y={size * 0.15}
            width={size * 0.7}
            height={size * 0.7}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={2}
          />
        )

      case 'P': {
        // Pyramid - rotated 90° to point at opponent
        // Create centered pyramid, then rotate: BLACK→right (90°), WHITE→left (-90°)
        const rotation = isDark ? 90 : -90
        return (
          <g transform={`rotate(${rotation}, ${size / 2}, ${size / 2})`}>
            {/* Top/smallest bar - centered */}
            <rect
              x={size * 0.35}
              y={size * 0.1}
              width={size * 0.3}
              height={size * 0.15}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={1.5}
            />
            {/* Second bar */}
            <rect
              x={size * 0.25}
              y={size * 0.3}
              width={size * 0.5}
              height={size * 0.15}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={1.5}
            />
            {/* Third bar */}
            <rect
              x={size * 0.15}
              y={size * 0.5}
              width={size * 0.7}
              height={size * 0.15}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={1.5}
            />
            {/* Bottom/largest bar */}
            <rect
              x={size * 0.05}
              y={size * 0.7}
              width={size * 0.9}
              height={size * 0.15}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>
        )
      }

      default:
        return null
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {renderShape()}
      {/* Pyramids don't show numbers */}
      {type !== 'P' && (
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={textColor}
          fontSize={fontSize}
          fontWeight="bold"
          fontFamily="system-ui, -apple-system, sans-serif"
          // Only add white outline for white pieces (to separate from dark borders)
          {...(!isDark && {
            stroke: '#ffffff',
            strokeWidth: fontSize * 0.15,
            paintOrder: 'stroke fill',
          })}
        >
          {value}
        </text>
      )}
    </svg>
  )
}

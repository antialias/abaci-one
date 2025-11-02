import { AbacusReact, useAbacusDisplay } from '@soroban/abacus-react'
import type { Color, PieceType } from '../types'

interface PieceRendererProps {
  type: PieceType
  color: Color
  value: number | string
  size?: number
  useNativeAbacusNumbers?: boolean
  selected?: boolean
  pyramidFaces?: number[]
}

/**
 * SVG-based piece renderer with enhanced visual treatment.
 * BLACK pieces: dark gradient fill with light border, point RIGHT (towards white)
 * WHITE pieces: light gradient fill with dark border, point LEFT (towards black)
 */
export function PieceRenderer({
  type,
  color,
  value,
  size = 48,
  useNativeAbacusNumbers = false,
  selected = false,
  pyramidFaces = [],
}: PieceRendererProps) {
  const isDark = color === 'B'
  const { config } = useAbacusDisplay()

  // Gradient IDs
  const gradientId = `gradient-${type}-${color}-${size}`
  const shadowId = `shadow-${type}-${color}-${size}`

  // Enhanced colors with gradients
  const gradientStart = isDark ? '#2d2d2d' : '#ffffff'
  const gradientEnd = isDark ? '#0a0a0a' : '#d0d0d0'
  const strokeColor = isDark ? '#ffffff' : '#1a1a1a'
  const textColor = isDark ? '#ffffff' : '#000000'

  // Calculate responsive font size based on value length
  const valueStr = value.toString()
  const baseSize = type === 'P' ? size * 0.18 : size * 0.35
  let fontSize = baseSize
  if (valueStr.length >= 3) {
    fontSize = baseSize * 0.65 // 3+ digits: smaller
  } else if (valueStr.length === 2) {
    fontSize = baseSize * 0.8 // 2 digits: slightly smaller
  }

  const renderShape = () => {
    switch (type) {
      case 'C': // Circle
        return (
          <g>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.38}
              fill={`url(#${gradientId})`}
              filter={`url(#${shadowId})`}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.38}
              fill="none"
              stroke={strokeColor}
              strokeWidth={3}
              opacity={0.9}
            />
          </g>
        )

      case 'T': // Triangle - BLACK points RIGHT, WHITE points LEFT
        if (isDark) {
          // Black triangle points RIGHT (towards white)
          return (
            <g>
              <polygon
                points={`${size * 0.15},${size * 0.15} ${size * 0.85},${size / 2} ${size * 0.15},${size * 0.85}`}
                fill={`url(#${gradientId})`}
                filter={`url(#${shadowId})`}
              />
              <polygon
                points={`${size * 0.15},${size * 0.15} ${size * 0.85},${size / 2} ${size * 0.15},${size * 0.85}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={3}
                opacity={0.9}
              />
            </g>
          )
        } else {
          // White triangle points LEFT (towards black)
          return (
            <g>
              <polygon
                points={`${size * 0.85},${size * 0.15} ${size * 0.15},${size / 2} ${size * 0.85},${size * 0.85}`}
                fill={`url(#${gradientId})`}
                filter={`url(#${shadowId})`}
              />
              <polygon
                points={`${size * 0.85},${size * 0.15} ${size * 0.15},${size / 2} ${size * 0.85},${size * 0.85}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={3}
                opacity={0.9}
              />
            </g>
          )
        }

      case 'S': // Square
        return (
          <g>
            <rect
              x={size * 0.15}
              y={size * 0.15}
              width={size * 0.7}
              height={size * 0.7}
              fill={`url(#${gradientId})`}
              filter={`url(#${shadowId})`}
            />
            <rect
              x={size * 0.15}
              y={size * 0.15}
              width={size * 0.7}
              height={size * 0.7}
              fill="none"
              stroke={strokeColor}
              strokeWidth={3}
              opacity={0.9}
            />
          </g>
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
              fill={`url(#${gradientId})`}
              stroke={strokeColor}
              strokeWidth={2}
              opacity={0.9}
              filter={`url(#${shadowId})`}
            />
            {/* Second bar */}
            <rect
              x={size * 0.25}
              y={size * 0.3}
              width={size * 0.5}
              height={size * 0.15}
              fill={`url(#${gradientId})`}
              stroke={strokeColor}
              strokeWidth={2}
              opacity={0.9}
              filter={`url(#${shadowId})`}
            />
            {/* Third bar */}
            <rect
              x={size * 0.15}
              y={size * 0.5}
              width={size * 0.7}
              height={size * 0.15}
              fill={`url(#${gradientId})`}
              stroke={strokeColor}
              strokeWidth={2}
              opacity={0.9}
              filter={`url(#${shadowId})`}
            />
            {/* Bottom/largest bar */}
            <rect
              x={size * 0.05}
              y={size * 0.7}
              width={size * 0.9}
              height={size * 0.15}
              fill={`url(#${gradientId})`}
              stroke={strokeColor}
              strokeWidth={2}
              opacity={0.9}
              filter={`url(#${shadowId})`}
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
      <defs>
        {/* Gradient definition */}
        {type === 'C' ? (
          <radialGradient id={gradientId}>
            <stop offset="0%" stopColor={gradientStart} />
            <stop offset="100%" stopColor={gradientEnd} />
          </radialGradient>
        ) : (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={gradientStart} />
            <stop offset="100%" stopColor={gradientEnd} />
          </linearGradient>
        )}

        {/* Shadow filter */}
        <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
        </filter>

        {/* Text shadow for dark pieces */}
        {isDark && (
          <filter id={`text-shadow-${color}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.6" />
          </filter>
        )}
      </defs>

      {renderShape()}

      {/* Pyramid face numbers - show when selected */}
      {type === 'P' && selected && pyramidFaces.length === 4 && (
        <g>
          {/* Filter for strong drop shadow */}
          <defs>
            <filter id={`face-shadow-${color}`} x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3"
                floodColor="#000000"
                floodOpacity="0.9"
              />
            </filter>
          </defs>

          {/* Top face */}
          {/* Outline/stroke for contrast */}
          <text
            x={size / 2}
            y={size * 0.12}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="none"
            stroke={isDark ? '#000000' : '#ffffff'}
            strokeWidth={size * 0.03}
            fontSize={size * 0.26}
            fontWeight="900"
            fontFamily="Arial, sans-serif"
          >
            {pyramidFaces[0]}
          </text>
          {/* Main text with shadow and vibrant color */}
          <text
            x={size / 2}
            y={size * 0.12}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={isDark ? '#fbbf24' : '#b45309'}
            fontSize={size * 0.26}
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            filter={`url(#face-shadow-${color})`}
            style={{ transition: 'all 0.2s ease' }}
          >
            {pyramidFaces[0]}
          </text>

          {/* Right face */}
          <text
            x={size * 0.88}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="none"
            stroke={isDark ? '#000000' : '#ffffff'}
            strokeWidth={size * 0.03}
            fontSize={size * 0.26}
            fontWeight="900"
            fontFamily="Arial, sans-serif"
          >
            {pyramidFaces[1]}
          </text>
          <text
            x={size * 0.88}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={isDark ? '#fbbf24' : '#b45309'}
            fontSize={size * 0.26}
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            filter={`url(#face-shadow-${color})`}
            style={{ transition: 'all 0.2s ease' }}
          >
            {pyramidFaces[1]}
          </text>

          {/* Bottom face */}
          <text
            x={size / 2}
            y={size * 0.88}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="none"
            stroke={isDark ? '#000000' : '#ffffff'}
            strokeWidth={size * 0.03}
            fontSize={size * 0.26}
            fontWeight="900"
            fontFamily="Arial, sans-serif"
          >
            {pyramidFaces[2]}
          </text>
          <text
            x={size / 2}
            y={size * 0.88}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={isDark ? '#fbbf24' : '#b45309'}
            fontSize={size * 0.26}
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            filter={`url(#face-shadow-${color})`}
            style={{ transition: 'all 0.2s ease' }}
          >
            {pyramidFaces[2]}
          </text>

          {/* Left face */}
          <text
            x={size * 0.12}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="none"
            stroke={isDark ? '#000000' : '#ffffff'}
            strokeWidth={size * 0.03}
            fontSize={size * 0.26}
            fontWeight="900"
            fontFamily="Arial, sans-serif"
          >
            {pyramidFaces[3]}
          </text>
          <text
            x={size * 0.12}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={isDark ? '#fbbf24' : '#b45309'}
            fontSize={size * 0.26}
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            filter={`url(#face-shadow-${color})`}
            style={{ transition: 'all 0.2s ease' }}
          >
            {pyramidFaces[3]}
          </text>
        </g>
      )}

      {/* Other pieces show numbers normally */}
      {type !== 'P' &&
        (useNativeAbacusNumbers && typeof value === 'number' ? (
          // Render mini abacus
          <foreignObject
            x={size * 0.1}
            y={size * 0.1}
            width={size * 0.8}
            height={size * 0.8}
            style={{ overflow: 'visible' }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AbacusReact
                value={value}
                columns={Math.max(1, Math.ceil(Math.log10(value + 1)))}
                scaleFactor={0.35}
                showNumbers={false}
                beadShape={config.beadShape}
                colorScheme={config.colorScheme}
                hideInactiveBeads={config.hideInactiveBeads}
                customStyles={{
                  columnPosts: {
                    fill: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
                    stroke: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                    strokeWidth: 1,
                  },
                  reckoningBar: {
                    fill: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)',
                    stroke: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
                    strokeWidth: 1,
                  },
                }}
              />
            </div>
          </foreignObject>
        ) : (
          // Render traditional text number
          <g>
            {/* Outer glow/shadow for emphasis */}
            {isDark ? (
              <text
                x={size / 2}
                y={size / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="none"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth={fontSize * 0.2}
                fontSize={fontSize}
                fontWeight="900"
                fontFamily="Georgia, 'Times New Roman', serif"
              >
                {value}
              </text>
            ) : (
              <text
                x={size / 2}
                y={size / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="none"
                stroke="rgba(255, 255, 255, 0.95)"
                strokeWidth={fontSize * 0.25}
                fontSize={fontSize}
                fontWeight="900"
                fontFamily="Georgia, 'Times New Roman', serif"
              >
                {value}
              </text>
            )}
            {/* Main text */}
            <text
              x={size / 2}
              y={size / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={textColor}
              fontSize={fontSize}
              fontWeight="900"
              fontFamily="Georgia, 'Times New Roman', serif"
              filter={isDark ? `url(#text-shadow-${color})` : undefined}
            >
              {value}
            </text>
          </g>
        ))}
    </svg>
  )
}

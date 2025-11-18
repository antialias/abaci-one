'use client'

import { useState, useMemo } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import type { MapData, MapRegion } from '../types'
import {
  getRegionColor,
  getRegionStroke,
  getRegionStrokeWidth,
  getLabelTextColor,
  getLabelTextShadow,
} from '../mapColors'

interface BoundingBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
  area: number
}

interface SmallRegionLabel {
  regionId: string
  regionName: string
  regionCenter: [number, number]
  labelPosition: [number, number]
  isFound: boolean
}

interface MapRendererProps {
  mapData: MapData
  regionsFound: string[]
  currentPrompt: string | null
  difficulty: 'easy' | 'hard'
  onRegionClick: (regionId: string, regionName: string) => void
}

/**
 * Calculate bounding box from SVG path string
 */
function calculateBoundingBox(pathString: string): BoundingBox {
  const numbers = pathString.match(/-?\d+\.?\d*/g)?.map(Number) || []

  if (numbers.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, area: 0 }
  }

  const xCoords: number[] = []
  const yCoords: number[] = []

  for (let i = 0; i < numbers.length; i += 2) {
    xCoords.push(numbers[i])
    if (i + 1 < numbers.length) {
      yCoords.push(numbers[i + 1])
    }
  }

  const minX = Math.min(...xCoords)
  const maxX = Math.max(...xCoords)
  const minY = Math.min(...yCoords)
  const maxY = Math.max(...yCoords)
  const width = maxX - minX
  const height = maxY - minY
  const area = width * height

  return { minX, maxX, minY, maxY, width, height, area }
}

/**
 * Determine if a region is too small to click easily
 */
function isSmallRegion(bbox: BoundingBox, viewBox: string): boolean {
  // Parse viewBox to get map dimensions
  const viewBoxParts = viewBox.split(' ').map(Number)
  const mapWidth = viewBoxParts[2] || 1000
  const mapHeight = viewBoxParts[3] || 1000

  // Thresholds (relative to map size)
  const minWidth = mapWidth * 0.025 // 2.5% of map width
  const minHeight = mapHeight * 0.025 // 2.5% of map height
  const minArea = mapWidth * mapHeight * 0.001 // 0.1% of total map area

  return bbox.width < minWidth || bbox.height < minHeight || bbox.area < minArea
}

export function MapRenderer({
  mapData,
  regionsFound,
  currentPrompt,
  difficulty,
  onRegionClick,
}: MapRendererProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)

  // Calculate small regions that need labels with arrows
  const smallRegionLabels = useMemo(() => {
    const labels: SmallRegionLabel[] = []
    const viewBoxParts = mapData.viewBox.split(' ').map(Number)
    const mapWidth = viewBoxParts[2] || 1000
    const mapHeight = viewBoxParts[3] || 1000

    mapData.regions.forEach((region) => {
      const bbox = calculateBoundingBox(region.path)
      if (isSmallRegion(bbox, mapData.viewBox)) {
        // Position label to the right and slightly down from region
        // This is a simple strategy - could be improved with collision detection
        const offsetX = mapWidth * 0.08
        const offsetY = mapHeight * 0.03

        labels.push({
          regionId: region.id,
          regionName: region.name,
          regionCenter: region.center,
          labelPosition: [region.center[0] + offsetX, region.center[1] + offsetY],
          isFound: regionsFound.includes(region.id),
        })
      }
    })

    return labels
  }, [mapData, regionsFound])

  const showOutline = (region: MapRegion): boolean => {
    // Easy mode: always show outlines
    if (difficulty === 'easy') return true

    // Hard mode: only show outline on hover or if found
    return hoveredRegion === region.id || regionsFound.includes(region.id)
  }

  return (
    <div
      data-component="map-renderer"
      className={css({
        width: '100%',
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '4',
        bg: isDark ? 'gray.900' : 'gray.50',
        rounded: 'xl',
        shadow: 'lg',
      })}
    >
      <svg
        viewBox={mapData.viewBox}
        className={css({
          width: '100%',
          height: 'auto',
          cursor: 'pointer',
        })}
      >
        {/* Background */}
        <rect x="0" y="0" width="100%" height="100%" fill={isDark ? '#111827' : '#f3f4f6'} />

        {/* Render all regions */}
        {mapData.regions.map((region) => (
          <g key={region.id}>
            {/* Region path */}
            <path
              d={region.path}
              fill={getRegionColor(
                region.id,
                regionsFound.includes(region.id),
                hoveredRegion === region.id,
                isDark
              )}
              stroke={getRegionStroke(regionsFound.includes(region.id), isDark)}
              strokeWidth={getRegionStrokeWidth(
                hoveredRegion === region.id,
                regionsFound.includes(region.id)
              )}
              opacity={showOutline(region) ? 1 : 0.3}
              onMouseEnter={() => setHoveredRegion(region.id)}
              onMouseLeave={() => setHoveredRegion(null)}
              onClick={() => onRegionClick(region.id, region.name)}
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            />

            {/* Region label (show if found) */}
            {regionsFound.includes(region.id) && (
              <text
                x={region.center[0]}
                y={region.center[1]}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={getLabelTextColor(isDark, true)}
                fontSize="10"
                fontWeight="bold"
                pointerEvents="none"
                style={{
                  textShadow: getLabelTextShadow(isDark, true),
                }}
              >
                {region.name}
              </text>
            )}
          </g>
        ))}

        {/* Small region labels with arrows */}
        {smallRegionLabels.map((label) => (
          <g key={`label-${label.regionId}`}>
            {/* Arrow line from label to region center */}
            <line
              x1={label.labelPosition[0] - 10}
              y1={label.labelPosition[1]}
              x2={label.regionCenter[0]}
              y2={label.regionCenter[1]}
              stroke={label.isFound ? '#16a34a' : isDark ? '#60a5fa' : '#3b82f6'}
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
              pointerEvents="none"
            />

            {/* Label background */}
            <rect
              x={label.labelPosition[0] - 5}
              y={label.labelPosition[1] - 12}
              width={label.regionName.length * 6 + 10}
              height={20}
              fill={
                label.isFound ? (isDark ? '#22c55e' : '#86efac') : isDark ? '#1f2937' : '#ffffff'
              }
              stroke={label.isFound ? '#16a34a' : isDark ? '#60a5fa' : '#3b82f6'}
              strokeWidth={2}
              rx={4}
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => onRegionClick(label.regionId, label.regionName)}
              onMouseEnter={() => setHoveredRegion(label.regionId)}
              onMouseLeave={() => setHoveredRegion(null)}
            />

            {/* Label text */}
            <text
              x={label.labelPosition[0]}
              y={label.labelPosition[1]}
              textAnchor="start"
              dominantBaseline="middle"
              fill={getLabelTextColor(isDark, label.isFound)}
              fontSize="11"
              fontWeight="600"
              style={{
                cursor: 'pointer',
                userSelect: 'none',
                textShadow: label.isFound
                  ? getLabelTextShadow(isDark, true)
                  : '0 0 2px rgba(0,0,0,0.5)',
              }}
              onClick={() => onRegionClick(label.regionId, label.regionName)}
              onMouseEnter={() => setHoveredRegion(label.regionId)}
              onMouseLeave={() => setHoveredRegion(null)}
            >
              {label.regionName}
            </text>
          </g>
        ))}

        {/* Arrow marker definition */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill={isDark ? '#60a5fa' : '#3b82f6'} />
          </marker>
        </defs>
      </svg>
    </div>
  )
}

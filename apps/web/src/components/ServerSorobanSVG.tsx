'use client'

import { useState, useEffect } from 'react'
import { css } from '../../styled-system/css'

interface ServerSorobanSVGProps {
  number: number
  colorScheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating'
  hideInactiveBeads?: boolean
  beadShape?: 'diamond' | 'circle' | 'square'
  width?: number
  height?: number
  className?: string
}

export function ServerSorobanSVG({
  number,
  colorScheme = 'place-value',
  hideInactiveBeads = false,
  beadShape = 'diamond',
  width = 240,
  height = 320,
  className = ''
}: ServerSorobanSVGProps) {
  const [svgContent, setSvgContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const generateSVG = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const config = {
          range: number.toString(),
          colorScheme,
          hideInactiveBeads,
          beadShape,
          format: 'svg'
        }

        const response = await fetch('/api/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        })

        if (response.ok) {
          const data = await response.json()
          // Find the SVG for our specific number
          const sample = data.samples?.find((s: any) => s.number === number)
          if (sample?.front) {
            setSvgContent(sample.front)
          } else {
            throw new Error('No SVG found for number')
          }
        } else {
          throw new Error('SVG generation failed')
        }
      } catch (err) {
        console.error(`Failed to generate SVG for ${number}:`, err)
        setError('Unable to generate SVG')
        // Use fallback placeholder
        setSvgContent(generateFallbackSVG(number, width, height))
      } finally {
        setIsLoading(false)
      }
    }

    generateSVG()
  }, [number, colorScheme, hideInactiveBeads, beadShape])

  if (isLoading) {
    return (
      <div className={`${className} ${css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'gray.400',
        fontSize: 'sm'
      })}`}>
        <div className={css({
          w: '4',
          h: '4',
          border: '2px solid',
          borderColor: 'gray.300',
          borderTopColor: 'transparent',
          rounded: 'full',
          animation: 'spin 1s linear infinite',
          mr: '2'
        })} />
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} ${css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'gray.400',
        fontSize: 'sm',
        gap: '1'
      })}`}>
        <div className={css({ fontSize: '2xl' })}>🧮</div>
        <div>Soroban for {number}</div>
      </div>
    )
  }

  // Process the SVG to ensure proper scaling
  const processedSVG = svgContent ? processSVGForDisplay(svgContent, width, height) : ''

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: processedSVG }}
    />
  )
}

function processSVGForDisplay(svgContent: string, targetWidth: number, targetHeight: number): string {
  try {
    // Parse the SVG as DOM to calculate actual content bounds
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svgElement = svgDoc.documentElement

    if (svgElement.tagName !== 'svg') {
      throw new Error('Invalid SVG content')
    }

    // Get the bounding box of all actual content
    let bounds = calculateSVGContentBounds(svgElement)

    if (!bounds) {
      // Fallback to original if we can't calculate bounds
      console.warn('Could not calculate SVG bounds, using original')
      return svgContent
    }

    // Add reasonable padding around the content
    const padding = 15
    const newViewBox = `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`

    // Update the SVG with new dimensions and viewBox
    let processedSVG = svgContent
      .replace(/width="[^"]*"/, `width="${targetWidth}"`)
      .replace(/height="[^"]*"/, `height="${targetHeight}"`)
      .replace(/viewBox="[^"]*"/, `viewBox="${newViewBox}"`)

    // Ensure responsive scaling
    if (!processedSVG.includes('preserveAspectRatio')) {
      processedSVG = processedSVG.replace('<svg', '<svg preserveAspectRatio="xMidYMid meet"')
    }

    return processedSVG
  } catch (error) {
    console.warn('Failed to process SVG:', error)
    return svgContent // Return original if processing fails
  }
}

function calculateSVGContentBounds(svgElement: SVGSVGElement): { x: number; y: number; width: number; height: number } | null {
  try {
    // For Typst-generated soroban SVGs, we need to manually calculate bounds
    // because getBBox() doesn't work properly with complex transforms

    // Look for the main content group with the matrix transform
    const matrixTransform = svgElement.querySelector('[transform*="matrix(4 0 0 4"]')

    if (matrixTransform) {
      // This is a Typst soroban - calculate bounds based on known structure
      return calculateTypstSorobanBounds(svgElement, matrixTransform as SVGElement)
    }

    // For other SVGs, try to get actual bounding box
    const bbox = svgElement.getBBox()
    return {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height
    }
  } catch (error) {
    console.warn('Error calculating bounds:', error)
    return null
  }
}

function calculateTypstSorobanBounds(svgElement: SVGSVGElement, matrixElement: SVGElement): { x: number; y: number; width: number; height: number } {
  try {
    // STEP 1: Extract all path elements and calculate their actual coordinates
    const pathElements = Array.from(svgElement.querySelectorAll('path[d]'))
    const allPoints: { x: number; y: number }[] = []

    // Parse all path data to get actual coordinates
    pathElements.forEach(path => {
      const d = path.getAttribute('d') || ''
      const coords = extractPathCoordinates(d)

      // Apply all transforms from this path element up to the root
      const transformedCoords = coords.map(coord => applyElementTransforms(coord, path, svgElement))
      allPoints.push(...transformedCoords)
    })

    if (allPoints.length === 0) {
      // Fallback if no paths found
      return { x: -50, y: -120, width: 200, height: 350 }
    }

    // STEP 2: Calculate the bounding box from all transformed points
    const minX = Math.min(...allPoints.map(p => p.x))
    const maxX = Math.max(...allPoints.map(p => p.x))
    const minY = Math.min(...allPoints.map(p => p.y))
    const maxY = Math.max(...allPoints.map(p => p.y))

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  } catch (error) {
    console.warn('Error in calculateTypstSorobanBounds:', error)
    // Safe fallback
    return { x: -50, y: -120, width: 200, height: 350 }
  }
}

function extractPathCoordinates(pathData: string): { x: number; y: number }[] {
  const coords: { x: number; y: number }[] = []

  // Simple regex to extract M, L coordinates (handles most soroban paths)
  const moveToRegex = /M\s*([\d.-]+)\s+([\d.-]+)/g
  const lineToRegex = /L\s*([\d.-]+)\s+([\d.-]+)/g

  let match
  while ((match = moveToRegex.exec(pathData)) !== null) {
    coords.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) })
  }

  while ((match = lineToRegex.exec(pathData)) !== null) {
    coords.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) })
  }

  return coords
}

function applyElementTransforms(point: { x: number; y: number }, element: Element, rootSVG: SVGSVGElement): { x: number; y: number } {
  let current = element
  let transformedPoint = { ...point }

  // Apply transforms from element up to root
  while (current && current !== rootSVG) {
    const transform = current.getAttribute('transform')
    if (transform) {
      transformedPoint = applyTransformToPoint(transformedPoint, transform)
    }
    current = current.parentElement
  }

  return transformedPoint
}

function applyTransformToPoint(point: { x: number; y: number }, transformString: string): { x: number; y: number } {
  let result = { ...point }

  // Handle matrix transform
  const matrixMatch = transformString.match(/matrix\(([\d.-]+)[\s,]+([\d.-]+)[\s,]+([\d.-]+)[\s,]+([\d.-]+)[\s,]+([\d.-]+)[\s,]+([\d.-]+)\)/)
  if (matrixMatch) {
    const [, a, b, c, d, e, f] = matrixMatch.map(Number)
    result = {
      x: a * point.x + c * point.y + e,
      y: b * point.x + d * point.y + f
    }
  }

  // Handle translate transform
  const translateMatch = transformString.match(/translate\(([\d.-]+)[\s,]+([\d.-]+)\)/)
  if (translateMatch) {
    const [, tx, ty] = translateMatch.map(Number)
    result = {
      x: result.x + tx,
      y: result.y + ty
    }
  }

  return result
}

function generateFallbackSVG(number: number, width: number, height: number): string {
  // Simple fallback SVG showing the number
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <rect x="10" y="10" width="${width-20}" height="${height-20}" fill="none" stroke="#8B4513" stroke-width="3"/>
    <line x1="15" y1="${height/2}" x2="${width-15}" y2="${height/2}" stroke="#8B4513" stroke-width="3"/>
    <text x="${width/2}" y="${height/2 + 40}" text-anchor="middle" font-size="24" fill="#666">
      ${number}
    </text>
  </svg>`
}
'use client'

import { css } from '@styled/css'
import { useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { DisplayRules } from '../../displayRules'

interface ProblemPreviewProps {
  displayRules: DisplayRules
  resolvedDisplayRules?: DisplayRules
  operator?: 'addition' | 'subtraction' | 'mixed'
  digitRange?: { min: number; max: number }
  className?: string
}

interface SVGDimensions {
  width: number
  height: number
}

/**
 * Choose demonstration problems based on digit range
 * Problems are selected to show conditional regrouping:
 * - Ones place regroups/borrows
 * - Higher places don't (to demonstrate conditional scaffolding)
 */
function getExampleProblems(digitCount: number, operator: string) {
  if (operator === 'subtraction') {
    // Subtraction: ones borrow, higher places don't
    switch (digitCount) {
      case 1:
        return { minuend: 12, subtrahend: 7 } // 12 - 7 = 5 (borrow)
      case 2:
        return { minuend: 52, subtrahend: 17 } // 52 - 17 = 35 (ones borrow, tens don't)
      case 3:
        return { minuend: 352, subtrahend: 117 } // 352 - 117 = 235 (ones borrow, tens/hundreds don't)
      case 4:
        return { minuend: 2352, subtrahend: 1117 } // ones borrow only
      case 5:
        return { minuend: 12352, subtrahend: 11117 } // ones borrow only
      case 6:
        return { minuend: 112352, subtrahend: 111117 } // ones borrow only
      default:
        return { minuend: 52, subtrahend: 17 } // Default to 2-digit
    }
  } else {
    // Addition: ones regroup, higher places don't
    switch (digitCount) {
      case 1:
        return { addend1: 7, addend2: 8 } // 7 + 8 = 15 (regroup)
      case 2:
        return { addend1: 27, addend2: 14 } // 27 + 14 = 41 (ones regroup: 7+4=11, tens don't)
      case 3:
        return { addend1: 127, addend2: 234 } // 127 + 234 = 361 (ones regroup: 7+4=11, tens/hundreds don't)
      case 4:
        return { addend1: 1027, addend2: 2034 } // ones regroup only
      case 5:
        return { addend1: 10027, addend2: 20034 } // ones regroup only
      case 6:
        return { addend1: 100027, addend2: 200034 } // ones regroup only
      default:
        return { addend1: 27, addend2: 14 } // Default to 2-digit
    }
  }
}

/**
 * Extract actual dimensions from SVG string
 */
function getSVGDimensions(svgString: string): SVGDimensions {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svg = doc.querySelector('svg')

  if (!svg) {
    return { width: 60, height: 50 } // Fallback
  }

  // Try to get dimensions from width/height attributes
  const widthAttr = svg.getAttribute('width')
  const heightAttr = svg.getAttribute('height')

  if (widthAttr && heightAttr) {
    // Parse values like "123.45pt" or "123.45"
    const width = parseFloat(widthAttr)
    const height = parseFloat(heightAttr)
    if (!Number.isNaN(width) && !Number.isNaN(height)) {
      return { width, height }
    }
  }

  // Try to get dimensions from viewBox
  const viewBox = svg.getAttribute('viewBox')
  if (viewBox) {
    const [, , width, height] = viewBox.split(' ').map(parseFloat)
    if (!Number.isNaN(width) && !Number.isNaN(height)) {
      return { width, height }
    }
  }

  return { width: 60, height: 50 } // Fallback
}

/**
 * Compact problem preview showing current scaffolding settings
 * Fetches a single-problem SVG from the example API and scales it to fit
 */
export function ProblemPreview({
  displayRules,
  resolvedDisplayRules,
  operator = 'addition',
  digitRange,
  className,
}: ProblemPreviewProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<SVGDimensions>({ width: 60, height: 50 })
  const [isLoading, setIsLoading] = useState(false)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoading(true)
      try {
        // Use first operator for mixed mode
        const effectiveOperator = operator === 'mixed' ? 'addition' : operator

        // Use max digit count from range, or default to 2
        const digitCount = digitRange?.max ?? 2

        // Get appropriate example problems for this digit count
        const problems = getExampleProblems(digitCount, effectiveOperator)

        // Resolve 'auto' to actual value if we have resolved rules
        const getResolvedValue = (key: keyof DisplayRules) => {
          const value = displayRules[key]
          if (value === 'auto' && resolvedDisplayRules) {
            return resolvedDisplayRules[key]
          }
          return value
        }

        // Get resolved values for all rules
        const carryBoxes = getResolvedValue('carryBoxes')
        const answerBoxes = getResolvedValue('answerBoxes')
        const placeValueColors = getResolvedValue('placeValueColors')
        const tenFrames = getResolvedValue('tenFrames')
        const borrowNotation = getResolvedValue('borrowNotation')
        const borrowingHints = getResolvedValue('borrowingHints')

        const response = await fetch('/api/create/worksheets/addition/example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            showCarryBoxes: carryBoxes !== 'never',
            showAnswerBoxes: answerBoxes !== 'never',
            showPlaceValueColors: placeValueColors !== 'never',
            showProblemNumbers: false, // Don't show problem numbers in preview
            showCellBorder: false, // Keep preview clean
            showTenFrames: tenFrames !== 'never',
            // Only force show-all for 'always' - others show conditionally based on problem
            showTenFramesForAll: tenFrames === 'always',
            showBorrowNotation: borrowNotation !== 'never',
            showBorrowingHints: borrowingHints !== 'never',
            fontSize: 12, // Smaller font for compact preview
            operator: effectiveOperator,
            // Use problems that demonstrate conditional regrouping
            ...problems,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const svgDimensions = getSVGDimensions(data.svg)
          setSvg(data.svg)
          setDimensions(svgDimensions)
        }
      } catch (error) {
        console.error('[ProblemPreview] Error fetching preview:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreview()
  }, [displayRules, operator, digitRange, resolvedDisplayRules])

  // Only show loading state on first load (no previous svg), and make it invisible
  if (!svg) {
    return (
      <div
        className={css({
          opacity: 0,
        })}
        style={{ width: 60, height: 50 }}
      />
    )
  }

  // Show svg even if isLoading (keeps previous preview visible during updates)

  // Calculate scale to fit in preview area (max 60px wide, 50px tall)
  const maxWidth = 60
  const maxHeight = 50
  const scaleX = maxWidth / dimensions.width
  const scaleY = maxHeight / dimensions.height
  const scale = Math.min(scaleX, scaleY, 1) // Don't scale up, only down

  const scaledWidth = dimensions.width * scale
  const scaledHeight = dimensions.height * scale

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.300',
        rounded: 'md',
        boxShadow: isDark ? '0 0 8px rgba(255, 255, 255, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
        // Make the SVG inside slightly larger to clip off white edges
        '& svg': {
          width: 'calc(100% + 4px)',
          height: 'calc(100% + 4px)',
          marginLeft: '-2px',
          marginTop: '-2px',
        },
      })}
      style={{
        width: scaledWidth,
        height: scaledHeight,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

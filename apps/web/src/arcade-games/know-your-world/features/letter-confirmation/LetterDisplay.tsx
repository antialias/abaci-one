/**
 * Letter Display Component
 *
 * Renders a region name with letter-by-letter confirmation highlighting.
 * Used in Learning mode to show which letters have been confirmed,
 * which letter is next, and which are pending.
 *
 * Visual states:
 * - Confirmed: Full opacity
 * - Next: Full opacity with underline
 * - Pending: Dimmed (40% opacity)
 * - Beyond required: Full opacity (no confirmation needed)
 * - Spaces: Always full opacity
 */

'use client'

import { memo, useMemo } from 'react'
import type { LetterDisplayProps, LetterStatus } from './types'
import { getLetterStatus, getLetterStyles } from './letterUtils'

/**
 * Renders a single letter with appropriate styling based on confirmation status.
 */
interface StyledLetterProps {
  char: string
  status: LetterStatus | 'space'
  isDark: boolean
  index: number
}

const StyledLetter = memo(function StyledLetter({
  char,
  status,
  isDark,
  index,
}: StyledLetterProps) {
  // Spaces are always shown at full opacity
  if (status === 'space') {
    return (
      <span key={index} style={{ transition: 'all 0.15s ease-out' }}>
        {char}
      </span>
    )
  }

  const styles = getLetterStyles(status, isDark)

  return (
    <span key={index} style={styles}>
      {char}
    </span>
  )
})

/**
 * Renders a region name with letter confirmation highlighting.
 *
 * This component handles:
 * - Splitting the name into individual characters
 * - Tracking non-space letter indices
 * - Applying appropriate styles based on confirmation progress
 *
 * @example
 * ```tsx
 * <LetterDisplay
 *   regionName="United States"
 *   requiredLetters={3}
 *   confirmedCount={2}
 *   isComplete={false}
 *   isDark={true}
 * />
 * // Renders: "Un" at full opacity, "i" underlined, "ted States" dimmed
 * ```
 */
export const LetterDisplay = memo(function LetterDisplay({
  regionName,
  requiredLetters,
  confirmedCount,
  isComplete,
  isDark,
  fontSize,
  style,
}: LetterDisplayProps) {
  // Calculate letter statuses and render elements
  const letterElements = useMemo(() => {
    let nonSpaceIndex = 0

    return regionName.split('').map((char, index) => {
      const isSpace = char === ' '

      if (isSpace) {
        return <StyledLetter key={index} char={char} status="space" isDark={isDark} index={index} />
      }

      // Get current index before incrementing
      const currentNonSpaceIndex = nonSpaceIndex
      nonSpaceIndex++

      // Determine letter status
      const status = getLetterStatus(
        currentNonSpaceIndex,
        confirmedCount,
        requiredLetters,
        isComplete
      )

      return <StyledLetter key={index} char={char} status={status} isDark={isDark} index={index} />
    })
  }, [regionName, confirmedCount, requiredLetters, isComplete, isDark])

  return (
    <span
      style={{
        fontSize,
        ...style,
      }}
    >
      {letterElements}
    </span>
  )
})

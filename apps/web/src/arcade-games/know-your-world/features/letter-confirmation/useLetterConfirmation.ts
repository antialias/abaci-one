/**
 * Letter Confirmation Hook
 *
 * Manages the letter confirmation state and logic for Learning mode.
 * This hook handles:
 * - Tracking confirmation progress
 * - Keyboard event handling
 * - Turn-based mode restrictions
 * - Progress calculation
 */

'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type {
  UseLetterConfirmationOptions,
  UseLetterConfirmationReturn,
  LetterStatus,
} from './types'
import {
  getNthNonSpaceLetter,
  normalizeToBaseLetter,
  getLetterStatus as getLetterStatusUtil,
  calculateProgress,
} from './letterUtils'

/**
 * Hook for managing letter confirmation in Learning mode.
 *
 * This hook provides:
 * - Keyboard event handling for letter input
 * - Progress tracking and completion detection
 * - Turn-based mode enforcement
 * - Letter status calculation for display
 *
 * @example
 * ```tsx
 * const confirmation = useLetterConfirmation({
 *   regionName: 'France',
 *   requiredLetters: 3,
 *   confirmedCount: state.nameConfirmationProgress,
 *   isMyTurn: true,
 *   gameMode: 'cooperative',
 *   onConfirmLetter: (letter, index) => dispatch({ type: 'CONFIRM_LETTER', ... }),
 * })
 *
 * if (confirmation.isComplete) {
 *   // Show "Now find it on the map"
 * }
 * ```
 */
export function useLetterConfirmation({
  regionName,
  requiredLetters,
  confirmedCount,
  isMyTurn,
  gameMode,
  onConfirmLetter,
  onNotYourTurn,
}: UseLetterConfirmationOptions): UseLetterConfirmationReturn {
  // Optimistic letter count ref - prevents race conditions when typing fast
  const optimisticCountRef = useRef(confirmedCount)

  // Sync optimistic count when server state updates
  useEffect(() => {
    optimisticCountRef.current = confirmedCount
  }, [confirmedCount])

  // Reset optimistic count when region changes
  useEffect(() => {
    optimisticCountRef.current = 0
  }, [regionName])

  // Calculate derived state
  const isRequired = requiredLetters > 0
  const isComplete = confirmedCount >= requiredLetters

  // Get the next expected letter
  const nextExpectedLetter = useMemo(() => {
    if (!regionName || isComplete) return null
    const letterInfo = getNthNonSpaceLetter(regionName, confirmedCount)
    return letterInfo ? normalizeToBaseLetter(letterInfo.char) : null
  }, [regionName, confirmedCount, isComplete])

  // Calculate progress (0-1)
  const progress = useMemo(
    () => calculateProgress(confirmedCount, requiredLetters),
    [confirmedCount, requiredLetters]
  )

  // Get letter status for display
  const getLetterStatus = useCallback(
    (nonSpaceIndex: number): LetterStatus => {
      return getLetterStatusUtil(
        nonSpaceIndex,
        confirmedCount,
        requiredLetters,
        isComplete
      )
    },
    [confirmedCount, requiredLetters, isComplete]
  )

  // Handle keyboard input
  useEffect(() => {
    if (!isRequired || isComplete || !regionName) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Only accept single character keys (letters only)
      const pressedLetter = e.key.toLowerCase()
      if (pressedLetter.length !== 1 || !/[a-z]/i.test(pressedLetter)) {
        return
      }

      // In turn-based mode, only allow the current player to type
      if (gameMode === 'turn-based' && !isMyTurn) {
        onNotYourTurn?.()
        return
      }

      // Use optimistic count to prevent race conditions when typing fast
      const nextLetterIndex = optimisticCountRef.current
      if (nextLetterIndex >= requiredLetters) {
        return // Already confirmed all required letters
      }

      // Get the nth non-space letter (skipping spaces in the name)
      const letterInfo = getNthNonSpaceLetter(regionName, nextLetterIndex)
      if (!letterInfo) {
        return // No more letters to confirm
      }

      // Normalize accented letters to base ASCII
      const expectedLetter = normalizeToBaseLetter(letterInfo.char)

      if (pressedLetter === expectedLetter) {
        // Optimistically advance count before server responds
        optimisticCountRef.current = nextLetterIndex + 1
        // Dispatch to shared state
        onConfirmLetter(pressedLetter, nextLetterIndex)
      }
      // Ignore wrong characters silently
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isRequired,
    isComplete,
    regionName,
    requiredLetters,
    isMyTurn,
    gameMode,
    onConfirmLetter,
    onNotYourTurn,
  ])

  return {
    isComplete,
    nextExpectedLetter,
    progress,
    isRequired,
    getLetterStatus,
  }
}

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

export interface UseKidNumberInputOptions {
  /** The correct answer to validate against */
  correctAnswer: number
  /** Called when the correct answer is entered */
  onCorrect: (answer: number, responseTimeMs: number) => void
  /** Called when an incorrect answer is entered (optional) */
  onIncorrect?: (answer: number, correctAnswer: number, responseTimeMs: number) => void
  /** Whether input is disabled */
  disabled?: boolean
  /** Whether to listen for keyboard events globally (default: true) */
  useGlobalKeyboard?: boolean
  /** Maximum number of digits allowed (default: correctAnswer.toString().length) */
  maxDigits?: number
  /** Whether to clear input after correct answer (default: true, set false for form-like behavior) */
  clearOnCorrect?: boolean
  /** Whether to clear input after incorrect answer (default: true) */
  clearOnIncorrect?: boolean
}

export interface KidNumberInputState {
  /** Current input value as string */
  value: string
  /** Whether the input is currently disabled */
  disabled: boolean
  /** Time when input started (first digit entered) */
  startTime: number | null
}

export interface KidNumberInputActions {
  /** Add a digit to the input */
  addDigit: (digit: string) => void
  /** Remove the last digit */
  backspace: () => void
  /** Clear all input */
  clear: () => void
  /** Reset for a new question */
  reset: () => void
}

/**
 * Hook for kid-friendly number input with auto-validation.
 *
 * Automatically validates the input when the user has entered enough digits
 * to potentially match the correct answer. If correct, calls onCorrect.
 * If incorrect, calls onIncorrect and clears the input.
 *
 * @example
 * ```tsx
 * const { state, actions } = useKidNumberInput({
 *   correctAnswer: 7,
 *   onCorrect: (answer, time) => console.log('Correct!', answer, time),
 *   onIncorrect: (answer, correct, time) => console.log('Wrong', answer, correct),
 * })
 * ```
 */
export function useKidNumberInput({
  correctAnswer,
  onCorrect,
  onIncorrect,
  disabled = false,
  useGlobalKeyboard = true,
  maxDigits,
  clearOnCorrect = true,
  clearOnIncorrect = true,
}: UseKidNumberInputOptions) {
  const [value, setValue] = useState('')
  const [startTime, setStartTime] = useState<number | null>(null)

  // Refs for stable callback references
  const correctAnswerRef = useRef(correctAnswer)
  const onCorrectRef = useRef(onCorrect)
  const onIncorrectRef = useRef(onIncorrect)
  const disabledRef = useRef(disabled)
  const clearOnCorrectRef = useRef(clearOnCorrect)
  const clearOnIncorrectRef = useRef(clearOnIncorrect)

  // Update refs when props change
  useEffect(() => {
    correctAnswerRef.current = correctAnswer
    onCorrectRef.current = onCorrect
    onIncorrectRef.current = onIncorrect
    disabledRef.current = disabled
    clearOnCorrectRef.current = clearOnCorrect
    clearOnIncorrectRef.current = clearOnIncorrect
  }, [correctAnswer, onCorrect, onIncorrect, disabled, clearOnCorrect, clearOnIncorrect])

  // Calculate max digits allowed
  const effectiveMaxDigits = maxDigits ?? correctAnswer.toString().length

  // Validate input when it reaches the expected length
  const validateAndSubmit = useCallback((inputValue: string, inputStartTime: number | null) => {
    const answer = parseInt(inputValue, 10)
    const correct = correctAnswerRef.current
    const responseTime = inputStartTime ? Date.now() - inputStartTime : 0

    if (answer === correct) {
      // Correct answer!
      onCorrectRef.current(answer, responseTime)
      // Optionally clear input (for games: clear immediately, for forms: keep displayed)
      if (clearOnCorrectRef.current) {
        setValue('')
        setStartTime(null)
      }
    } else {
      // Incorrect answer
      onIncorrectRef.current?.(answer, correct, responseTime)
      // Optionally clear input for retry
      if (clearOnIncorrectRef.current) {
        setValue('')
        setStartTime(null)
      }
    }
  }, [])

  // Add a digit
  const addDigit = useCallback((digit: string) => {
    if (disabledRef.current) return
    if (!/^[0-9]$/.test(digit)) return

    setValue(prev => {
      // Don't add if already at max length
      if (prev.length >= effectiveMaxDigits) return prev

      const newValue = prev + digit
      const newStartTime = startTime ?? Date.now()

      // Update start time if this is the first digit
      if (!startTime) {
        setStartTime(newStartTime)
      }

      // Check if we should validate
      if (newValue.length >= effectiveMaxDigits) {
        // Use setTimeout to allow the state to update first
        setTimeout(() => {
          validateAndSubmit(newValue, newStartTime)
        }, 50)
      }

      return newValue
    })
  }, [effectiveMaxDigits, startTime, validateAndSubmit])

  // Remove last digit
  const backspace = useCallback(() => {
    if (disabledRef.current) return
    setValue(prev => prev.slice(0, -1))
  }, [])

  // Clear all input
  const clear = useCallback(() => {
    setValue('')
    setStartTime(null)
  }, [])

  // Reset for new question
  const reset = useCallback(() => {
    setValue('')
    setStartTime(null)
  }, [])

  // Global keyboard handler
  useEffect(() => {
    if (!useGlobalKeyboard) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabledRef.current) return

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        addDigit(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        backspace()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [useGlobalKeyboard, addDigit, backspace])

  // Reset when correctAnswer changes (new question)
  useEffect(() => {
    reset()
  }, [correctAnswer, reset])

  return {
    state: {
      value,
      disabled,
      startTime,
    } as KidNumberInputState,
    actions: {
      addDigit,
      backspace,
      clear,
      reset,
    } as KidNumberInputActions,
  }
}

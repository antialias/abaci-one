'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'
import { KidNumberInput } from '@/components/ui/KidNumberInput'
import { useIsTouchDevice, useHasPhysicalKeyboard } from '@/hooks/useDeviceCapabilities'

interface FlowchartCheckpointProps {
  prompt: string
  inputType: 'number' | 'text' | 'two-numbers'
  onSubmit: (value: number | string | [number, number]) => void
  disabled?: boolean
  /** Labels for two-numbers inputs */
  inputLabels?: [string, string]
  /** Feedback after validation */
  feedback?: {
    correct: boolean
    expected?: number | string | [number, number]
    userAnswer?: number | string | [number, number]
  }
  /** Hint to show after repeated failures */
  hint?: string
  /** Expected values for immediate per-field validation (optional) */
  expectedValues?: number | [number, number]
  /** Whether order matters for two-numbers validation (default: true) */
  orderMatters?: boolean
}

/**
 * Checkpoint node UI - number/text input with validation
 */
export function FlowchartCheckpoint({
  prompt,
  inputType,
  onSubmit,
  disabled = false,
  inputLabels = ['First', 'Second'],
  feedback,
  hint,
  expectedValues,
  orderMatters = true,
}: FlowchartCheckpointProps) {
  const [value, setValue] = useState('')
  const [value1, setValue1] = useState('')
  const [value2, setValue2] = useState('')
  const [focusedInput, setFocusedInput] = useState<0 | 1>(0)
  const input2Ref = useRef<HTMLInputElement>(null)

  // Per-field feedback state (for immediate validation)
  const [fieldFeedback, setFieldFeedback] = useState<{
    first: 'none' | 'correct' | 'incorrect'
    second: 'none' | 'correct' | 'incorrect'
  }>({ first: 'none', second: 'none' })

  // Smart keypad visibility - show on touch devices without physical keyboard
  const isTouchDevice = useIsTouchDevice()
  const hasPhysicalKeyboard = useHasPhysicalKeyboard()
  // Show keypad only on touch devices without detected physical keyboard
  // Default to showing keypad while detection is pending (hasPhysicalKeyboard === null)
  const showOnScreenKeypad = isTouchDevice && hasPhysicalKeyboard !== true

  // Handlers for single number input (KidNumberInput)
  const handleDigit = useCallback(
    (digit: string) => {
      if (disabled || feedback) return
      setValue((prev) => prev + digit)
    },
    [disabled, feedback]
  )

  const handleBackspace = useCallback(() => {
    if (disabled || feedback) return
    setValue((prev) => prev.slice(0, -1))
  }, [disabled, feedback])

  // Handlers for two-numbers input (first input)
  const handleDigit1 = useCallback(
    (digit: string) => {
      if (disabled || feedback) return
      setValue1((prev) => prev + digit)
    },
    [disabled, feedback]
  )

  const handleBackspace1 = useCallback(() => {
    if (disabled || feedback) return
    setValue1((prev) => prev.slice(0, -1))
  }, [disabled, feedback])

  // Handlers for two-numbers input (second input)
  const handleDigit2 = useCallback(
    (digit: string) => {
      if (disabled || feedback) return
      setValue2((prev) => prev + digit)
    },
    [disabled, feedback]
  )

  const handleBackspace2 = useCallback(() => {
    if (disabled || feedback) return
    setValue2((prev) => prev.slice(0, -1))
  }, [disabled, feedback])

  // Per-field validation helper for two-numbers input
  const validateTwoNumbersField = useCallback(
    (
      fieldValue: string,
      expected: [number, number],
      fieldIndex: 0 | 1,
      otherFieldValue: string
    ): 'correct' | 'incorrect' | 'pending' => {
      if (!fieldValue.trim()) return 'pending'
      const num = parseFloat(fieldValue)
      if (Number.isNaN(num)) return 'pending'

      // Get the expected value(s) based on which field
      const expectedDigits = String(expected[fieldIndex]).length

      // Don't validate until user has entered enough digits
      if (fieldValue.length < expectedDigits) return 'pending'

      if (orderMatters) {
        // Simple ordered validation
        return num === expected[fieldIndex] ? 'correct' : 'incorrect'
      } else {
        // Order-agnostic validation: either expected value is acceptable
        // unless the other field already has it
        const otherNum = parseFloat(otherFieldValue)

        if (num === expected[0]) {
          // Value matches first expected - correct unless other field already claimed it
          return Number.isNaN(otherNum) || otherNum !== expected[0] ? 'correct' : 'incorrect'
        }
        if (num === expected[1]) {
          // Value matches second expected - correct unless other field already claimed it
          return Number.isNaN(otherNum) || otherNum !== expected[1] ? 'correct' : 'incorrect'
        }
        return 'incorrect'
      }
    },
    [orderMatters]
  )

  // Per-field validation effect for first field (two-numbers)
  useEffect(() => {
    if (inputType !== 'two-numbers' || !expectedValues || disabled || feedback) return
    if (!Array.isArray(expectedValues)) return

    const result = validateTwoNumbersField(value1, expectedValues, 0, value2)
    setFieldFeedback((prev) => ({
      ...prev,
      first: result === 'pending' ? 'none' : result,
    }))

    // Auto-advance to second field when first is correct
    if (result === 'correct' && focusedInput === 0) {
      const timeout = setTimeout(() => setFocusedInput(1), 300)
      return () => clearTimeout(timeout)
    }
  }, [
    value1,
    value2,
    expectedValues,
    inputType,
    disabled,
    feedback,
    focusedInput,
    validateTwoNumbersField,
  ])

  // Per-field validation effect for second field (two-numbers)
  useEffect(() => {
    if (inputType !== 'two-numbers' || !expectedValues || disabled || feedback) return
    if (!Array.isArray(expectedValues)) return

    const result = validateTwoNumbersField(value2, expectedValues, 1, value1)
    setFieldFeedback((prev) => ({
      ...prev,
      second: result === 'pending' ? 'none' : result,
    }))

    // Auto-submit when both fields are correct
    if (result === 'correct' && fieldFeedback.first === 'correct') {
      const num1 = parseFloat(value1)
      const num2 = parseFloat(value2)
      if (!Number.isNaN(num1) && !Number.isNaN(num2)) {
        const timeout = setTimeout(() => {
          onSubmit([num1, num2])
        }, 400)
        return () => clearTimeout(timeout)
      }
    }
  }, [
    value1,
    value2,
    expectedValues,
    inputType,
    disabled,
    feedback,
    fieldFeedback.first,
    validateTwoNumbersField,
    onSubmit,
  ])

  // Per-field validation for single number input
  useEffect(() => {
    if (inputType !== 'number' || typeof expectedValues !== 'number' || disabled || feedback) return

    if (!value.trim()) {
      setFieldFeedback({ first: 'none', second: 'none' })
      return
    }

    const num = parseFloat(value)
    if (Number.isNaN(num)) return

    const expectedDigits = String(expectedValues).length
    if (value.length < expectedDigits) {
      setFieldFeedback({ first: 'none', second: 'none' })
      return
    }

    const isCorrect = num === expectedValues
    setFieldFeedback({ first: isCorrect ? 'correct' : 'incorrect', second: 'none' })

    // Auto-submit when correct
    if (isCorrect) {
      const timeout = setTimeout(() => {
        onSubmit(num)
      }, 400)
      return () => clearTimeout(timeout)
    }
  }, [value, expectedValues, inputType, disabled, feedback, onSubmit])

  // Submit handler (must be defined before useEffect that uses it)
  const handleSubmit = useCallback(() => {
    if (inputType === 'two-numbers') {
      if (!value1.trim() || !value2.trim()) return
      const num1 = parseFloat(value1)
      const num2 = parseFloat(value2)
      if (!Number.isNaN(num1) && !Number.isNaN(num2)) {
        onSubmit([num1, num2])
      }
    } else if (inputType === 'number') {
      if (!value.trim()) return
      const num = parseFloat(value)
      if (!Number.isNaN(num)) {
        onSubmit(num)
      }
    } else {
      if (!value.trim()) return
      onSubmit(value)
    }
  }, [inputType, value, value1, value2, onSubmit])

  // Global keyboard handler for physical keyboard support (number inputs)
  useEffect(() => {
    if (inputType === 'text') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || feedback) return

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        if (inputType === 'number') {
          handleDigit(e.key)
        } else if (inputType === 'two-numbers') {
          if (focusedInput === 0) {
            handleDigit1(e.key)
          } else {
            handleDigit2(e.key)
          }
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        if (inputType === 'number') {
          handleBackspace()
        } else if (inputType === 'two-numbers') {
          if (focusedInput === 0) {
            handleBackspace1()
          } else {
            handleBackspace2()
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (inputType === 'two-numbers' && focusedInput === 0 && value1.trim()) {
          // Move to second input on Enter
          setFocusedInput(1)
        } else {
          handleSubmit()
        }
      } else if (e.key === 'Tab' && inputType === 'two-numbers') {
        e.preventDefault()
        setFocusedInput((prev) => (prev === 0 ? 1 : 0))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    inputType,
    disabled,
    feedback,
    focusedInput,
    value1,
    handleDigit,
    handleBackspace,
    handleDigit1,
    handleBackspace1,
    handleDigit2,
    handleBackspace2,
    handleSubmit,
  ])

  // Auto-submit for two-numbers when both values are filled (fallback when no expectedValues)
  useEffect(() => {
    // Skip if per-field validation is active (it handles auto-submit)
    if (expectedValues && Array.isArray(expectedValues)) return
    if (inputType !== 'two-numbers' || disabled || feedback) return

    const num1 = parseFloat(value1)
    const num2 = parseFloat(value2)

    // Only auto-submit if both are valid integers (denominators should be whole numbers)
    if (
      value1.trim() &&
      value2.trim() &&
      !Number.isNaN(num1) &&
      !Number.isNaN(num2) &&
      Number.isInteger(num1) &&
      Number.isInteger(num2)
    ) {
      // Small delay so the user sees what they typed
      const timeout = setTimeout(() => {
        onSubmit([num1, num2])
      }, 150)
      return () => clearTimeout(timeout)
    }
  }, [value1, value2, inputType, disabled, feedback, onSubmit, expectedValues])

  const handleKeyDown = (e: React.KeyboardEvent, isFirstOfTwo?: boolean) => {
    if (e.key === 'Enter') {
      if (isFirstOfTwo && input2Ref.current) {
        // Move to second input
        input2Ref.current.focus()
      } else {
        handleSubmit()
      }
    }
  }

  const canSubmit = inputType === 'two-numbers' ? value1.trim() && value2.trim() : value.trim()

  // Check which inputs are wrong for two-numbers feedback
  const getTwoNumbersFeedback = () => {
    if (!feedback || inputType !== 'two-numbers') return { first: null, second: null }
    if (feedback.correct) return { first: true, second: true }

    const expected = feedback.expected as [number, number]
    const userAnswer = feedback.userAnswer as [number, number]

    return {
      first: userAnswer[0] === expected[0],
      second: userAnswer[1] === expected[1],
    }
  }

  const twoNumFeedback = getTwoNumbersFeedback()

  const inputStyle = (isCorrect: boolean | null) =>
    css({
      width: '80px',
      padding: '3',
      fontSize: 'xl',
      fontWeight: 'bold',
      textAlign: 'center',
      borderRadius: 'lg',
      border: '2px solid',
      borderColor:
        isCorrect === null
          ? { base: 'gray.300', _dark: 'gray.600' }
          : isCorrect
            ? { base: 'green.500', _dark: 'green.400' }
            : { base: 'red.500', _dark: 'red.400' },
      backgroundColor:
        isCorrect === null
          ? { base: 'white', _dark: 'gray.800' }
          : isCorrect
            ? { base: 'green.50', _dark: 'green.900' }
            : { base: 'red.50', _dark: 'red.900' },
      color: { base: 'gray.900', _dark: 'gray.100' },
      outline: 'none',
      _focus: {
        borderColor: { base: 'blue.500', _dark: 'blue.400' },
        boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.3)',
      },
      _disabled: {
        opacity: 0.7,
        cursor: 'not-allowed',
      },
    })

  return (
    <div
      data-testid="checkpoint-container"
      data-input-type={inputType}
      data-has-feedback={!!feedback}
      data-feedback-correct={feedback?.correct}
      className={vstack({ gap: '4', alignItems: 'center' })}
    >
      {/* Prompt */}
      <p
        data-testid="checkpoint-prompt"
        className={css({
          fontSize: 'lg',
          fontWeight: 'medium',
          color: { base: 'gray.800', _dark: 'gray.200' },
          textAlign: 'center',
        })}
      >
        {prompt}
      </p>

      {/* Input area */}
      {inputType === 'two-numbers' ? (
        <div data-testid="checkpoint-two-numbers-row" className={vstack({ gap: '4' })}>
          {/* Two KidNumberInput displays (without keypads) */}
          <div className={hstack({ gap: '4', alignItems: 'flex-start' })}>
            {/* First input with label */}
            <div
              data-testid="checkpoint-input-1-wrapper"
              onClick={() => setFocusedInput(0)}
              className={vstack({
                gap: '1',
                alignItems: 'center',
                cursor: 'pointer',
              })}
            >
              <label
                className={css({
                  fontSize: 'sm',
                  color: { base: 'gray.600', _dark: 'gray.400' },
                  fontWeight: 'medium',
                })}
              >
                {inputLabels[0]}
              </label>
              <div
                className={css({
                  outline: focusedInput === 0 ? '3px solid' : 'none',
                  outlineColor: { base: 'blue.400', _dark: 'blue.500' },
                  outlineOffset: '2px',
                  borderRadius: 'xl',
                })}
              >
                <KidNumberInput
                  value={value1}
                  onDigit={handleDigit1}
                  onBackspace={handleBackspace1}
                  disabled={disabled || !!feedback}
                  feedback={
                    feedback
                      ? twoNumFeedback.first
                        ? 'correct'
                        : 'incorrect'
                      : fieldFeedback.first
                  }
                  showKeypad={false}
                  displaySize="md"
                  placeholder="?"
                />
              </div>
            </div>

            <span
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: { base: 'gray.400', _dark: 'gray.500' },
                marginTop: '8', // Align with inputs (below labels)
              })}
            >
              and
            </span>

            {/* Second input with label */}
            <div
              data-testid="checkpoint-input-2-wrapper"
              onClick={() => setFocusedInput(1)}
              className={vstack({
                gap: '1',
                alignItems: 'center',
                cursor: 'pointer',
              })}
            >
              <label
                className={css({
                  fontSize: 'sm',
                  color: { base: 'gray.600', _dark: 'gray.400' },
                  fontWeight: 'medium',
                })}
              >
                {inputLabels[1]}
              </label>
              <div
                className={css({
                  outline: focusedInput === 1 ? '3px solid' : 'none',
                  outlineColor: { base: 'blue.400', _dark: 'blue.500' },
                  outlineOffset: '2px',
                  borderRadius: 'xl',
                })}
              >
                <KidNumberInput
                  value={value2}
                  onDigit={handleDigit2}
                  onBackspace={handleBackspace2}
                  disabled={disabled || !!feedback}
                  feedback={
                    feedback
                      ? twoNumFeedback.second
                        ? 'correct'
                        : 'incorrect'
                      : fieldFeedback.second
                  }
                  showKeypad={false}
                  displaySize="md"
                  placeholder="?"
                />
              </div>
            </div>
          </div>

          {/* Shared inline keypad for two-numbers - only show on touch devices without keyboard */}
          {showOnScreenKeypad && (
            <div className={css({ width: '100%', maxWidth: '320px' })}>
              <KidNumberInput
                value=""
                onDigit={focusedInput === 0 ? handleDigit1 : handleDigit2}
                onBackspace={focusedInput === 0 ? handleBackspace1 : handleBackspace2}
                disabled={disabled || !!feedback}
                showKeypad={true}
                keypadMode="inline"
                displaySize="sm"
                placeholder=""
              />
            </div>
          )}
        </div>
      ) : inputType === 'number' ? (
        /* Number input with KidNumberInput */
        <div
          data-testid="checkpoint-input-row"
          className={vstack({ gap: '4', alignItems: 'center' })}
        >
          <KidNumberInput
            value={value}
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            disabled={disabled || !!feedback}
            feedback={feedback ? (feedback.correct ? 'correct' : 'incorrect') : fieldFeedback.first}
            showKeypad={showOnScreenKeypad}
            keypadMode="inline"
            displaySize="lg"
            placeholder="?"
          />
          <button
            data-testid="checkpoint-check-button"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={css({
              paddingY: '4',
              paddingX: '8',
              fontSize: 'xl',
              fontWeight: 'bold',
              borderRadius: 'xl',
              backgroundColor: { base: 'blue.500', _dark: 'blue.600' },
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
                transform: 'scale(1.02)',
              },
              _active: {
                transform: 'scale(0.98)',
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
                _hover: {
                  transform: 'none',
                },
              },
            })}
          >
            Check
          </button>
        </div>
      ) : (
        /* Text input - keep native input */
        <div data-testid="checkpoint-input-row" className={hstack({ gap: '3' })}>
          <input
            data-testid="checkpoint-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            disabled={disabled}
            // biome-ignore lint/a11y/noAutofocus: focus input on modal open
            autoFocus
            className={css({
              width: '120px',
              padding: '3',
              fontSize: 'xl',
              fontWeight: 'bold',
              textAlign: 'center',
              borderRadius: 'lg',
              border: '2px solid',
              borderColor: feedback
                ? feedback.correct
                  ? { base: 'green.500', _dark: 'green.400' }
                  : { base: 'red.500', _dark: 'red.400' }
                : { base: 'gray.300', _dark: 'gray.600' },
              backgroundColor: feedback
                ? feedback.correct
                  ? { base: 'green.50', _dark: 'green.900' }
                  : { base: 'red.50', _dark: 'red.900' }
                : { base: 'white', _dark: 'gray.800' },
              color: { base: 'gray.900', _dark: 'gray.100' },
              outline: 'none',
              _focus: {
                borderColor: { base: 'blue.500', _dark: 'blue.400' },
                boxShadow: '0 0 0 3px rgba(66, 153, 225, 0.3)',
              },
              _disabled: {
                opacity: 0.7,
                cursor: 'not-allowed',
              },
            })}
          />
          <button
            data-testid="checkpoint-check-button"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className={css({
              paddingY: '3',
              paddingX: '5',
              fontSize: 'lg',
              fontWeight: 'semibold',
              borderRadius: 'lg',
              backgroundColor: { base: 'blue.500', _dark: 'blue.600' },
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            Check
          </button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          data-testid="checkpoint-feedback"
          data-feedback-correct={feedback.correct}
          data-expected={
            Array.isArray(feedback.expected) ? feedback.expected.join(',') : feedback.expected
          }
          data-user-answer={
            Array.isArray(feedback.userAnswer) ? feedback.userAnswer.join(',') : feedback.userAnswer
          }
          className={css({
            paddingY: '3',
            paddingX: '4',
            borderRadius: 'md',
            backgroundColor: feedback.correct
              ? { base: 'green.100', _dark: 'green.800' }
              : { base: 'red.100', _dark: 'red.800' },
            color: feedback.correct
              ? { base: 'green.800', _dark: 'green.200' }
              : { base: 'red.800', _dark: 'red.200' },
            fontSize: 'md',
            fontWeight: 'medium',
          })}
        >
          {feedback.correct ? (
            <span>Correct!</span>
          ) : inputType === 'two-numbers' ? (
            <span>
              Not quite.
              {!twoNumFeedback.first && (
                <> First should be {(feedback.expected as [number, number])[0]}.</>
              )}
              {!twoNumFeedback.second && (
                <> Second should be {(feedback.expected as [number, number])[1]}.</>
              )}
            </span>
          ) : (
            <span>
              Not quite. You entered {String(feedback.userAnswer)}, but the answer is{' '}
              {String(feedback.expected)}.
            </span>
          )}
        </div>
      )}

      {/* Hint */}
      {hint && (
        <div
          data-testid="checkpoint-hint"
          className={css({
            paddingY: '3',
            paddingX: '4',
            borderRadius: 'md',
            backgroundColor: { base: 'purple.100', _dark: 'purple.800' },
            color: { base: 'purple.800', _dark: 'purple.200' },
            fontSize: 'sm',
          })}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

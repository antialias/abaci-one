'use client'

import { useState, useEffect } from 'react'
import * as RadioGroup from '@radix-ui/react-radio-group'
import type { DecisionOption } from '@/lib/flowcharts/schema'
import { css, cx } from '../../../styled-system/css'
import { hstack } from '../../../styled-system/patterns'

interface FlowchartDecisionProps {
  options: DecisionOption[]
  onSelect: (value: string) => void
  /** Wrong answer value to highlight and shake briefly */
  wrongAnswer?: string
  /** Correct answer to highlight after wrong answer */
  correctAnswer?: string
}

/**
 * Decision node UI using Radix RadioGroup for accessibility.
 * When a wrong answer is given, it shakes briefly and shows
 * the correct answer, then resets for another try.
 */
export function FlowchartDecision({
  options,
  onSelect,
  wrongAnswer,
  correctAnswer,
}: FlowchartDecisionProps) {
  const [isShaking, setIsShaking] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [selectedValue, setSelectedValue] = useState<string | undefined>()

  // When wrongAnswer changes, trigger shake animation
  useEffect(() => {
    if (wrongAnswer) {
      setIsShaking(true)
      setShowFeedback(true)
      setSelectedValue(undefined)

      // Reset shake after animation
      const shakeTimer = setTimeout(() => setIsShaking(false), 500)
      // Reset feedback after a brief delay so they can try again
      const feedbackTimer = setTimeout(() => setShowFeedback(false), 1500)

      return () => {
        clearTimeout(shakeTimer)
        clearTimeout(feedbackTimer)
      }
    }
  }, [wrongAnswer])

  const handleSelect = (value: string) => {
    if (showFeedback) return // Don't allow selection during feedback
    setSelectedValue(value)
    onSelect(value)
  }

  return (
    <RadioGroup.Root
      value={selectedValue}
      onValueChange={handleSelect}
      className={cx(
        hstack({ gap: '4', justifyContent: 'center', flexWrap: 'wrap' }),
        isShaking ? 'shake-animation' : ''
      )}
    >
      {options.map((option) => {
        const isCorrect = showFeedback && correctAnswer === option.value
        const isWrong = showFeedback && wrongAnswer === option.value

        return (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            disabled={showFeedback}
            className={css({
              all: 'unset',
              boxSizing: 'border-box',
              padding: '4 6',
              fontSize: 'lg',
              fontWeight: 'semibold',
              borderRadius: 'xl',
              border: '3px solid',
              cursor: showFeedback ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              minWidth: '140px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',

              // Base styles based on state
              backgroundColor: isCorrect
                ? { base: 'green.100', _dark: 'green.800' }
                : isWrong
                  ? { base: 'red.100', _dark: 'red.800' }
                  : { base: 'white', _dark: 'gray.800' },
              borderColor: isCorrect
                ? { base: 'green.500', _dark: 'green.400' }
                : isWrong
                  ? { base: 'red.500', _dark: 'red.400' }
                  : { base: 'gray.300', _dark: 'gray.600' },
              color: isCorrect
                ? { base: 'green.800', _dark: 'green.200' }
                : isWrong
                  ? { base: 'red.800', _dark: 'red.200' }
                  : { base: 'gray.800', _dark: 'gray.200' },

              // Hover
              _hover: showFeedback
                ? {}
                : {
                    backgroundColor: { base: 'blue.50', _dark: 'blue.900' },
                    borderColor: { base: 'blue.500', _dark: 'blue.400' },
                    transform: 'scale(1.03)',
                    boxShadow: 'lg',
                  },

              // Focus visible
              _focusVisible: {
                outline: '3px solid',
                outlineColor: { base: 'blue.400', _dark: 'blue.500' },
                outlineOffset: '2px',
              },

              // Active/pressed
              _active: showFeedback
                ? {}
                : {
                    transform: 'scale(0.97)',
                  },

              // Selected (checked)
              '&[data-state="checked"]': {
                backgroundColor: { base: 'blue.100', _dark: 'blue.800' },
                borderColor: { base: 'blue.500', _dark: 'blue.400' },
                color: { base: 'blue.800', _dark: 'blue.200' },
              },
            })}
          >
            {/* Correct/wrong indicator */}
            {isCorrect && (
              <span
                className={css({
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '24px',
                  height: '24px',
                  backgroundColor: 'green.500',
                  borderRadius: 'full',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'sm',
                  color: 'white',
                  fontWeight: 'bold',
                })}
              >
                ✓
              </span>
            )}
            {isWrong && (
              <span
                className={css({
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '24px',
                  height: '24px',
                  backgroundColor: 'red.500',
                  borderRadius: 'full',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'sm',
                  color: 'white',
                  fontWeight: 'bold',
                })}
              >
                ✗
              </span>
            )}
            {option.label}
          </RadioGroup.Item>
        )
      })}

      {/* Inline styles for shake animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
              20%, 40%, 60%, 80% { transform: translateX(8px); }
            }
            .shake-animation {
              animation: shake 0.5s ease-in-out;
            }
          `,
        }}
      />
    </RadioGroup.Root>
  )
}

interface WrongAnswerFeedbackProps {
  message: string
}

/**
 * Inline feedback message shown briefly after wrong answer
 */
export function FlowchartWrongAnswerFeedback({ message }: WrongAnswerFeedbackProps) {
  return (
    <div
      className={css({
        padding: '3 4',
        backgroundColor: { base: 'amber.100', _dark: 'amber.900' },
        borderRadius: 'lg',
        border: '2px solid',
        borderColor: { base: 'amber.400', _dark: 'amber.600' },
        fontSize: 'md',
        color: { base: 'amber.800', _dark: 'amber.200' },
        textAlign: 'center',
        animation: 'fadeInOut 2s ease-in-out forwards',
      })}
    >
      {message}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeInOut {
              0% { opacity: 0; transform: translateY(-10px); }
              15% { opacity: 1; transform: translateY(0); }
              85% { opacity: 1; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(-10px); }
            }
          `,
        }}
      />
    </div>
  )
}

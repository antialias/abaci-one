'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { css } from '../../../../../../styled-system/css'
import type { WorksheetFormState } from '../types'

interface DisplayOptionsPreviewProps {
  formState: WorksheetFormState
}

interface MathSentenceProps {
  operands: number[]
  operator: string
  onChange: (operands: number[]) => void
  labels?: string[]
}

/**
 * Flexible math sentence component supporting operators with arity 1-3
 * Examples:
 *   Arity 1 (unary):  [64] with "√" → "√64"
 *   Arity 2 (binary): [45, 27] with "+" → "45 + 27"
 *   Arity 3 (ternary): [5, 10, 15] with "between" → "5 < 10 < 15"
 */
function MathSentence({ operands, operator, onChange, labels }: MathSentenceProps) {
  const handleOperandChange = (index: number, value: string) => {
    const numValue = Number.parseInt(value, 10)
    if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= 99) {
      const newOperands = [...operands]
      newOperands[index] = numValue
      onChange(newOperands)
    }
  }

  const renderInput = (value: number, index: number) => (
    <input
      key={index}
      type="number"
      min="0"
      max="99"
      value={value}
      onChange={(e) => handleOperandChange(index, e.target.value)}
      aria-label={labels?.[index] || `operand ${index + 1}`}
      className={css({
        width: '3.5em',
        px: '1',
        py: '0.5',
        fontSize: 'sm',
        fontWeight: 'medium',
        textAlign: 'center',
        border: '1px solid',
        borderColor: 'transparent',
        rounded: 'sm',
        outline: 'none',
        transition: 'border-color 0.2s',
        _hover: {
          borderColor: 'gray.300',
        },
        _focus: {
          borderColor: 'brand.500',
          ring: '1px',
          ringColor: 'brand.200',
        },
      })}
    />
  )

  // Render based on arity
  if (operands.length === 1) {
    // Unary operator (prefix): √64 or ±5
    return (
      <div
        data-component="math-sentence"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '1',
          fontSize: 'sm',
          fontWeight: 'medium',
        })}
      >
        <span>{operator}</span>
        {renderInput(operands[0], 0)}
      </div>
    )
  }

  if (operands.length === 2) {
    // Binary operator (infix): 45 + 27
    return (
      <div
        data-component="math-sentence"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '1',
          fontSize: 'sm',
          fontWeight: 'medium',
        })}
      >
        {renderInput(operands[0], 0)}
        <span>{operator}</span>
        {renderInput(operands[1], 1)}
      </div>
    )
  }

  if (operands.length === 3) {
    // Ternary operator: 5 < 10 < 15 or similar
    return (
      <div
        data-component="math-sentence"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '1',
          fontSize: 'sm',
          fontWeight: 'medium',
        })}
      >
        {renderInput(operands[0], 0)}
        <span>{operator}</span>
        {renderInput(operands[1], 1)}
        <span>{operator}</span>
        {renderInput(operands[2], 2)}
      </div>
    )
  }

  return null
}

async function fetchExample(options: {
  showCarryBoxes: boolean
  showAnswerBoxes: boolean
  showPlaceValueColors: boolean
  showProblemNumbers: boolean
  showCellBorder: boolean
  showTenFrames: boolean
  showTenFramesForAll: boolean
  showBorrowNotation: boolean
  operator: 'addition' | 'subtraction' | 'mixed'
  addend1?: number
  addend2?: number
  minuend?: number
  subtrahend?: number
}): Promise<string> {
  const response = await fetch('/api/create/worksheets/addition/example', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...options,
      fontSize: 16,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch example')
  }

  const data = await response.json()
  return data.svg
}

export function DisplayOptionsPreview({ formState }: DisplayOptionsPreviewProps) {
  const operator = formState.operator ?? 'addition'

  // Local state for operands (not debounced - we want immediate feedback)
  const [operands, setOperands] = useState([45, 27])

  // Build options based on operator type
  const buildOptions = () => {
    const base = {
      showCarryBoxes: formState.showCarryBoxes ?? true,
      showAnswerBoxes: formState.showAnswerBoxes ?? true,
      showPlaceValueColors: formState.showPlaceValueColors ?? true,
      showProblemNumbers: formState.showProblemNumbers ?? true,
      showCellBorder: formState.showCellBorder ?? true,
      showTenFrames: formState.showTenFrames ?? false,
      showTenFramesForAll: formState.showTenFramesForAll ?? false,
      showBorrowNotation: formState.showBorrowNotation ?? true,
      operator,
    }

    if (operator === 'addition') {
      return {
        ...base,
        addend1: operands[0],
        addend2: operands[1],
      }
    } else {
      // Subtraction (mixed mode shows subtraction in preview)
      return {
        ...base,
        minuend: operands[0],
        subtrahend: operands[1],
      }
    }
  }

  // Debounce the display options to avoid hammering the server
  const [debouncedOptions, setDebouncedOptions] = useState(buildOptions())

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOptions(buildOptions())
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [
    formState.showCarryBoxes,
    formState.showAnswerBoxes,
    formState.showPlaceValueColors,
    formState.showProblemNumbers,
    formState.showCellBorder,
    formState.showTenFrames,
    formState.showTenFramesForAll,
    formState.showBorrowNotation,
    formState.operator,
    operands,
  ])

  const { data: svg, isLoading } = useQuery({
    queryKey: ['display-example', debouncedOptions],
    queryFn: () => fetchExample(debouncedOptions),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return (
    <div
      data-component="display-options-preview"
      className={css({
        p: '3',
        bg: 'white',
        rounded: 'xl',
        border: '2px solid',
        borderColor: 'brand.200',
        display: 'flex',
        flexDirection: 'column',
        gap: '2',
        width: 'fit-content',
        maxWidth: '100%',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        })}
      >
        <div
          className={css({
            fontSize: 'xs',
            fontWeight: 'semibold',
            color: 'gray.500',
            textTransform: 'uppercase',
            letterSpacing: 'wider',
          })}
        >
          Preview
        </div>
        <MathSentence
          operands={operands}
          operator={operator === 'addition' ? '+' : '−'}
          onChange={setOperands}
          labels={operator === 'addition' ? ['addend', 'addend'] : ['minuend', 'subtrahend']}
        />
      </div>

      {isLoading ? (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minH: '200px',
            color: 'gray.400',
            fontSize: 'sm',
          })}
        >
          Generating preview...
        </div>
      ) : svg ? (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minH: '200px',
            '& svg': {
              maxW: 'full',
              h: 'auto',
            },
          })}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
    </div>
  )
}

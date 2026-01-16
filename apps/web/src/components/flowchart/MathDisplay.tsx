'use client'

import { css } from '../../../styled-system/css'
import { hstack } from '../../../styled-system/patterns'

interface MathDisplayProps {
  /** Math expression string to render (e.g., "3 2/9 − 1 1/2" or "2x = 12") */
  expression: string
  /** Font size for the display */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * Renders math expressions with proper fraction formatting.
 * Parses strings like "3 2/9 − 1 1/2" and renders fractions stacked.
 */
export function MathDisplay({ expression, size = 'lg' }: MathDisplayProps) {
  const fontSize = {
    sm: '1rem',
    md: '1.25rem',
    lg: '1.5rem',
    xl: '2rem',
  }[size]

  // Parse the expression into tokens
  const tokens = parseExpression(expression)

  return (
    <span
      className={hstack({
        gap: '2',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      })}
      style={{ fontSize }}
    >
      {tokens.map((token, idx) => (
        <span key={idx}>{renderToken(token)}</span>
      ))}
    </span>
  )
}

type Token =
  | { type: 'number'; value: string }
  | { type: 'fraction'; numerator: string; denominator: string }
  | { type: 'mixed'; whole: string; numerator: string; denominator: string }
  | { type: 'operator'; value: string }
  | { type: 'variable'; name: string }
  | { type: 'term'; coefficient: string; variable: string }
  | { type: 'text'; value: string }

function parseExpression(expr: string): Token[] {
  const tokens: Token[] = []
  // Split by spaces but keep operators together
  const parts = expr.split(/\s+/)

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]

    // Check if it's an operator
    if (['−', '-', '+', '×', '÷', '=', '→'].includes(part)) {
      tokens.push({ type: 'operator', value: part })
      continue
    }

    // Check if it's a fraction (contains /)
    if (part.includes('/')) {
      const [num, denom] = part.split('/')
      // Check if previous token was a plain number (making this a mixed number)
      const prev = tokens[tokens.length - 1]
      if (prev && prev.type === 'number') {
        // Convert previous number + this fraction to mixed number
        tokens.pop()
        tokens.push({
          type: 'mixed',
          whole: prev.value,
          numerator: num,
          denominator: denom,
        })
      } else {
        tokens.push({ type: 'fraction', numerator: num, denominator: denom })
      }
      continue
    }

    // Check if it's a plain number
    if (/^-?\d+$/.test(part)) {
      tokens.push({ type: 'number', value: part })
      continue
    }

    // Check if it's a term like "2x" or "3y" (coefficient + variable)
    const termMatch = part.match(/^(-?\d*)([a-zA-Z])$/)
    if (termMatch) {
      const [, coef, varName] = termMatch
      if (coef === '' || coef === '-') {
        // Just "x" or "-x"
        tokens.push({ type: 'variable', name: coef === '-' ? `-${varName}` : varName })
      } else {
        tokens.push({ type: 'term', coefficient: coef, variable: varName })
      }
      continue
    }

    // Check if it's a single variable
    if (/^[a-zA-Z]$/.test(part)) {
      tokens.push({ type: 'variable', name: part })
      continue
    }

    // Otherwise it's text
    tokens.push({ type: 'text', value: part })
  }

  return tokens
}

function renderToken(token: Token): React.ReactNode {
  switch (token.type) {
    case 'number':
      return (
        <span className={css({ fontWeight: 'bold' })}>{token.value}</span>
      )

    case 'fraction':
      return (
        <span
          className={css({
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            verticalAlign: 'middle',
            lineHeight: 1.1,
          })}
        >
          <span className={css({ fontWeight: 'bold' })}>{token.numerator}</span>
          <span
            className={css({
              width: '100%',
              height: '2px',
              backgroundColor: 'currentColor',
              margin: '1px 0',
            })}
          />
          <span className={css({ fontWeight: 'bold' })}>{token.denominator}</span>
        </span>
      )

    case 'mixed':
      return (
        <span className={hstack({ gap: '1', alignItems: 'center' })}>
          <span className={css({ fontWeight: 'bold' })}>{token.whole}</span>
          <span
            className={css({
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              verticalAlign: 'middle',
              lineHeight: 1.1,
              fontSize: '0.85em',
            })}
          >
            <span className={css({ fontWeight: 'bold' })}>{token.numerator}</span>
            <span
              className={css({
                width: '100%',
                height: '2px',
                backgroundColor: 'currentColor',
                margin: '1px 0',
              })}
            />
            <span className={css({ fontWeight: 'bold' })}>{token.denominator}</span>
          </span>
        </span>
      )

    case 'operator':
      return (
        <span
          className={css({
            fontWeight: 'normal',
            padding: '0 0.25em',
            opacity: 0.8,
          })}
        >
          {token.value}
        </span>
      )

    case 'variable':
      return (
        <span
          className={css({
            fontWeight: 'bold',
            fontStyle: 'italic',
            color: 'purple.600',
          })}
        >
          {token.name}
        </span>
      )

    case 'term':
      return (
        <span className={css({ display: 'inline-flex', alignItems: 'baseline' })}>
          <span className={css({ fontWeight: 'bold' })}>{token.coefficient}</span>
          <span
            className={css({
              fontWeight: 'bold',
              fontStyle: 'italic',
              color: 'purple.600',
            })}
          >
            {token.variable}
          </span>
        </span>
      )

    case 'text':
      return (
        <span className={css({ fontWeight: 'bold' })}>{token.value}</span>
      )
  }
}

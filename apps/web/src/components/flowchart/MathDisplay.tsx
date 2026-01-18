'use client'

import { css } from '../../../styled-system/css'

interface MathDisplayProps {
  /** Math expression string to render (e.g., "3 2/9 − 1 1/2" or "2x = 12") */
  expression: string
  /** Font size for the display */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * Math font stack optimized for MathML rendering.
 * STIX Two Math is the gold standard for web math typography.
 * Fallbacks include system math fonts and common alternatives.
 */
const mathFontFamily = [
  '"STIX Two Math"',
  '"Cambria Math"',
  '"Latin Modern Math"',
  '"XITS Math"',
  'math',
  'serif',
].join(', ')

/**
 * Renders math expressions using native MathML.
 * Parses strings like "3 2/9 − 1 1/2" and renders proper semantic math.
 *
 * Browser support: 94%+ (Chrome 109+, Firefox, Safari 10+, Edge 109+)
 */
export function MathDisplay({ expression, size = 'lg' }: MathDisplayProps) {
  const fontSize = {
    sm: '1.25rem',
    md: '1.5rem',
    lg: '1.75rem',
    xl: '2.25rem',
  }[size]

  // Parse the expression into tokens
  const tokens = parseExpression(expression)

  return (
    <math
      data-testid="math-display"
      data-expression={expression}
      data-size={size}
      data-token-count={tokens.length}
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
      })}
      style={{ fontSize, fontFamily: mathFontFamily }}
    >
      <mrow>{tokens.map((token, idx) => renderToken(token, idx))}</mrow>
    </math>
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
      if (coef === '' || coef === '-' || coef === '1' || coef === '-1') {
        // Coefficient of 1 is implicit: "1x" → "x", "-1x" → "-x"
        const isNegative = coef === '-' || coef === '-1'
        tokens.push({ type: 'variable', name: isNegative ? `-${varName}` : varName })
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

function renderToken(token: Token, key: number): React.ReactNode {
  switch (token.type) {
    case 'number':
      return <mn key={key}>{token.value}</mn>

    case 'fraction':
      return (
        <mfrac key={key}>
          <mn>{token.numerator}</mn>
          <mn>{token.denominator}</mn>
        </mfrac>
      )

    case 'mixed':
      return (
        <mrow key={key}>
          <mn>{token.whole}</mn>
          <mfrac>
            <mn>{token.numerator}</mn>
            <mn>{token.denominator}</mn>
          </mfrac>
        </mrow>
      )

    case 'operator':
      return <mo key={key}>{token.value}</mo>

    case 'variable':
      return <mi key={key}>{token.name}</mi>

    case 'term':
      return (
        <mrow key={key}>
          <mn>{token.coefficient}</mn>
          <mi>{token.variable}</mi>
        </mrow>
      )

    case 'text':
      return <mtext key={key}>{token.value}</mtext>
  }
}

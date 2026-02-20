'use client'

import type { EquationForm, Fraction, MixedNumber } from './types'
import { toMixedNumber, isInteger, toStandardForm } from './fractionMath'

export type EquationDisplayForm = 'slope-intercept' | 'standard'

/**
 * Math font stack — same chain as MathDisplay.tsx
 */
const mathFontFamily = [
  '"STIX Two Math"',
  '"Cambria Math"',
  '"Latin Modern Math"',
  '"XITS Math"',
  'math',
  'serif',
].join(', ')

// ── MathML helpers ─────────────────────────────────────────────────

/** Render a mixed number as MathML nodes */
function MixedNumberMml({ m }: { m: MixedNumber }) {
  // Pure integer
  if (m.fracNum === 0) {
    return <mn>{m.negative ? `\u2212${m.whole}` : `${m.whole}`}</mn>
  }

  // Pure fraction (no whole part)
  if (m.whole === 0) {
    return (
      <mrow>
        {m.negative && <mo>&minus;</mo>}
        <mfrac>
          <mn>{m.fracNum}</mn>
          <mn>{m.fracDen}</mn>
        </mfrac>
      </mrow>
    )
  }

  // Mixed number
  return (
    <mrow>
      <mn>{m.negative ? `\u2212${m.whole}` : `${m.whole}`}</mn>
      <mfrac>
        <mn>{m.fracNum}</mn>
        <mn>{m.fracDen}</mn>
      </mfrac>
    </mrow>
  )
}

/** Render a fraction (possibly mixed) as MathML */
function FractionMml({ f }: { f: Fraction }) {
  return <MixedNumberMml m={toMixedNumber(f)} />
}

/** Render the slope coefficient with variable x */
function SlopeTerm({ slope }: { slope: Fraction }) {
  const m = toMixedNumber(slope)

  // slope = 1: just "x"
  if (slope.num === 1 && slope.den === 1) {
    return <mi>x</mi>
  }

  // slope = -1: "−x"
  if (slope.num === -1 && slope.den === 1) {
    return (
      <mrow>
        <mo>&minus;</mo>
        <mi>x</mi>
      </mrow>
    )
  }

  // Integer slope
  if (isInteger(slope)) {
    return (
      <mrow>
        <mn>{slope.num}</mn>
        <mi>x</mi>
      </mrow>
    )
  }

  // Fractional slope: render as mixed number then x
  return (
    <mrow>
      {m.negative && <mo>&minus;</mo>}
      {m.whole > 0 && <mn>{m.whole}</mn>}
      <mfrac>
        <mn>{m.fracNum}</mn>
        <mn>{m.fracDen}</mn>
      </mfrac>
      <mi>x</mi>
    </mrow>
  )
}

// ── Main component ─────────────────────────────────────────────────

interface RulerEquationLabelProps {
  equation: EquationForm
  /** Which equation form to display (only affects 'general' equations) */
  equationForm?: EquationDisplayForm
  /** Screen position (px) — driven by sliderT, not always midpoint */
  screenX: number
  screenY: number
  /** Angle of the ruler line in radians */
  angle: number
  isDark: boolean
  /** Whether the equation probe is currently being dragged */
  isDragging?: boolean
  /** Pointer-down handler for the card */
  onIndicatorPointerDown?: (e: React.PointerEvent) => void
  /** Ref to the outer positioned container — used by RAF loop for position sync */
  containerRef?: React.MutableRefObject<HTMLDivElement | null>
}

export function RulerEquationLabel({
  equation,
  equationForm = 'slope-intercept',
  screenX,
  screenY,
  angle,
  isDark,
  isDragging = false,
  onIndicatorPointerDown,
  containerRef,
}: RulerEquationLabelProps) {
  // Normalize angle to keep text readable (within ±90°)
  let displayAngle = angle
  while (displayAngle > Math.PI / 2) displayAngle -= Math.PI
  while (displayAngle < -Math.PI / 2) displayAngle += Math.PI

  // Offset the card above the ruler line so the canvas probe dot is visible.
  // Card height is constant (no dynamic content), so -50% centering is stable.
  const offsetPx = 18
  const perpX = -Math.sin(displayAngle) * offsetPx
  const perpY = Math.cos(displayAngle) * offsetPx

  const color = isDark ? 'rgba(226, 232, 240, 0.95)' : 'rgba(30, 41, 59, 0.95)'
  const bgColor = isDark ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.75)'

  return (
    <div
      ref={(el) => {
        if (containerRef) containerRef.current = el
      }}
      data-element="ruler-equation-label"
      style={{
        position: 'absolute',
        left: screenX + perpX,
        top: screenY + perpY,
        transform: `translate(-50%, -50%) rotate(${displayAngle}rad)`,
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        data-element="equation-probe-card"
        onPointerDown={onIndicatorPointerDown}
        style={{
          background: bgColor,
          backdropFilter: 'blur(6px)',
          borderRadius: 6,
          padding: '3px 8px',
          display: 'inline-block',
          pointerEvents: 'auto',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <math
          {...({ xmlns: 'http://www.w3.org/1998/Math/MathML' } as any)}
          style={{
            fontFamily: mathFontFamily,
            fontSize: 16,
            color,
          }}
        >
          <EquationMml equation={equation} equationForm={equationForm} />
        </math>
      </div>
    </div>
  )
}

// ── Equation MathML ────────────────────────────────────────────────

function EquationMml({
  equation,
  equationForm,
}: {
  equation: EquationForm
  equationForm: EquationDisplayForm
}) {
  switch (equation.kind) {
    case 'point':
      return (
        <mrow>
          <mo>(</mo>
          <mn>{equation.x}</mn>
          <mo>,</mo>
          <mn>{equation.y}</mn>
          <mo>)</mo>
        </mrow>
      )

    case 'vertical':
      return (
        <mrow>
          <mi>x</mi>
          <mo>=</mo>
          <mn>{equation.x}</mn>
        </mrow>
      )

    case 'horizontal':
      return (
        <mrow>
          <mi>y</mi>
          <mo>=</mo>
          <mn>{equation.y}</mn>
        </mrow>
      )

    case 'general':
      if (equationForm === 'standard') {
        return <StandardFormMml slope={equation.slope} intercept={equation.intercept} />
      }
      return <SlopeInterceptMml slope={equation.slope} intercept={equation.intercept} />
  }
}

/** Render y = mx + b */
function SlopeInterceptMml({ slope, intercept }: { slope: Fraction; intercept: Fraction }) {
  const hasIntercept = intercept.num !== 0
  const interceptNeg = intercept.num < 0

  // Special case: slope is 0 → y = b
  if (slope.num === 0) {
    return (
      <mrow>
        <mi>y</mi>
        <mo>=</mo>
        <FractionMml f={intercept} />
      </mrow>
    )
  }

  return (
    <mrow>
      <mi>y</mi>
      <mo>=</mo>
      <SlopeTerm slope={slope} />
      {hasIntercept && (
        <>
          <mo>{interceptNeg ? '\u2212' : '+'}</mo>
          <FractionMml f={interceptNeg ? { num: -intercept.num, den: intercept.den } : intercept} />
        </>
      )}
    </mrow>
  )
}

/** Render an integer coefficient with its variable as a term in standard form */
function StdTerm({
  coeff,
  variable,
  isFirst,
}: {
  coeff: number
  variable: string
  isFirst: boolean
}) {
  if (coeff === 0) return null

  const absCoeff = Math.abs(coeff)
  const neg = coeff < 0

  return (
    <>
      {isFirst ? (
        // First term: show minus sign as unary, no plus
        neg && <mo>&minus;</mo>
      ) : (
        // Subsequent terms: show + or −
        <mo>{neg ? '\u2212' : '+'}</mo>
      )}
      {absCoeff !== 1 && <mn>{absCoeff}</mn>}
      <mi>{variable}</mi>
    </>
  )
}

/** Render Ax + By = C */
function StandardFormMml({ slope, intercept }: { slope: Fraction; intercept: Fraction }) {
  const { a, b, c } = toStandardForm(slope, intercept)

  return (
    <mrow>
      {a !== 0 && <StdTerm coeff={a} variable="x" isFirst />}
      {b !== 0 && <StdTerm coeff={b} variable="y" isFirst={a === 0} />}
      <mo>=</mo>
      <mn>{c < 0 ? `\u2212${Math.abs(c)}` : `${c}`}</mn>
    </mrow>
  )
}

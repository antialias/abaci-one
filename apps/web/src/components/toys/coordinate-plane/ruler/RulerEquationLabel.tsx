'use client'

import type { EquationForm, Fraction, MixedNumber } from './types'
import { toMixedNumber, isInteger } from './fractionMath'

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
  /** Screen position (px) — driven by sliderT, not always midpoint */
  screenX: number
  screenY: number
  /** Angle of the ruler line in radians */
  angle: number
  isDark: boolean
  /** Whether the equation probe is currently being dragged */
  isDragging?: boolean
  /** Whether the spring snap-back animation is running */
  isSpringAnimating?: boolean
  /** Pointer-down handler for the indicator dot */
  onIndicatorPointerDown?: (e: React.PointerEvent) => void
  /** Nearby integer x grid line (from probe solving) */
  nearX?: number | null
  /** Nearby integer y grid line (from probe solving) */
  nearY?: number | null
  /** Solved y at nearby x grid line */
  solvedAtNearX?: { x: number; yFrac: Fraction } | null
  /** Solved x at nearby y grid line */
  solvedAtNearY?: { y: number; xFrac: Fraction } | null
  /** Ref to the outer positioned container — used by RAF loop for position sync */
  containerRef?: React.MutableRefObject<HTMLDivElement | null>
}

export function RulerEquationLabel({
  equation,
  screenX,
  screenY,
  angle,
  isDark,
  isDragging = false,
  isSpringAnimating = false,
  onIndicatorPointerDown,
  nearX,
  nearY,
  solvedAtNearX,
  solvedAtNearY,
  containerRef,
}: RulerEquationLabelProps) {
  // Normalize angle to keep text readable (within ±90°)
  let displayAngle = angle
  while (displayAngle > Math.PI / 2) displayAngle -= Math.PI
  while (displayAngle < -Math.PI / 2) displayAngle += Math.PI

  const color = isDark ? 'rgba(226, 232, 240, 0.95)' : 'rgba(30, 41, 59, 0.95)'
  const bgColor = isDark ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.75)'
  const showSolved = (isDragging || isSpringAnimating) && (nearX != null || nearY != null)

  return (
    <div
      ref={(el) => { if (containerRef) containerRef.current = el }}
      data-element="ruler-equation-label"
      style={{
        position: 'absolute',
        // Positioned at the ruler line; top edge pinned there, card grows downward.
        // Rotate around top-center so height changes never shift the top edge.
        left: screenX,
        top: screenY,
        transform: `translate(-50%, 0) rotate(${displayAngle}rad)`,
        transformOrigin: '50% 0',
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Card — entire area is the grab target; cursor: grab provides affordance */}
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
          {...{ xmlns: 'http://www.w3.org/1998/Math/MathML' } as any}
          style={{
            fontFamily: mathFontFamily,
            fontSize: 16,
            color,
          }}
        >
          <EquationMml equation={equation} />
        </math>

        {/* Solved coordinates row */}
        {showSolved && (
          <div
            data-element="equation-solved-coords"
            style={{ marginTop: 2 }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <math
              {...{ xmlns: 'http://www.w3.org/1998/Math/MathML' } as any}
              style={{
                fontFamily: mathFontFamily,
                fontSize: 13,
                color: isDark ? 'rgba(165, 180, 252, 0.95)' : 'rgba(79, 70, 229, 0.95)',
              }}
            >
              <SolvedCoordsMml
                nearX={nearX ?? null}
                nearY={nearY ?? null}
                solvedAtNearX={solvedAtNearX ?? null}
                solvedAtNearY={solvedAtNearY ?? null}
              />
            </math>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Solved coordinates MathML ─────────────────────────────────────

function SolvedCoordsMml({
  nearX,
  nearY,
  solvedAtNearX,
  solvedAtNearY,
}: {
  nearX: number | null
  nearY: number | null
  solvedAtNearX: { x: number; yFrac: Fraction } | null
  solvedAtNearY: { y: number; xFrac: Fraction } | null
}) {
  // Show x = N, y = fraction when near an x grid line
  if (nearX != null && solvedAtNearX) {
    return (
      <mrow>
        <mo>(</mo>
        <mn>{solvedAtNearX.x}</mn>
        <mo>,</mo>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <mspace {...{ width: '0.2em' } as any} />
        <FractionMml f={solvedAtNearX.yFrac} />
        <mo>)</mo>
      </mrow>
    )
  }

  // Show y = N, x = fraction when near a y grid line
  if (nearY != null && solvedAtNearY) {
    return (
      <mrow>
        <mo>(</mo>
        <FractionMml f={solvedAtNearY.xFrac} />
        <mo>,</mo>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <mspace {...{ width: '0.2em' } as any} />
        <mn>{solvedAtNearY.y}</mn>
        <mo>)</mo>
      </mrow>
    )
  }

  return null
}

// ── Equation MathML ────────────────────────────────────────────────

function EquationMml({ equation }: { equation: EquationForm }) {
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

    case 'general': {
      const { slope, intercept } = equation
      const hasIntercept = intercept.num !== 0
      const interceptNeg = intercept.num < 0

      return (
        <mrow>
          <SlopeTerm slope={slope} />
          {hasIntercept && (
            <>
              <mo>{interceptNeg ? '\u2212' : '+'}</mo>
              <FractionMml
                f={interceptNeg ? { num: -intercept.num, den: intercept.den } : intercept}
              />
            </>
          )}
          <mo>=</mo>
          <mi>y</mi>
        </mrow>
      )
    }
  }
}

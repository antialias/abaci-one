'use client'

import type { PrimeTickInfo } from '../types'
import { factorize } from './sieve'
import { primeColorHex } from './primeColors'
import { getSpecialPrimeLabels, LABEL_COLORS } from './specialPrimes'
import type { SpecialPrimeLabel } from './specialPrimes'

interface PrimeTooltipProps {
  value: number
  primeInfo: PrimeTickInfo
  /** Screen X position of the tick (CSS px) */
  screenX: number
  /** Y position below the tick label area (CSS px) */
  tooltipY: number
  /** Width of the canvas container (CSS px) */
  containerWidth: number
  isDark: boolean
  /** Optional note from landmark/interestingness data (e.g., "Record gap of 72") */
  landmarkNote?: string
  /** When provided, shows a "Take the tour!" link for prime numbers */
  onStartTour?: () => void
  /** Called when the mouse enters/leaves the tooltip (to prevent hover-clear) */
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

const TOOLTIP_PAD = 8

/**
 * Format an exponent as a superscript string using Unicode superscript digits.
 */
function superscript(n: number): string {
  const superDigits = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079'
  return String(n).split('').map(d => superDigits[parseInt(d)]).join('')
}

function SpecialLabel({ label, isDark }: { label: SpecialPrimeLabel; isDark: boolean }) {
  const color = LABEL_COLORS[label.type][isDark ? 'dark' : 'light']
  return (
    <div
      data-element="special-prime-label"
      style={{
        fontSize: 10,
        color,
        marginTop: 2,
        lineHeight: 1.3,
      }}
    >
      {label.text}
    </div>
  )
}

export function PrimeTooltip({
  value,
  primeInfo,
  screenX,
  tooltipY,
  containerWidth,
  isDark,
  landmarkNote,
  onStartTour,
  onMouseEnter,
  onMouseLeave,
}: PrimeTooltipProps) {
  const bg = isDark ? 'rgba(30, 30, 40, 0.92)' : 'rgba(255, 255, 255, 0.92)'
  const textColor = isDark ? '#f3f4f6' : '#1f2937'

  // Get special properties for primes
  const specialLabels = primeInfo.isPrime ? getSpecialPrimeLabels(value) : []

  // Show tour link for primes
  const showTourLink = primeInfo.isPrime && onStartTour

  // Wider tooltip when there are special properties or landmark notes
  const tooltipWidth = (specialLabels.length > 0 || landmarkNote || showTourLink) ? 220 : 180

  // Clamp horizontal position
  const clampedX = Math.max(TOOLTIP_PAD, Math.min(containerWidth - tooltipWidth - TOOLTIP_PAD, screenX - tooltipWidth / 2))

  let mainContent: React.ReactNode

  if (primeInfo.classification === 'one') {
    mainContent = (
      <span data-element="tooltip-text" style={{ color: textColor, fontSize: 12 }}>
        <strong>1</strong> is neither prime nor composite
      </span>
    )
  } else if (primeInfo.isPrime) {
    const color = primeColorHex(value, isDark)
    mainContent = (
      <span data-element="tooltip-text" style={{ color: textColor, fontSize: 12 }}>
        <span
          data-element="prime-dot"
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: color,
            marginRight: 6,
            verticalAlign: 'middle',
          }}
        />
        <strong>{value}</strong> is prime
      </span>
    )
  } else {
    // Composite: show factorization with colored factors
    const factors = factorize(value)
    mainContent = (
      <span data-element="tooltip-text" style={{ color: textColor, fontSize: 12 }}>
        <strong>{value}</strong>
        {' = '}
        {factors.map((f, i) => (
          <span key={f.prime}>
            {i > 0 && ' \u00d7 '}
            <span style={{ color: primeColorHex(f.prime, isDark), fontWeight: 600 }}>
              {f.prime}
              {f.exponent > 1 && superscript(f.exponent)}
            </span>
          </span>
        ))}
      </span>
    )
  }

  return (
    <div
      data-component="prime-tooltip"
      onMouseEnter={showTourLink ? onMouseEnter : undefined}
      onMouseLeave={showTourLink ? onMouseLeave : undefined}
      style={{
        position: 'absolute',
        left: clampedX,
        top: tooltipY,
        width: tooltipWidth,
        padding: '6px 10px',
        borderRadius: 8,
        backgroundColor: bg,
        backdropFilter: 'blur(8px)',
        boxShadow: isDark
          ? '0 2px 12px rgba(0,0,0,0.5)'
          : '0 2px 12px rgba(0,0,0,0.1)',
        zIndex: 10,
        pointerEvents: showTourLink ? 'auto' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {mainContent}
      {specialLabels.length > 0 && (
        <div data-element="special-labels" style={{ marginTop: 3, paddingTop: 3, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
          {specialLabels.map((label, i) => (
            <SpecialLabel key={i} label={label} isDark={isDark} />
          ))}
        </div>
      )}
      {landmarkNote && (
        <div
          data-element="landmark-note"
          style={{
            fontSize: 10,
            color: isDark ? '#ffa070' : '#a04020',
            marginTop: 3,
            paddingTop: specialLabels.length > 0 ? 0 : 3,
            borderTop: specialLabels.length > 0 ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            lineHeight: 1.3,
            fontStyle: 'italic',
          }}
        >
          {landmarkNote}
        </div>
      )}
      {showTourLink && (
        <div
          data-element="tour-link"
          style={{
            marginTop: 4,
            paddingTop: 4,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <button
            data-action="start-prime-tour"
            onClick={onStartTour}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              fontSize: 11,
              fontWeight: 600,
              color: isDark ? '#c4b5fd' : '#7c3aed',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            Explore primes
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import type React from 'react'
import { CITATIONS } from '../engine/citations'
import { getFoundationHref } from '../foundations/citationUtils'
import { PROOF_COLORS, PROOF_FONTS, getProofFontSizes } from './styles'

interface StepCitationProps {
  citationKey: string
  /** Override label text (for progressive disclosure) */
  label?: string
  /** Show definition text after label */
  showText?: boolean
  /** Color for the citation block (state-aware: green for done steps, blue for current) */
  color?: string
  /** Font size for the citation text block */
  fontSize?: number
  /** Font size for the label specifically */
  citationFontSize?: number
  /** Line height */
  lineHeight?: number
  /** Link wrapping */
  href?: string | null
  /** Popover interaction (pointer handlers receive citationKey) */
  onPointerEnter?: (key: string, e: React.PointerEvent) => void
  onPointerLeave?: () => void
  onPointerDown?: (key: string, e: React.PointerEvent) => void
  isMobile?: boolean
}

/**
 * Renders the italic citation text block below a proof step's instruction.
 *
 * Example output:
 *   Post.1 — To draw a straight-line from any point to any point.
 *
 * Label is bold non-italic. If citationKey is a foundation (Post/Def/C.N.) or
 * proposition (I.*), the label is wrapped in a link. Definition text follows
 * after an em-dash separator.
 *
 * Extracted from GuidedProofPanel's inline citation rendering for reuse in
 * both guided proof and playground ledger panels.
 */
export function StepCitation({
  citationKey,
  label,
  showText,
  color,
  fontSize,
  citationFontSize,
  lineHeight,
  href: hrefProp,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  isMobile,
}: StepCitationProps) {
  const cit = CITATIONS[citationKey]
  const displayLabel = label ?? citationKey
  const displayColor = color ?? '#7893ab'

  // Determine href: explicit prop takes precedence, then auto-detect
  const foundationHref = getFoundationHref(citationKey)
  const isProposition = /^I\./.test(citationKey)
  const autoHref = foundationHref ?? (isProposition ? `/toys/euclid/${citationKey.replace('I.', '')}` : null)
  const href = hrefProp !== undefined ? hrefProp : autoHref
  const isLink = href != null

  const proofFont = getProofFontSizes(isMobile ?? false)
  const blockFontSize = fontSize ?? proofFont.stepText
  const labelFontSize = citationFontSize ?? proofFont.citation
  const blockLineHeight = lineHeight ?? (isMobile ? 1.25 : 1.4)

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontStyle: 'normal',
    fontSize: labelFontSize,
  }

  return (
    <div
      data-element="citation-text"
      style={{
        marginTop: 4,
        fontSize: blockFontSize,
        lineHeight: blockLineHeight,
        color: displayColor,
        fontFamily: PROOF_FONTS.serif,
        fontStyle: 'italic',
      }}
    >
      {isLink ? (
        <a
          href={href!}
          target="_blank"
          rel="noopener noreferrer"
          onPointerEnter={onPointerEnter ? (e) => onPointerEnter(citationKey, e) : undefined}
          onPointerLeave={onPointerLeave}
          onPointerDown={onPointerDown ? (e) => onPointerDown(citationKey, e) : undefined}
          style={{
            ...labelStyle,
            color: 'inherit',
            textDecoration: 'underline',
            textDecorationColor: PROOF_COLORS.citationUnderline,
            cursor: 'pointer',
          }}
        >
          {displayLabel}
        </a>
      ) : (
        <span
          style={labelStyle}
          onPointerEnter={onPointerEnter ? (e) => onPointerEnter(citationKey, e) : undefined}
          onPointerLeave={onPointerLeave}
          onPointerDown={onPointerDown ? (e) => onPointerDown(citationKey, e) : undefined}
        >
          {displayLabel}
        </span>
      )}
      {showText && cit?.text && <span style={{ marginLeft: 4 }}>&mdash; {cit.text}</span>}
    </div>
  )
}

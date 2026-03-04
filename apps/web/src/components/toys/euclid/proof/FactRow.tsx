'use client'

import type React from 'react'
import type { ProofFact } from '../engine/facts'
import type { CitationDef } from '../engine/citations'
import { getFoundationHref } from '../foundations/citationUtils'
import { PROOF_COLORS, PROOF_FONTS } from './styles'

interface FactRowCitation {
  def: CitationDef | null
  /** Display label (may be abbreviated) */
  label: string | null
  /** Whether to show the full definition text */
  showText: boolean
  onPointerEnter?: (key: string, e: React.PointerEvent) => void
  onPointerLeave?: () => void
  onPointerDown?: (key: string, e: React.PointerEvent) => void
}

interface FactRowProps {
  fact: ProofFact
  highlighted?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  citation?: FactRowCitation
  explanation?: string
  fontSize?: number
  /** Extra left padding (for conclusion facts positioned under step indicators) */
  paddingLeft?: number
  /** Border color when not highlighted (default: factBorder) */
  borderColor?: string
}

export function FactRow({
  fact,
  highlighted = false,
  onMouseEnter,
  onMouseLeave,
  citation,
  explanation,
  fontSize = 12,
  paddingLeft = 8,
  borderColor = PROOF_COLORS.factBorder,
}: FactRowProps) {
  const citDef = citation?.def
  const citLabel = citation?.label
  const foundationHref = citDef ? getFoundationHref(citDef.key) : null
  const isLink = citDef && (foundationHref || citDef.key.match(/^I\./))
  const href = isLink ? (foundationHref ?? `/toys/euclid/${citDef!.key.replace('I.', '')}`) : null

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        fontSize,
        marginBottom: 3,
        paddingLeft,
        cursor: 'default',
        borderLeft: highlighted
          ? `2px solid ${PROOF_COLORS.factBorderHighlighted}`
          : `2px solid ${borderColor}`,
        background: highlighted ? PROOF_COLORS.factBgHighlighted : 'transparent',
        borderRadius: highlighted ? 2 : 0,
        transition: 'all 0.15s ease',
      }}
    >
      <div>
        <span
          style={{
            color: PROOF_COLORS.factStatement,
            fontWeight: 600,
            fontFamily: PROOF_FONTS.serif,
          }}
        >
          {fact.statement}
        </span>
        {citLabel && citDef && (
          <>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onPointerEnter={
                  citation?.onPointerEnter
                    ? (e) => citation.onPointerEnter!(citDef.key, e)
                    : undefined
                }
                onPointerLeave={citation?.onPointerLeave}
                onPointerDown={
                  citation?.onPointerDown
                    ? (e) => citation.onPointerDown!(citDef.key, e)
                    : undefined
                }
                style={{
                  color: PROOF_COLORS.textMuted,
                  fontFamily: PROOF_FONTS.serif,
                  fontSize: Math.max(fontSize - 2, 9),
                  fontWeight: 600,
                  marginLeft: 6,
                  textDecoration: 'underline',
                  textDecorationColor: PROOF_COLORS.citationUnderline,
                  cursor: 'pointer',
                }}
              >
                [{citLabel}]
              </a>
            ) : (
              <span
                style={{
                  color: PROOF_COLORS.textMuted,
                  fontFamily: PROOF_FONTS.serif,
                  fontSize: Math.max(fontSize - 2, 9),
                  fontWeight: 600,
                  marginLeft: 6,
                }}
              >
                [{citLabel}]
              </span>
            )}
          </>
        )}
      </div>
      {citation?.showText && citDef?.text && (
        <div
          style={{
            color: PROOF_COLORS.textMuted,
            fontStyle: 'italic',
            fontFamily: PROOF_FONTS.serif,
            fontSize: Math.max(fontSize - 2, 9),
            lineHeight: 1.3,
            marginTop: 1,
          }}
        >
          {citDef.text}
        </div>
      )}
      {explanation && (
        <div
          style={{
            color: PROOF_COLORS.textMuted,
            fontStyle: 'italic',
            fontFamily: PROOF_FONTS.serif,
            fontSize: Math.max(fontSize - 2, 9),
            lineHeight: 1.3,
            marginTop: 1,
          }}
        >
          {explanation}
        </div>
      )}
    </div>
  )
}

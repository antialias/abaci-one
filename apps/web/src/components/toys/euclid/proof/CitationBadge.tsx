'use client'

import type React from 'react'
import { PROOF_COLORS, PROOF_FONTS } from './styles'

/** Determine badge color from citation key */
export function citationColor(key: string | null): string {
  if (!key) return PROOF_COLORS.citationDefault
  if (key === 'Given') return PROOF_COLORS.citationGiven
  if (key.startsWith('Post.')) return PROOF_COLORS.citationPostulate
  if (key.startsWith('I.')) return PROOF_COLORS.citationProposition
  return PROOF_COLORS.citationDefault
}

interface CitationBadgeProps {
  citationKey: string | null
  /** Override label (for progressive disclosure abbreviation) */
  label?: string | null
  /** Show definition text after badge */
  showText?: boolean
  /** Citation definition text to show */
  citationText?: string | null
  /** Wrap in <a> if provided */
  href?: string | null
  onPointerEnter?: (e: React.PointerEvent) => void
  onPointerLeave?: () => void
  onPointerDown?: (e: React.PointerEvent) => void
  fontSize?: number
  /** Color override (for step-level vs fact-level badges) */
  color?: string
  /** Whether to apply link-style underline decoration */
  linkStyle?: boolean
}

export function CitationBadge({
  citationKey,
  label,
  showText,
  citationText,
  href,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  fontSize = 10,
  color,
  linkStyle,
}: CitationBadgeProps) {
  if (!citationKey) return null

  const displayLabel = label ?? citationKey
  const badgeColor = color ?? citationColor(citationKey)

  const badgeStyle: React.CSSProperties = {
    fontWeight: 600,
    fontStyle: 'normal',
    fontSize,
    color: badgeColor,
    ...(linkStyle
      ? {
          textDecoration: 'underline',
          textDecorationColor: PROOF_COLORS.citationUnderline,
          cursor: 'pointer',
        }
      : {}),
  }

  const textStyle: React.CSSProperties = {
    fontWeight: 400,
    fontStyle: 'italic',
    fontFamily: PROOF_FONTS.serif,
    color: PROOF_COLORS.textMuted,
    marginLeft: 4,
  }

  if (href) {
    return (
      <span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onPointerDown={onPointerDown}
          style={{
            ...badgeStyle,
            textDecoration: 'underline',
            textDecorationColor: PROOF_COLORS.citationUnderline,
            cursor: 'pointer',
          }}
        >
          [{displayLabel}]
        </a>
        {showText && citationText && <span style={textStyle}>— {citationText}</span>}
      </span>
    )
  }

  return (
    <span>
      <span
        style={badgeStyle}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
      >
        [{displayLabel}]
      </span>
      {showText && citationText && <span style={textStyle}>— {citationText}</span>}
    </span>
  )
}

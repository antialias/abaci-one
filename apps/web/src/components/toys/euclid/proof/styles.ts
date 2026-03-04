import type React from 'react'

export const PROOF_COLORS = {
  background: '#FAFAF0',
  text: '#475569',
  textMuted: '#94a3b8',
  textGiven: '#78716c',
  textDark: '#334155',
  textCurrent: '#1e293b',
  // Citation badge colors by type
  citationPostulate: '#6b9b6b',
  citationProposition: '#4E79A7',
  citationGiven: '#8b7355',
  citationDefault: '#94a3b8',
  // Step indicator
  stepDone: '#10b981',
  stepDoneHover: '#0d9668',
  stepCurrent: '#4E79A7',
  stepFuture: '#e2e8f0',
  stepFutureText: '#94a3b8',
  // Facts
  factStatement: '#4E79A7',
  factBorder: 'rgba(78, 121, 167, 0.2)',
  factBorderHighlighted: '#10b981',
  factBgHighlighted: 'rgba(16, 185, 129, 0.08)',
  // Completion
  proven: '#10b981',
  unproven: '#ef4444',
  // Step hover
  stepHoverBg: 'rgba(16, 185, 129, 0.06)',
  // Citation link underline
  citationUnderline: 'rgba(16, 185, 129, 0.45)',
  // Guidance
  guidanceBg: 'rgba(78, 121, 167, 0.06)',
  guidanceBorder: 'rgba(78, 121, 167, 0.15)',
  guidanceText: '#4E79A7',
} as const

export const PROOF_FONTS = {
  serif: 'Georgia, serif',
  sans: 'system-ui, sans-serif',
} as const

export interface ProofFontSizes {
  header: number
  title: number
  stepTitle: number
  stepText: number
  hint: number
  citation: number
  conclusion: number
}

export function getProofFontSizes(isMobile: boolean): ProofFontSizes {
  return {
    header: isMobile ? 11 : 14,
    title: isMobile ? 11 : 14,
    stepTitle: isMobile ? 11 : 13,
    stepText: isMobile ? 10 : 12,
    hint: isMobile ? 9 : 11,
    citation: isMobile ? 9 : 10,
    conclusion: isMobile ? 12 : 15,
  }
}

export const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: PROOF_COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontFamily: PROOF_FONTS.sans,
}

export const EMPTY_STATE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontFamily: PROOF_FONTS.serif,
  fontStyle: 'italic',
  color: PROOF_COLORS.textMuted,
  margin: '8px 0',
}

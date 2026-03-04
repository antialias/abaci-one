'use client'

/**
 * Ghost preview entry shown at the bottom of the construction log
 * while a tool action is in progress. Renders the same StepIndicator +
 * ProofInstruction + StepCitation components as a committed entry but
 * with reduced opacity and a pulsing current-step indicator to signal
 * its incomplete nature.
 */

import type React from 'react'
import type { EuclidEntityRef } from '../chat/parseGeometricEntities'
import { StepIndicator } from '../proof/StepIndicator'
import { StepCitation } from '../proof/StepCitation'
import { ProofInstruction } from '../proof/ProofInstruction'
import { PROOF_COLORS, PROOF_FONTS, getProofFontSizes } from '../proof/styles'

interface LedgerPreviewEntryProps {
  citation: string | null
  markedDescription: string
  stepNumber: number
  renderEntity: (entity: EuclidEntityRef, displayText: string, index: number) => React.ReactNode
  isMobile?: boolean
}

export function LedgerPreviewEntry({
  citation,
  markedDescription,
  stepNumber,
  renderEntity,
  isMobile,
}: LedgerPreviewEntryProps) {
  const proofFont = getProofFontSizes(isMobile ?? false)

  return (
    <div
      data-element="ledger-preview"
      style={{
        marginBottom: isMobile ? 8 : 12,
        borderRadius: 6,
        opacity: 0.45,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Step indicator — "current" state (blue pulsing) */}
        <StepIndicator
          state="current"
          stepNumber={stepNumber}
          isHovered={false}
          size={isMobile ? 18 : 20}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Instruction text */}
          <div
            data-element="ledger-description"
            style={{
              fontSize: proofFont.stepTitle,
              fontFamily: PROOF_FONTS.serif,
              lineHeight: isMobile ? 1.25 : 1.4,
              color: PROOF_COLORS.text,
            }}
          >
            <ProofInstruction text={markedDescription} renderEntity={renderEntity} />
          </div>

          {/* Citation block */}
          {citation && (
            <StepCitation
              citationKey={citation}
              ordinal={1}
              fontSize={proofFont.stepText}
              citationFontSize={proofFont.citation}
              lineHeight={isMobile ? 1.25 : 1.4}
              isMobile={isMobile}
            />
          )}
        </div>
      </div>
    </div>
  )
}

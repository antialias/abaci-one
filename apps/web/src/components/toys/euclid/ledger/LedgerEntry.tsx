'use client'

/**
 * Individual entry in the construction log.
 *
 * Uses the same shared proof components as GuidedProofPanel:
 * StepIndicator for the numbered circle, ProofInstruction for entity-marked
 * text, and StepCitation for the citation block below the instruction.
 *
 * Double-click the instruction to edit it (re-annotated via markup API).
 */

import type React from 'react'
import { useState, useRef, useEffect } from 'react'
import { stripEntityMarkers } from '@/lib/character/parseEntityMarkers'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'
import type { EuclidEntityRef } from '../chat/parseGeometricEntities'
import { StepIndicator } from '../proof/StepIndicator'
import { StepCitation } from '../proof/StepCitation'
import { ProofInstruction } from '../proof/ProofInstruction'
import { PROOF_COLORS, PROOF_FONTS, getProofFontSizes } from '../proof/styles'

interface LedgerEntryProps {
  index: number
  stepNumber?: number
  citation: string | null
  /** Progressive disclosure ordinal — passed to StepCitation */
  citationOrdinal?: number
  markedDescription: string
  isEditing: boolean
  isLoadingMarkup: boolean
  onStartEdit: () => void
  onCommitEdit: (text: string) => void
  onCancelEdit: () => void
  onRevert?: () => void
  renderEntity: (entity: EuclidEntityRef, displayText: string, index: number) => React.ReactNode
  onCitationPointerEnter?: (key: string, e: React.PointerEvent) => void
  onCitationPointerLeave?: () => void
  onCitationPointerDown?: (key: string, e: React.PointerEvent) => void
  isGiven?: boolean
  isMobile?: boolean
}

export function LedgerEntry({
  stepNumber,
  citation,
  citationOrdinal,
  markedDescription,
  isEditing,
  isLoadingMarkup,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onRevert,
  renderEntity,
  onCitationPointerEnter,
  onCitationPointerLeave,
  onCitationPointerDown,
  isGiven,
  isMobile,
}: LedgerEntryProps) {
  const [editText, setEditText] = useState('')
  const [isHovered, setIsHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const proofFont = getProofFontSizes(isMobile ?? false)

  useEffect(() => {
    if (isEditing) {
      // Initialize edit text from stripped markers
      setEditText(stripEntityMarkers(markedDescription, EUCLID_ENTITY_MARKERS))
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }
  }, [isEditing, markedDescription])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onCommitEdit(editText)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancelEdit()
    }
  }

  // Given entries: italic text with [Given] badge, no step indicator
  if (isGiven) {
    return (
      <div
        data-element="ledger-entry"
        style={{
          padding: '3px 0',
          paddingLeft: 8,
          borderLeft: `2px solid ${PROOF_COLORS.factBorder}`,
          opacity: 0.8,
        }}
      >
        <span
          data-element="ledger-description"
          style={{
            fontSize: proofFont.stepText,
            fontFamily: PROOF_FONTS.serif,
            lineHeight: 1.4,
            color: PROOF_COLORS.textGiven,
            fontStyle: 'italic',
          }}
        >
          <ProofInstruction text={markedDescription} renderEntity={renderEntity} />
          <span
            style={{
              color: PROOF_COLORS.textMuted,
              fontFamily: PROOF_FONTS.serif,
              fontSize: proofFont.citation,
              fontWeight: 600,
              fontStyle: 'normal',
              marginLeft: 6,
            }}
          >
            [Given]
          </span>
        </span>
      </div>
    )
  }

  // Action entries: StepIndicator + instruction + citation (matches GuidedProofPanel layout)
  return (
    <div
      data-element="ledger-entry"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        marginBottom: isMobile ? 8 : 12,
        borderRadius: 6,
        background: isHovered ? PROOF_COLORS.stepHoverBg : undefined,
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Step indicator — green done circle; click to rewind */}
        {stepNumber != null && (
          <StepIndicator
            state="done"
            stepNumber={stepNumber}
            isHovered={isHovered}
            onClick={onRevert}
            size={isMobile ? 18 : 20}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Instruction text (double-click to edit) */}
          <div
            data-element="ledger-description"
            onDoubleClick={isEditing ? undefined : onStartEdit}
            style={{
              fontSize: proofFont.stepTitle,
              fontFamily: PROOF_FONTS.serif,
              lineHeight: isMobile ? 1.25 : 1.4,
              color: PROOF_COLORS.text,
              cursor: 'pointer',
            }}
          >
            {isEditing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  ref={inputRef}
                  data-element="ledger-edit-input"
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={onCancelEdit}
                  style={{
                    flex: 1,
                    fontSize: proofFont.stepTitle,
                    fontFamily: PROOF_FONTS.serif,
                    border: '1px solid rgba(78, 121, 167, 0.3)',
                    borderRadius: 3,
                    padding: '2px 6px',
                    outline: 'none',
                    background: 'white',
                    color: PROOF_COLORS.text,
                  }}
                />
                {isLoadingMarkup && (
                  <span style={{ fontSize: 10, color: PROOF_COLORS.textMuted }}>...</span>
                )}
              </span>
            ) : (
              <ProofInstruction text={markedDescription} renderEntity={renderEntity} />
            )}
          </div>

          {/* Citation block below instruction */}
          {citation && (
            <StepCitation
              citationKey={citation}
              ordinal={citationOrdinal}
              color="#6b9b6b"
              fontSize={proofFont.stepText}
              citationFontSize={proofFont.citation}
              lineHeight={isMobile ? 1.25 : 1.4}
              onPointerEnter={onCitationPointerEnter}
              onPointerLeave={onCitationPointerLeave}
              onPointerDown={onCitationPointerDown}
              isMobile={isMobile}
            />
          )}
        </div>
      </div>
    </div>
  )
}

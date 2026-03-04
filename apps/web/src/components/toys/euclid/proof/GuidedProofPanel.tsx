'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type React from 'react'
import type { PropositionDef, PropositionStep, ConstructionState } from '../types'
import type { ProofFact } from '../engine/facts'
import { isAngleFact, distancePairKey, angleMeasureKey } from '../engine/facts'
import type { DistancePair } from '../engine/facts'
import { CITATIONS, citationDefFromFact } from '../engine/citations'
import type { FactStore } from '../engine/factStore'
import { getEqualDistances, getEqualAngles } from '../engine/factStore'
import { MarkedText } from '@/lib/character/MarkedText'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'
import type { EuclidEntityRef } from '../chat/parseGeometricEntities'
import { StepIndicator } from './StepIndicator'
import { StepCitation } from './StepCitation'
import { FactRow } from './FactRow'
import { computeCitationOrdinals } from './citationOrdinals'
import { PROOF_COLORS, PROOF_FONTS, SECTION_LABEL_STYLE, getProofFontSizes } from './styles'
import type { CompletionResult } from './types'

/** Group proof facts by their citation for highlight matching */
function citGroupKey(fact: ProofFact): string | null {
  const j = fact.justification
  const triMatch = j.match(/△\w+ ≅ △\w+/)
  if (triMatch) return `${fact.atStep}:tri:${triMatch[0]}`
  if (fact.citation.type === 'cn4') return `${fact.atStep}:cn4`
  return null
}

interface GuidedProofPanelProps {
  // Data
  proposition: PropositionDef
  steps: PropositionStep[]
  currentStep: number
  completedSteps: boolean[]
  isComplete: boolean
  proofFacts: ProofFact[]
  factsByStep: Map<number, ProofFact[]>
  completionResult: CompletionResult | null
  completionMeta?: {
    unlocked: number[]
    nextPropId: number | null
    onNavigateNext: (propId: number) => void
    onNavigateMap: () => void
  }
  currentInstruction: string
  constructionState: ConstructionState

  // Callbacks
  onRewindToStep: (stepIndex: number) => void
  advanceObservation: () => void
  onHoverMacroStep: (stepIndex: number | null) => void

  // Entity rendering
  renderEntity: (entity: EuclidEntityRef, displayText: string, index: number) => React.ReactNode
  renderEntitySubtle: (
    entity: EuclidEntityRef,
    displayText: string,
    index: number
  ) => React.ReactNode
  onHighlight: (entity: EuclidEntityRef | null) => void

  // Citation popover (rendered at root level by parent)
  onCitationPointerEnter: (key: string, e: React.PointerEvent) => void
  onCitationPointerLeave: () => void
  onCitationPointerDown: (key: string, e: React.PointerEvent) => void

  // Fact store ref for highlight computation
  factStoreRef: React.MutableRefObject<FactStore>

  // Layout
  isMobile: boolean
}

export function GuidedProofPanel({
  proposition,
  steps,
  currentStep,
  completedSteps,
  isComplete,
  proofFacts,
  factsByStep,
  completionResult,
  completionMeta,
  currentInstruction,
  constructionState,
  onRewindToStep,
  advanceObservation,
  onHoverMacroStep,
  renderEntity,
  renderEntitySubtle,
  onHighlight,
  onCitationPointerEnter,
  onCitationPointerLeave,
  onCitationPointerDown,
  factStoreRef,
  isMobile,
}: GuidedProofPanelProps) {
  const proofFont = getProofFontSizes(isMobile)

  // ── Internal state ──
  const [hoveredProofDp, setHoveredProofDp] = useState<DistancePair | null>(null)
  const [hoveredFactId, setHoveredFactId] = useState<number | null>(null)
  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null)

  // ── Citation ordinals (progressive disclosure) ──
  const citationOrdinals = useMemo(
    () => computeCitationOrdinals(steps, factsByStep),
    [steps, factsByStep]
  )

  // ── Highlight state ──
  const highlightState = useMemo(() => {
    const dpKeys = new Set<string>()
    const angleKeys = new Set<string>()
    let citGroup: string | null = null

    if (hoveredProofDp) {
      for (const dp of getEqualDistances(factStoreRef.current, hoveredProofDp)) {
        dpKeys.add(distancePairKey(dp))
      }
    }

    if (hoveredFactId != null) {
      const fact = proofFacts.find((f) => f.id === hoveredFactId)
      if (fact) {
        if (isAngleFact(fact)) {
          for (const am of getEqualAngles(factStoreRef.current, fact.left)) {
            angleKeys.add(angleMeasureKey(am))
          }
        } else {
          for (const dp of getEqualDistances(factStoreRef.current, fact.left)) {
            dpKeys.add(distancePairKey(dp))
          }
        }
        citGroup = citGroupKey(fact)
      }
    }

    return {
      dpKeys: dpKeys.size > 0 ? dpKeys : null,
      angleKeys: angleKeys.size > 0 ? angleKeys : null,
      citGroup,
    }
  }, [hoveredProofDp, hoveredFactId, proofFacts, factStoreRef])

  const isFactHighlighted = useCallback(
    (fact: ProofFact): boolean => {
      const { dpKeys, angleKeys, citGroup } = highlightState
      if (!isAngleFact(fact) && dpKeys != null) {
        if (dpKeys.has(distancePairKey(fact.left)) || dpKeys.has(distancePairKey(fact.right))) {
          return true
        }
      }
      if (isAngleFact(fact) && angleKeys != null) {
        if (
          angleKeys.has(angleMeasureKey(fact.left)) ||
          angleKeys.has(angleMeasureKey(fact.right))
        ) {
          return true
        }
      }
      if (citGroup != null && citGroupKey(fact) === citGroup) {
        return true
      }
      return false
    },
    [highlightState]
  )

  // ── Auto-scroll to current step ──
  const proofScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const container = proofScrollRef.current
    if (!container) return
    const active = container.querySelector('[data-step-current="true"]') as HTMLElement | null
    if (!active) return
    const pad = 8
    const top = active.offsetTop
    const bottom = top + active.offsetHeight
    if (top < container.scrollTop + pad) {
      container.scrollTop = top - pad
    } else if (bottom > container.scrollTop + container.clientHeight - pad) {
      container.scrollTop = bottom - container.clientHeight + pad
    }
  }, [currentStep])

  // ── Fact row citation helper ──
  const makeFactCitation = useCallback(
    (fact: ProofFact) => {
      const factCit = citationDefFromFact(fact.citation)
      if (!factCit) return undefined
      const ord = citationOrdinals.get(`fact-${fact.id}`) ?? 1
      return {
        def: factCit,
        label: ord <= 2 ? factCit.label : factCit.key,
        showText: ord === 1,
        onPointerEnter: onCitationPointerEnter,
        onPointerLeave: onCitationPointerLeave,
        onPointerDown: onCitationPointerDown,
      }
    },
    [citationOrdinals, onCitationPointerEnter, onCitationPointerLeave, onCitationPointerDown]
  )

  return (
    <>
      {/* Proposition header (hidden on mobile to save space) */}
      {!isMobile && (
        <div
          data-element="proof-header"
          style={{
            padding: '16px 20px 12px',
            borderBottom: '1px solid rgba(203, 213, 225, 0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                ...SECTION_LABEL_STYLE,
                marginBottom: 4,
              }}
            >
              Proposition I.{proposition.id}
            </div>
            <div
              style={{
                fontSize: proofFont.header,
                fontWeight: 500,
                color: PROOF_COLORS.textDark,
                fontFamily: PROOF_FONTS.serif,
                fontStyle: 'italic',
                lineHeight: 1.4,
              }}
            >
              {proposition.title}
            </div>
          </div>
        </div>
      )}

      {/* Proof body — wraps steps + conclusion + completion dock */}
      <div
        data-element="proof-body"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Scrollable steps + proof chain */}
        <div
          ref={proofScrollRef}
          data-element="proof-steps"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: isMobile ? '10px 14px' : '12px 20px',
          }}
        >
          {/* Given facts (atStep === -1) */}
          {(() => {
            const givenFacts = factsByStep.get(-1) ?? []
            if (givenFacts.length === 0) return null
            return (
              <div data-element="given-facts" style={{ marginBottom: isMobile ? 8 : 16 }}>
                {givenFacts.map((fact) => {
                  const highlighted = isFactHighlighted(fact)
                  return (
                    <div
                      key={fact.id}
                      onMouseEnter={() => setHoveredFactId(fact.id)}
                      onMouseLeave={() => setHoveredFactId(null)}
                      style={{
                        fontSize: proofFont.stepText,
                        marginBottom: 3,
                        paddingLeft: 8,
                        cursor: 'default',
                        borderLeft: highlighted
                          ? `2px solid ${PROOF_COLORS.factBorderHighlighted}`
                          : `2px solid ${PROOF_COLORS.factBorder}`,
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
                        <span
                          style={{
                            color: PROOF_COLORS.textMuted,
                            fontFamily: PROOF_FONTS.serif,
                            fontSize: proofFont.citation,
                            fontWeight: 600,
                            marginLeft: 6,
                          }}
                        >
                          [Given]
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Steps */}
          {steps.map((step, i) => {
            const isDone = completedSteps[i]
            const isCurrent = i === currentStep && !isComplete
            const isFuture = !isDone && !isCurrent
            const stepFacts = factsByStep.get(i) ?? []
            const isHovered = isDone && hoveredStepIndex === i

            return (
              <div
                key={i}
                data-element="proof-step"
                data-step-current={isCurrent ? 'true' : undefined}
                onClick={isDone ? () => onRewindToStep(i) : undefined}
                onMouseEnter={
                  isDone
                    ? () => {
                        setHoveredStepIndex(i)
                        if (step.expected.type === 'macro') {
                          onHoverMacroStep(i)
                        }
                      }
                    : undefined
                }
                onMouseLeave={
                  isDone
                    ? () => {
                        setHoveredStepIndex(null)
                        onHoverMacroStep(null)
                      }
                    : undefined
                }
                style={{
                  marginBottom: isMobile ? 8 : 16,
                  opacity: isFuture ? 0.35 : 1,
                  transition: 'opacity 0.3s ease',
                  cursor: isDone ? 'pointer' : undefined,
                  borderRadius: 6,
                  background: isHovered ? PROOF_COLORS.stepHoverBg : undefined,
                }}
              >
                {/* Step header: number + instruction + citation */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {/* Step indicator */}
                  <StepIndicator
                    state={isDone ? 'done' : isCurrent ? 'current' : 'future'}
                    stepNumber={i + 1}
                    isHovered={isHovered}
                    size={isMobile ? 18 : 20}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Formal instruction */}
                    <div
                      style={{
                        fontSize: proofFont.stepTitle,
                        fontWeight: isCurrent ? 600 : 400,
                        color: isCurrent ? PROOF_COLORS.textCurrent : PROOF_COLORS.text,
                        fontFamily: PROOF_FONTS.serif,
                        lineHeight: isMobile ? 1.25 : 1.4,
                      }}
                    >
                      <MarkedText
                        text={step.instruction}
                        markers={EUCLID_ENTITY_MARKERS}
                        onHighlight={onHighlight}
                        renderEntity={renderEntity}
                      />
                    </div>

                    {/* Citation: progressive disclosure */}
                    {step.citation &&
                      (() => {
                        const cit = CITATIONS[step.citation]
                        const ord = citationOrdinals.get(`step-${i}`) ?? 1
                        const label = ord <= 2 ? (cit?.label ?? step.citation) : step.citation
                        return (
                          <StepCitation
                            citationKey={step.citation}
                            label={label}
                            showText={ord === 1}
                            color={isDone ? '#6b9b6b' : '#7893ab'}
                            fontSize={proofFont.stepText}
                            citationFontSize={proofFont.citation}
                            lineHeight={isMobile ? 1.25 : 1.4}
                            onPointerEnter={onCitationPointerEnter}
                            onPointerLeave={onCitationPointerLeave}
                            onPointerDown={onCitationPointerDown}
                            isMobile={isMobile}
                          />
                        )
                      })()}

                    {/* Tutorial guidance for current step */}
                    {isCurrent && currentInstruction && (
                      <div
                        data-element="step-guidance"
                        style={{
                          marginTop: 6,
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: PROOF_COLORS.guidanceBg,
                          border: `1px solid ${PROOF_COLORS.guidanceBorder}`,
                          fontSize: proofFont.stepText,
                          color: PROOF_COLORS.guidanceText,
                          fontFamily: PROOF_FONTS.sans,
                          lineHeight: isMobile ? 1.25 : 1.4,
                        }}
                      >
                        <MarkedText
                          text={currentInstruction}
                          markers={EUCLID_ENTITY_MARKERS}
                          onHighlight={onHighlight}
                          renderEntity={renderEntitySubtle}
                        />
                      </div>
                    )}

                    {/* Observation step: Continue button */}
                    {isCurrent && step.expected.type === 'observation' && (
                      <button
                        data-action="advance-observation"
                        type="button"
                        onClick={advanceObservation}
                        style={{
                          marginTop: 8,
                          padding: '6px 20px',
                          borderRadius: 16,
                          border: 'none',
                          background: PROOF_COLORS.stepCurrent,
                          color: '#fff',
                          fontSize: proofFont.stepText,
                          fontWeight: 600,
                          fontFamily: PROOF_FONTS.serif,
                          cursor: 'pointer',
                          letterSpacing: '0.02em',
                        }}
                      >
                        Continue
                      </button>
                    )}

                    {/* Facts derived at this step */}
                    {stepFacts.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {stepFacts.map((fact) => {
                          const explanation = fact.justification.replace(
                            /^(Def\.15|C\.N\.\d|I\.\d+):\s*/,
                            ''
                          )
                          return (
                            <FactRow
                              key={fact.id}
                              fact={fact}
                              highlighted={isFactHighlighted(fact)}
                              onMouseEnter={() => setHoveredFactId(fact.id)}
                              onMouseLeave={() => setHoveredFactId(null)}
                              citation={makeFactCitation(fact)}
                              explanation={explanation}
                              fontSize={proofFont.stepText}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Conclusion facts (atStep === steps.length) */}
          {(() => {
            const conclusionFacts = factsByStep.get(steps.length) ?? []
            if (conclusionFacts.length === 0 && !isComplete) return null
            return conclusionFacts.map((fact) => {
              const explanation = fact.justification.replace(/^(Def\.15|C\.N\.\d|I\.\d+):\s*/, '')
              return (
                <div
                  key={fact.id}
                  style={{
                    paddingLeft: 28,
                    marginLeft: 0,
                    cursor: 'default',
                  }}
                >
                  <FactRow
                    fact={fact}
                    highlighted={isFactHighlighted(fact)}
                    onMouseEnter={() => setHoveredFactId(fact.id)}
                    onMouseLeave={() => setHoveredFactId(null)}
                    citation={makeFactCitation(fact)}
                    explanation={explanation}
                    fontSize={proofFont.stepText}
                    borderColor="rgba(16, 185, 129, 0.3)"
                  />
                </div>
              )
            })
          })()}
        </div>

        {/* Conclusion + completion */}
        {isComplete && completionResult && (
          <div
            data-element="proof-conclusion"
            style={{
              padding: isMobile ? '6px 10px' : '12px 20px',
              borderTop:
                completionResult.status === 'proven'
                  ? `2px solid rgba(16, 185, 129, 0.4)`
                  : `2px solid rgba(239, 68, 68, 0.4)`,
              background:
                completionResult.status === 'proven'
                  ? 'rgba(16, 185, 129, 0.06)'
                  : 'rgba(239, 68, 68, 0.06)',
            }}
            onMouseLeave={() => {
              setHoveredProofDp(null)
              setHoveredFactId(null)
            }}
          >
            {completionResult.status === 'proven' ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 5,
                    flexWrap: 'wrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      color: PROOF_COLORS.proven,
                      fontWeight: 700,
                      fontSize: proofFont.conclusion,
                      fontFamily: PROOF_FONTS.serif,
                    }}
                  >
                    {'∴ '}
                    {completionResult.segments.map((seg, idx) => (
                      <span key={seg.label}>
                        {idx > 0 && <span style={{ fontWeight: 400, margin: '0 2px' }}> = </span>}
                        <span
                          data-element="conclusion-segment"
                          onMouseEnter={() => setHoveredProofDp(seg.dp)}
                          style={{
                            cursor: 'default',
                            borderBottom: highlightState.dpKeys?.has(distancePairKey(seg.dp))
                              ? `2px solid ${PROOF_COLORS.proven}`
                              : '2px solid transparent',
                            transition: 'border-color 0.15s ease',
                          }}
                        >
                          {seg.label}
                        </span>
                      </span>
                    ))}
                  </span>
                  {(() => {
                    const conclusionAngleFacts = (factsByStep.get(steps.length) ?? []).filter(
                      isAngleFact
                    )
                    const conclusionText = proposition.computeTheoremConclusion
                      ? proposition.computeTheoremConclusion(constructionState)
                      : proposition.theoremConclusion

                    return (
                      <>
                        {conclusionAngleFacts.length > 0 && (
                          <div
                            style={{
                              color: PROOF_COLORS.proven,
                              fontSize: proofFont.stepText,
                              fontFamily: PROOF_FONTS.serif,
                              fontStyle: 'italic',
                              marginTop: 0,
                              width: '100%',
                            }}
                          >
                            {conclusionAngleFacts.map((fact, idx) => (
                              <span key={fact.id}>
                                {idx > 0 && ', '}
                                <span
                                  data-element="conclusion-angle"
                                  onMouseEnter={() => setHoveredFactId(fact.id)}
                                  onMouseLeave={() => setHoveredFactId(null)}
                                  style={{
                                    cursor: 'default',
                                    borderBottom: isFactHighlighted(fact)
                                      ? `2px solid ${PROOF_COLORS.proven}`
                                      : '2px solid transparent',
                                    transition: 'border-color 0.15s ease',
                                  }}
                                >
                                  {fact.statement}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                        {conclusionText && (
                          <div
                            style={{
                              color: PROOF_COLORS.proven,
                              fontSize: proofFont.stepText,
                              fontFamily: PROOF_FONTS.serif,
                              fontStyle: 'italic',
                              marginTop: 0,
                              width: '100%',
                              whiteSpace: 'pre-line',
                            }}
                          >
                            {conclusionText}
                          </div>
                        )}
                      </>
                    )
                  })()}
                  <span
                    style={{
                      color: PROOF_COLORS.proven,
                      fontStyle: 'italic',
                      fontSize: proofFont.stepText,
                      fontWeight: 600,
                      fontFamily: PROOF_FONTS.serif,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {proposition.kind === 'theorem' ? 'Q.E.D.' : 'Q.E.F.'}
                  </span>
                </div>
                {isMobile && completionMeta?.nextPropId && (
                  <button
                    type="button"
                    data-action="navigate-next"
                    onClick={() => completionMeta.onNavigateNext(completionMeta.nextPropId!)}
                    style={{
                      padding: '4px 8px',
                      fontSize: proofFont.stepText,
                      fontWeight: 600,
                      fontFamily: PROOF_FONTS.serif,
                      background: PROOF_COLORS.proven,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                  >
                    {completionMeta.unlocked.includes(completionMeta.nextPropId)
                      ? `Unlocked: I.${completionMeta.nextPropId} →`
                      : `Next: I.${completionMeta.nextPropId} →`}
                  </button>
                )}
                {!isMobile && proposition.draggablePointIds && (
                  <div
                    data-element="drag-invitation"
                    style={{
                      marginTop: 10,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: PROOF_COLORS.guidanceBg,
                      border: `1px solid ${PROOF_COLORS.guidanceBorder}`,
                      color: PROOF_COLORS.guidanceText,
                      fontSize: proofFont.stepText,
                      fontFamily: PROOF_FONTS.sans,
                      fontStyle: 'normal',
                      fontWeight: 500,
                      lineHeight: 1.4,
                    }}
                  >
                    Now try dragging the points to see that it always works.
                  </div>
                )}
              </div>
            ) : (
              <span
                style={{
                  color: PROOF_COLORS.unproven,
                  fontWeight: 600,
                  fontSize: proofFont.stepText,
                  fontFamily: PROOF_FONTS.serif,
                }}
              >
                Proof incomplete — could not establish equality for {completionResult.statement}
              </span>
            )}
            {isMobile &&
              completionMeta &&
              (completionResult.status !== 'proven' ||
                (completionMeta.unlocked.length > 0 &&
                  !(
                    completionMeta.nextPropId &&
                    completionMeta.unlocked.length === 1 &&
                    completionMeta.unlocked[0] === completionMeta.nextPropId
                  ))) && (
                <div
                  data-element="proof-completion-dock"
                  style={{
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: '1px dashed rgba(148, 163, 184, 0.5)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    {completionResult.status !== 'proven' && (
                      <div
                        style={{
                          color: '#b91c1c',
                          fontFamily: PROOF_FONTS.serif,
                          fontSize: proofFont.stepText,
                          fontWeight: 600,
                        }}
                      >
                        Incomplete
                      </div>
                    )}
                  </div>
                  {completionMeta.unlocked.length > 0 &&
                    !(
                      completionMeta.nextPropId &&
                      completionMeta.unlocked.length === 1 &&
                      completionMeta.unlocked[0] === completionMeta.nextPropId
                    ) && (
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: proofFont.stepText,
                          color: PROOF_COLORS.text,
                          fontFamily: PROOF_FONTS.serif,
                          lineHeight: isMobile ? 1.2 : 1.4,
                        }}
                      >
                        <span style={{ color: PROOF_COLORS.proven, fontWeight: 600 }}>
                          Unlocked:{' '}
                        </span>
                        {completionMeta.unlocked.map((id, i) => (
                          <span key={id}>
                            {i > 0 && ', '}
                            <strong>I.{id}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                </div>
              )}
          </div>
        )}

        {/* Desktop completion dock */}
        {!isMobile && isComplete && completionResult && completionMeta && (
          <div
            data-element="proof-completion-dock"
            style={{
              padding: '10px 20px 12px',
              borderTop: '1px dashed rgba(148, 163, 184, 0.5)',
              background: 'rgba(248, 250, 252, 0.9)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  color: completionResult.status === 'proven' ? '#0f766e' : '#b91c1c',
                  fontFamily: PROOF_FONTS.serif,
                  fontSize: proofFont.stepText,
                  fontWeight: 600,
                }}
              >
                ✓ I.{proposition.id}{' '}
                {completionResult.status === 'proven'
                  ? `Complete • ${proposition.kind === 'theorem' ? 'Q.E.D.' : 'Q.E.F.'}`
                  : 'Incomplete'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {completionMeta.nextPropId && (
                  <button
                    type="button"
                    data-action="navigate-next"
                    onClick={() => completionMeta.onNavigateNext(completionMeta.nextPropId!)}
                    style={{
                      padding: '5px 12px',
                      fontSize: proofFont.stepText,
                      fontWeight: 600,
                      fontFamily: PROOF_FONTS.serif,
                      background: PROOF_COLORS.proven,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    {completionMeta.unlocked.includes(completionMeta.nextPropId)
                      ? `Unlocked: I.${completionMeta.nextPropId} →`
                      : `Next: I.${completionMeta.nextPropId} →`}
                  </button>
                )}
              </div>
            </div>
            {completionMeta.unlocked.length > 0 &&
              !(
                completionMeta.nextPropId &&
                completionMeta.unlocked.length === 1 &&
                completionMeta.unlocked[0] === completionMeta.nextPropId
              ) && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: proofFont.stepText,
                    color: PROOF_COLORS.text,
                    fontFamily: PROOF_FONTS.serif,
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: PROOF_COLORS.proven, fontWeight: 600 }}>Unlocked: </span>
                  {completionMeta.unlocked.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ', '}
                      <strong>I.{id}</strong>
                    </span>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>
    </>
  )
}

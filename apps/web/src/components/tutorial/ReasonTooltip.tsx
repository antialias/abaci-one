'use client'

import React, { useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { PedagogicalRule, PedagogicalSegment, TermReason } from './DecompositionWithReasons'
import type { UnifiedStepData } from '../../utils/unifiedStepGenerator'

interface ReasonTooltipProps {
  children: React.ReactNode
  termIndex: number
  segment?: PedagogicalSegment
  reason?: TermReason
  originalValue?: string
  steps?: UnifiedStepData[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// Utility functions
function getPlaceName(place: number): string {
  const names = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands']
  return names[place] || `10^${place}`
}

function formatRuleName(rule: PedagogicalRule, place: number, hasCascade = false): string {
  const placeName = getPlaceName(place)
  switch (rule) {
    case 'Direct':
      return `Direct — ${placeName}`
    case 'FiveComplement':
      return `Five Friend — ${placeName}`
    case 'TenComplement':
      return hasCascade ? `Ten Friend (cascade) — ${placeName}` : `Ten Friend — ${placeName}`
    case 'Cascade':
      return `Chain Reaction — ${placeName}`
    default:
      return `Strategy — ${placeName}`
  }
}

export function ReasonTooltip({
  children,
  termIndex,
  segment,
  reason,
  originalValue,
  steps,
  open,
  onOpenChange
}: ReasonTooltipProps) {
  const [showBeadDetails, setShowBeadDetails] = useState(false)
  const rule = reason?.rule ?? segment?.plan[0]?.rule
  const shortReason = reason?.shortReason
  const bullets = reason?.bullets

  if (!rule) {
    return <>{children}</>
  }

  // Calculate context values
  const place = segment?.place ?? 0
  const currentDigit = segment?.a ?? 0  // Current digit at this place
  const addingDigit = segment?.digit ?? 0  // Digit being added
  const sum = currentDigit + addingDigit
  const complement = rule === 'FiveComplement' ? (5 - currentDigit) :
                   rule === 'TenComplement' ? (10 - addingDigit) : 0

  // Detect cascade
  const hasCascade = segment?.plan?.some(p => p.rule === 'Cascade') ?? false

  const getRuleInfo = (rule: PedagogicalRule) => {
    switch (rule) {
      case 'Direct':
        return {
          emoji: '✨',
          name: 'Direct Move',
          description: 'Simple bead movement',
          color: 'green'
        }
      case 'FiveComplement':
        return {
          emoji: '🤝',
          name: 'Five Friend',
          description: 'Using pairs that make 5',
          color: 'blue'
        }
      case 'TenComplement':
        return {
          emoji: '🔟',
          name: 'Ten Friend',
          description: 'Using pairs that make 10',
          color: 'purple'
        }
      case 'Cascade':
        return {
          emoji: '🌊',
          name: 'Chain Reaction',
          description: 'One move triggers another',
          color: 'orange'
        }
      default:
        return {
          emoji: '💭',
          name: 'Strategy',
          description: 'Abacus technique',
          color: 'gray'
        }
    }
  }

  const ruleInfo = getRuleInfo(rule)
  const contentClasses = `reason-tooltip reason-tooltip--${ruleInfo.color}`

  const tooltipId = `tooltip-${termIndex}`
  const ruleTitle = formatRuleName(rule, place, hasCascade)

  return (
    <Tooltip.Root open={open} onOpenChange={onOpenChange} delayDuration={300}>
      <Tooltip.Trigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-labelledby={tooltipId}
          aria-describedby={`${tooltipId}-description`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpenChange?.(!open)
            }
            if (e.key === 'Escape' && open) {
              onOpenChange?.(false)
            }
          }}
        >
          {children}
        </div>
      </Tooltip.Trigger>

      <Tooltip.Portal>
        <Tooltip.Content
          id={tooltipId}
          className={contentClasses}
          sideOffset={8}
          side="top"
          align="center"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => onOpenChange?.(false)}
        >
          <div className="reason-tooltip__content">
            <div className="reason-tooltip__header">
              <span className="reason-tooltip__emoji">{ruleInfo.emoji}</span>
              <div className="reason-tooltip__title">
                <h4 className="reason-tooltip__name">{ruleTitle}</h4>
                <p id={`${tooltipId}-description`} className="reason-tooltip__description">{ruleInfo.description}</p>
              </div>
            </div>

            {/* Context chips */}
            {segment && (
              <div className="reason-tooltip__context">
                <div className="reason-tooltip__chips">
                  <span className="reason-tooltip__chip">Place: {getPlaceName(place)}</span>
                  <span className="reason-tooltip__chip">a = {currentDigit}</span>
                  <span className="reason-tooltip__chip">d = {addingDigit}</span>
                  {complement > 0 && (
                    <span className="reason-tooltip__chip">
                      s = {rule === 'FiveComplement' ? 5 : 10} − {rule === 'FiveComplement' ? currentDigit : addingDigit} = {complement}
                    </span>
                  )}
                </div>
              </div>
            )}

            {shortReason && (
              <div className="reason-tooltip__explanation">
                <p>{shortReason}</p>
              </div>
            )}

            {/* Show expansion reasoning from segment plan */}
            {segment?.plan && segment.plan.length > 0 && (
              <div className="reason-tooltip__reasoning">
                <h5 className="reason-tooltip__section-title">Why this expansion?</h5>
                {segment.plan.map((decision, idx) => (
                  <div key={idx} className="reason-tooltip__decision">
                    {decision.explanation.map((explain, explainIdx) => (
                      <p key={explainIdx} className="reason-tooltip__explanation-text">
                        {explain}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Show carry path for ten complements */}
            {rule === 'TenComplement' && (
              <div className="reason-tooltip__carry-path">
                <p className="reason-tooltip__carry-description">
                  {hasCascade ? (
                    <>
                      <strong>Carry path:</strong> {getPlaceName(place + 1)} = 9 ⇒ find nearest non-9, then clear intermediate 9s
                    </>
                  ) : (
                    <>
                      <strong>Carry path:</strong> +1 to {getPlaceName(place + 1)}, -{addingDigit} from {getPlaceName(place)}
                    </>
                  )}
                </p>
              </div>
            )}

            {bullets && bullets.length > 0 && (
              <div className="reason-tooltip__details">
                <ul>
                  {bullets.map((bullet, idx) => (
                    <li key={idx}>
                      <span className="reason-tooltip__bullet">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Show expandable step-by-step breakdown for multi-step segments */}
            {segment && steps && segment.stepIndices && segment.stepIndices.length > 1 && (
              <div className="reason-tooltip__steps">
                <button
                  className="reason-tooltip__expand-button"
                  onClick={() => setShowBeadDetails(!showBeadDetails)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setShowBeadDetails(!showBeadDetails)
                    }
                  }}
                  aria-expanded={showBeadDetails}
                  aria-controls={`${tooltipId}-steps`}
                  type="button"
                >
                  <span className="reason-tooltip__section-title">
                    Step-by-step breakdown
                    <span className="reason-tooltip__chevron" style={{ transform: showBeadDetails ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </span>
                </button>

                {showBeadDetails && (
                  <ol id={`${tooltipId}-steps`} className="reason-tooltip__step-list">
                    {segment.stepIndices.map((stepIndex, idx) => {
                      const step = steps[stepIndex]
                      if (!step) return null

                      return (
                        <li key={stepIndex} className="reason-tooltip__step">
                          <code className="reason-tooltip__step-term">{step.mathematicalTerm}</code>
                          <span className="reason-tooltip__step-instruction">{step.englishInstruction}</span>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </div>
            )}

            {originalValue && segment?.expression && (
              <div className="reason-tooltip__formula">
                <div className="reason-tooltip__expansion">
                  <span className="reason-tooltip__original">{originalValue}</span>
                  <span className="reason-tooltip__arrow">→</span>
                  <code className="reason-tooltip__expanded">{segment.expression}</code>
                </div>
                <div className="reason-tooltip__label">
                  {originalValue} becomes {segment.expression}
                </div>
              </div>
            )}
          </div>

          <Tooltip.Arrow className="reason-tooltip__arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
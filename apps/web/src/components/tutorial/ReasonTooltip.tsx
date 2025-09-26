'use client'

import React, { useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import type { PedagogicalRule, PedagogicalSegment, TermReason } from './DecompositionWithReasons'
import type { UnifiedStepData, TermProvenance } from '../../utils/unifiedStepGenerator'

interface ReasonTooltipProps {
  children: React.ReactNode
  termIndex: number
  segment?: PedagogicalSegment
  reason?: TermReason
  originalValue?: string
  steps?: UnifiedStepData[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  provenance?: TermProvenance  // NEW: Provenance data for enhanced tooltips
}

// Fallback utility for legacy support
function getPlaceName(place: number): string {
  const names = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands']
  return names[place] || `10^${place}`
}

export function ReasonTooltip({
  children,
  termIndex,
  segment,
  reason,
  originalValue,
  steps,
  open,
  onOpenChange,
  provenance
}: ReasonTooltipProps) {
  const [showBeadDetails, setShowBeadDetails] = useState(false)
  const [showMath, setShowMath] = useState(false)
  const rule = reason?.rule ?? segment?.plan[0]?.rule
  const shortReason = reason?.shortReason
  const bullets = reason?.bullets

  if (!rule) {
    return <>{children}</>
  }

  // Use readable format from segment, enhanced with provenance
  const readable = segment?.readable

  // Generate enhanced tooltip content using provenance
  const getEnhancedTooltipContent = () => {
    if (!provenance) return null

    // For Direct operations, use the enhanced provenance title
    if (rule === 'Direct') {
      const title = `Add the ${provenance.rhsPlaceName} digit — ${provenance.rhsDigit} ${provenance.rhsPlaceName} (${provenance.rhsValue})`
      const subtitle = `From addend ${provenance.rhs}`

      const enhancedChips = [
        { label: 'Digit we\'re using', value: `${provenance.rhsDigit} (${provenance.rhsPlaceName})` },
        ...(readable?.chips.find(chip => chip.label === 'This rod shows') ? [
          { label: 'This rod shows', value: readable.chips.find(chip => chip.label === 'This rod shows')!.value }
        ] : []),
        { label: 'So we add here', value: `+${provenance.rhsDigit} ${provenance.rhsPlaceName} → ${provenance.rhsValue}` }
      ]

      return { title, subtitle, chips: enhancedChips }
    }

    // For complement operations, enhance the existing readable content with provenance context
    if (readable) {
      // Keep the readable title but add provenance context to subtitle
      const title = readable.title
      const subtitle = `${readable.subtitle || ''} • From ${provenance.rhsPlaceName} digit ${provenance.rhsDigit} of ${provenance.rhs}`.trim()

      // Enhance the chips by adding provenance context at the beginning
      const enhancedChips = [
        { label: 'Source digit', value: `${provenance.rhsDigit} from ${provenance.rhs} (${provenance.rhsPlaceName} place)` },
        ...readable.chips
      ]

      return { title, subtitle, chips: enhancedChips }
    }

    return null
  }

  const enhancedContent = getEnhancedTooltipContent()



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

  return (
    <Tooltip.Root open={open} onOpenChange={onOpenChange} delayDuration={300}>
      <Tooltip.Trigger asChild>
        <span
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
        </span>
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
                <h4 className="reason-tooltip__name">
                  {enhancedContent?.title || readable?.title || ruleInfo.name}
                </h4>
                <p id={`${tooltipId}-description`} className="reason-tooltip__description">
                  {enhancedContent?.subtitle || readable?.subtitle || ruleInfo.description}
                </p>
              </div>
            </div>

            {/* Context chips using enhanced or readable format */}
            {(enhancedContent?.chips || readable?.chips) && (
              <div className="reason-tooltip__context">
                <div className="reason-tooltip__chips">
                  {(enhancedContent?.chips || readable?.chips || []).map((chip, index) => (
                    <span key={index} className="reason-tooltip__chip">
                      {chip.label}: {chip.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Why this step using enhanced provenance or readable format */}
            {(provenance || (readable && readable.why.length > 0)) && (
              <div className="reason-tooltip__reasoning">
                <h5 className="reason-tooltip__section-title">Why this step</h5>
                {/* Show provenance explanation for Direct rules */}
                {provenance && rule === 'Direct' && (
                  <>
                    <p className="reason-tooltip__explanation-text">
                      • We're adding the <strong>{provenance.rhsPlaceName} digit</strong> of <strong>{provenance.rhs}</strong> → <strong>{provenance.rhsDigit} {provenance.rhsPlaceName}</strong>.
                    </p>
                    {readable?.chips.find(chip => chip.label === 'This rod shows') && (
                      <p className="reason-tooltip__explanation-text">
                        • {readable.chips.find(chip => chip.label === 'This rod shows')?.label} <strong>{readable.chips.find(chip => chip.label === 'This rod shows')?.value}</strong>; adding <strong>{provenance.rhsDigit}</strong> fits, so no carry.
                      </p>
                    )}
                  </>
                )}
                {/* Show readable why explanations for complement rules (and optionally Direct if available) */}
                {readable && readable.why.length > 0 && readable.why.map((why, index) => (
                  <p key={index} className="reason-tooltip__explanation-text">
                    • {why}
                  </p>
                ))}
                {/* For complement rules with provenance, add additional context about source digit */}
                {provenance && rule !== 'Direct' && (
                  <p className="reason-tooltip__explanation-text">
                    • This expansion processes the <strong>{provenance.rhsPlaceName} digit {provenance.rhsDigit}</strong> from the addend <strong>{provenance.rhs}</strong>.
                  </p>
                )}
              </div>
            )}

            {/* Show carry path using readable format */}
            {readable?.carryPath && (
              <div className="reason-tooltip__carry-path">
                <p className="reason-tooltip__carry-description">
                  <strong>Carry path:</strong> {readable.carryPath}
                </p>
              </div>
            )}

            {/* Show the math toggle for advanced users */}
            {readable?.showMath && (
              <div className="reason-tooltip__advanced">
                <button
                  className="reason-tooltip__math-toggle"
                  onClick={() => setShowMath(!showMath)}
                  aria-expanded={showMath}
                  type="button"
                >
                  <span className="reason-tooltip__math-label">
                    Show the math
                    <span className="reason-tooltip__chevron" style={{ transform: showMath ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </span>
                </button>

                {showMath && (
                  <div className="reason-tooltip__math-content">
                    {readable.showMath.lines.map((line, index) => (
                      <p key={index} className="reason-tooltip__math-line">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Show expandable step-by-step breakdown using readable format */}
            {readable && readable.stepsFriendly.length > 1 && (
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
                    {readable.stepsFriendly.map((stepInstruction, idx) => (
                      <li key={idx} className="reason-tooltip__step">
                        <span className="reason-tooltip__step-instruction">{stepInstruction}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {/* Original transformation shown at bottom */}
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
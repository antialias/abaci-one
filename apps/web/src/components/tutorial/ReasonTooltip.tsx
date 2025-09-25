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
  onOpenChange
}: ReasonTooltipProps) {
  const [showBeadDetails, setShowBeadDetails] = useState(false)
  const [showMath, setShowMath] = useState(false)
  const rule = reason?.rule ?? segment?.plan[0]?.rule
  const shortReason = reason?.shortReason
  const bullets = reason?.bullets

  if (!rule) {
    return <>{children}</>
  }

  // Use readable format from segment
  const readable = segment?.readable

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
                <h4 className="reason-tooltip__name">{readable?.title || ruleInfo.name}</h4>
                <p id={`${tooltipId}-description`} className="reason-tooltip__description">
                  {readable?.subtitle || ruleInfo.description}
                </p>
              </div>
            </div>

            {/* Context chips using readable format */}
            {readable && readable.chips.length > 0 && (
              <div className="reason-tooltip__context">
                <div className="reason-tooltip__chips">
                  {readable.chips.map((chip, index) => (
                    <span key={index} className="reason-tooltip__chip">
                      {chip.label}: {chip.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Why this step using readable format */}
            {readable && readable.why.length > 0 && (
              <div className="reason-tooltip__reasoning">
                <h5 className="reason-tooltip__section-title">Why this step</h5>
                {readable.why.map((why, index) => (
                  <p key={index} className="reason-tooltip__explanation-text">
                    • {why}
                  </p>
                ))}
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
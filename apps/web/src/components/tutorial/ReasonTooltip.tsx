'use client'

import React from 'react'
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
  const rule = reason?.rule ?? segment?.plan[0]?.rule
  const shortReason = reason?.shortReason
  const bullets = reason?.bullets

  if (!rule) {
    return <>{children}</>
  }

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

  return (
    <Tooltip.Root open={open} onOpenChange={onOpenChange} delayDuration={300}>
      <Tooltip.Trigger asChild>
        {children}
      </Tooltip.Trigger>

      <Tooltip.Portal>
        <Tooltip.Content
          className={contentClasses}
          sideOffset={8}
          side="top"
          align="center"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="reason-tooltip__content">
            <div className="reason-tooltip__header">
              <span className="reason-tooltip__emoji">{ruleInfo.emoji}</span>
              <div className="reason-tooltip__title">
                <h4 className="reason-tooltip__name">{ruleInfo.name}</h4>
                <p className="reason-tooltip__description">{ruleInfo.description}</p>
              </div>
            </div>

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

            {/* Show step-by-step breakdown for multi-step segments */}
            {segment && steps && segment.stepIndices && segment.stepIndices.length > 1 && (
              <div className="reason-tooltip__steps">
                <h5 className="reason-tooltip__section-title">Step-by-step breakdown:</h5>
                <ol className="reason-tooltip__step-list">
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
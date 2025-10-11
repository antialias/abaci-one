'use client'

import * as HoverCard from '@radix-ui/react-hover-card'
import type React from 'react'
import { useMemo, useState } from 'react'
import type { TermProvenance, UnifiedStepData } from '../../utils/unifiedStepGenerator'
import type { PedagogicalRule, PedagogicalSegment, TermReason } from './DecompositionWithReasons'
import './reason-tooltip.css'

// Helper hook to safely access TutorialUI context
// Check if TutorialUI module is available at module load time
let useTutorialUIImport: (() => any) | null = null
try {
  const module = require('./TutorialUIContext')
  useTutorialUIImport = module.useTutorialUI
} catch {
  // TutorialUI context not available
}

function useTutorialUIGate() {
  if (useTutorialUIImport) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useTutorialUIImport()
  }
  // Return a fallback that allows all focus requests (non-tutorial context)
  return {
    requestFocus: () => true,
    releaseFocus: () => {},
    hintFocus: 'none' as const,
  }
}

interface ReasonTooltipProps {
  children: React.ReactNode
  termIndex: number
  segment?: PedagogicalSegment
  reason?: TermReason
  originalValue?: string
  steps?: UnifiedStepData[]
  provenance?: TermProvenance // NEW: Provenance data for enhanced tooltips
}

// Fallback utility for legacy support
function _getPlaceName(place: number): string {
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
  provenance,
}: ReasonTooltipProps) {
  // All hooks must be called before early return
  const [showBeadDetails, setShowBeadDetails] = useState(false)
  const [showMath, setShowMath] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const ui = useTutorialUIGate()
  const rule = reason?.rule ?? segment?.plan[0]?.rule

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
        {
          label: "Digit we're using",
          value: `${provenance.rhsDigit} (${provenance.rhsPlaceName})`,
        },
        ...(() => {
          const rodChip = readable?.chips.find((c) => /^(this )?rod shows$/i.test(c.label))
          return rodChip ? [{ label: 'Rod shows', value: rodChip.value }] : []
        })(),
        {
          label: 'So we add here',
          value: `+${provenance.rhsDigit} ${provenance.rhsPlaceName} → ${provenance.rhsValue}`,
        },
      ]

      return { title, subtitle, chips: enhancedChips }
    }

    // For complement operations, enhance the existing readable content with provenance context
    if (readable) {
      // Keep the readable title but add provenance context to subtitle
      const title = readable.title
      const subtitle =
        `${readable.subtitle || ''} • From ${provenance.rhsPlaceName} digit ${provenance.rhsDigit} of ${provenance.rhs}`.trim()

      // Enhance the chips by adding provenance context at the beginning
      const enhancedChips = [
        {
          label: 'Source digit',
          value: `${provenance.rhsDigit} from ${provenance.rhs} (${provenance.rhsPlaceName} place)`,
        },
        ...readable.chips,
      ]

      return { title, subtitle, chips: enhancedChips }
    }

    return null
  }

  const enhancedContent = useMemo(getEnhancedTooltipContent, [])

  const getRuleInfo = (ruleName: PedagogicalRule) => {
    switch (ruleName) {
      case 'Direct':
        return {
          emoji: '✨',
          name: 'Direct Move',
          description: 'Simple bead movement',
          color: 'green',
        }
      case 'FiveComplement':
        return {
          emoji: '🤝',
          name: 'Five Friend',
          description: 'Using pairs that make 5',
          color: 'blue',
        }
      case 'TenComplement':
        return {
          emoji: '🔟',
          name: 'Ten Friend',
          description: 'Using pairs that make 10',
          color: 'purple',
        }
      case 'Cascade':
        return {
          emoji: '🌊',
          name: 'Chain Reaction',
          description: 'One move triggers another',
          color: 'orange',
        }
      default:
        return {
          emoji: '💭',
          name: 'Strategy',
          description: 'Abacus technique',
          color: 'gray',
        }
    }
  }

  const ruleInfo = useMemo(
    () =>
      rule
        ? getRuleInfo(rule)
        : {
            emoji: '💭',
            name: 'Strategy',
            description: 'Abacus technique',
            color: 'gray',
          },
    [rule, getRuleInfo]
  )

  if (!rule) {
    return <>{children}</>
  }

  const contentClasses = `reason-tooltip reason-tooltip--${ruleInfo.color}`

  const tooltipId = `tooltip-${termIndex}`

  const handleOpenChange = (open: boolean) => {
    if (open) {
      const granted = ui.requestFocus('term')
      if (granted) {
        setIsOpen(true)
      }
    } else {
      ui.releaseFocus('term')
      setIsOpen(false)
    }
  }

  return (
    <HoverCard.Root open={isOpen} onOpenChange={handleOpenChange} openDelay={150} closeDelay={400}>
      <HoverCard.Trigger asChild>
        <span aria-describedby={`${tooltipId}-description`}>{children}</span>
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content
          id={tooltipId}
          className={contentClasses}
          sideOffset={8}
          side="top"
          align="center"
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

            {/* Primary, concise explanation */}
            {segment?.readable?.summary && (
              <div className="reason-tooltip__summary">
                <p className="reason-tooltip__explanation-text">{segment.readable.summary}</p>
              </div>
            )}

            {/* Optional provenance nudge (avoid duplicating subtitle) */}
            {provenance &&
              !(enhancedContent?.subtitle || readable?.subtitle || '').includes('From ') && (
                <div className="reason-tooltip__reasoning">
                  <p className="reason-tooltip__explanation-text">
                    From <strong>{provenance.rhs}</strong>: use the{' '}
                    <strong>{provenance.rhsPlaceName}</strong> digit (
                    <strong>{provenance.rhsDigit}</strong>).
                  </p>
                </div>
              )}

            {/* More details disclosure for optional content */}
            {((enhancedContent?.chips || readable?.chips)?.length ||
              readable?.carryPath ||
              readable?.showMath ||
              (readable && readable.stepsFriendly.length > 1)) && (
              <div className="reason-tooltip__details">
                <button
                  className="reason-tooltip__details-toggle"
                  onClick={() => setShowDetails(!showDetails)}
                  aria-expanded={showDetails}
                  aria-controls={`${tooltipId}-details`}
                  type="button"
                >
                  <span className="reason-tooltip__details-label">
                    More details
                    <span
                      className="reason-tooltip__chevron"
                      style={{
                        transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▼
                    </span>
                  </span>
                </button>

                {showDetails && (
                  <div id={`${tooltipId}-details`} className="reason-tooltip__details-content">
                    {/* Context chips */}
                    {(enhancedContent?.chips || readable?.chips)?.length ? (
                      <div className="reason-tooltip__context">
                        <dl className="reason-tooltip__chips">
                          {(enhancedContent?.chips || readable?.chips || []).map((chip, index) => (
                            <div key={index} className="reason-tooltip__chip">
                              <dt>{chip.label}</dt>
                              <dd>{chip.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null}

                    {/* Carry path only when it's interesting (cascades) */}
                    {segment?.plan?.some((p) => p.rule === 'Cascade') && readable?.carryPath && (
                      <div className="reason-tooltip__carry-path">
                        <p className="reason-tooltip__carry-description">
                          <strong>Carry path:</strong> {readable.carryPath}
                        </p>
                      </div>
                    )}

                    {/* Math toggle */}
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
                            <span
                              className="reason-tooltip__chevron"
                              style={{
                                transform: showMath ? 'rotate(180deg)' : 'rotate(0deg)',
                              }}
                            >
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

                    {/* Step-by-step breakdown */}
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
                            <span
                              className="reason-tooltip__chevron"
                              style={{
                                transform: showBeadDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                              }}
                            >
                              ▼
                            </span>
                          </span>
                        </button>

                        {showBeadDetails && (
                          <ol id={`${tooltipId}-steps`} className="reason-tooltip__step-list">
                            {readable.stepsFriendly.map((stepInstruction, idx) => (
                              <li key={idx} className="reason-tooltip__step">
                                <span className="reason-tooltip__step-instruction">
                                  {stepInstruction}
                                </span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Dev-only validation hint */}
            {process.env.NODE_ENV !== 'production' &&
              segment?.readable?.validation &&
              !segment.readable.validation.ok && (
                <div className="reason-tooltip__dev-warn">
                  ⚠ Summary/guard mismatch: {segment.readable.validation.issues.join('; ')}
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

          <HoverCard.Arrow className="reason-tooltip__arrow" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}

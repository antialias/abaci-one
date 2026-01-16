'use client'

import { useMemo, useState, useEffect } from 'react'
import type { ExecutableFlowchart, FlowchartState, DecisionNode } from '@/lib/flowcharts/schema'
import { css, cx } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'

interface FlowchartPhaseRailProps {
  flowchart: ExecutableFlowchart
  state: FlowchartState
  /** Callback when user selects a decision option */
  onDecisionSelect?: (value: string) => void
  /** Wrong answer for feedback animation */
  wrongDecision?: { value: string; correctValue: string; attempt: number } | null
}

interface PathNode {
  nodeId: string
  title: string
  choice?: string // For decision nodes, which choice was made
  isCurrent: boolean
}

/**
 * Horizontal phase rail showing all phases with current phase expanded.
 * Shows path taken with ellipsis if more than 2 previous nodes.
 * When at a decision node, renders the options as clickable cards in the flowchart.
 */
export function FlowchartPhaseRail({
  flowchart,
  state,
  onDecisionSelect,
  wrongDecision,
}: FlowchartPhaseRailProps) {
  const phases = flowchart.mermaid.phases

  // Shake animation state
  const [isShaking, setIsShaking] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  // Handle wrong answer feedback
  useEffect(() => {
    if (wrongDecision) {
      setIsShaking(true)
      setShowFeedback(true)

      const shakeTimer = setTimeout(() => setIsShaking(false), 500)
      const feedbackTimer = setTimeout(() => setShowFeedback(false), 1500)

      return () => {
        clearTimeout(shakeTimer)
        clearTimeout(feedbackTimer)
      }
    }
  }, [wrongDecision?.attempt])

  // Build the path taken through the flowchart
  const pathTaken = useMemo((): PathNode[] => {
    const path: PathNode[] = []

    // Add nodes from history
    for (const entry of state.history) {
      const node = flowchart.nodes[entry.node]
      if (!node) continue

      const title = node.content?.title || entry.node

      // For decision nodes, include the choice made
      let choice: string | undefined
      if (node.definition.type === 'decision' && entry.userInput) {
        const def = node.definition as DecisionNode
        const option = def.options.find((o) => o.value === entry.userInput)
        choice = option?.label || String(entry.userInput)
      }

      path.push({
        nodeId: entry.node,
        title,
        choice,
        isCurrent: false,
      })
    }

    // Add current node
    const currentNode = flowchart.nodes[state.currentNode]
    if (currentNode) {
      path.push({
        nodeId: state.currentNode,
        title: currentNode.content?.title || state.currentNode,
        isCurrent: true,
      })
    }

    return path
  }, [flowchart.nodes, state.history, state.currentNode])

  // Get decision options for current node if it's a decision
  const decisionOptions = useMemo(() => {
    const currentNode = flowchart.nodes[state.currentNode]
    if (!currentNode || currentNode.definition.type !== 'decision') return null

    const def = currentNode.definition as DecisionNode
    return def.options.map((opt) => {
      const nextNode = flowchart.nodes[opt.next]
      return {
        label: opt.label,
        value: opt.value,
        leadsTo: nextNode?.content?.title || opt.next,
      }
    })
  }, [flowchart.nodes, state.currentNode])

  // Find which phase the current node is in
  const currentPhaseIndex = useMemo(() => {
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].nodes.includes(state.currentNode)) {
        return i
      }
    }
    return -1
  }, [phases, state.currentNode])

  // Determine phase status
  const getPhaseStatus = (phaseIndex: number): 'completed' | 'current' | 'future' => {
    if (phaseIndex < currentPhaseIndex) return 'completed'
    if (phaseIndex === currentPhaseIndex) return 'current'
    return 'future'
  }

  if (phases.length === 0) return null

  const currentPhase = phases[currentPhaseIndex]

  // Build display path with ellipsis logic
  const displayPath = useMemo(() => {
    if (pathTaken.length <= 3) {
      return { showEllipsis: false, nodes: pathTaken }
    }
    // Show ellipsis + last 2 visited + current
    return {
      showEllipsis: true,
      nodes: pathTaken.slice(-3), // last 2 + current
    }
  }, [pathTaken])

  const handleOptionClick = (value: string) => {
    if (showFeedback) return
    onDecisionSelect?.(value)
  }

  return (
    <div data-testid="phase-rail" className={vstack({ gap: '3', alignItems: 'stretch' })}>
      {/* Horizontal phase rail */}
      <div
        data-testid="phase-rail-horizontal"
        data-current-phase={currentPhaseIndex}
        data-total-phases={phases.length}
        className={css({
          display: 'flex',
          gap: '2',
          overflowX: 'auto',
          padding: '2',
          scrollbarWidth: 'thin',
        })}
      >
        {phases.map((phase, idx) => {
          const status = getPhaseStatus(idx)
          const isCurrent = status === 'current'

          return (
            <div
              key={phase.id}
              data-testid={`phase-${idx}`}
              data-phase-id={phase.id}
              data-phase-status={status}
              className={css({
                flex: isCurrent ? '2 0 auto' : '1 0 auto',
                minWidth: isCurrent ? '160px' : '60px',
                maxWidth: isCurrent ? '240px' : '100px',
                padding: '2',
                borderRadius: 'lg',
                border: '2px solid',
                borderColor: isCurrent
                  ? { base: 'blue.400', _dark: 'blue.500' }
                  : status === 'completed'
                    ? { base: 'green.300', _dark: 'green.700' }
                    : { base: 'gray.200', _dark: 'gray.700' },
                backgroundColor: isCurrent
                  ? { base: 'blue.50', _dark: 'blue.900' }
                  : status === 'completed'
                    ? { base: 'green.50', _dark: 'green.900/30' }
                    : { base: 'gray.50', _dark: 'gray.800' },
                transition: 'all 0.3s ease',
              })}
            >
              <div className={vstack({ gap: '1', alignItems: 'center' })}>
                {/* Phase status icon + title */}
                <div
                  className={hstack({
                    gap: '1',
                    justifyContent: 'center',
                    width: '100%',
                  })}
                >
                  <span className={css({ fontSize: 'sm' })}>
                    {status === 'completed' ? '✓' : status === 'current' ? '📍' : '○'}
                  </span>
                  <span
                    className={css({
                      fontSize: isCurrent ? 'xs' : '2xs',
                      fontWeight: isCurrent ? 'semibold' : 'medium',
                      color: isCurrent
                        ? { base: 'blue.700', _dark: 'blue.200' }
                        : status === 'completed'
                          ? { base: 'green.700', _dark: 'green.300' }
                          : { base: 'gray.500', _dark: 'gray.400' },
                      textAlign: 'center',
                      lineHeight: 'tight',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: isCurrent ? 'normal' : 'nowrap',
                    })}
                  >
                    {phase.title}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Expanded current phase - Path taken + Decision */}
      {currentPhase && (
        <div
          data-testid="current-phase-expanded"
          data-phase-id={currentPhase.id}
          className={css({
            padding: '3',
            backgroundColor: { base: 'gray.50', _dark: 'gray.800' },
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: { base: 'gray.200', _dark: 'gray.700' },
          })}
        >
          <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
            {/* Path taken */}
            <div data-testid="path-taken" className={vstack({ gap: '1', alignItems: 'center' })}>
              <div
                data-testid="path-nodes-container"
                data-path-length={pathTaken.length}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                })}
              >
                {displayPath.showEllipsis && (
                  <>
                    <span
                      className={css({
                        fontSize: 'sm',
                        color: { base: 'gray.400', _dark: 'gray.500' },
                      })}
                    >
                      •••
                    </span>
                    <span
                      className={css({
                        fontSize: 'sm',
                        color: { base: 'gray.400', _dark: 'gray.500' },
                      })}
                    >
                      →
                    </span>
                  </>
                )}
                {displayPath.nodes.map((node, idx) => (
                  <div
                    key={node.nodeId}
                    data-testid={`path-node-${idx}`}
                    data-node-id={node.nodeId}
                    data-is-current={node.isCurrent}
                    className={hstack({ gap: '2', alignItems: 'center' })}
                  >
                    <span
                      className={css({
                        padding: '1 2',
                        borderRadius: 'md',
                        fontSize: 'xs',
                        fontWeight: node.isCurrent ? 'bold' : 'medium',
                        backgroundColor: node.isCurrent
                          ? { base: 'blue.100', _dark: 'blue.800' }
                          : { base: 'green.100', _dark: 'green.800' },
                        color: node.isCurrent
                          ? { base: 'blue.700', _dark: 'blue.200' }
                          : { base: 'green.700', _dark: 'green.200' },
                        border: '1px solid',
                        borderColor: node.isCurrent
                          ? { base: 'blue.300', _dark: 'blue.600' }
                          : { base: 'green.300', _dark: 'green.600' },
                        whiteSpace: 'nowrap',
                      })}
                    >
                      {node.isCurrent ? '📍 ' : '✓ '}
                      {node.title.length > 15 ? node.title.slice(0, 13) + '…' : node.title}
                      {node.choice && (
                        <span
                          className={css({
                            marginLeft: '1',
                            opacity: 0.8,
                            fontWeight: 'normal',
                          })}
                        >
                          ({node.choice.length > 8 ? node.choice.slice(0, 6) + '…' : node.choice})
                        </span>
                      )}
                    </span>
                    {idx < displayPath.nodes.length - 1 && (
                      <span
                        className={css({
                          fontSize: 'sm',
                          color: { base: 'gray.400', _dark: 'gray.500' },
                        })}
                      >
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Decision branching - rendered as part of the flowchart */}
            {decisionOptions && onDecisionSelect && (
              <div
                data-testid="decision-branching"
                data-option-count={decisionOptions.length}
                className={vstack({ gap: '2', alignItems: 'center' })}
              >
                {/* Branch line */}
                <div
                  className={css({
                    width: '2px',
                    height: '16px',
                    backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
                  })}
                />

                {/* Branch split */}
                <div
                  className={css({
                    display: 'flex',
                    alignItems: 'flex-start',
                    position: 'relative',
                  })}
                >
                  {/* Horizontal connector line */}
                  <div
                    className={css({
                      position: 'absolute',
                      top: '0',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 'calc(100% - 80px)',
                      height: '2px',
                      backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
                    })}
                  />

                  {/* Option cards */}
                  <div
                    className={cx(
                      hstack({ gap: '4', justifyContent: 'center', alignItems: 'stretch' }),
                      isShaking ? 'shake-animation' : ''
                    )}
                  >
                    {decisionOptions.map((opt, idx) => {
                      const isCorrect = showFeedback && wrongDecision?.correctValue === opt.value
                      const isWrong = showFeedback && wrongDecision?.value === opt.value

                      return (
                        <div
                          key={opt.value}
                          data-testid={`decision-option-${idx}`}
                          data-option-value={opt.value}
                          data-is-correct={isCorrect}
                          data-is-wrong={isWrong}
                          className={vstack({ gap: '0', alignItems: 'center' })}
                        >
                          {/* Vertical connector */}
                          <div
                            className={css({
                              width: '2px',
                              height: '12px',
                              backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
                            })}
                          />
                          {/* Arrow */}
                          <div
                            className={css({
                              width: '0',
                              height: '0',
                              borderLeft: '6px solid transparent',
                              borderRight: '6px solid transparent',
                              borderTop: '8px solid',
                              borderTopColor: { base: 'gray.300', _dark: 'gray.600' },
                              marginBottom: '2',
                            })}
                          />

                          {/* Clickable option card */}
                          <button
                            data-testid={`decision-option-button-${idx}`}
                            onClick={() => handleOptionClick(opt.value)}
                            disabled={showFeedback}
                            className={css({
                              display: 'flex',
                              flexDirection: 'column',
                              padding: '0',
                              borderRadius: 'lg',
                              border: '3px solid',
                              cursor: showFeedback ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s',
                              minWidth: '120px',
                              maxWidth: '160px',
                              overflow: 'hidden',
                              backgroundColor: { base: 'white', _dark: 'gray.700' },

                              borderColor: isCorrect
                                ? { base: 'green.500', _dark: 'green.400' }
                                : isWrong
                                  ? { base: 'red.500', _dark: 'red.400' }
                                  : { base: 'blue.300', _dark: 'blue.600' },

                              _hover: showFeedback
                                ? {}
                                : {
                                    borderColor: { base: 'blue.500', _dark: 'blue.400' },
                                    transform: 'scale(1.03)',
                                    boxShadow: 'lg',
                                  },

                              _active: showFeedback
                                ? {}
                                : {
                                    transform: 'scale(0.97)',
                                  },
                            })}
                          >
                            {/* Choice header */}
                            <div
                              className={css({
                                padding: '2 3',
                                fontSize: 'sm',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                backgroundColor: isCorrect
                                  ? { base: 'green.100', _dark: 'green.800' }
                                  : isWrong
                                    ? { base: 'red.100', _dark: 'red.800' }
                                    : { base: 'blue.100', _dark: 'blue.800' },
                                color: isCorrect
                                  ? { base: 'green.800', _dark: 'green.200' }
                                  : isWrong
                                    ? { base: 'red.800', _dark: 'red.200' }
                                    : { base: 'blue.800', _dark: 'blue.200' },
                                borderBottom: '1px solid',
                                borderColor: isCorrect
                                  ? { base: 'green.200', _dark: 'green.600' }
                                  : isWrong
                                    ? { base: 'red.200', _dark: 'red.600' }
                                    : { base: 'blue.200', _dark: 'blue.600' },
                                position: 'relative',
                              })}
                            >
                              {isCorrect && (
                                <span
                                  className={css({
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    fontSize: 'xs',
                                  })}
                                >
                                  ✓
                                </span>
                              )}
                              {isWrong && (
                                <span
                                  className={css({
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    fontSize: 'xs',
                                  })}
                                >
                                  ✗
                                </span>
                              )}
                              {opt.label}
                            </div>

                            {/* Where it leads */}
                            <div
                              className={css({
                                padding: '2',
                                fontSize: '2xs',
                                color: { base: 'gray.600', _dark: 'gray.400' },
                                textAlign: 'center',
                                lineHeight: 'tight',
                              })}
                            >
                              {opt.leadsTo.length > 25
                                ? opt.leadsTo.slice(0, 23) + '…'
                                : opt.leadsTo}
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shake animation styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
              20%, 40%, 60%, 80% { transform: translateX(8px); }
            }
            .shake-animation {
              animation: shake 0.5s ease-in-out;
            }
          `,
        }}
      />
    </div>
  )
}

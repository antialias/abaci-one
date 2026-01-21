'use client'

import { useMemo, useState, useEffect } from 'react'
import type { ExecutableFlowchart, FlowchartState, DecisionNode } from '@/lib/flowcharts/schema'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'
import { FlowchartDecisionGraph } from './FlowchartDecisionGraph'

interface FlowchartPhaseRailProps {
  flowchart: ExecutableFlowchart
  state: FlowchartState
  /** Callback when user selects a decision option */
  onDecisionSelect?: (value: string) => void
  /** Wrong answer for feedback animation */
  wrongDecision?: { value: string; correctValue: string; attempt: number } | null
  /** Compact mode - shows only phase pills, no expanded section or decision graph */
  compact?: boolean
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
  compact = false,
}: FlowchartPhaseRailProps) {
  const phases = flowchart.mermaid.phases

  // Feedback state for wrong answers
  const [showFeedback, setShowFeedback] = useState(false)

  // Handle wrong answer feedback - show feedback briefly then allow retry
  useEffect(() => {
    if (wrongDecision) {
      setShowFeedback(true)

      const feedbackTimer = setTimeout(() => setShowFeedback(false), 1500)

      return () => {
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
        pathLabel: opt.pathLabel,
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

  // Compact mode: just show phase pills, no expanded section
  if (compact) {
    return (
      <div
        data-testid="phase-rail-compact"
        data-current-phase={currentPhaseIndex}
        data-total-phases={phases.length}
        className={hstack({
          gap: '1.5',
          justifyContent: 'center',
          flexWrap: 'wrap',
        })}
      >
        {phases.map((phase, idx) => {
          const status = getPhaseStatus(idx)
          return (
            <span
              key={phase.id}
              data-testid={`phase-pill-${idx}`}
              data-phase-id={phase.id}
              data-phase-status={status}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1',
                paddingY: '1', paddingX: '2',
                borderRadius: 'full',
                fontSize: '2xs',
                fontWeight: 'medium',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                backgroundColor:
                  status === 'completed'
                    ? { base: 'green.100', _dark: 'green.900/40' }
                    : status === 'current'
                      ? { base: 'blue.100', _dark: 'blue.900/40' }
                      : { base: 'gray.100', _dark: 'gray.800' },
                color:
                  status === 'completed'
                    ? { base: 'green.700', _dark: 'green.300' }
                    : status === 'current'
                      ? { base: 'blue.700', _dark: 'blue.300' }
                      : { base: 'gray.500', _dark: 'gray.400' },
                border: '1px solid',
                borderColor:
                  status === 'completed'
                    ? { base: 'green.200', _dark: 'green.800' }
                    : status === 'current'
                      ? { base: 'blue.300', _dark: 'blue.700' }
                      : { base: 'gray.200', _dark: 'gray.700' },
              })}
            >
              <span className={css({ fontSize: 'xs' })}>
                {status === 'completed' ? '✓' : status === 'current' ? '📍' : '○'}
              </span>
              {phase.title}
            </span>
          )
        })}
      </div>
    )
  }

  // Build display path with ellipsis logic
  // When showing a decision, exclude the current node since the diamond represents it
  const displayPath = useMemo(() => {
    const nodesToShow = decisionOptions
      ? pathTaken.filter((n) => !n.isCurrent) // Exclude current for decisions
      : pathTaken

    if (nodesToShow.length <= 3) {
      return { showEllipsis: false, nodes: nodesToShow }
    }
    // Show ellipsis + last 2-3 visited nodes
    return {
      showEllipsis: true,
      nodes: nodesToShow.slice(-3),
    }
  }, [pathTaken, decisionOptions])

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
          data-element="phase-expanded-container"
          data-phase-id={currentPhase.id}
          className={css({
            padding: '3',
            backgroundColor: { base: 'gray.50', _dark: 'gray.800' },
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: { base: 'gray.200', _dark: 'gray.700' },
          })}
        >
          <div
            data-element="phase-expanded-content"
            className={vstack({ gap: '4', alignItems: 'stretch' })}
          >
            {/* Path taken */}
            <div
              data-testid="path-taken"
              data-element="path-taken-section"
              className={vstack({ gap: '1', alignItems: 'center' })}
            >
              <div
                data-testid="path-nodes-container"
                data-element="path-nodes-row"
                data-path-length={pathTaken.length}
                data-show-ellipsis={displayPath.showEllipsis}
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
                      data-element="path-ellipsis"
                      className={css({
                        fontSize: 'sm',
                        color: { base: 'gray.400', _dark: 'gray.500' },
                      })}
                    >
                      •••
                    </span>
                    <span
                      data-element="path-ellipsis-arrow"
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
                    data-element="path-node-item"
                    data-node-id={node.nodeId}
                    data-node-title={node.title}
                    data-is-current={node.isCurrent}
                    data-has-choice={!!node.choice}
                    className={hstack({ gap: '2', alignItems: 'center' })}
                  >
                    <span
                      data-element="path-node-badge"
                      data-node-type={node.isCurrent ? 'current' : 'visited'}
                      className={css({
                        paddingY: '1', paddingX: '2',
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
                      {node.title.length > 15 ? `${node.title.slice(0, 13)}…` : node.title}
                      {node.choice && (
                        <span
                          data-element="path-node-choice"
                          className={css({
                            marginLeft: '1',
                            opacity: 0.8,
                            fontWeight: 'normal',
                          })}
                        >
                          ({node.choice.length > 8 ? `${node.choice.slice(0, 6)}…` : node.choice})
                        </span>
                      )}
                    </span>
                    {idx < displayPath.nodes.length - 1 && (
                      <span
                        data-element="path-node-arrow"
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

            {/* Decision branching - flowchart-style graph */}
            {decisionOptions && onDecisionSelect && (
              <div
                data-element="decision-graph-container"
                data-option-count={decisionOptions.length}
              >
                <FlowchartDecisionGraph
                  nodeTitle={flowchart.nodes[state.currentNode]?.content?.title || 'Choose'}
                  nodeBody={flowchart.nodes[state.currentNode]?.content?.body || []}
                  options={decisionOptions.map((opt) => ({
                    label: opt.label,
                    value: opt.value,
                    pathLabel: opt.pathLabel,
                    leadsTo: opt.leadsTo,
                  }))}
                  onSelect={handleOptionClick}
                  wrongAnswer={showFeedback ? wrongDecision?.value : undefined}
                  correctAnswer={showFeedback ? wrongDecision?.correctValue : undefined}
                  disabled={showFeedback}
                  hasPreviousNode={displayPath.nodes.length > 0}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

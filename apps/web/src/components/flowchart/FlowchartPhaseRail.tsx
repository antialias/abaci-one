'use client'

import { useMemo } from 'react'
import type { ExecutableFlowchart, FlowchartState, DecisionNode } from '@/lib/flowcharts/schema'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'

interface FlowchartPhaseRailProps {
  flowchart: ExecutableFlowchart
  state: FlowchartState
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
 */
export function FlowchartPhaseRail({ flowchart, state }: FlowchartPhaseRailProps) {
  const phases = flowchart.mermaid.phases

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
      // Find where this option leads
      const nextNodeId = opt.next
      const nextNode = flowchart.nodes[nextNodeId]
      const nextTitle = nextNode?.content?.title || nextNodeId

      return {
        label: opt.label,
        value: opt.value,
        leadsTo: nextTitle,
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

  return (
    <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
      {/* Horizontal phase rail */}
      <div
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

      {/* Expanded current phase - Path taken */}
      {currentPhase && (
        <div
          className={css({
            padding: '3',
            backgroundColor: { base: 'gray.50', _dark: 'gray.800' },
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: { base: 'gray.200', _dark: 'gray.700' },
          })}
        >
          <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
            {/* Path taken */}
            <div className={vstack({ gap: '1', alignItems: 'flex-start' })}>
              <span
                className={css({
                  fontSize: '2xs',
                  fontWeight: 'medium',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                  textTransform: 'uppercase',
                  letterSpacing: 'wide',
                })}
              >
                Path
              </span>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  flexWrap: 'wrap',
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
                  <div key={node.nodeId} className={hstack({ gap: '2', alignItems: 'center' })}>
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

            {/* Decision options (if current node is a decision) */}
            {decisionOptions && (
              <div className={vstack({ gap: '1', alignItems: 'flex-start' })}>
                <span
                  className={css({
                    fontSize: '2xs',
                    fontWeight: 'medium',
                    color: { base: 'gray.500', _dark: 'gray.400' },
                    textTransform: 'uppercase',
                    letterSpacing: 'wide',
                  })}
                >
                  Choose
                </span>
                <div
                  className={css({
                    display: 'flex',
                    gap: '3',
                    flexWrap: 'wrap',
                  })}
                >
                  {decisionOptions.map((opt) => (
                    <div
                      key={opt.value}
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1',
                        fontSize: 'xs',
                        color: { base: 'gray.600', _dark: 'gray.300' },
                      })}
                    >
                      <span
                        className={css({
                          padding: '0.5 1.5',
                          borderRadius: 'sm',
                          backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                          fontWeight: 'medium',
                        })}
                      >
                        {opt.label}
                      </span>
                      <span className={css({ color: { base: 'gray.400', _dark: 'gray.500' } })}>
                        →
                      </span>
                      <span className={css({ fontStyle: 'italic', opacity: 0.8 })}>
                        {opt.leadsTo.length > 20 ? opt.leadsTo.slice(0, 18) + '…' : opt.leadsTo}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

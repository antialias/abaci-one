'use client'

import { useMemo } from 'react'
import type { ExecutableFlowchart, FlowchartState } from '@/lib/flowcharts/schema'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'

interface FlowchartPhaseRailProps {
  flowchart: ExecutableFlowchart
  state: FlowchartState
}

/**
 * Horizontal phase rail showing all phases with current phase expanded.
 *
 * - All phases visible as cards in a horizontal rail
 * - Current phase is wider and highlighted
 * - Dots represent nodes within each phase
 * - Current phase expands below with node progression
 */
export function FlowchartPhaseRail({ flowchart, state }: FlowchartPhaseRailProps) {
  const phases = flowchart.mermaid.phases

  // Get set of visited node IDs from history
  const visitedNodes = useMemo(() => {
    const visited = new Set<string>()
    for (const entry of state.history) {
      visited.add(entry.node)
    }
    return visited
  }, [state.history])

  // Find which phase the current node is in
  const currentPhaseIndex = useMemo(() => {
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].nodes.includes(state.currentNode)) {
        return i
      }
    }
    return -1
  }, [phases, state.currentNode])

  // Determine phase status: completed, current, or future
  const getPhaseStatus = (phaseIndex: number): 'completed' | 'current' | 'future' => {
    if (phaseIndex < currentPhaseIndex) return 'completed'
    if (phaseIndex === currentPhaseIndex) return 'current'
    return 'future'
  }

  // Get node status within a phase
  const getNodeStatus = (nodeId: string): 'completed' | 'current' | 'future' => {
    if (nodeId === state.currentNode) return 'current'
    if (visitedNodes.has(nodeId)) return 'completed'
    return 'future'
  }

  if (phases.length === 0) return null

  const currentPhase = phases[currentPhaseIndex]

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
                minWidth: isCurrent ? '180px' : '80px',
                maxWidth: isCurrent ? '280px' : '120px',
                padding: '2 3',
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

                {/* Node dots */}
                <div className={hstack({ gap: '1', justifyContent: 'center', flexWrap: 'wrap' })}>
                  {phase.nodes.map((nodeId) => {
                    const nodeStatus = getNodeStatus(nodeId)
                    return (
                      <span
                        key={nodeId}
                        className={css({
                          width: nodeStatus === 'current' ? '10px' : '6px',
                          height: nodeStatus === 'current' ? '10px' : '6px',
                          borderRadius: 'full',
                          backgroundColor:
                            nodeStatus === 'current'
                              ? { base: 'blue.500', _dark: 'blue.400' }
                              : nodeStatus === 'completed'
                                ? { base: 'green.500', _dark: 'green.400' }
                                : { base: 'gray.300', _dark: 'gray.600' },
                          transition: 'all 0.2s ease',
                          boxShadow: nodeStatus === 'current' ? '0 0 0 2px white, 0 0 0 4px var(--colors-blue-400)' : 'none',
                        })}
                        title={flowchart.nodes[nodeId]?.content?.title || nodeId}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Expanded current phase */}
      {currentPhase && (
        <div
          className={css({
            padding: '3',
            backgroundColor: { base: 'blue.50', _dark: 'blue.900/50' },
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: { base: 'blue.200', _dark: 'blue.800' },
          })}
        >
          <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
            {/* Phase title */}
            <div
              className={css({
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: { base: 'blue.700', _dark: 'blue.200' },
                textAlign: 'center',
              })}
            >
              {currentPhase.title}
            </div>

            {/* Node progression */}
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1',
                flexWrap: 'wrap',
                padding: '2',
              })}
            >
              {currentPhase.nodes.map((nodeId, idx) => {
                const nodeStatus = getNodeStatus(nodeId)
                const node = flowchart.nodes[nodeId]
                const nodeTitle = node?.content?.title || nodeId
                const isLast = idx === currentPhase.nodes.length - 1

                return (
                  <div key={nodeId} className={hstack({ gap: '1', alignItems: 'center' })}>
                    {/* Node pill */}
                    <div
                      className={css({
                        padding: '1 2',
                        borderRadius: 'md',
                        fontSize: 'xs',
                        fontWeight: nodeStatus === 'current' ? 'bold' : 'medium',
                        backgroundColor:
                          nodeStatus === 'current'
                            ? { base: 'blue.500', _dark: 'blue.500' }
                            : nodeStatus === 'completed'
                              ? { base: 'green.100', _dark: 'green.800' }
                              : { base: 'gray.100', _dark: 'gray.700' },
                        color:
                          nodeStatus === 'current'
                            ? 'white'
                            : nodeStatus === 'completed'
                              ? { base: 'green.700', _dark: 'green.200' }
                              : { base: 'gray.500', _dark: 'gray.400' },
                        border: nodeStatus === 'current' ? '2px solid' : '1px solid',
                        borderColor:
                          nodeStatus === 'current'
                            ? { base: 'blue.600', _dark: 'blue.400' }
                            : nodeStatus === 'completed'
                              ? { base: 'green.300', _dark: 'green.600' }
                              : { base: 'gray.200', _dark: 'gray.600' },
                        maxWidth: '100px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        boxShadow: nodeStatus === 'current' ? 'md' : 'none',
                        transform: nodeStatus === 'current' ? 'scale(1.05)' : 'none',
                        transition: 'all 0.2s ease',
                      })}
                      title={nodeTitle}
                    >
                      {nodeStatus === 'completed' && '✓ '}
                      {nodeStatus === 'current' && '→ '}
                      {nodeTitle.length > 12 ? nodeTitle.slice(0, 10) + '…' : nodeTitle}
                    </div>

                    {/* Arrow to next node */}
                    {!isLast && (
                      <span
                        className={css({
                          color: { base: 'gray.400', _dark: 'gray.500' },
                          fontSize: 'xs',
                        })}
                      >
                        →
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

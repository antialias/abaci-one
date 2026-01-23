'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { ExecutableFlowchart, ProblemValue, MixedNumberValue, StateSnapshot } from '@/lib/flowcharts/schema'
import type { GeneratedExample } from '@/lib/flowcharts/loader'
import { generateExamplesAsync } from '@/lib/flowcharts/example-generator-client'
import { formatProblemDisplay } from '@/lib/flowcharts/formatting'
import { simulateWalk, extractAnswer } from '@/lib/flowcharts/loader'
import { ProblemTrace } from './ProblemTrace'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

interface WorksheetDebugPanelProps {
  /** The loaded flowchart */
  flowchart: ExecutableFlowchart
  /** Number of problems to generate (default: 10) */
  problemCount?: number
  /** Callback when hovering over a problem (shows entire path via snapshots) */
  onHoverSnapshots?: (snapshots: StateSnapshot[] | null) => void
  /** Callback when hovering over a specific trace node (for focused highlighting) */
  onHoverNode?: (nodeId: string | null) => void
}

/** Difficulty tier type */
type DifficultyTier = 'easy' | 'medium' | 'hard'

/**
 * Debug panel for testing worksheet generation.
 * Shows generated problems with their computed answers, raw values, and difficulty tiers.
 */
export function WorksheetDebugPanel({ flowchart, problemCount = 10, onHoverSnapshots, onHoverNode }: WorksheetDebugPanelProps) {
  const [examples, setExamples] = useState<GeneratedExample[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  // Generate examples on mount
  useEffect(() => {
    generateExamples()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowchart.definition.id])

  const generateExamples = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const newExamples = await generateExamplesAsync(flowchart, problemCount, {
        positiveAnswersOnly: false,
      })
      setExamples(newExamples)
    } catch (err) {
      console.error('Failed to generate examples:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate examples')
    } finally {
      setIsLoading(false)
    }
  }, [flowchart, problemCount])

  // Calculate difficulty range
  const difficultyRange = useMemo(() => {
    if (examples.length === 0) return { min: 0, max: 0 }
    const scores = examples.map((ex) => ex.complexity.decisions + ex.complexity.checkpoints)
    return { min: Math.min(...scores), max: Math.max(...scores) }
  }, [examples])

  // Get difficulty tier for an example
  const getDifficultyTier = useCallback(
    (example: GeneratedExample): DifficultyTier => {
      const score = example.complexity.decisions + example.complexity.checkpoints
      const { min, max } = difficultyRange
      if (max === min) return 'easy'
      const normalized = (score - min) / (max - min)
      if (normalized < 0.25) return 'easy'
      if (normalized < 0.75) return 'medium'
      return 'hard'
    },
    [difficultyRange]
  )

  // Toggle expanded state for a problem
  const toggleExpanded = useCallback((index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Format a value for display
  const formatValue = (value: ProblemValue): string => {
    if (value === null) return 'null'
    if (typeof value === 'object' && 'denom' in value) {
      const mn = value as MixedNumberValue
      if (mn.whole === 0) return `${mn.num}/${mn.denom}`
      if (mn.num === 0) return String(mn.whole)
      return `${mn.whole} ${mn.num}/${mn.denom}`
    }
    return String(value)
  }

  // Tier counts
  const tierCounts = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const ex of examples) {
      counts[getDifficultyTier(ex)]++
    }
    return counts
  }, [examples, getDifficultyTier])

  // Tier colors
  const getTierColor = (tier: DifficultyTier) => {
    switch (tier) {
      case 'easy':
        return { bg: 'green.100', text: 'green.700', darkBg: 'green.900/40', darkText: 'green.300' }
      case 'medium':
        return { bg: 'amber.100', text: 'amber.700', darkBg: 'amber.900/40', darkText: 'amber.300' }
      case 'hard':
        return { bg: 'red.100', text: 'red.700', darkBg: 'red.900/40', darkText: 'red.300' }
    }
  }

  // Compute simulations and answers for all examples (unified computation path)
  const computedExamples = useMemo(() => {
    return examples.map((example) => {
      try {
        const terminalState = simulateWalk(flowchart, example.values)
        const { display } = extractAnswer(flowchart, terminalState)
        return {
          state: terminalState,
          answerDisplay: display.text || '?',
          error: null,
        }
      } catch (err) {
        console.error('Failed to compute answer for example:', err)
        return {
          state: null,
          answerDisplay: '?',
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    })
  }, [examples, flowchart])

  if (isLoading) {
    return (
      <div className={css({ padding: '4', textAlign: 'center' })}>
        <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
          Generating worksheet problems...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={vstack({ gap: '3', padding: '4', alignItems: 'center' })}>
        <p className={css({ color: { base: 'red.600', _dark: 'red.400' } })}>{error}</p>
        <button
          onClick={generateExamples}
          className={css({
            paddingY: '2',
            paddingX: '4',
            borderRadius: 'md',
            backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            _hover: { backgroundColor: { base: 'blue.700', _dark: 'blue.600' } },
          })}
        >
          Retry
        </button>
      </div>
    )
  }

  const schema = flowchart.definition.problemInput.schema

  return (
    <div
      data-component="worksheet-debug-panel"
      className={vstack({ gap: '4', alignItems: 'stretch' })}
    >
      {/* Header with stats and refresh */}
      <div className={hstack({ gap: '3', justifyContent: 'space-between', alignItems: 'center' })}>
        <div className={hstack({ gap: '2', alignItems: 'center', flexWrap: 'wrap' })}>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: { base: 'gray.700', _dark: 'gray.300' },
            })}
          >
            {examples.length} problems
          </span>
          <span className={css({ color: { base: 'gray.400', _dark: 'gray.600' } })}>•</span>
          <span className={css({ fontSize: 'xs', color: { base: 'gray.500', _dark: 'gray.400' } })}>
            Schema: <code className={css({ fontFamily: 'mono' })}>{schema || 'custom'}</code>
          </span>
        </div>
        <div className={hstack({ gap: '2' })}>
          {/* Tier badges */}
          {tierCounts.easy > 0 && (
            <span
              className={css({
                fontSize: 'xs',
                padding: '0.5 2',
                borderRadius: 'full',
                backgroundColor: { base: 'green.100', _dark: 'green.900/40' },
                color: { base: 'green.700', _dark: 'green.300' },
              })}
            >
              {tierCounts.easy} easy
            </span>
          )}
          {tierCounts.medium > 0 && (
            <span
              className={css({
                fontSize: 'xs',
                padding: '0.5 2',
                borderRadius: 'full',
                backgroundColor: { base: 'amber.100', _dark: 'amber.900/40' },
                color: { base: 'amber.700', _dark: 'amber.300' },
              })}
            >
              {tierCounts.medium} med
            </span>
          )}
          {tierCounts.hard > 0 && (
            <span
              className={css({
                fontSize: 'xs',
                padding: '0.5 2',
                borderRadius: 'full',
                backgroundColor: { base: 'red.100', _dark: 'red.900/40' },
                color: { base: 'red.700', _dark: 'red.300' },
              })}
            >
              {tierCounts.hard} hard
            </span>
          )}
          <button
            data-action="regenerate"
            onClick={generateExamples}
            className={css({
              paddingY: '1',
              paddingX: '2',
              fontSize: 'sm',
              borderRadius: 'md',
              backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
              color: { base: 'gray.700', _dark: 'gray.300' },
              border: 'none',
              cursor: 'pointer',
              _hover: { backgroundColor: { base: 'gray.200', _dark: 'gray.700' } },
            })}
          >
            🔄 Regenerate
          </button>
        </div>
      </div>

      {/* Answer computation info */}
      <div
        className={css({
          paddingY: '2',
          paddingX: '3',
          borderRadius: 'md',
          backgroundColor: { base: 'blue.50', _dark: 'blue.900/30' },
          fontSize: 'xs',
          color: { base: 'blue.700', _dark: 'blue.300' },
        })}
      >
        <strong>Answer computation:</strong>{' '}
        {flowchart.definition.display?.answer ? (
          <>
            Custom expression:{' '}
            <code
              className={css({
                fontFamily: 'mono',
                backgroundColor: { base: 'blue.100', _dark: 'blue.800/50' },
                paddingY: '0',
                paddingX: '1',
                borderRadius: 'sm',
              })}
            >
              {flowchart.definition.display.answer}
            </code>
          </>
        ) : schema ? (
          <>Schema-based ({schema})</>
        ) : (
          <>From computed variables</>
        )}
      </div>

      {/* Problems list */}
      {examples.length === 0 ? (
        <p
          className={css({
            color: { base: 'gray.500', _dark: 'gray.400' },
            textAlign: 'center',
            padding: '4',
          })}
        >
          No problems could be generated. Check the flowchart configuration.
        </p>
      ) : (
        <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
          {examples.map((example, index) => {
            const tier = getDifficultyTier(example)
            const tierColor = getTierColor(tier)
            const isExpanded = expandedItems.has(index)
            const problemDisplay = formatProblemDisplay(flowchart, example.values)
            const computed = computedExamples[index]
            const answerDisplay = computed?.answerDisplay ?? '?'
            // Get snapshots for hover highlighting
            const snapshots = computed?.state?.snapshots ?? []

            return (
              <div
                key={index}
                data-element="worksheet-problem"
                className={css({
                  borderRadius: 'lg',
                  border: '1px solid',
                  borderColor: { base: 'gray.200', _dark: 'gray.700' },
                  overflow: 'hidden',
                })}
                onMouseEnter={() => snapshots.length > 0 && onHoverSnapshots?.(snapshots)}
                onMouseLeave={() => onHoverSnapshots?.(null)}
              >
                {/* Problem header - clickable to expand */}
                <button
                  onClick={() => toggleExpanded(index)}
                  className={css({
                    width: '100%',
                    padding: '3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '3',
                    backgroundColor: { base: 'white', _dark: 'gray.800' },
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    _hover: {
                      backgroundColor: { base: 'gray.50', _dark: 'gray.700' },
                    },
                  })}
                >
                  <div className={hstack({ gap: '3', alignItems: 'center', flex: 1 })}>
                    {/* Problem number and tier */}
                    <div className={hstack({ gap: '2', alignItems: 'center' })}>
                      <span
                        className={css({
                          fontSize: 'xs',
                          fontWeight: 'medium',
                          color: { base: 'gray.400', _dark: 'gray.500' },
                          width: '24px',
                        })}
                      >
                        #{index + 1}
                      </span>
                      <span
                        className={css({
                          fontSize: 'xs',
                          padding: '0.5 2',
                          borderRadius: 'full',
                          backgroundColor: { base: tierColor.bg, _dark: tierColor.darkBg },
                          color: { base: tierColor.text, _dark: tierColor.darkText },
                          textTransform: 'capitalize',
                        })}
                      >
                        {tier}
                      </span>
                    </div>

                    {/* Problem display */}
                    <span
                      className={css({
                        fontSize: 'lg',
                        fontWeight: 'medium',
                        fontFamily: 'mono',
                        color: { base: 'gray.900', _dark: 'gray.100' },
                      })}
                    >
                      {problemDisplay}
                    </span>
                  </div>

                  {/* Answer */}
                  <div className={hstack({ gap: '2', alignItems: 'center' })}>
                    <span
                      className={css({
                        fontSize: 'sm',
                        color: { base: 'gray.500', _dark: 'gray.400' },
                      })}
                    >
                      =
                    </span>
                    <span
                      className={css({
                        fontSize: 'lg',
                        fontWeight: 'bold',
                        fontFamily: 'mono',
                        color:
                          answerDisplay === '?'
                            ? { base: 'red.600', _dark: 'red.400' }
                            : { base: 'blue.600', _dark: 'blue.400' },
                      })}
                    >
                      {answerDisplay}
                    </span>
                    <span
                      className={css({
                        fontSize: 'sm',
                        color: { base: 'gray.400', _dark: 'gray.500' },
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      })}
                    >
                      ▼
                    </span>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div
                    className={css({
                      padding: '3',
                      borderTop: '1px solid',
                      borderColor: { base: 'gray.100', _dark: 'gray.800' },
                      backgroundColor: { base: 'gray.50', _dark: 'gray.900' },
                    })}
                  >
                    <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
                      {/* Raw values */}
                      <div>
                        <h4
                          className={css({
                            fontSize: 'xs',
                            fontWeight: 'semibold',
                            color: { base: 'gray.600', _dark: 'gray.400' },
                            marginBottom: '1',
                            textTransform: 'uppercase',
                            letterSpacing: 'wide',
                          })}
                        >
                          Raw Values
                        </h4>
                        <div
                          className={css({
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                            gap: '2',
                          })}
                        >
                          {Object.entries(example.values).map(([key, value]) => (
                            <div
                              key={key}
                              className={css({
                                padding: '1.5 2',
                                borderRadius: 'md',
                                backgroundColor: { base: 'white', _dark: 'gray.800' },
                                border: '1px solid',
                                borderColor: { base: 'gray.200', _dark: 'gray.700' },
                              })}
                            >
                              <div
                                className={css({
                                  fontSize: 'xs',
                                  color: { base: 'gray.500', _dark: 'gray.400' },
                                })}
                              >
                                {key}
                              </div>
                              <div
                                className={css({
                                  fontSize: 'sm',
                                  fontFamily: 'mono',
                                  fontWeight: 'medium',
                                  color: { base: 'gray.900', _dark: 'gray.100' },
                                })}
                              >
                                {formatValue(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Complexity info */}
                      <div>
                        <h4
                          className={css({
                            fontSize: 'xs',
                            fontWeight: 'semibold',
                            color: { base: 'gray.600', _dark: 'gray.400' },
                            marginBottom: '1',
                            textTransform: 'uppercase',
                            letterSpacing: 'wide',
                          })}
                        >
                          Path Info
                        </h4>
                        <div className={hstack({ gap: '4', flexWrap: 'wrap' })}>
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: { base: 'gray.600', _dark: 'gray.400' },
                            })}
                          >
                            <strong>Path:</strong> {example.pathDescriptor}
                          </div>
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: { base: 'gray.600', _dark: 'gray.400' },
                            })}
                          >
                            <strong>Length:</strong> {example.complexity.pathLength} nodes
                          </div>
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: { base: 'gray.600', _dark: 'gray.400' },
                            })}
                          >
                            <strong>Decisions:</strong> {example.complexity.decisions}
                          </div>
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: { base: 'gray.600', _dark: 'gray.400' },
                            })}
                          >
                            <strong>Checkpoints:</strong> {example.complexity.checkpoints}
                          </div>
                        </div>
                      </div>

                      {/* Computation Trace */}
                      {computed?.state?.snapshots && computed.state.snapshots.length > 0 && (
                        <div data-element="computation-trace-section">
                          <h4
                            className={css({
                              fontSize: 'xs',
                              fontWeight: 'semibold',
                              color: { base: 'gray.600', _dark: 'gray.400' },
                              marginBottom: '2',
                              textTransform: 'uppercase',
                              letterSpacing: 'wide',
                            })}
                          >
                            Computation Trace
                          </h4>
                          <ProblemTrace
                            snapshots={computed.state.snapshots}
                            defaultExpanded={false}
                            onHoverStep={onHoverNode}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

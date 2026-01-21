'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { ExecutableFlowchart, ProblemValue } from '@/lib/flowcharts/schema'
import {
  analyzeFlowchart,
  inferGridDimensions,
  inferGridDimensionsFromExamples,
  formatProblemDisplay,
  type GeneratedExample,
  type GenerationConstraints,
  DEFAULT_CONSTRAINTS,
} from '@/lib/flowcharts/loader'
import { generateExamplesAsync } from '@/lib/flowcharts/example-generator-client'
import { InteractiveDice } from '@/components/ui/InteractiveDice'
import { AnimatedMathDisplay } from './AnimatedMathDisplay'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

/** Difficulty tier for filtering examples */
type DifficultyTier = 'easy' | 'medium' | 'hard' | 'all'

/** Default number of examples to generate */
const DEFAULT_EXAMPLES_TO_GENERATE = 100

export interface FlowchartExampleGridProps {
  /** The loaded flowchart */
  flowchart: ExecutableFlowchart
  /** Generation constraints (positive answers, max values, etc.) */
  constraints?: GenerationConstraints
  /** Number of examples to generate (default: 100) */
  exampleCount?: number
  /** Whether to cache examples in sessionStorage (default: true) */
  enableCaching?: boolean
  /** Called when an example is selected */
  onSelect: (values: Record<string, ProblemValue>) => void
  /** Whether to show the dice button for regenerating (default: true) */
  showDice?: boolean
  /** Whether to show difficulty filter tabs (default: true) */
  showDifficultyFilter?: boolean
  /** Compact mode for smaller displays (default: false) */
  compact?: boolean
}

/**
 * Reusable component that displays generated flowchart examples in an organized grid.
 *
 * Features:
 * - Generates examples using web workers
 * - Organizes examples by flowchart decision structure
 * - Displays in 1D, 2D, or flat grid based on path analysis
 * - Difficulty-based coloring and filtering
 * - Optional caching in sessionStorage
 * - Dice button for regeneration
 */
export function FlowchartExampleGrid({
  flowchart,
  constraints = DEFAULT_CONSTRAINTS,
  exampleCount = DEFAULT_EXAMPLES_TO_GENERATE,
  enableCaching = true,
  onSelect,
  showDice = true,
  showDifficultyFilter = true,
  compact = false,
}: FlowchartExampleGridProps) {
  // Displayed examples
  const [displayedExamples, setDisplayedExamples] = useState<GeneratedExample[]>([])
  // Pending examples promise during drag
  const pendingExamplesRef = useRef<Promise<GeneratedExample[]> | null>(null)
  // Selected difficulty tier
  const [selectedTier, setSelectedTier] = useState<DifficultyTier>('all')
  // Loading state
  const [isLoading, setIsLoading] = useState(true)
  // Error state
  const [error, setError] = useState<string | null>(null)

  // Create a stable storage key for caching examples
  const storageKey = useMemo(() => {
    if (!enableCaching) return null
    const constraintHash = JSON.stringify(constraints)
    return `flowchart-examples-${flowchart.definition.id}-${constraintHash}`
  }, [flowchart.definition.id, constraints, enableCaching])

  // Analyze flowchart structure (paths, complexity, etc.)
  const analysis = useMemo(() => {
    try {
      return analyzeFlowchart(flowchart)
    } catch (e) {
      console.error('Error analyzing flowchart:', e)
      return null
    }
  }, [flowchart])

  // Infer grid dimensions from flowchart decision structure (for "All" view)
  const baseGridDimensions = useMemo(() => {
    if (!analysis) return null
    try {
      return inferGridDimensions(flowchart, analysis.paths)
    } catch (e) {
      console.error('Error inferring grid dimensions:', e)
      return null
    }
  }, [flowchart, analysis])

  // Load/generate examples on mount or when flowchart changes
  useEffect(() => {
    // Create a flag to track if this effect is still active (for cleanup)
    let isActive = true

    // Reset loading state when flowchart changes
    setIsLoading(true)
    setError(null)

    // Try to load from cache first
    if (storageKey) {
      try {
        const cached = sessionStorage.getItem(storageKey)
        if (cached) {
          const parsed = JSON.parse(cached) as GeneratedExample[]
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDisplayedExamples(parsed)
            setIsLoading(false)
            return
          }
        }
      } catch (e) {
        console.error('Error loading cached examples:', e)
      }
    }

    // Generate new examples
    generateExamplesAsync(flowchart, exampleCount, constraints)
      .then((examples) => {
        if (isActive) {
          setDisplayedExamples(examples)
          setError(null)
        }
        if (storageKey) {
          try {
            sessionStorage.setItem(storageKey, JSON.stringify(examples))
          } catch (e) {
            console.error('Error caching examples:', e)
          }
        }
      })
      .catch((e) => {
        console.error('Error generating examples:', e)
        if (isActive) {
          setError(e instanceof Error ? e.message : 'Failed to generate examples')
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    // Cleanup: mark this effect as inactive if component unmounts or deps change
    return () => {
      isActive = false
    }
  }, [flowchart, exampleCount, constraints, storageKey])

  // Calculate difficulty range for visual indicators
  const difficultyRange = useMemo(() => {
    if (displayedExamples.length === 0) return { min: 0, max: 0 }
    const scores = displayedExamples.map(
      (ex) => ex.complexity.decisions + ex.complexity.checkpoints
    )
    return { min: Math.min(...scores), max: Math.max(...scores) }
  }, [displayedExamples])

  // Get difficulty level (1-3) for an example
  const getDifficultyLevel = useCallback(
    (example: GeneratedExample): 1 | 2 | 3 => {
      const score = example.complexity.decisions + example.complexity.checkpoints
      const { min, max } = difficultyRange
      if (max === min) return 1
      const normalized = (score - min) / (max - min)
      if (normalized < 0.25) return 1
      if (normalized < 0.75) return 2
      return 3
    },
    [difficultyRange]
  )

  // Get difficulty tier for an example
  const getDifficultyTier = useCallback(
    (example: GeneratedExample): 'easy' | 'medium' | 'hard' => {
      const level = getDifficultyLevel(example)
      switch (level) {
        case 1:
          return 'easy'
        case 2:
          return 'medium'
        case 3:
          return 'hard'
      }
    },
    [getDifficultyLevel]
  )

  // Filter examples by selected tier
  const filteredExamples = useMemo(() => {
    if (selectedTier === 'all') return displayedExamples
    return displayedExamples.filter((ex) => getDifficultyTier(ex) === selectedTier)
  }, [displayedExamples, selectedTier, getDifficultyTier])

  // Count examples by tier
  const tierCounts = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const ex of displayedExamples) {
      counts[getDifficultyTier(ex)]++
    }
    return counts
  }, [displayedExamples, getDifficultyTier])

  // Smart labels for tiers
  const tierLabels = useMemo(() => {
    const labels: { easy: string; medium: string; hard: string } = {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
    }

    if (!baseGridDimensions) return labels

    const is2D = baseGridDimensions.cols.length > 0
    const tiers: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard']

    for (const tier of tiers) {
      const tierExamples = displayedExamples.filter((ex) => getDifficultyTier(ex) === tier)
      if (tierExamples.length === 0) continue

      const rowIndices = new Set<number>()
      const colIndices = new Set<number>()

      for (const ex of tierExamples) {
        const cell = baseGridDimensions.cellMap.get(ex.pathDescriptor)
        if (cell) {
          rowIndices.add(cell[0])
          if (is2D) colIndices.add(cell[1])
        }
      }

      if (rowIndices.size === 1) {
        const rowIdx = [...rowIndices][0]
        if (rowIdx < baseGridDimensions.rows.length) {
          labels[tier] = baseGridDimensions.rows[rowIdx]
        }
      } else if (is2D && colIndices.size === 1) {
        const colIdx = [...colIndices][0]
        if (colIdx < baseGridDimensions.cols.length) {
          labels[tier] = baseGridDimensions.cols[colIdx]
        }
      }
    }

    return labels
  }, [displayedExamples, baseGridDimensions, getDifficultyTier])

  // Dynamic grid dimensions based on filtered examples
  const gridDimensions = useMemo(() => {
    if (selectedTier === 'all') return baseGridDimensions

    try {
      return inferGridDimensionsFromExamples(flowchart, filteredExamples)
    } catch (e) {
      console.error('Error inferring dynamic grid dimensions:', e)
      return baseGridDimensions
    }
  }, [flowchart, selectedTier, filteredExamples, baseGridDimensions])

  // Difficulty colors
  const getDifficultyBorderColor = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return { base: 'green.500', _dark: 'green.400' }
      case 2:
        return { base: 'orange.500', _dark: 'orange.400' }
      case 3:
        return { base: 'red.500', _dark: 'red.400' }
    }
  }

  // Precompute new examples when user starts dragging the dice
  const handleDragStart = useCallback(() => {
    pendingExamplesRef.current = generateExamplesAsync(flowchart, exampleCount, constraints)
  }, [flowchart, exampleCount, constraints])

  // Handle dice roll
  const handleRoll = useCallback(async () => {
    let newExamples: GeneratedExample[] | null = null

    if (pendingExamplesRef.current) {
      try {
        newExamples = await pendingExamplesRef.current
      } catch (e) {
        console.error('Error from worker:', e)
      }
      pendingExamplesRef.current = null
    } else {
      try {
        newExamples = await generateExamplesAsync(flowchart, exampleCount, constraints)
      } catch (e) {
        console.error('Error generating examples:', e)
      }
    }

    if (newExamples) {
      setDisplayedExamples(newExamples)
      if (storageKey) {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(newExamples))
        } catch (e) {
          console.error('Error caching examples:', e)
        }
      }
    }
  }, [flowchart, exampleCount, constraints, storageKey])

  // Handle instant roll (shift+click)
  const handleInstantRoll = useCallback(async () => {
    try {
      const newExamples = await generateExamplesAsync(flowchart, exampleCount, constraints)
      setDisplayedExamples(newExamples)
      if (storageKey) {
        sessionStorage.setItem(storageKey, JSON.stringify(newExamples))
      }
    } catch (e) {
      console.error('Error generating examples:', e)
    }
  }, [flowchart, exampleCount, constraints, storageKey])

  // Handle example selection
  const handleExampleSelect = useCallback(
    (example: GeneratedExample) => {
      onSelect(example.values)
    },
    [onSelect]
  )

  // Format example for display using the shared formatProblemDisplay
  // This handles display.problem expressions for LLM-generated flowcharts
  const formatExampleDisplay = (values: Record<string, ProblemValue>): string => {
    return formatProblemDisplay(flowchart, values)
  }

  // Check if difficulty tabs should be shown
  const availableTiers = [
    tierCounts.easy > 0 ? 'easy' : null,
    tierCounts.medium > 0 ? 'medium' : null,
    tierCounts.hard > 0 ? 'hard' : null,
  ].filter(Boolean) as ('easy' | 'medium' | 'hard')[]

  const allLabelsFromGrid = availableTiers.every(
    (tier) =>
      tierLabels[tier] !== 'Easy' && tierLabels[tier] !== 'Medium' && tierLabels[tier] !== 'Hard'
  )

  const shouldShowTabs =
    showDifficultyFilter &&
    displayedExamples.length > 0 &&
    availableTiers.length > 1 &&
    !allLabelsFromGrid

  // Cell sizes based on compact mode
  const cellMinHeight = compact ? '50px' : '60px'
  const cellPadding = compact ? '2' : '3'
  const fontSize = compact ? 'md' : 'lg'

  if (isLoading) {
    return (
      <div
        data-testid="example-grid-loading"
        className={css({
          padding: '4',
          textAlign: 'center',
          color: { base: 'gray.500', _dark: 'gray.400' },
        })}
      >
        Generating examples...
      </div>
    )
  }

  return (
    <div
      data-testid="flowchart-example-grid"
      className={vstack({ gap: '3', alignItems: 'stretch' })}
    >
      {/* Header with dice and difficulty filter */}
      <div className={hstack({ gap: '2', justifyContent: 'space-between', alignItems: 'center' })}>
        {/* Difficulty filter tabs */}
        {shouldShowTabs ? (
          <div
            data-element="difficulty-filter"
            className={css({
              display: 'inline-flex',
              backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
              borderRadius: 'lg',
              padding: '0.5',
              gap: '0.5',
            })}
          >
            {tierCounts.easy > 0 && (
              <button
                data-tier="easy"
                data-selected={selectedTier === 'easy'}
                onClick={() => setSelectedTier(selectedTier === 'easy' ? 'all' : 'easy')}
                className={css({
                  paddingX: '3',
                  paddingY: '1',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  borderRadius: 'md',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  backgroundColor:
                    selectedTier === 'easy' ? { base: 'white', _dark: 'gray.600' } : 'transparent',
                  color:
                    selectedTier === 'easy'
                      ? { base: 'emerald.600', _dark: 'emerald.300' }
                      : { base: 'gray.600', _dark: 'gray.300' },
                  boxShadow: selectedTier === 'easy' ? 'sm' : 'none',
                })}
              >
                {tierLabels.easy}
              </button>
            )}
            {tierCounts.medium > 0 && (
              <button
                data-tier="medium"
                data-selected={selectedTier === 'medium'}
                onClick={() => setSelectedTier(selectedTier === 'medium' ? 'all' : 'medium')}
                className={css({
                  paddingX: '3',
                  paddingY: '1',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  borderRadius: 'md',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  backgroundColor:
                    selectedTier === 'medium'
                      ? { base: 'white', _dark: 'gray.600' }
                      : 'transparent',
                  color:
                    selectedTier === 'medium'
                      ? { base: 'amber.600', _dark: 'amber.300' }
                      : { base: 'gray.600', _dark: 'gray.300' },
                  boxShadow: selectedTier === 'medium' ? 'sm' : 'none',
                })}
              >
                {tierLabels.medium}
              </button>
            )}
            {tierCounts.hard > 0 && (
              <button
                data-tier="hard"
                data-selected={selectedTier === 'hard'}
                onClick={() => setSelectedTier(selectedTier === 'hard' ? 'all' : 'hard')}
                className={css({
                  paddingX: '3',
                  paddingY: '1',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  borderRadius: 'md',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  backgroundColor:
                    selectedTier === 'hard' ? { base: 'white', _dark: 'gray.600' } : 'transparent',
                  color:
                    selectedTier === 'hard'
                      ? { base: 'rose.600', _dark: 'rose.300' }
                      : { base: 'gray.600', _dark: 'gray.300' },
                  boxShadow: selectedTier === 'hard' ? 'sm' : 'none',
                })}
              >
                {tierLabels.hard}
              </button>
            )}
          </div>
        ) : (
          <div /> /* Spacer */
        )}

        {/* Dice button */}
        {showDice && (
          <InteractiveDice
            onRoll={handleRoll}
            onDragStart={handleDragStart}
            onRollComplete={() => {}}
            onInstantRoll={handleInstantRoll}
            size={16}
            title="Roll for new examples (shift+click for instant)"
            className={css({
              padding: '1',
              borderRadius: 'md',
              backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
              border: 'none',
              transition: 'all 0.2s',
              cursor: 'pointer',
              _hover: {
                backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
                transform: 'scale(1.1)',
              },
            })}
          />
        )}
      </div>

      {/* Example grid */}
      {filteredExamples.length > 0 ? (
        <div data-testid="examples-grid">
          {/* 2D Grid */}
          {gridDimensions && gridDimensions.cols.length > 0 ? (
            <div
              data-grid-type="2d"
              className={css({
                display: 'grid',
                gap: '2',
                width: '100%',
              })}
              style={{
                gridTemplateColumns: `${compact ? '60px' : '80px'} repeat(${gridDimensions.cols.length}, 1fr)`,
              }}
            >
              {/* Column headers */}
              <div key="corner" />
              {gridDimensions.cols.map((col) => (
                <div
                  key={`col-${col}`}
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'medium',
                    color: { base: 'gray.500', _dark: 'gray.400' },
                    textAlign: 'center',
                    padding: '1',
                  })}
                >
                  {col}
                </div>
              ))}

              {/* Data rows */}
              {gridDimensions.rows.flatMap((row, rowIdx) => [
                <div
                  key={`row-${rowIdx}`}
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'medium',
                    color: { base: 'gray.500', _dark: 'gray.400' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: '2',
                    textAlign: 'right',
                    lineHeight: '1.2',
                  })}
                >
                  {row}
                </div>,
                ...gridDimensions.cols.map((_, colIdx) => {
                  const example = filteredExamples.find((ex) => {
                    const cell = gridDimensions.cellMap.get(ex.pathDescriptor)
                    return cell && cell[0] === rowIdx && cell[1] === colIdx
                  })

                  if (!example) {
                    return (
                      <div
                        key={`cell-${rowIdx}-${colIdx}`}
                        className={css({
                          padding: cellPadding,
                          borderRadius: 'lg',
                          border: '2px dashed',
                          borderColor: { base: 'gray.200', _dark: 'gray.700' },
                          minHeight: cellMinHeight,
                        })}
                      />
                    )
                  }

                  const difficultyLevel = getDifficultyLevel(example)
                  return (
                    <button
                      key={`cell-${rowIdx}-${colIdx}`}
                      data-testid={`example-button-${rowIdx}-${colIdx}`}
                      onClick={() => handleExampleSelect(example)}
                      title={`${example.pathDescriptor} • ${example.complexity.pathLength} steps`}
                      className={css({
                        padding: cellPadding,
                        borderRadius: 'lg',
                        borderWidth: '3px',
                        borderStyle: 'solid',
                        borderColor: getDifficultyBorderColor(difficultyLevel),
                        backgroundColor: { base: 'white', _dark: 'gray.700/50' },
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-out',
                        _hover: {
                          transform: 'translateY(-1px)',
                        },
                        _active: {
                          transform: 'scale(0.97)',
                        },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: cellMinHeight,
                      })}
                    >
                      <div className={css({ color: { base: 'gray.900', _dark: 'white' } })}>
                        <AnimatedMathDisplay
                          expression={formatExampleDisplay(example.values)}
                          size={compact ? 'sm' : 'md'}
                        />
                      </div>
                    </button>
                  )
                }),
              ])}
            </div>
          ) : gridDimensions && gridDimensions.cols.length === 0 ? (
            /* 1D Grid */
            <div
              data-grid-type="1d"
              className={css({
                display: 'grid',
                gap: '3',
                width: '100%',
              })}
              style={{
                gridTemplateColumns: `repeat(${gridDimensions.rows.length}, 1fr)`,
              }}
            >
              {gridDimensions.rows.map((group, groupIdx) => {
                const groupExamples = filteredExamples
                  .filter((ex) => {
                    const cell = gridDimensions.cellMap.get(ex.pathDescriptor)
                    return cell && cell[0] === groupIdx
                  })
                  .slice(0, 3)

                return (
                  <div
                    key={`group-${groupIdx}`}
                    className={vstack({ gap: '2', alignItems: 'stretch' })}
                  >
                    <div
                      className={css({
                        fontSize: 'xs',
                        fontWeight: 'semibold',
                        color: { base: 'gray.600', _dark: 'gray.300' },
                        textAlign: 'center',
                        paddingBottom: '1',
                        borderBottom: '1px solid',
                        borderColor: { base: 'gray.200', _dark: 'gray.700' },
                      })}
                    >
                      {group}
                    </div>
                    {groupExamples.map((example, idx) => {
                      const difficultyLevel = getDifficultyLevel(example)
                      return (
                        <button
                          key={`${example.pathSignature}-${idx}`}
                          data-testid={`example-button-${groupIdx}-${idx}`}
                          onClick={() => handleExampleSelect(example)}
                          title={`${example.pathDescriptor} • ${example.complexity.pathLength} steps`}
                          className={css({
                            padding: cellPadding,
                            borderRadius: 'lg',
                            borderWidth: '3px',
                            borderStyle: 'solid',
                            borderColor: getDifficultyBorderColor(difficultyLevel),
                            backgroundColor: { base: 'white', _dark: 'gray.700/50' },
                            cursor: 'pointer',
                            transition: 'all 0.15s ease-out',
                            _hover: {
                              transform: 'translateY(-1px)',
                            },
                            _active: {
                              transform: 'scale(0.97)',
                            },
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: cellMinHeight,
                          })}
                        >
                          <div className={css({ color: { base: 'gray.900', _dark: 'white' } })}>
                            <AnimatedMathDisplay
                              expression={formatExampleDisplay(example.values)}
                              size={compact ? 'sm' : 'md'}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : (
            /* Fallback: flat 3-column grid */
            <div
              data-grid-type="flat"
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '2',
                width: '100%',
              })}
            >
              {filteredExamples.slice(0, compact ? 9 : 12).map((example, idx) => {
                const difficultyLevel = getDifficultyLevel(example)
                return (
                  <button
                    key={`${example.pathSignature}-${idx}`}
                    data-testid={`example-button-${idx}`}
                    onClick={() => handleExampleSelect(example)}
                    title={`${example.pathDescriptor} • ${example.complexity.pathLength} steps`}
                    className={css({
                      padding: cellPadding,
                      borderRadius: 'lg',
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderColor: getDifficultyBorderColor(difficultyLevel),
                      backgroundColor: { base: 'white', _dark: 'gray.700/50' },
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-out',
                      _hover: {
                        transform: 'translateY(-1px)',
                      },
                      _active: {
                        transform: 'scale(0.97)',
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '1',
                      minHeight: cellMinHeight,
                    })}
                  >
                    <div className={css({ color: { base: 'gray.900', _dark: 'white' } })}>
                      <AnimatedMathDisplay
                        expression={formatExampleDisplay(example.values)}
                        size={compact ? 'sm' : 'md'}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : displayedExamples.length > 0 && selectedTier !== 'all' ? (
        <div
          className={css({
            padding: '4',
            textAlign: 'center',
            color: { base: 'gray.500', _dark: 'gray.400' },
            fontSize: 'sm',
          })}
        >
          No {selectedTier} examples available.
        </div>
      ) : (
        <div
          className={css({
            padding: '4',
            textAlign: 'center',
            color: { base: 'gray.500', _dark: 'gray.400' },
            fontSize: 'sm',
          })}
        >
          {error ? (
            <>
              <span className={css({ color: { base: 'red.600', _dark: 'red.400' } })}>
                Error: {error}
              </span>
            </>
          ) : (
            'No examples could be generated.'
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import * as Dialog from '@radix-ui/react-dialog'
import type {
  ProblemInputSchema,
  Field,
  ProblemValue,
  MixedNumberValue,
  ExecutableFlowchart,
} from '@/lib/flowcharts/schema'
import { evaluate } from '@/lib/flowcharts/evaluator'
import {
  generateDiverseExamples,
  analyzeFlowchart,
  inferGridDimensions,
  inferGridDimensionsFromExamples,
  calculatePathComplexity,
  type GeneratedExample,
  type GenerationConstraints,
  type GridDimensions,
  DEFAULT_CONSTRAINTS,
} from '@/lib/flowcharts/loader'
import { InteractiveDice } from '@/components/ui/InteractiveDice'
import { TeacherConfigPanel } from './TeacherConfigPanel'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'
import { MathDisplay } from './MathDisplay'

/** Difficulty tier for filtering examples */
type DifficultyTier = 'easy' | 'medium' | 'hard' | 'all'

/** Default number of examples to generate for the example picker grid */
const DEFAULT_EXAMPLES_TO_GENERATE = 100

interface FlowchartProblemInputProps {
  schema: ProblemInputSchema
  onSubmit: (values: Record<string, ProblemValue>) => void
  /** The loaded flowchart (used to calculate path complexity for examples and display title) */
  flowchart?: ExecutableFlowchart
  /** When true, renders as a Dialog.Content for use in a modal */
  asModal?: boolean
  /** Called when the modal close button is clicked (only used when asModal=true) */
  onClose?: () => void
}

/**
 * Dynamic problem input form based on schema definition.
 * Renders appropriate input fields based on field types.
 */
export function FlowchartProblemInput({
  schema,
  onSubmit,
  flowchart,
  asModal = false,
  onClose,
}: FlowchartProblemInputProps) {
  const [values, setValues] = useState<Record<string, ProblemValue>>(() =>
    initializeValues(schema.fields)
  )
  const [error, setError] = useState<string | null>(null)
  // Teacher-configurable constraints for problem generation
  const [constraints, setConstraints] = useState<GenerationConstraints>(DEFAULT_CONSTRAINTS)
  // Displayed examples - updated when dice roll completes
  const [displayedExamples, setDisplayedExamples] = useState<GeneratedExample[]>([])
  // Pending examples - pre-computed during drag, shown on roll complete
  const pendingExamplesRef = useRef<GeneratedExample[] | null>(null)
  // Track if we've loaded from cache
  const loadedFromCacheRef = useRef(false)
  // Track which example is being edited (shows popover editor)
  const [editingExample, setEditingExample] = useState<{
    example: GeneratedExample
    buttonRect: DOMRect
  } | null>(null)
  // Selected difficulty tier for filtering examples
  const [selectedTier, setSelectedTier] = useState<DifficultyTier>('all')
  // Adjustable example count (via Teacher Settings)
  const [exampleCount, setExampleCount] = useState(DEFAULT_EXAMPLES_TO_GENERATE)
  // Ref to the container for positioning the popover
  const containerRef = useRef<HTMLDivElement>(null)
  // Visual debug mode
  const { isVisualDebugEnabled } = useVisualDebugSafe()

  // Create a stable storage key for caching examples
  const storageKey = useMemo(() => {
    if (!flowchart) return null
    const constraintHash = JSON.stringify(constraints)
    return `flowchart-examples-${flowchart.definition.id}-${constraintHash}`
  }, [flowchart, constraints])

  // Analyze flowchart structure (paths, complexity, etc.)
  const analysis = useMemo(() => {
    if (!flowchart) return null
    try {
      return analyzeFlowchart(flowchart)
    } catch (e) {
      console.error('Error analyzing flowchart:', e)
      return null
    }
  }, [flowchart])

  // Infer grid dimensions from flowchart decision structure (for "All" view)
  const baseGridDimensions = useMemo(() => {
    if (!flowchart || !analysis) return null
    try {
      return inferGridDimensions(flowchart, analysis.paths)
    } catch (e) {
      console.error('Error inferring grid dimensions:', e)
      return null
    }
  }, [flowchart, analysis])

  // Try to load cached examples from session storage on first render
  useEffect(() => {
    if (!storageKey || loadedFromCacheRef.current) return
    loadedFromCacheRef.current = true

    try {
      const cached = sessionStorage.getItem(storageKey)
      if (cached) {
        const parsed = JSON.parse(cached) as GeneratedExample[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDisplayedExamples(parsed)
          return
        }
      }
    } catch (e) {
      console.error('Error loading cached examples:', e)
    }

    // No cache found, generate new examples
    if (flowchart) {
      try {
        const examples = generateDiverseExamples(flowchart, exampleCount, constraints)
        setDisplayedExamples(examples)
        sessionStorage.setItem(storageKey, JSON.stringify(examples))
      } catch (e) {
        console.error('Error generating examples:', e)
      }
    }
  }, [flowchart, constraints, storageKey])

  // The displayed examples (from cache or fresh generation)
  const generatedExamples = displayedExamples

  // Calculate coverage: how many unique paths are represented in current examples
  const pathsCovered = useMemo(() => {
    const uniquePaths = new Set(generatedExamples.map((ex) => ex.pathSignature))
    return uniquePaths.size
  }, [generatedExamples])

  // Calculate difficulty range for visual indicators
  const difficultyRange = useMemo(() => {
    if (generatedExamples.length === 0) return { min: 0, max: 0 }
    const scores = generatedExamples.map(
      (ex) => ex.complexity.decisions + ex.complexity.checkpoints
    )
    return { min: Math.min(...scores), max: Math.max(...scores) }
  }, [generatedExamples])

  // Get difficulty level (1-3) for an example
  // Tier boundaries: Easy (bottom 25%), Medium (middle 50%), Hard (top 25%)
  // Wider medium tier = more stable grid dimensions
  const getDifficultyLevel = (example: GeneratedExample): 1 | 2 | 3 => {
    const score = example.complexity.decisions + example.complexity.checkpoints
    const { min, max } = difficultyRange
    if (max === min) return 1
    const normalized = (score - min) / (max - min)
    if (normalized < 0.25) return 1
    if (normalized < 0.75) return 2
    return 3
  }

  // Get difficulty tier for an example (matches the tier selection)
  const getDifficultyTier = (example: GeneratedExample): 'easy' | 'medium' | 'hard' => {
    const level = getDifficultyLevel(example)
    switch (level) {
      case 1:
        return 'easy'
      case 2:
        return 'medium'
      case 3:
        return 'hard'
    }
  }

  // Filter examples by selected tier
  const filteredExamples = useMemo(() => {
    if (selectedTier === 'all') return generatedExamples
    return generatedExamples.filter((ex) => getDifficultyTier(ex) === selectedTier)
  }, [generatedExamples, selectedTier, difficultyRange])

  // Count examples by tier for display
  const tierCounts = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const ex of generatedExamples) {
      counts[getDifficultyTier(ex)]++
    }
    return counts
  }, [generatedExamples, difficultyRange])

  // Smart labels for tiers - if all examples in a tier share a dimension, use that as the label
  const tierLabels = useMemo(() => {
    const labels: { easy: string; medium: string; hard: string } = {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
    }

    if (!baseGridDimensions) {
      return labels
    }

    const is2D = baseGridDimensions.cols.length > 0
    const tiers: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard']

    for (const tier of tiers) {
      const tierExamples = generatedExamples.filter((ex) => getDifficultyTier(ex) === tier)
      if (tierExamples.length === 0) continue

      // Check if all examples share the same row (and column for 2D grids)
      const rowIndices = new Set<number>()
      const colIndices = new Set<number>()

      for (const ex of tierExamples) {
        const cell = baseGridDimensions.cellMap.get(ex.pathDescriptor)
        if (cell) {
          rowIndices.add(cell[0])
          if (is2D) colIndices.add(cell[1])
        }
      }

      // If all examples are in the same row, use that row's label
      if (rowIndices.size === 1) {
        const rowIdx = [...rowIndices][0]
        if (rowIdx < baseGridDimensions.rows.length) {
          labels[tier] = baseGridDimensions.rows[rowIdx]
        }
      }
      // If all examples are in the same column (2D grid only), use that column's label
      else if (is2D && colIndices.size === 1) {
        const colIdx = [...colIndices][0]
        if (colIdx < baseGridDimensions.cols.length) {
          labels[tier] = baseGridDimensions.cols[colIdx]
        }
      }
    }

    return labels
  }, [generatedExamples, baseGridDimensions, difficultyRange])

  // Dynamic grid dimensions based on filtered examples
  // When a tier is selected, use the dimensions that actually vary within that tier
  const gridDimensions = useMemo(() => {
    if (!flowchart) return null

    // For "All" view, use the base grid dimensions (from all paths)
    if (selectedTier === 'all') {
      return baseGridDimensions
    }

    // For tier-filtered views, dynamically infer dimensions from filtered examples
    try {
      return inferGridDimensionsFromExamples(flowchart, filteredExamples)
    } catch (e) {
      console.error('Error inferring dynamic grid dimensions:', e)
      // Fall back to base dimensions if dynamic inference fails
      return baseGridDimensions
    }
  }, [flowchart, selectedTier, filteredExamples, baseGridDimensions])

  // Get border color based on difficulty
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

  // Get button background color based on difficulty
  const getDifficultyButtonColor = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return { base: 'green.500', _dark: 'green.600' }
      case 2:
        return { base: 'orange.500', _dark: 'orange.600' }
      case 3:
        return { base: 'red.500', _dark: 'red.600' }
    }
  }

  // Get button hover color based on difficulty
  const getDifficultyButtonHoverColor = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return { base: 'green.600', _dark: 'green.500' }
      case 2:
        return { base: 'orange.600', _dark: 'orange.500' }
      case 3:
        return { base: 'red.600', _dark: 'red.500' }
    }
  }

  // Calculate the difficulty level for current editor values (updates as user types)
  const editorDifficultyLevel = useMemo((): 1 | 2 | 3 => {
    if (!flowchart || !editingExample) return 1

    try {
      const complexity = calculatePathComplexity(flowchart, values)
      const score = complexity.decisions + complexity.checkpoints
      const { min, max } = difficultyRange
      if (max === min) return 1
      const normalized = (score - min) / (max - min)
      if (normalized < 0.25) return 1
      if (normalized < 0.75) return 2
      return 3
    } catch {
      // If complexity calculation fails, default to medium
      return 2
    }
  }, [flowchart, editingExample, values, difficultyRange])

  // Precompute new examples when user starts dragging the dice
  const handleDragStart = useCallback(() => {
    if (!flowchart) return
    try {
      // Compute new examples during drag - one per unique pedagogical path
      pendingExamplesRef.current = generateDiverseExamples(flowchart, exampleCount, constraints)
    } catch (e) {
      console.error('Error pre-generating examples:', e)
    }
  }, [flowchart, constraints])

  // Show new examples after the dice roll animation completes
  const handleRollComplete = useCallback(() => {
    let newExamples: GeneratedExample[] | null = null

    // If we have pre-computed examples from drag, use them
    if (pendingExamplesRef.current) {
      newExamples = pendingExamplesRef.current
      pendingExamplesRef.current = null
    } else if (flowchart) {
      // Click-only roll - compute now (animation masked the compute time)
      try {
        newExamples = generateDiverseExamples(flowchart, exampleCount, constraints)
      } catch (e) {
        console.error('Error generating examples:', e)
      }
    }

    if (newExamples) {
      setDisplayedExamples(newExamples)
      // Save to session storage
      if (storageKey) {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(newExamples))
        } catch (e) {
          console.error('Error caching examples:', e)
        }
      }
    }
  }, [flowchart, constraints, storageKey])

  // Handler for dice roll - we don't update examples here anymore
  // (examples update on completion via handleRollComplete)
  const handleRoll = useCallback(() => {
    // The actual example update happens in handleRollComplete
    // This is called immediately when rolled - could add a spinning indicator here
  }, [])

  // Handler for instant roll (shift+click) - bypasses animation
  const handleInstantRoll = useCallback(() => {
    if (!flowchart) return
    try {
      const newExamples = generateDiverseExamples(flowchart, exampleCount, constraints)
      setDisplayedExamples(newExamples)
      if (storageKey) {
        sessionStorage.setItem(storageKey, JSON.stringify(newExamples))
      }
    } catch (e) {
      console.error('Error generating examples:', e)
    }
  }, [flowchart, exampleCount, constraints, storageKey])

  const handleChange = useCallback((name: string, value: ProblemValue) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }, [])

  // Handle constraint changes - regenerate examples with new constraints
  const handleConstraintsChange = useCallback(
    (newConstraints: GenerationConstraints) => {
      setConstraints(newConstraints)
      // Reset the cache loading flag so new examples will be generated with new constraints
      loadedFromCacheRef.current = false
      setDisplayedExamples([])
    },
    []
  )

  const handleExampleSelect = useCallback(
    (example: GeneratedExample) => {
      // Clicking an example immediately starts the flowchart with that problem
      onSubmit(example.values)
    },
    [onSubmit]
  )

  // Show edit popover for an example (pencil badge click or long press)
  const handleEditExample = useCallback(
    (example: GeneratedExample, e?: React.MouseEvent | React.TouchEvent) => {
      e?.stopPropagation() // Don't trigger the main button click
      e?.preventDefault()

      // Get the button element's position
      const target = e?.currentTarget as HTMLElement
      const button = target?.closest('[data-element="example-button"]') as HTMLElement
      if (button) {
        const rect = button.getBoundingClientRect()
        setValues(example.values as Record<string, ProblemValue>)
        setEditingExample({ example, buttonRect: rect })
        setError(null)
      }
    },
    []
  )

  // Close the edit popover
  const handleCloseEditor = useCallback(() => {
    setEditingExample(null)
    setError(null)
  }, [])

  // Long press handling for mobile
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const longPressTriggeredRef = useRef(false)
  const longPressTargetRef = useRef<HTMLElement | null>(null)

  const handleTouchStart = useCallback(
    (example: GeneratedExample, e: React.TouchEvent) => {
      // Prevent text selection on long press
      e.preventDefault()
      longPressTriggeredRef.current = false
      longPressTargetRef.current = e.currentTarget as HTMLElement
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true
        // Create a synthetic event for positioning
        const button = longPressTargetRef.current
        if (button) {
          const rect = button.getBoundingClientRect()
          setValues(example.values as Record<string, ProblemValue>)
          setEditingExample({ example, buttonRect: rect })
          setError(null)
        }
      }, 500) // 500ms long press
    },
    []
  )

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    // If long press was triggered, prevent the click
    if (longPressTriggeredRef.current) {
      e.preventDefault()
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    // Cancel long press if user moves finger
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleSubmit = useCallback(() => {
    // Validate if validation expression is defined
    if (schema.validation) {
      try {
        const context = { problem: values, computed: {}, userState: {} }
        const isValid = evaluate(schema.validation, context)
        if (!isValid) {
          // Provide helpful error message based on schema type
          if (schema.schema === 'two-digit-subtraction') {
            const minuend = values.minuend as number
            const subtrahend = values.subtrahend as number
            if (minuend === 0 || subtrahend === 0) {
              setError('Please enter both numbers.')
            } else if (minuend <= subtrahend) {
              setError('Top number must be larger than bottom number.')
            } else {
              setError('Invalid input. Please check your values.')
            }
          } else {
            setError('Invalid input. Please check your values.')
          }
          return
        }
      } catch (e) {
        console.error('Validation error:', e)
        setError(`Validation error: ${(e as Error).message}`)
        return
      }
    }

    onSubmit(values)
  }, [values, schema.validation, onSubmit])

  const containerStyles = asModal
    ? css({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6',
        padding: '6',
        backgroundColor: { base: 'white', _dark: 'gray.800' },
        borderRadius: '2xl',
        boxShadow: '2xl',
        width: '95vw',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        zIndex: 101,
        _focus: { outline: 'none' },
      })
    : vstack({
        gap: '6',
        padding: '6',
        backgroundColor: { base: 'white', _dark: 'gray.800' },
        borderRadius: 'xl',
        boxShadow: 'lg',
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
        maxWidth: '400px',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
      })

  const Wrapper = asModal ? Dialog.Content : 'div'

  return (
    <Wrapper
      ref={containerRef}
      data-testid="flowchart-problem-input"
      className={containerStyles}
    >
      {/* Cozy close corner - upper right (modal only) */}
      {asModal && (
        <div
          data-element="close-corner"
          className={css({
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '44px',
            height: '44px',
            backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
            borderBottomLeftRadius: 'xl',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: '4px',
            paddingRight: '4px',
            zIndex: 20,
          })}
        >
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className={css({
                width: '28px',
                height: '28px',
                borderRadius: 'md',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: { base: 'gray.500', _dark: 'gray.400' },
                transition: 'all 0.2s',
                _hover: {
                  backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
                  transform: 'scale(1.1)',
                },
              })}
            >
              ✕
            </button>
          </Dialog.Close>
        </div>
      )}

      {/* Cozy dice corner - top-left in modal mode, top-right otherwise */}
      {generatedExamples.length > 0 && (
        <div
          data-element="dice-corner"
          className={css({
            position: 'absolute',
            top: '-4px',
            right: asModal ? undefined : '-4px',
            left: asModal ? '-4px' : undefined,
            width: '44px',
            height: '44px',
            backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
            borderBottomLeftRadius: asModal ? 'none' : 'xl',
            borderBottomRightRadius: asModal ? 'xl' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: '4px',
            paddingRight: asModal ? '0' : '4px',
            paddingLeft: asModal ? '4px' : '0',
            zIndex: 10,
          })}
        >
          <InteractiveDice
            onRoll={handleRoll}
            onDragStart={handleDragStart}
            onRollComplete={handleRollComplete}
            onInstantRoll={handleInstantRoll}
            size={18}
            title="Roll for new examples (shift+click for instant)"
            className={css({
              padding: '1',
              borderRadius: 'md',
              backgroundColor: 'transparent',
              border: 'none',
              transition: 'all 0.2s',
              cursor: 'pointer',
              _hover: {
                backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
                transform: 'scale(1.1)',
              },
            })}
          />
        </div>
      )}

      {/* Cozy gear corner - lower left (mirrors dice corner pattern) */}
      <div
        data-element="gear-corner"
        className={css({
          position: 'absolute',
          bottom: '-4px',
          left: '-4px',
          width: '44px',
          height: '44px',
          backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
          borderTopRightRadius: 'xl',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: '4px',
          paddingLeft: '4px',
          zIndex: 10,
        })}
      >
        <TeacherConfigPanel
          constraints={constraints}
          onConstraintsChange={handleConstraintsChange}
          exampleCount={exampleCount}
          onExampleCountChange={setExampleCount}
          onRegenerate={() => {
            if (flowchart) {
              const examples = generateDiverseExamples(flowchart, exampleCount, constraints)
              setDisplayedExamples(examples)
              if (storageKey) {
                sessionStorage.setItem(storageKey, JSON.stringify(examples))
              }
            }
          }}
          showDebugControls={isVisualDebugEnabled}
        />
      </div>

      {/* Title + Difficulty Filter */}
      {flowchart && (() => {
        const availableTiers = [
          tierCounts.easy > 0 ? 'easy' : null,
          tierCounts.medium > 0 ? 'medium' : null,
          tierCounts.hard > 0 ? 'hard' : null,
        ].filter(Boolean) as ('easy' | 'medium' | 'hard')[]

        // Check if all tier labels are derived from grid dimensions (not default Easy/Medium/Hard)
        // If so, tabs are redundant since the grid already shows that organization
        const allLabelsFromGrid = availableTiers.every(
          (tier) => tierLabels[tier] !== 'Easy' && tierLabels[tier] !== 'Medium' && tierLabels[tier] !== 'Hard'
        )

        const showTabs = generatedExamples.length > 0 && availableTiers.length > 1 && !allLabelsFromGrid

        return (
          <div
            data-testid="tier-selection"
            className={vstack({ gap: '3', alignItems: 'center' })}
          >
            {/* Title */}
            <h2
              data-element="title"
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: { base: 'gray.800', _dark: 'gray.100' },
                textAlign: 'center',
                letterSpacing: '-0.01em',
              })}
            >
              {flowchart.definition.title}
            </h2>

            {/* Segmented control for difficulty filter */}
            {showTabs && (
              <div
                data-element="difficulty-filter"
                className={css({
                  display: 'inline-flex',
                  backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                  borderRadius: 'xl',
                  padding: '1',
                  gap: '1',
                })}
              >
                {tierCounts.easy > 0 && (
                  <button
                    data-tier="easy"
                    data-selected={selectedTier === 'easy'}
                    onClick={() => setSelectedTier(selectedTier === 'easy' ? 'all' : 'easy')}
                    className={css({
                      paddingX: '4',
                      paddingY: '2',
                      fontSize: 'sm',
                      fontWeight: 'semibold',
                      borderRadius: 'lg',
                      border: '1px solid',
                      borderColor: selectedTier === 'easy'
                        ? { base: 'emerald.400', _dark: 'emerald.500' }
                        : { base: 'gray.300', _dark: 'gray.500' },
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      backgroundColor: selectedTier === 'easy'
                        ? { base: 'white', _dark: 'gray.600' }
                        : { base: 'gray.100', _dark: 'gray.800' },
                      color: selectedTier === 'easy'
                        ? { base: 'emerald.600', _dark: 'emerald.300' }
                        : { base: 'gray.600', _dark: 'gray.300' },
                      boxShadow: selectedTier === 'easy' ? 'sm' : 'none',
                      _hover: {
                        borderColor: { base: 'emerald.400', _dark: 'emerald.500' },
                        color: { base: 'emerald.600', _dark: 'emerald.300' },
                      },
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
                      paddingX: '4',
                      paddingY: '2',
                      fontSize: 'sm',
                      fontWeight: 'semibold',
                      borderRadius: 'lg',
                      border: '1px solid',
                      borderColor: selectedTier === 'medium'
                        ? { base: 'amber.400', _dark: 'amber.500' }
                        : { base: 'gray.300', _dark: 'gray.500' },
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      backgroundColor: selectedTier === 'medium'
                        ? { base: 'white', _dark: 'gray.600' }
                        : { base: 'gray.100', _dark: 'gray.800' },
                      color: selectedTier === 'medium'
                        ? { base: 'amber.600', _dark: 'amber.300' }
                        : { base: 'gray.600', _dark: 'gray.300' },
                      boxShadow: selectedTier === 'medium' ? 'sm' : 'none',
                      _hover: {
                        borderColor: { base: 'amber.400', _dark: 'amber.500' },
                        color: { base: 'amber.600', _dark: 'amber.300' },
                      },
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
                      paddingX: '4',
                      paddingY: '2',
                      fontSize: 'sm',
                      fontWeight: 'semibold',
                      borderRadius: 'lg',
                      border: '1px solid',
                      borderColor: selectedTier === 'hard'
                        ? { base: 'rose.400', _dark: 'rose.500' }
                        : { base: 'gray.300', _dark: 'gray.500' },
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      backgroundColor: selectedTier === 'hard'
                        ? { base: 'white', _dark: 'gray.600' }
                        : { base: 'gray.100', _dark: 'gray.800' },
                      color: selectedTier === 'hard'
                        ? { base: 'rose.600', _dark: 'rose.300' }
                        : { base: 'gray.600', _dark: 'gray.300' },
                      boxShadow: selectedTier === 'hard' ? 'sm' : 'none',
                      _hover: {
                        borderColor: { base: 'rose.400', _dark: 'rose.500' },
                        color: { base: 'rose.600', _dark: 'rose.300' },
                      },
                    })}
                  >
                    {tierLabels.hard}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Debug: Dimension distribution for current tier */}
      {isVisualDebugEnabled && selectedTier !== 'all' && baseGridDimensions && (
        <div
          data-element="debug-dimensions"
          className={css({
            fontSize: 'xs',
            fontFamily: 'mono',
            backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
            padding: '2',
            borderRadius: 'md',
            color: { base: 'gray.600', _dark: 'gray.400' },
          })}
        >
          <div><strong>Tier:</strong> {selectedTier} → Label: "{tierLabels[selectedTier as 'easy' | 'medium' | 'hard']}"</div>
          <div><strong>Base grid:</strong> {baseGridDimensions.rows.length} rows × {baseGridDimensions.cols.length} cols</div>
          <div><strong>Rows:</strong> {baseGridDimensions.rows.join(', ')}</div>
          <div><strong>Cols:</strong> {baseGridDimensions.cols.join(', ')}</div>
          <div style={{ marginTop: '4px' }}>
            <strong>Distribution ({filteredExamples.length} examples):</strong>
            {(() => {
              const rowCounts = new Map<number, number>()
              const colCounts = new Map<number, number>()
              for (const ex of filteredExamples) {
                const cell = baseGridDimensions.cellMap.get(ex.pathDescriptor)
                if (cell) {
                  rowCounts.set(cell[0], (rowCounts.get(cell[0]) || 0) + 1)
                  colCounts.set(cell[1], (colCounts.get(cell[1]) || 0) + 1)
                }
              }
              return (
                <div style={{ paddingLeft: '8px' }}>
                  <div>By row: {baseGridDimensions.rows.map((r, i) => `${r}: ${rowCounts.get(i) || 0}`).join(', ')}</div>
                  <div>By col: {baseGridDimensions.cols.map((c, i) => `${c}: ${colCounts.get(i) || 0}`).join(', ')}</div>
                  <div>Unique rows: {rowCounts.size}, Unique cols: {colCounts.size}</div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Examples Section */}
      {filteredExamples.length > 0 ? (
        <div data-testid="examples-section" className={vstack({ gap: '3', alignItems: 'stretch' })}>
          {/* Example grid - 1D or 2D layout based on grid dimensions */}
          {gridDimensions && gridDimensions.cols.length > 0 ? (
            /* 2D Grid: rows × cols */
            <div
              data-grid-type="2d"
              data-rows={gridDimensions.rows.length}
              data-cols={gridDimensions.cols.length}
              className={css({
                display: 'grid',
                gap: '2',
                width: '100%',
                alignItems: 'stretch',
              })}
              style={{
                gridTemplateColumns: `80px repeat(${gridDimensions.cols.length}, 1fr)`,
              }}
            >
              {/* Column headers (first row) */}
              <div key="corner" data-element="grid-corner" /> {/* Empty cell for top-left corner */}
              {gridDimensions.cols.map((col, colIdx) => (
                <div
                  key={`col-${col}`}
                  data-element="col-header"
                  data-col-index={colIdx}
                  data-col-label={col}
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

              {/* Data rows - flatten into single array of grid items */}
              {gridDimensions.rows.flatMap((row, rowIdx) => [
                // Row label - angled and wrapped
                <div
                  key={`row-${rowIdx}`}
                  data-element="row-label"
                  data-row-index={rowIdx}
                  data-row-label={row}
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
                    wordBreak: 'break-word',
                    hyphens: 'auto',
                  })}
                >
                  {row}
                </div>,
                // Cells for this row
                ...gridDimensions.cols.map((col, colIdx) => {
                  // Find example that matches this cell
                  const example = filteredExamples.find((ex) => {
                    const cell = gridDimensions.cellMap.get(ex.pathDescriptor)
                    return cell && cell[0] === rowIdx && cell[1] === colIdx
                  })

                  if (!example) {
                    return (
                      <div
                        key={`cell-${rowIdx}-${colIdx}`}
                        data-element="empty-cell"
                        data-row-index={rowIdx}
                        data-col-index={colIdx}
                        className={css({
                          padding: '2',
                          borderRadius: 'lg',
                          border: '2px dashed',
                          borderColor: { base: 'gray.200', _dark: 'gray.700' },
                          minHeight: '60px',
                        })}
                      />
                    )
                  }

                  const difficultyLevel = getDifficultyLevel(example)
                  return (
                    <button
                      key={`cell-${rowIdx}-${colIdx}`}
                      data-testid={`example-button-${rowIdx}-${colIdx}`}
                      data-element="example-button"
                      data-path-signature={example.pathSignature}
                      data-path-descriptor={example.pathDescriptor}
                      data-difficulty={difficultyLevel}
                      data-row-index={rowIdx}
                      data-col-index={colIdx}
                      onClick={() => {
                        if (!longPressTriggeredRef.current) {
                          handleExampleSelect(example)
                        }
                      }}
                      onTouchStart={(e) => handleTouchStart(example, e)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                      title={`${example.pathDescriptor} • ${example.complexity.pathLength} steps`}
                      className={css({
                        position: 'relative',
                        overflow: 'hidden',
                        padding: '2',
                        borderRadius: 'lg',
                        borderWidth: '3px',
                        borderStyle: 'solid',
                        borderColor: getDifficultyBorderColor(difficultyLevel),
                        backgroundColor: { base: 'white', _dark: 'gray.700/50' },
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-out',
                        userSelect: 'none',
                        WebkitTouchCallout: 'none',
                        _hover: {
                          transform: 'translateY(-1px)',
                          '& [data-element="edit-badge"]': {
                            opacity: 1,
                          },
                        },
                        _active: {
                          transform: 'scale(0.97)',
                        },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '60px',
                      })}
                    >
                      <div className={css({ color: { base: 'gray.900', _dark: 'white' } })}>
                        <MathDisplay
                          expression={formatExampleDisplay(schema.schema, example.values)}
                          size="md"
                        />
                      </div>
                      {/* Pencil badge to show edit popover (visible on hover, long-press on mobile) */}
                      <span
                        data-element="edit-badge"
                        onClick={(e) => handleEditExample(example, e)}
                        title="Edit problem"
                        className={css({
                          position: 'absolute',
                          top: '0',
                          right: '0',
                          width: '20px',
                          height: '20px',
                          borderRadius: '3px',
                          backgroundColor: { base: 'gray.100', _dark: 'gray.600' },
                          borderLeft: '1px solid',
                          borderBottom: '1px solid',
                          borderColor: { base: 'gray.300', _dark: 'gray.500' },
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          opacity: 0,
                          _hover: {
                            backgroundColor: { base: 'blue.100', _dark: 'blue.700' },
                          },
                        })}
                      >
                        ✏️
                      </span>
                    </button>
                  )
                }),
              ])}
            </div>
          ) : gridDimensions && gridDimensions.cols.length === 0 ? (
            /* 1D Grid: horizontal groups */
            <div
              data-grid-type="1d"
              data-groups={gridDimensions.rows.length}
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
                // Find up to 3 examples for this group
                const groupExamples = filteredExamples
                  .filter((ex) => {
                    const cell = gridDimensions.cellMap.get(ex.pathDescriptor)
                    return cell && cell[0] === groupIdx
                  })
                  .slice(0, 3)

                return (
                  <div
                    key={`group-${groupIdx}`}
                    data-element="example-group"
                    data-group-index={groupIdx}
                    data-group-label={group}
                    className={vstack({ gap: '2', alignItems: 'stretch' })}
                  >
                    {/* Group header */}
                    <div
                      data-element="group-header"
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
                    {/* Up to 3 examples in this group */}
                    {groupExamples.map((example, idx) => {
                      const difficultyLevel = getDifficultyLevel(example)
                      return (
                        <button
                          key={`${example.pathSignature}-${idx}`}
                          data-testid={`example-button-${groupIdx}-${idx}`}
                          data-element="example-button"
                          data-path-signature={example.pathSignature}
                          data-path-descriptor={example.pathDescriptor}
                          data-difficulty={difficultyLevel}
                          data-group-index={groupIdx}
                          onClick={() => {
                            if (!longPressTriggeredRef.current) {
                              handleExampleSelect(example)
                            }
                          }}
                          onTouchStart={(e) => handleTouchStart(example, e)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchMove}
                          title={`${example.pathDescriptor} • ${example.complexity.pathLength} steps`}
                          className={css({
                            position: 'relative',
                            overflow: 'hidden',
                            padding: '3',
                            borderRadius: 'lg',
                            borderWidth: '3px',
                            borderStyle: 'solid',
                            borderColor: getDifficultyBorderColor(difficultyLevel),
                            backgroundColor: { base: 'white', _dark: 'gray.700/50' },
                            cursor: 'pointer',
                            transition: 'all 0.15s ease-out',
                            userSelect: 'none',
                            WebkitTouchCallout: 'none',
                            _hover: {
                              transform: 'translateY(-1px)',
                              '& [data-element="edit-badge"]': {
                                opacity: 1,
                              },
                            },
                            _active: {
                              transform: 'scale(0.97)',
                            },
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '70px',
                          })}
                        >
                          <div className={css({ color: { base: 'gray.900', _dark: 'white' } })}>
                            <MathDisplay
                              expression={formatExampleDisplay(schema.schema, example.values)}
                              size="md"
                            />
                          </div>
                          {/* Pencil badge to show edit popover (visible on hover, long-press on mobile) */}
                          <span
                            data-element="edit-badge"
                            onClick={(e) => handleEditExample(example, e)}
                            title="Edit problem"
                            className={css({
                              position: 'absolute',
                              top: '0',
                              right: '0',
                              width: '20px',
                              height: '20px',
                              borderRadius: '3px',
                              backgroundColor: { base: 'gray.100', _dark: 'gray.600' },
                              borderLeft: '1px solid',
                              borderBottom: '1px solid',
                              borderColor: { base: 'gray.300', _dark: 'gray.500' },
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              opacity: 0,
                              _hover: {
                                backgroundColor: { base: 'blue.100', _dark: 'blue.700' },
                              },
                            })}
                          >
                            ✏️
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : (
            /* Fallback: flat 3-column grid when no grid dimensions */
            <div
              data-grid-type="flat"
              data-count={filteredExamples.length}
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '2',
                width: '100%',
              })}
            >
              {filteredExamples.map((example, idx) => (
                <button
                  key={`${example.pathSignature}-${idx}`}
                  data-testid={`example-button-${idx}`}
                  data-element="example-button"
                  data-path-signature={example.pathSignature}
                  data-path-descriptor={example.pathDescriptor}
                  data-index={idx}
                  onClick={() => {
                    if (!longPressTriggeredRef.current) {
                      handleExampleSelect(example)
                    }
                  }}
                  onTouchStart={(e) => handleTouchStart(example, e)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                  title={`${example.pathDescriptor} • ${example.complexity.pathLength} steps`}
                  className={css({
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '3',
                    borderRadius: 'lg',
                    border: '2px solid',
                    borderColor: { base: 'gray.200', _dark: 'gray.600' },
                    backgroundColor: { base: 'white', _dark: 'gray.700/50' },
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-out',
                    userSelect: 'none',
                    WebkitTouchCallout: 'none',
                    _hover: {
                      borderColor: { base: 'blue.400', _dark: 'blue.400' },
                      backgroundColor: { base: 'blue.50', _dark: 'blue.900/30' },
                      transform: 'translateY(-1px)',
                      '& [data-element="edit-badge"]': {
                        opacity: 1,
                      },
                    },
                    _active: {
                      transform: 'scale(0.97)',
                      backgroundColor: { base: 'blue.100', _dark: 'blue.900/50' },
                    },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1',
                    minHeight: '70px',
                  })}
                >
                  <div className={css({ color: { base: 'gray.900', _dark: 'white' } })}>
                    <MathDisplay
                      expression={formatExampleDisplay(schema.schema, example.values)}
                      size="md"
                    />
                  </div>
                  <div
                    className={css({
                      fontSize: '2xs',
                      color: { base: 'gray.400', _dark: 'gray.500' },
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                    })}
                  >
                    {example.pathDescriptor}
                  </div>
                  {/* Pencil badge to show edit popover (visible on hover, long-press on mobile) */}
                  <span
                    data-element="edit-badge"
                    onClick={(e) => handleEditExample(example, e)}
                    title="Edit problem"
                    className={css({
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      width: '20px',
                      height: '20px',
                      borderRadius: '3px',
                      backgroundColor: { base: 'gray.100', _dark: 'gray.600' },
                      borderLeft: '1px solid',
                      borderBottom: '1px solid',
                      borderColor: { base: 'gray.300', _dark: 'gray.500' },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      opacity: 0,
                      _hover: {
                        backgroundColor: { base: 'blue.100', _dark: 'blue.700' },
                      },
                    })}
                  >
                    ✏️
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : generatedExamples.length > 0 && selectedTier !== 'all' ? (
        /* No examples in selected tier */
        <div
          data-testid="no-tier-examples"
          className={css({
            padding: '4',
            textAlign: 'center',
            color: { base: 'gray.500', _dark: 'gray.400' },
            fontSize: 'sm',
          })}
        >
          No {selectedTier} examples available. Try selecting a different difficulty level.
        </div>
      ) : null}

      {/* Edit Popover - shows when editing an example */}
      {/* Use portal to escape modal's transform containing block for correct fixed positioning */}
      {editingExample && containerRef.current && createPortal(
        <>
          {/* Backdrop to close on click outside */}
          <div
            data-element="edit-backdrop"
            onClick={handleCloseEditor}
            className={css({
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              zIndex: 200, // Higher than modal (101) to work in modal mode
            })}
          />
          {/* Popover positioned over the example */}
          <div
            data-section="edit-popover"
            data-schema={schema.schema}
            data-difficulty={editorDifficultyLevel}
            className={css({
              position: 'fixed',
              zIndex: 201, // Higher than modal (101) to work in modal mode
              padding: '3',
              borderRadius: 'lg',
              border: '3px solid',
              borderColor: getDifficultyBorderColor(editorDifficultyLevel),
              backgroundColor: { base: 'white', _dark: 'gray.800' },
              boxShadow: 'xl',
              width: 'max-content',
              transition: 'border-color 0.2s ease-out',
            })}
            style={{
              // Center over the button
              top: `${editingExample.buttonRect.top + editingExample.buttonRect.height / 2}px`,
              left: `${editingExample.buttonRect.left + editingExample.buttonRect.width / 2}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
              {/* Close button */}
              <button
                data-element="close-button"
                onClick={handleCloseEditor}
                className={css({
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '20px',
                  height: '20px',
                  borderRadius: 'full',
                  backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                  _hover: {
                    backgroundColor: { base: 'gray.200', _dark: 'gray.600' },
                  },
                })}
              >
                ✕
              </button>

              {/* Input fields */}
              {schema.schema === 'two-digit-subtraction' ? (
                <TwoDigitSubtractionInput values={values} onChange={handleChange} />
              ) : schema.schema === 'two-fractions-with-op' ? (
                <TwoFractionsInput values={values} onChange={handleChange} />
              ) : schema.schema === 'linear-equation' ? (
                <LinearEquationInput values={values} onChange={handleChange} />
              ) : (
                <GenericFieldsInput fields={schema.fields} values={values} onChange={handleChange} />
              )}

              {/* Error message */}
              {error && (
                <p
                  data-element="error-message"
                  className={css({
                    color: { base: 'red.600', _dark: 'red.400' },
                    fontSize: 'sm',
                    textAlign: 'center',
                  })}
                >
                  {error}
                </p>
              )}

              {/* Submit button */}
              <button
                data-testid="start-button"
                data-difficulty={editorDifficultyLevel}
                onClick={() => {
                  handleSubmit()
                  // Close popover after successful submit (handleSubmit sets error if invalid)
                }}
                className={css({
                  width: '100%',
                  padding: '1.5',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  borderRadius: 'md',
                  backgroundColor: getDifficultyButtonColor(editorDifficultyLevel),
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    backgroundColor: getDifficultyButtonHoverColor(editorDifficultyLevel),
                  },
                  _active: {
                    transform: 'scale(0.98)',
                  },
                })}
              >
                Start
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </Wrapper>
  )
}

// =============================================================================
// Specialized Input Components
// =============================================================================

interface TwoDigitSubtractionInputProps {
  values: Record<string, ProblemValue>
  onChange: (name: string, value: ProblemValue) => void
}

/**
 * Custom input layout for two-digit subtraction (vertical layout like on paper)
 */
function TwoDigitSubtractionInput({ values, onChange }: TwoDigitSubtractionInputProps) {
  return (
    <div data-input-type="two-digit-subtraction" className={vstack({ gap: '1', alignItems: 'center' })}>
      {/* Top number (minuend) */}
      <input
        type="number"
        min={10}
        max={99}
        data-field="minuend"
        value={values.minuend === 0 ? '' : (values.minuend as number)}
        onChange={(e) =>
          onChange('minuend', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
        }
        placeholder="52"
        className={css({
          width: '70px',
          padding: '1.5',
          fontSize: 'xl',
          fontWeight: 'bold',
          textAlign: 'center',
          borderRadius: 'md',
          border: '2px solid',
          borderColor: { base: 'gray.300', _dark: 'gray.600' },
          backgroundColor: { base: 'white', _dark: 'gray.800' },
          color: { base: 'gray.900', _dark: 'gray.100' },
        })}
      />

      {/* Minus sign and bottom number */}
      <div className={hstack({ gap: '1', alignItems: 'center' })}>
        <span
          data-element="operator"
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: { base: 'gray.600', _dark: 'gray.400' },
          })}
        >
          −
        </span>
        <input
          type="number"
          min={10}
          max={99}
          data-field="subtrahend"
          value={values.subtrahend === 0 ? '' : (values.subtrahend as number)}
          onChange={(e) =>
            onChange('subtrahend', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
          }
          placeholder="37"
          className={css({
            width: '70px',
            padding: '1.5',
            fontSize: 'xl',
            fontWeight: 'bold',
            textAlign: 'center',
            borderRadius: 'md',
            border: '2px solid',
            borderColor: { base: 'gray.300', _dark: 'gray.600' },
            backgroundColor: { base: 'white', _dark: 'gray.800' },
            color: { base: 'gray.900', _dark: 'gray.100' },
          })}
        />
      </div>

      {/* Line */}
      <div
        data-element="answer-line"
        className={css({
          width: '90px',
          height: '2px',
          backgroundColor: { base: 'gray.400', _dark: 'gray.500' },
          marginTop: '1',
        })}
      />
    </div>
  )
}

/**
 * Custom input layout for two fractions with operation
 */
function TwoFractionsInput({ values, onChange }: TwoDigitSubtractionInputProps) {
  const inputStyle = css({
    width: '36px',
    padding: '1',
    fontSize: 'md',
    fontWeight: 'bold',
    textAlign: 'center',
    borderRadius: 'sm',
    border: '2px solid',
    borderColor: { base: 'gray.300', _dark: 'gray.600' },
    backgroundColor: { base: 'white', _dark: 'gray.800' },
    color: { base: 'gray.900', _dark: 'gray.100' },
  })

  const fractionLineStyle = css({
    width: '36px',
    height: '2px',
    backgroundColor: { base: 'gray.600', _dark: 'gray.400' },
  })

  return (
    <div
      data-input-type="two-fractions-with-op"
      className={hstack({
        gap: '2',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'nowrap',
      })}
    >
      {/* Left fraction */}
      <div data-element="left-fraction" className={hstack({ gap: '2', alignItems: 'center' })}>
        <input
          type="number"
          min={0}
          data-field="leftWhole"
          value={values.leftWhole === 0 ? '' : (values.leftWhole as number)}
          onChange={(e) =>
            onChange('leftWhole', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
          }
          placeholder="0"
          className={inputStyle}
        />
        <div className={vstack({ gap: '0', alignItems: 'center' })}>
          <input
            type="number"
            min={0}
            data-field="leftNum"
            value={values.leftNum === 0 ? '' : (values.leftNum as number)}
            onChange={(e) =>
              onChange('leftNum', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
            }
            placeholder="1"
            className={inputStyle}
          />
          <div data-element="fraction-line" className={fractionLineStyle} />
          <input
            type="number"
            min={1}
            data-field="leftDenom"
            value={values.leftDenom === 0 ? '' : (values.leftDenom as number)}
            onChange={(e) =>
              onChange('leftDenom', e.target.value === '' ? 1 : parseInt(e.target.value, 10))
            }
            placeholder="4"
            className={inputStyle}
          />
        </div>
      </div>

      {/* Operation */}
      <select
        data-field="op"
        value={(values.op as string) || '+'}
        onChange={(e) => onChange('op', e.target.value)}
        className={css({
          padding: '1',
          fontSize: 'lg',
          fontWeight: 'bold',
          borderRadius: 'sm',
          border: '2px solid',
          borderColor: { base: 'gray.300', _dark: 'gray.600' },
          backgroundColor: { base: 'white', _dark: 'gray.800' },
          color: { base: 'gray.900', _dark: 'gray.100' },
        })}
      >
        <option value="+">+</option>
        <option value="−">−</option>
      </select>

      {/* Right fraction */}
      <div data-element="right-fraction" className={hstack({ gap: '2', alignItems: 'center' })}>
        <input
          type="number"
          min={0}
          data-field="rightWhole"
          value={values.rightWhole === 0 ? '' : (values.rightWhole as number)}
          onChange={(e) =>
            onChange('rightWhole', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
          }
          placeholder="0"
          className={inputStyle}
        />
        <div className={vstack({ gap: '0', alignItems: 'center' })}>
          <input
            type="number"
            min={0}
            data-field="rightNum"
            value={values.rightNum === 0 ? '' : (values.rightNum as number)}
            onChange={(e) =>
              onChange('rightNum', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
            }
            placeholder="2"
            className={inputStyle}
          />
          <div data-element="fraction-line" className={fractionLineStyle} />
          <input
            type="number"
            min={1}
            data-field="rightDenom"
            value={values.rightDenom === 0 ? '' : (values.rightDenom as number)}
            onChange={(e) =>
              onChange('rightDenom', e.target.value === '' ? 1 : parseInt(e.target.value, 10))
            }
            placeholder="3"
            className={inputStyle}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Custom input layout for linear equations (e.g., 3x + 5 = 17)
 */
function LinearEquationInput({ values, onChange }: TwoDigitSubtractionInputProps) {
  const inputStyle = css({
    width: '44px',
    padding: '1',
    fontSize: 'md',
    fontWeight: 'bold',
    textAlign: 'center',
    borderRadius: 'sm',
    border: '2px solid',
    borderColor: { base: 'gray.300', _dark: 'gray.600' },
    backgroundColor: { base: 'white', _dark: 'gray.800' },
    color: { base: 'gray.900', _dark: 'gray.100' },
  })

  const labelStyle = css({
    fontSize: 'lg',
    fontWeight: 'bold',
    color: { base: 'gray.700', _dark: 'gray.300' },
  })

  return (
    <div
      data-input-type="linear-equation"
      className={hstack({
        gap: '1',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'nowrap',
      })}
    >
      {/* Coefficient */}
      <input
        type="number"
        min={1}
        data-field="coefficient"
        value={values.coefficient === 0 ? '' : (values.coefficient as number)}
        onChange={(e) =>
          onChange('coefficient', e.target.value === '' ? 1 : parseInt(e.target.value, 10))
        }
        placeholder="3"
        className={inputStyle}
      />
      <span data-element="variable-label" className={labelStyle}>x</span>

      {/* Operation */}
      <select
        data-field="operation"
        value={(values.operation as string) || '+'}
        onChange={(e) => onChange('operation', e.target.value)}
        className={css({
          padding: '1',
          fontSize: 'md',
          fontWeight: 'bold',
          borderRadius: 'sm',
          border: '2px solid',
          borderColor: { base: 'gray.300', _dark: 'gray.600' },
          backgroundColor: { base: 'white', _dark: 'gray.800' },
          color: { base: 'gray.900', _dark: 'gray.100' },
        })}
      >
        <option value="+">+</option>
        <option value="−">−</option>
      </select>

      {/* Constant */}
      <input
        type="number"
        min={0}
        data-field="constant"
        value={values.constant === 0 ? '' : (values.constant as number)}
        onChange={(e) =>
          onChange('constant', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
        }
        placeholder="5"
        className={inputStyle}
      />

      <span data-element="equals-sign" className={labelStyle}>=</span>

      {/* Equals */}
      <input
        type="number"
        min={0}
        data-field="equals"
        value={values.equals === 0 ? '' : (values.equals as number)}
        onChange={(e) =>
          onChange('equals', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
        }
        placeholder="17"
        className={inputStyle}
      />
    </div>
  )
}

// =============================================================================
// Generic Field Rendering
// =============================================================================

interface GenericFieldsInputProps {
  fields: Field[]
  values: Record<string, ProblemValue>
  onChange: (name: string, value: ProblemValue) => void
}

function GenericFieldsInput({ fields, values, onChange }: GenericFieldsInputProps) {
  return (
    <div data-input-type="generic" className={vstack({ gap: '4', alignItems: 'stretch' })}>
      {fields.map((field) => (
        <div key={field.name} data-field-container={field.name} className={vstack({ gap: '1', alignItems: 'stretch' })}>
          <label
            data-element="field-label"
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: { base: 'gray.700', _dark: 'gray.300' },
            })}
          >
            {field.label || field.name}
          </label>
          {renderFieldInput(field, values[field.name], (value) => onChange(field.name, value))}
        </div>
      ))}
    </div>
  )
}

function renderFieldInput(
  field: Field,
  value: ProblemValue,
  onChange: (value: ProblemValue) => void
) {
  switch (field.type) {
    case 'integer':
    case 'number':
      return (
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.type === 'number' ? (field as any).step : 1}
          data-field={field.name}
          data-field-type={field.type}
          value={(value as number) || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={css({
            padding: '2',
            fontSize: 'lg',
            borderRadius: 'md',
            border: '1px solid',
            borderColor: { base: 'gray.300', _dark: 'gray.600' },
            backgroundColor: { base: 'white', _dark: 'gray.800' },
            color: { base: 'gray.900', _dark: 'gray.100' },
          })}
        />
      )

    case 'choice':
      return (
        <select
          data-field={field.name}
          data-field-type="choice"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          className={css({
            padding: '2',
            fontSize: 'lg',
            borderRadius: 'md',
            border: '1px solid',
            borderColor: { base: 'gray.300', _dark: 'gray.600' },
            backgroundColor: { base: 'white', _dark: 'gray.800' },
            color: { base: 'gray.900', _dark: 'gray.100' },
          })}
        >
          <option value="">Select...</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )

    case 'mixed-number': {
      const mn = (value as MixedNumberValue) || { whole: 0, num: 0, denom: 1 }
      return (
        <div data-field={field.name} data-field-type="mixed-number" className={hstack({ gap: '2', alignItems: 'center' })}>
          <input
            type="number"
            min={0}
            data-part="whole"
            value={mn.whole || ''}
            onChange={(e) => onChange({ ...mn, whole: parseInt(e.target.value, 10) || 0 })}
            placeholder="0"
            className={css({
              width: '60px',
              padding: '2',
              textAlign: 'center',
              borderRadius: 'md',
              border: '1px solid',
              borderColor: { base: 'gray.300', _dark: 'gray.600' },
            })}
          />
          <div className={vstack({ gap: '0' })}>
            <input
              type="number"
              min={0}
              data-part="numerator"
              value={mn.num || ''}
              onChange={(e) => onChange({ ...mn, num: parseInt(e.target.value, 10) || 0 })}
              placeholder="0"
              className={css({
                width: '50px',
                padding: '1',
                textAlign: 'center',
                borderRadius: 'md',
                border: '1px solid',
                borderColor: { base: 'gray.300', _dark: 'gray.600' },
              })}
            />
            <div
              data-element="fraction-line"
              className={css({
                width: '50px',
                height: '2px',
                backgroundColor: { base: 'gray.600', _dark: 'gray.400' },
              })}
            />
            <input
              type="number"
              min={1}
              data-part="denominator"
              value={mn.denom || ''}
              onChange={(e) => onChange({ ...mn, denom: parseInt(e.target.value, 10) || 1 })}
              placeholder="1"
              className={css({
                width: '50px',
                padding: '1',
                textAlign: 'center',
                borderRadius: 'md',
                border: '1px solid',
                borderColor: { base: 'gray.300', _dark: 'gray.600' },
              })}
            />
          </div>
        </div>
      )
    }

    default:
      return null
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format example values into a readable problem expression based on schema type
 */
function formatExampleDisplay(schema: string, values: Record<string, ProblemValue>): string {
  switch (schema) {
    case 'two-digit-subtraction':
      return `${values.minuend} − ${values.subtrahend}`

    case 'linear-equation': {
      const coef = values.coefficient as number
      const op = values.operation as string
      const constant = values.constant as number
      const equals = values.equals as number
      if (constant === 0) {
        return `${coef}x = ${equals}`
      }
      return `${coef}x ${op} ${constant} = ${equals}`
    }

    case 'two-fractions-with-op': {
      const lw = values.leftWhole as number
      const ln = values.leftNum as number
      const ld = values.leftDenom as number
      const op = values.op as string
      const rw = values.rightWhole as number
      const rn = values.rightNum as number
      const rd = values.rightDenom as number

      const left = lw > 0 ? `${lw} ${ln}/${ld}` : `${ln}/${ld}`
      const right = rw > 0 ? `${rw} ${rn}/${rd}` : `${rn}/${rd}`
      return `${left} ${op} ${right}`
    }

    default:
      return JSON.stringify(values)
  }
}

function initializeValues(fields: Field[]): Record<string, ProblemValue> {
  const values: Record<string, ProblemValue> = {}

  for (const field of fields) {
    switch (field.type) {
      case 'integer':
      case 'number':
        values[field.name] = field.default ?? 0
        break
      case 'choice':
        values[field.name] = field.default ?? ''
        break
      case 'mixed-number':
        values[field.name] = { whole: 0, num: 0, denom: 1 }
        break
      default:
        values[field.name] = ''
    }
  }

  return values
}

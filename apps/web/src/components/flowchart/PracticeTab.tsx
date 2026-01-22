'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type {
  ProblemInputSchema,
  Field,
  ProblemValue,
  MixedNumberValue,
  ExecutableFlowchart,
} from '@/lib/flowcharts/schema'
import { evaluate } from '@/lib/flowcharts/evaluator'
import {
  inferGridDimensions,
  inferGridDimensionsFromExamples,
  calculatePathComplexity,
  formatProblemDisplay,
  type GeneratedExample,
  type GenerationConstraints,
  type GridDimensions,
  DEFAULT_CONSTRAINTS,
} from '@/lib/flowcharts/loader'
import { generateExamplesAsync } from '@/lib/flowcharts/example-generator-client'
import { InteractiveDice } from '@/components/ui/InteractiveDice'
import { TeacherConfigPanel } from './TeacherConfigPanel'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'
import { AnimatedMathDisplay } from './AnimatedMathDisplay'

/** Difficulty tier for filtering examples */
type DifficultyTier = 'easy' | 'medium' | 'hard' | 'all'

/** Default number of examples to generate for the example picker grid */
const DEFAULT_EXAMPLES_TO_GENERATE = 100

interface PracticeTabProps {
  schema: ProblemInputSchema
  onSubmit: (values: Record<string, ProblemValue>) => void
  flowchart: ExecutableFlowchart
  /** Pre-generated examples from parent (for caching) */
  examples?: GeneratedExample[]
  /** Called when new examples are generated */
  onExamplesGenerated?: (examples: GeneratedExample[]) => void
  /** Optional share URL */
  shareUrl?: string
}

/**
 * Practice tab content - example picker grid with difficulty filtering.
 * Extracted from FlowchartProblemInput for use in FlowchartModal.
 */
export function PracticeTab({
  schema,
  onSubmit,
  flowchart,
  examples: externalExamples,
  onExamplesGenerated,
  shareUrl,
}: PracticeTabProps) {
  const [values, setValues] = useState<Record<string, ProblemValue>>(() =>
    initializeValues(schema.fields)
  )
  const [error, setError] = useState<string | null>(null)
  const [constraints, setConstraints] = useState<GenerationConstraints>(DEFAULT_CONSTRAINTS)
  const [displayedExamples, setDisplayedExamples] = useState<GeneratedExample[]>(
    externalExamples ?? []
  )
  const pendingExamplesRef = useRef<Promise<GeneratedExample[]> | null>(null)
  const loadedFromCacheRef = useRef(externalExamples && externalExamples.length > 0)
  const [editingExample, setEditingExample] = useState<{
    example: GeneratedExample
    buttonRect: DOMRect
  } | null>(null)
  const [selectedTier, setSelectedTier] = useState<DifficultyTier>('all')
  const [exampleCount, setExampleCount] = useState(DEFAULT_EXAMPLES_TO_GENERATE)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isVisualDebugEnabled } = useVisualDebugSafe()
  const [shareCopied, setShareCopied] = useState(false)

  // Create a stable storage key for caching examples
  const storageKey = useMemo(() => {
    const constraintHash = JSON.stringify(constraints)
    return `flowchart-examples-${flowchart.definition.id}-${constraintHash}`
  }, [flowchart, constraints])

  // Infer grid dimensions from flowchart decision structure (for "All" view)
  const baseGridDimensions = useMemo(() => {
    try {
      const { paths } = require('@/lib/flowcharts/path-analysis').analyzeFlowchart(flowchart)
      return inferGridDimensions(flowchart, paths)
    } catch (e) {
      console.error('Error inferring grid dimensions:', e)
      return null
    }
  }, [flowchart])

  // Try to load cached examples from session storage on first render
  useEffect(() => {
    if (loadedFromCacheRef.current) return
    loadedFromCacheRef.current = true

    // Check external examples first
    if (externalExamples && externalExamples.length > 0) {
      setDisplayedExamples(externalExamples)
      return
    }

    try {
      const cached = sessionStorage.getItem(storageKey)
      if (cached) {
        const parsed = JSON.parse(cached) as GeneratedExample[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDisplayedExamples(parsed)
          onExamplesGenerated?.(parsed)
          return
        }
      }
    } catch (e) {
      console.error('Error loading cached examples:', e)
    }

    // No cache found, generate new examples
    generateExamplesAsync(flowchart, exampleCount, constraints)
      .then((examples) => {
        setDisplayedExamples(examples)
        onExamplesGenerated?.(examples)
        sessionStorage.setItem(storageKey, JSON.stringify(examples))
      })
      .catch((e) => {
        console.error('Error generating examples:', e)
      })
  }, [flowchart, exampleCount, constraints, storageKey, externalExamples, onExamplesGenerated])

  const generatedExamples = displayedExamples

  // Calculate difficulty range for visual indicators
  const difficultyRange = useMemo(() => {
    if (generatedExamples.length === 0) return { min: 0, max: 0 }
    const scores = generatedExamples.map(
      (ex) => ex.complexity.decisions + ex.complexity.checkpoints
    )
    return { min: Math.min(...scores), max: Math.max(...scores) }
  }, [generatedExamples])

  // Get difficulty level (1-3) for an example
  const getDifficultyLevel = (example: GeneratedExample): 1 | 2 | 3 => {
    const score = example.complexity.decisions + example.complexity.checkpoints
    const { min, max } = difficultyRange
    if (max === min) return 1
    const normalized = (score - min) / (max - min)
    if (normalized < 0.25) return 1
    if (normalized < 0.75) return 2
    return 3
  }

  // Get difficulty tier for an example
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

  // Count examples by tier
  const tierCounts = useMemo(() => {
    const counts = { easy: 0, medium: 0, hard: 0 }
    for (const ex of generatedExamples) {
      counts[getDifficultyTier(ex)]++
    }
    return counts
  }, [generatedExamples, difficultyRange])

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
      const tierExamples = generatedExamples.filter((ex) => getDifficultyTier(ex) === tier)
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
  }, [generatedExamples, baseGridDimensions, difficultyRange])

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

  // Calculate difficulty level for current editor values
  const editorDifficultyLevel = useMemo((): 1 | 2 | 3 => {
    if (!editingExample) return 1

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
      return 2
    }
  }, [flowchart, editingExample, values, difficultyRange])

  // Precompute new examples when user starts dragging the dice
  const handleDragStart = useCallback(() => {
    pendingExamplesRef.current = generateExamplesAsync(flowchart, exampleCount, constraints)
  }, [flowchart, exampleCount, constraints])

  // Dice roll animation complete
  const handleRollComplete = useCallback(() => {
    // No-op: examples are now updated at roll start
  }, [])

  // Handler for dice roll
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
      onExamplesGenerated?.(newExamples)
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(newExamples))
      } catch (e) {
        console.error('Error caching examples:', e)
      }
    }
  }, [flowchart, exampleCount, constraints, storageKey, onExamplesGenerated])

  // Handler for instant roll (shift+click)
  const handleInstantRoll = useCallback(async () => {
    try {
      const newExamples = await generateExamplesAsync(flowchart, exampleCount, constraints)
      setDisplayedExamples(newExamples)
      onExamplesGenerated?.(newExamples)
      sessionStorage.setItem(storageKey, JSON.stringify(newExamples))
    } catch (e) {
      console.error('Error generating examples:', e)
    }
  }, [flowchart, exampleCount, constraints, storageKey, onExamplesGenerated])

  const handleChange = useCallback((name: string, value: ProblemValue) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }, [])

  // Handle constraint changes
  const handleConstraintsChange = useCallback((newConstraints: GenerationConstraints) => {
    setConstraints(newConstraints)
    loadedFromCacheRef.current = false
    setDisplayedExamples([])
  }, [])

  const handleExampleSelect = useCallback(
    (example: GeneratedExample) => {
      onSubmit(example.values)
    },
    [onSubmit]
  )

  // Show edit popover for an example
  const handleEditExample = useCallback(
    (example: GeneratedExample, e?: React.MouseEvent | React.TouchEvent) => {
      e?.stopPropagation()
      e?.preventDefault()

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

  const handleCloseEditor = useCallback(() => {
    setEditingExample(null)
    setError(null)
  }, [])

  const handleShare = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy share URL:', err)
    }
  }, [shareUrl])

  // Long press handling for mobile
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const longPressTriggeredRef = useRef(false)
  const longPressTargetRef = useRef<HTMLElement | null>(null)

  const handleTouchStart = useCallback((example: GeneratedExample, e: React.TouchEvent) => {
    e.preventDefault()
    longPressTriggeredRef.current = false
    longPressTargetRef.current = e.currentTarget as HTMLElement
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      const button = longPressTargetRef.current
      if (button) {
        const rect = button.getBoundingClientRect()
        setValues(example.values as Record<string, ProblemValue>)
        setEditingExample({ example, buttonRect: rect })
        setError(null)
      }
    }, 500)
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    if (longPressTriggeredRef.current) {
      e.preventDefault()
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleSubmit = useCallback(() => {
    if (schema.validation) {
      try {
        const context = { problem: values, computed: {}, userState: {} }
        const isValid = evaluate(schema.validation, context)
        if (!isValid) {
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

  // Check if tier tabs should be shown
  const availableTiers = [
    tierCounts.easy > 0 ? 'easy' : null,
    tierCounts.medium > 0 ? 'medium' : null,
    tierCounts.hard > 0 ? 'hard' : null,
  ].filter(Boolean) as ('easy' | 'medium' | 'hard')[]

  const allLabelsFromGrid = availableTiers.every(
    (tier) =>
      tierLabels[tier] !== 'Easy' && tierLabels[tier] !== 'Medium' && tierLabels[tier] !== 'Hard'
  )

  const showTabs = generatedExamples.length > 0 && availableTiers.length > 1 && !allLabelsFromGrid

  return (
    <div
      ref={containerRef}
      data-component="practice-tab"
      className={vstack({ gap: '4', alignItems: 'stretch', position: 'relative' })}
    >
      {/* Dice row - shows when examples are loaded */}
      {generatedExamples.length > 0 && (
        <div
          data-element="dice-control"
          className={css({
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '2',
            marginBottom: '-2',
          })}
        >
          <span
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.400', _dark: 'gray.500' },
            })}
          >
            Re-roll
          </span>
          <InteractiveDice
            onRoll={handleRoll}
            onDragStart={handleDragStart}
            onRollComplete={handleRollComplete}
            onInstantRoll={handleInstantRoll}
            size={20}
            title="Roll for new examples (shift+click for instant)"
            className={css({
              padding: '1',
              borderRadius: 'md',
              backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
              border: '1px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.600' },
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

      {/* Gear corner */}
      <div
        data-element="settings-control"
        className={css({
          position: 'absolute',
          bottom: '0',
          left: '-16px',
        })}
      >
        <TeacherConfigPanel
          constraints={constraints}
          onConstraintsChange={handleConstraintsChange}
          exampleCount={exampleCount}
          onExampleCountChange={setExampleCount}
          onRegenerate={async () => {
            const examples = await generateExamplesAsync(flowchart, exampleCount, constraints)
            setDisplayedExamples(examples)
            onExamplesGenerated?.(examples)
            sessionStorage.setItem(storageKey, JSON.stringify(examples))
          }}
          showDebugControls={isVisualDebugEnabled}
        />
      </div>

      {/* Difficulty Filter Tabs */}
      {showTabs && (
        <div
          data-element="difficulty-filter"
          className={css({
            display: 'inline-flex',
            backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
            borderRadius: 'xl',
            padding: '1',
            gap: '1',
            alignSelf: 'center',
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
                borderColor:
                  selectedTier === 'easy'
                    ? { base: 'emerald.400', _dark: 'emerald.500' }
                    : { base: 'gray.300', _dark: 'gray.500' },
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor:
                  selectedTier === 'easy'
                    ? { base: 'white', _dark: 'gray.600' }
                    : { base: 'gray.100', _dark: 'gray.800' },
                color:
                  selectedTier === 'easy'
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
                borderColor:
                  selectedTier === 'medium'
                    ? { base: 'amber.400', _dark: 'amber.500' }
                    : { base: 'gray.300', _dark: 'gray.500' },
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor:
                  selectedTier === 'medium'
                    ? { base: 'white', _dark: 'gray.600' }
                    : { base: 'gray.100', _dark: 'gray.800' },
                color:
                  selectedTier === 'medium'
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
                borderColor:
                  selectedTier === 'hard'
                    ? { base: 'rose.400', _dark: 'rose.500' }
                    : { base: 'gray.300', _dark: 'gray.500' },
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor:
                  selectedTier === 'hard'
                    ? { base: 'white', _dark: 'gray.600' }
                    : { base: 'gray.100', _dark: 'gray.800' },
                color:
                  selectedTier === 'hard'
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

      {/* Examples Grid */}
      {filteredExamples.length > 0 ? (
        <div data-testid="examples-section" className={vstack({ gap: '3', alignItems: 'stretch' })}>
          {gridDimensions && gridDimensions.cols.length > 0 ? (
            /* 2D Grid */
            <div
              data-grid-type="2d"
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
              {/* Column headers */}
              <div key="corner" data-element="grid-corner" />
              {gridDimensions.cols.map((col, colIdx) => (
                <div
                  key={`col-${col}`}
                  data-element="col-header"
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
                  data-element="row-label"
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
                ...gridDimensions.cols.map((col, colIdx) => {
                  const example = filteredExamples.find((ex) => {
                    const cell = gridDimensions.cellMap.get(ex.pathDescriptor)
                    return cell && cell[0] === rowIdx && cell[1] === colIdx
                  })

                  if (!example) {
                    return (
                      <div
                        key={`cell-${rowIdx}-${colIdx}`}
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
                      onClick={() => {
                        if (!longPressTriggeredRef.current) handleExampleSelect(example)
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
                          '& [data-element="edit-badge"]': { opacity: 1 },
                        },
                        _active: { transform: 'scale(0.97)' },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '60px',
                      })}
                    >
                      <div className={css({ color: { base: 'gray.900', _dark: 'white' } })}>
                        <AnimatedMathDisplay
                          expression={formatProblemDisplay(flowchart, example.values)}
                          size="md"
                        />
                      </div>
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
                          _hover: { backgroundColor: { base: 'blue.100', _dark: 'blue.700' } },
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
            /* 1D Grid */
            <div
              data-grid-type="1d"
              className={css({
                display: 'grid',
                gap: '3',
                width: '100%',
              })}
              style={{ gridTemplateColumns: `repeat(${gridDimensions.rows.length}, 1fr)` }}
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
                          data-element="example-button"
                          onClick={() => {
                            if (!longPressTriggeredRef.current) handleExampleSelect(example)
                          }}
                          onTouchStart={(e) => handleTouchStart(example, e)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchMove}
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
                            _hover: {
                              transform: 'translateY(-1px)',
                              '& [data-element="edit-badge"]': { opacity: 1 },
                            },
                            _active: { transform: 'scale(0.97)' },
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '70px',
                          })}
                        >
                          <div className={css({ color: { base: 'gray.900', _dark: 'white' } })}>
                            <AnimatedMathDisplay
                              expression={formatProblemDisplay(flowchart, example.values)}
                              size="md"
                            />
                          </div>
                          <span
                            data-element="edit-badge"
                            onClick={(e) => handleEditExample(example, e)}
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
            /* Flat grid fallback */
            <div
              data-grid-type="flat"
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '2',
                width: '100%',
              })}
            >
              {filteredExamples.slice(0, 9).map((example, idx) => {
                const difficultyLevel = getDifficultyLevel(example)
                return (
                  <button
                    key={`${example.pathSignature}-${idx}`}
                    data-element="example-button"
                    onClick={() => {
                      if (!longPressTriggeredRef.current) handleExampleSelect(example)
                    }}
                    onTouchStart={(e) => handleTouchStart(example, e)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
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
                      _hover: {
                        transform: 'translateY(-1px)',
                        '& [data-element="edit-badge"]': { opacity: 1 },
                      },
                      _active: { transform: 'scale(0.97)' },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '1',
                      minHeight: '70px',
                    })}
                  >
                    <div className={css({ color: { base: 'gray.900', _dark: 'white' } })}>
                      <AnimatedMathDisplay
                        expression={formatProblemDisplay(flowchart, example.values)}
                        size="md"
                      />
                    </div>
                    <span
                      data-element="edit-badge"
                      onClick={(e) => handleEditExample(example, e)}
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
                      })}
                    >
                      ✏️
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : generatedExamples.length > 0 && selectedTier !== 'all' ? (
        <div
          className={css({
            padding: '4',
            textAlign: 'center',
            color: { base: 'gray.500', _dark: 'gray.400' },
            fontSize: 'sm',
          })}
        >
          No {selectedTier} examples available. Try selecting a different difficulty level.
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
          Generating examples...
        </div>
      )}

      {/* Edit Popover */}
      {editingExample &&
        containerRef.current &&
        createPortal(
          <>
            <div
              onClick={handleCloseEditor}
              className={css({
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                zIndex: 200,
                pointerEvents: 'auto',
              })}
            />
            <div
              data-section="edit-popover"
              className={css({
                position: 'fixed',
                zIndex: 201,
                padding: '3',
                borderRadius: 'lg',
                border: '3px solid',
                borderColor: getDifficultyBorderColor(editorDifficultyLevel),
                backgroundColor: { base: 'white', _dark: 'gray.800' },
                boxShadow: 'xl',
                width: 'max-content',
                transition: 'border-color 0.2s ease-out',
                pointerEvents: 'auto',
              })}
              style={{
                top: `${editingExample.buttonRect.top + editingExample.buttonRect.height / 2}px`,
                left: `${editingExample.buttonRect.left + editingExample.buttonRect.width / 2}px`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
                <button
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
                    _hover: { backgroundColor: { base: 'gray.200', _dark: 'gray.600' } },
                  })}
                >
                  ✕
                </button>

                {/* Simple generic input - schema-specific inputs would go here */}
                <div className={vstack({ gap: '2' })}>
                  {schema.fields.map((field) => (
                    <div key={field.name} className={hstack({ gap: '2', alignItems: 'center' })}>
                      <label
                        className={css({
                          fontSize: 'sm',
                          color: { base: 'gray.600', _dark: 'gray.400' },
                          minWidth: '60px',
                        })}
                      >
                        {field.label || field.name}
                      </label>
                      <input
                        type={field.type === 'choice' ? 'text' : 'number'}
                        value={String(values[field.name] ?? '')}
                        onChange={(e) =>
                          handleChange(
                            field.name,
                            field.type === 'choice'
                              ? e.target.value
                              : parseFloat(e.target.value) || 0
                          )
                        }
                        className={css({
                          width: '80px',
                          paddingY: '1',
                          paddingX: '2',
                          fontSize: 'md',
                          borderRadius: 'md',
                          border: '1px solid',
                          borderColor: { base: 'gray.300', _dark: 'gray.600' },
                          backgroundColor: { base: 'white', _dark: 'gray.800' },
                          color: { base: 'gray.900', _dark: 'gray.100' },
                        })}
                      />
                    </div>
                  ))}
                </div>

                {error && (
                  <p
                    className={css({
                      color: { base: 'red.600', _dark: 'red.400' },
                      fontSize: 'sm',
                      textAlign: 'center',
                    })}
                  >
                    {error}
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  className={css({
                    width: '100%',
                    padding: '1.5',
                    fontSize: 'sm',
                    fontWeight: 'semibold',
                    borderRadius: 'md',
                    backgroundColor: getDifficultyButtonColor(editorDifficultyLevel),
                    color: 'white',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'all 0.2s',
                    _hover: {
                      backgroundColor: getDifficultyButtonHoverColor(editorDifficultyLevel),
                    },
                    _active: { transform: 'scale(0.98)' },
                  })}
                >
                  Start
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  )
}

// Helper function to initialize values
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

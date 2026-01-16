'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
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
  type GeneratedExample,
  type GenerationConstraints,
  DEFAULT_CONSTRAINTS,
} from '@/lib/flowcharts/loader'
import { InteractiveDice } from '@/components/ui/InteractiveDice'
import { TeacherConfigPanel } from './TeacherConfigPanel'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'
import { MathDisplay } from './MathDisplay'

interface FlowchartProblemInputProps {
  schema: ProblemInputSchema
  onSubmit: (values: Record<string, ProblemValue>) => void
  title?: string
  /** The loaded flowchart (used to calculate path complexity for examples) */
  flowchart?: ExecutableFlowchart
}

/**
 * Dynamic problem input form based on schema definition.
 * Renders appropriate input fields based on field types.
 */
export function FlowchartProblemInput({
  schema,
  onSubmit,
  title,
  flowchart,
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

  // Generate initial examples on first render (re-generates when constraints change)
  const initialExamples = useMemo(() => {
    if (!flowchart) return []
    try {
      return generateDiverseExamples(flowchart, 6, constraints)
    } catch (e) {
      console.error('Error generating examples:', e)
      return []
    }
  }, [flowchart, constraints])

  // Set initial examples on first render
  const generatedExamples = displayedExamples.length > 0 ? displayedExamples : initialExamples

  // Calculate coverage: how many unique paths are represented in current examples
  const pathsCovered = useMemo(() => {
    const uniquePaths = new Set(generatedExamples.map((ex) => ex.pathSignature))
    return uniquePaths.size
  }, [generatedExamples])

  // Precompute new examples when user starts dragging the dice
  const handleDragStart = useCallback(() => {
    if (!flowchart) return
    try {
      // Compute new examples during drag - user won't notice the computation
      pendingExamplesRef.current = generateDiverseExamples(flowchart, 6, constraints)
    } catch (e) {
      console.error('Error pre-generating examples:', e)
    }
  }, [flowchart, constraints])

  // Show new examples after the dice roll animation completes
  const handleRollComplete = useCallback(() => {
    // If we have pre-computed examples from drag, use them
    if (pendingExamplesRef.current) {
      setDisplayedExamples(pendingExamplesRef.current)
      pendingExamplesRef.current = null
    } else if (flowchart) {
      // Click-only roll - compute now (animation masked the compute time)
      try {
        setDisplayedExamples(generateDiverseExamples(flowchart, 6, constraints))
      } catch (e) {
        console.error('Error generating examples:', e)
      }
    }
  }, [flowchart, constraints])

  // Handler for dice roll - we don't update examples here anymore
  // (examples update on completion via handleRollComplete)
  const handleRoll = useCallback(() => {
    // The actual example update happens in handleRollComplete
    // This is called immediately when rolled - could add a spinning indicator here
  }, [])

  const handleChange = useCallback((name: string, value: ProblemValue) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setError(null)
  }, [])

  // Handle constraint changes - regenerate examples with new constraints
  const handleConstraintsChange = useCallback((newConstraints: GenerationConstraints) => {
    setConstraints(newConstraints)
    setDisplayedExamples([]) // Clear displayed examples so they regenerate with new constraints
  }, [])

  const handleExampleSelect = useCallback(
    (example: GeneratedExample) => {
      // Clicking an example immediately starts the flowchart with that problem
      onSubmit(example.values)
    },
    [onSubmit]
  )

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

  return (
    <div
      data-testid="flowchart-problem-input"
      className={vstack({
        gap: '6',
        padding: '6',
        backgroundColor: { base: 'white', _dark: 'gray.800' },
        borderRadius: 'xl',
        boxShadow: 'lg',
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
        maxWidth: '400px',
        margin: '0 auto',
      })}
    >
      {/* Teacher configuration panel */}
      <TeacherConfigPanel
        constraints={constraints}
        onConstraintsChange={handleConstraintsChange}
        defaultCollapsed={true}
      />

      {title && (
        <h2
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: { base: 'gray.800', _dark: 'gray.200' },
            textAlign: 'center',
          })}
        >
          {title}
        </h2>
      )}

      {/* Quick Pick Section */}
      {generatedExamples.length > 0 && (
        <div data-testid="examples-section" className={vstack({ gap: '3', alignItems: 'stretch' })}>
          {/* Section header */}
          <div
            className={hstack({ gap: '2', justifyContent: 'space-between', alignItems: 'center' })}
          >
            <span
              className={css({
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: { base: 'gray.700', _dark: 'gray.200' },
              })}
            >
              Quick Pick
            </span>
            <div className={hstack({ gap: '2', alignItems: 'center' })}>
              {analysis && (
                <span
                  className={css({
                    fontSize: '2xs',
                    color: { base: 'gray.400', _dark: 'gray.500' },
                  })}
                  title={`${analysis.stats.totalPaths} unique paths`}
                >
                  {pathsCovered}/{analysis.stats.totalPaths} paths
                </span>
              )}
              <InteractiveDice
                onRoll={handleRoll}
                onDragStart={handleDragStart}
                onRollComplete={handleRollComplete}
                size={16}
                title="Roll for new examples"
                className={css({
                  padding: '1',
                  borderRadius: 'md',
                  backgroundColor: 'transparent',
                  border: 'none',
                  transition: 'background 0.2s',
                  _hover: {
                    backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
                  },
                })}
              />
            </div>
          </div>

          {/* Example grid */}
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '2',
              width: '100%',
            })}
          >
            {generatedExamples.map((example, idx) => {
              const { complexity } = example
              return (
                <button
                  key={`${example.pathSignature}-${idx}`}
                  data-testid={`example-button-${idx}`}
                  data-path-signature={example.pathSignature}
                  onClick={() => handleExampleSelect(example)}
                  title={`${example.pathDescriptor} • ${complexity.pathLength} steps`}
                  className={css({
                    padding: '3',
                    borderRadius: 'lg',
                    border: '2px solid',
                    borderColor: { base: 'gray.200', _dark: 'gray.600' },
                    backgroundColor: { base: 'white', _dark: 'gray.700/50' },
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-out',
                    _hover: {
                      borderColor: { base: 'blue.400', _dark: 'blue.400' },
                      backgroundColor: { base: 'blue.50', _dark: 'blue.900/30' },
                      transform: 'translateY(-1px)',
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
                      size="sm"
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
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      {generatedExamples.length > 0 && (
        <div className={hstack({ gap: '3', alignItems: 'center', width: '100%' })}>
          <div
            className={css({
              flex: 1,
              height: '1px',
              backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
            })}
          />
          <span
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.400', _dark: 'gray.500' },
              textTransform: 'uppercase',
              letterSpacing: 'wide',
            })}
          >
            or
          </span>
          <div
            className={css({
              flex: 1,
              height: '1px',
              backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
            })}
          />
        </div>
      )}

      {/* Custom Problem Section */}
      <div
        className={css({
          padding: '4',
          borderRadius: 'xl',
          border: '2px solid',
          borderColor: { base: 'gray.200', _dark: 'gray.600' },
          backgroundColor: { base: 'gray.50', _dark: 'gray.700/30' },
        })}
      >
        <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
          {/* Section header */}
          <div className={hstack({ gap: '2', justifyContent: 'center', alignItems: 'center' })}>
            <span className={css({ fontSize: 'lg' })}>✏️</span>
            <span
              className={css({
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: { base: 'gray.700', _dark: 'gray.200' },
              })}
            >
              Make Your Own
            </span>
          </div>

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
            onClick={handleSubmit}
            className={css({
              width: '100%',
              padding: '3',
              fontSize: 'md',
              fontWeight: 'semibold',
              borderRadius: 'lg',
              backgroundColor: { base: 'blue.500', _dark: 'blue.600' },
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
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
    </div>
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
    <div className={vstack({ gap: '2', alignItems: 'center' })}>
      {/* Top number (minuend) */}
      <input
        type="number"
        min={10}
        max={99}
        value={values.minuend === 0 ? '' : (values.minuend as number)}
        onChange={(e) =>
          onChange('minuend', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
        }
        placeholder="e.g. 52"
        className={css({
          width: '100px',
          padding: '3',
          fontSize: '2xl',
          fontWeight: 'bold',
          textAlign: 'center',
          borderRadius: 'lg',
          border: '2px solid',
          borderColor: { base: 'gray.300', _dark: 'gray.600' },
          backgroundColor: { base: 'white', _dark: 'gray.800' },
          color: { base: 'gray.900', _dark: 'gray.100' },
        })}
      />

      {/* Minus sign and bottom number */}
      <div className={hstack({ gap: '2', alignItems: 'center' })}>
        <span
          className={css({
            fontSize: '2xl',
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
          value={values.subtrahend === 0 ? '' : (values.subtrahend as number)}
          onChange={(e) =>
            onChange('subtrahend', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
          }
          placeholder="e.g. 37"
          className={css({
            width: '100px',
            padding: '3',
            fontSize: '2xl',
            fontWeight: 'bold',
            textAlign: 'center',
            borderRadius: 'lg',
            border: '2px solid',
            borderColor: { base: 'gray.300', _dark: 'gray.600' },
            backgroundColor: { base: 'white', _dark: 'gray.800' },
            color: { base: 'gray.900', _dark: 'gray.100' },
          })}
        />
      </div>

      {/* Line */}
      <div
        className={css({
          width: '120px',
          height: '3px',
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
    width: '50px',
    padding: '2',
    fontSize: 'lg',
    fontWeight: 'bold',
    textAlign: 'center',
    borderRadius: 'md',
    border: '2px solid',
    borderColor: { base: 'gray.300', _dark: 'gray.600' },
    backgroundColor: { base: 'white', _dark: 'gray.800' },
    color: { base: 'gray.900', _dark: 'gray.100' },
  })

  const fractionLineStyle = css({
    width: '50px',
    height: '2px',
    backgroundColor: { base: 'gray.600', _dark: 'gray.400' },
  })

  return (
    <div
      className={hstack({
        gap: '4',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      })}
    >
      {/* Left fraction */}
      <div className={hstack({ gap: '2', alignItems: 'center' })}>
        <input
          type="number"
          min={0}
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
            value={values.leftNum === 0 ? '' : (values.leftNum as number)}
            onChange={(e) =>
              onChange('leftNum', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
            }
            placeholder="1"
            className={inputStyle}
          />
          <div className={fractionLineStyle} />
          <input
            type="number"
            min={1}
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
        value={(values.op as string) || '+'}
        onChange={(e) => onChange('op', e.target.value)}
        className={css({
          padding: '2',
          fontSize: '2xl',
          fontWeight: 'bold',
          borderRadius: 'md',
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
      <div className={hstack({ gap: '2', alignItems: 'center' })}>
        <input
          type="number"
          min={0}
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
            value={values.rightNum === 0 ? '' : (values.rightNum as number)}
            onChange={(e) =>
              onChange('rightNum', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
            }
            placeholder="2"
            className={inputStyle}
          />
          <div className={fractionLineStyle} />
          <input
            type="number"
            min={1}
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
    width: '60px',
    padding: '2',
    fontSize: 'xl',
    fontWeight: 'bold',
    textAlign: 'center',
    borderRadius: 'md',
    border: '2px solid',
    borderColor: { base: 'gray.300', _dark: 'gray.600' },
    backgroundColor: { base: 'white', _dark: 'gray.800' },
    color: { base: 'gray.900', _dark: 'gray.100' },
  })

  const labelStyle = css({
    fontSize: '2xl',
    fontWeight: 'bold',
    color: { base: 'gray.700', _dark: 'gray.300' },
  })

  return (
    <div
      className={hstack({
        gap: '2',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
      })}
    >
      {/* Coefficient */}
      <input
        type="number"
        min={1}
        value={values.coefficient === 0 ? '' : (values.coefficient as number)}
        onChange={(e) =>
          onChange('coefficient', e.target.value === '' ? 1 : parseInt(e.target.value, 10))
        }
        placeholder="3"
        className={inputStyle}
      />
      <span className={labelStyle}>x</span>

      {/* Operation */}
      <select
        value={(values.operation as string) || '+'}
        onChange={(e) => onChange('operation', e.target.value)}
        className={css({
          padding: '2',
          fontSize: 'xl',
          fontWeight: 'bold',
          borderRadius: 'md',
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
        value={values.constant === 0 ? '' : (values.constant as number)}
        onChange={(e) =>
          onChange('constant', e.target.value === '' ? 0 : parseInt(e.target.value, 10))
        }
        placeholder="5"
        className={inputStyle}
      />

      <span className={labelStyle}>=</span>

      {/* Equals */}
      <input
        type="number"
        min={0}
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
    <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
      {fields.map((field) => (
        <div key={field.name} className={vstack({ gap: '1', alignItems: 'stretch' })}>
          <label
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
        <div className={hstack({ gap: '2', alignItems: 'center' })}>
          <input
            type="number"
            min={0}
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
              className={css({
                width: '50px',
                height: '2px',
                backgroundColor: { base: 'gray.600', _dark: 'gray.400' },
              })}
            />
            <input
              type="number"
              min={1}
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

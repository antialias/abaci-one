'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'
import type {
  FlowchartDefinition,
  ProblemExample,
  ProblemValue,
  StateSnapshot,
} from '@/lib/flowcharts/schema'
import {
  validateTestCases,
  formatTestFailure,
  type ValidationReport,
  type TestResult,
} from '@/lib/flowchart-workshop/test-case-validator'
import { ProblemTrace } from './ProblemTrace'

interface TestsTabProps {
  definition: FlowchartDefinition | null
  validationReport?: ValidationReport | null
  onUpdateDefinition?: (definition: FlowchartDefinition) => void
  /** Callback when hovering over a test/example (shows entire path via snapshots) */
  onHoverSnapshots?: (snapshots: StateSnapshot[] | null) => void
  /** Callback when hovering over a specific trace node (for focused highlighting) */
  onHoverNode?: (nodeId: string | null) => void
}

/** Index of the test being edited, or null if not editing */
type EditingState = { index: number; example: ProblemExample } | null

/**
 * Tests tab for the flowchart workshop.
 * Shows test case results and allows adding new tests.
 */
export function TestsTab({
  definition,
  validationReport: externalReport,
  onUpdateDefinition,
  onHoverSnapshots,
  onHoverNode,
}: TestsTabProps) {
  const [localValidationReport, setLocalValidationReport] = useState<ValidationReport | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [showAddTestForm, setShowAddTestForm] = useState(false)
  const [editingTest, setEditingTest] = useState<EditingState>(null)

  // Use external report if provided, otherwise compute locally
  const validationReport = externalReport ?? localValidationReport

  // Only run local validation if no external report is provided
  useEffect(() => {
    // If we have an external report, don't compute locally
    if (externalReport !== undefined) {
      setLocalValidationReport(null)
      return
    }

    if (!definition) {
      setLocalValidationReport(null)
      return
    }

    const runValidation = async () => {
      setIsRunning(true)
      try {
        // Run basic validation (without coverage since we don't have flowchart)
        const report = validateTestCases(definition)
        setLocalValidationReport(report)
      } catch (err) {
        console.error('Test validation failed:', err)
        setLocalValidationReport(null)
      } finally {
        setIsRunning(false)
      }
    }

    runValidation()
  }, [definition, externalReport])

  // Get examples with expectedAnswer
  const testCases = useMemo(() => {
    return definition?.problemInput.examples?.filter((ex) => ex.expectedAnswer) || []
  }, [definition])

  // Get examples without expectedAnswer (could become test cases)
  const examplesWithoutTests = useMemo(() => {
    return definition?.problemInput.examples?.filter((ex) => !ex.expectedAnswer) || []
  }, [definition])

  // Handle adding a new test case
  const handleAddTest = useCallback(
    (example: ProblemExample) => {
      if (!definition || !onUpdateDefinition) return

      const existingExamples = definition.problemInput.examples || []
      const updatedDefinition: FlowchartDefinition = {
        ...definition,
        problemInput: {
          ...definition.problemInput,
          examples: [...existingExamples, example],
        },
      }
      onUpdateDefinition(updatedDefinition)
      setShowAddTestForm(false)
    },
    [definition, onUpdateDefinition]
  )

  // Handle updating an existing test case
  const handleUpdateTest = useCallback(
    (index: number, example: ProblemExample) => {
      if (!definition || !onUpdateDefinition) return

      const existingExamples = definition.problemInput.examples || []
      const updatedExamples = [...existingExamples]
      updatedExamples[index] = example

      const updatedDefinition: FlowchartDefinition = {
        ...definition,
        problemInput: {
          ...definition.problemInput,
          examples: updatedExamples,
        },
      }
      onUpdateDefinition(updatedDefinition)
      setEditingTest(null)
    },
    [definition, onUpdateDefinition]
  )

  // Handle deleting a test case
  const handleDeleteTest = useCallback(
    (index: number) => {
      if (!definition || !onUpdateDefinition) return

      const existingExamples = definition.problemInput.examples || []
      const updatedExamples = existingExamples.filter((_, i) => i !== index)

      const updatedDefinition: FlowchartDefinition = {
        ...definition,
        problemInput: {
          ...definition.problemInput,
          examples: updatedExamples,
        },
      }
      onUpdateDefinition(updatedDefinition)
    },
    [definition, onUpdateDefinition]
  )

  // Find the index of a test case in the examples array
  const findTestIndex = useCallback(
    (example: ProblemExample): number => {
      const examples = definition?.problemInput.examples || []
      return examples.findIndex(
        (ex) => ex.name === example.name && ex.expectedAnswer === example.expectedAnswer
      )
    },
    [definition]
  )

  if (!definition) {
    return (
      <p className={css({ color: { base: 'gray.500', _dark: 'gray.400' } })}>
        Generate a flowchart to see test results.
      </p>
    )
  }

  return (
    <div data-component="tests-tab" className={vstack({ gap: '4', alignItems: 'stretch' })}>
      {/* Summary Header */}
      <div
        data-element="test-summary"
        className={css({
          padding: '3',
          borderRadius: 'lg',
          backgroundColor: validationReport?.passed
            ? { base: 'green.50', _dark: 'green.900/30' }
            : validationReport && validationReport.summary.total > 0
              ? { base: 'red.50', _dark: 'red.900/30' }
              : { base: 'gray.50', _dark: 'gray.800' },
          border: '1px solid',
          borderColor: validationReport?.passed
            ? { base: 'green.200', _dark: 'green.800' }
            : validationReport && validationReport.summary.total > 0
              ? { base: 'red.200', _dark: 'red.800' }
              : { base: 'gray.200', _dark: 'gray.700' },
        })}
      >
        <div className={hstack({ gap: '2', justifyContent: 'space-between' })}>
          <div className={hstack({ gap: '2' })}>
            <span className={css({ fontSize: 'xl' })}>
              {isRunning
                ? '⏳'
                : validationReport?.passed
                  ? '✅'
                  : testCases.length > 0
                    ? '❌'
                    : '📝'}
            </span>
            <div>
              <h3
                className={css({
                  fontWeight: 'semibold',
                  color: { base: 'gray.900', _dark: 'gray.100' },
                })}
              >
                {isRunning
                  ? 'Running tests...'
                  : testCases.length === 0
                    ? 'No test cases'
                    : validationReport?.passed
                      ? 'All tests passing'
                      : `${validationReport?.summary.failed || 0} test${(validationReport?.summary.failed || 0) !== 1 ? 's' : ''} failing`}
              </h3>
              {validationReport && validationReport.summary.total > 0 && (
                <p
                  className={css({
                    fontSize: 'sm',
                    color: { base: 'gray.600', _dark: 'gray.400' },
                  })}
                >
                  {validationReport.summary.passed}/{validationReport.summary.total} passed
                </p>
              )}
            </div>
          </div>
          {testCases.length === 0 && (
            <span
              className={css({
                fontSize: 'xs',
                color: { base: 'gray.500', _dark: 'gray.400' },
              })}
            >
              Add expectedAnswer to examples
            </span>
          )}
        </div>
      </div>

      {/* Test Results */}
      {validationReport && validationReport.results.length > 0 && (
        <div data-element="test-results" className={vstack({ gap: '2', alignItems: 'stretch' })}>
          <h4
            className={css({
              fontWeight: 'medium',
              fontSize: 'sm',
              color: { base: 'gray.700', _dark: 'gray.300' },
            })}
          >
            Test Results
          </h4>
          {validationReport.results.map((result, index) => {
            const testIndex = findTestIndex(result.example)
            return (
              <TestResultRow
                key={index}
                result={result}
                canEdit={!!onUpdateDefinition}
                onEdit={() => setEditingTest({ index: testIndex, example: result.example })}
                onDelete={() => handleDeleteTest(testIndex)}
                onHoverSnapshots={onHoverSnapshots}
                onHoverNode={onHoverNode}
              />
            )
          })}
        </div>
      )}

      {/* Coverage Info */}
      {validationReport && validationReport.coverage.totalPaths > 0 && (
        <div
          data-element="coverage-info"
          className={css({
            padding: '3',
            borderRadius: 'md',
            backgroundColor: { base: 'blue.50', _dark: 'blue.900/20' },
            border: '1px solid',
            borderColor: { base: 'blue.200', _dark: 'blue.800' },
          })}
        >
          <div className={hstack({ gap: '2' })}>
            <span className={css({ fontSize: 'lg' })}>📊</span>
            <div>
              <p
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: { base: 'blue.700', _dark: 'blue.300' },
                })}
              >
                Path Coverage: {validationReport.coverage.coveragePercent}%
              </p>
              <p
                className={css({
                  fontSize: 'xs',
                  color: { base: 'blue.600', _dark: 'blue.400' },
                })}
              >
                {validationReport.coverage.coveredPaths}/{validationReport.coverage.totalPaths}
                {validationReport.coverage.pathsLimitReached ? '+' : ''} paths covered
              </p>
              {validationReport.coverage.pathsLimitReached && (
                <p
                  className={css({
                    fontSize: 'xs',
                    color: { base: 'amber.600', _dark: 'amber.400' },
                    fontStyle: 'italic',
                  })}
                >
                  (Flowchart has more paths than counted - limit reached)
                </p>
              )}
            </div>
          </div>
          {validationReport.coverage.uncoveredPaths.length > 0 && (
            <div className={css({ marginTop: '2' })}>
              <p
                className={css({
                  fontSize: 'xs',
                  color: { base: 'blue.600', _dark: 'blue.400' },
                  marginBottom: '1',
                })}
              >
                Uncovered paths:
              </p>
              <ul
                className={css({
                  fontSize: 'xs',
                  color: { base: 'blue.500', _dark: 'blue.500' },
                  paddingLeft: '4',
                })}
              >
                {validationReport.coverage.uncoveredPaths.slice(0, 3).map((path, i) => (
                  <li key={i}>• {path}</li>
                ))}
                {validationReport.coverage.uncoveredPaths.length > 3 && (
                  <li>• ...and {validationReport.coverage.uncoveredPaths.length - 3} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Examples without test cases */}
      {examplesWithoutTests.length > 0 && (
        <div
          data-element="examples-without-tests"
          className={css({
            padding: '3',
            borderRadius: 'md',
            backgroundColor: { base: 'yellow.50', _dark: 'yellow.900/20' },
            border: '1px solid',
            borderColor: { base: 'yellow.200', _dark: 'yellow.800' },
          })}
        >
          <p
            className={css({
              fontSize: 'sm',
              color: { base: 'yellow.700', _dark: 'yellow.300' },
              marginBottom: '2',
            })}
          >
            {examplesWithoutTests.length} example{examplesWithoutTests.length !== 1 ? 's' : ''}{' '}
            without expectedAnswer:
          </p>
          <ul
            className={css({
              fontSize: 'xs',
              color: { base: 'yellow.600', _dark: 'yellow.400' },
            })}
          >
            {examplesWithoutTests.map((ex, i) => (
              <li key={i}>• {ex.name}</li>
            ))}
          </ul>
          <p
            className={css({
              fontSize: 'xs',
              color: { base: 'yellow.500', _dark: 'yellow.500' },
              marginTop: '2',
            })}
          >
            Use refinement to add expectedAnswer to these examples.
          </p>
        </div>
      )}

      {/* Edit Test Form */}
      {editingTest && definition && (
        <EditTestForm
          definition={definition}
          example={editingTest.example}
          onSave={(example) => handleUpdateTest(editingTest.index, example)}
          onCancel={() => setEditingTest(null)}
        />
      )}

      {/* Add Test Form */}
      {showAddTestForm && definition && !editingTest && (
        <AddTestForm
          definition={definition}
          onAdd={handleAddTest}
          onCancel={() => setShowAddTestForm(false)}
        />
      )}

      {/* Add Test Button */}
      {onUpdateDefinition && !showAddTestForm && (
        <button
          data-action="add-test"
          onClick={() => setShowAddTestForm(true)}
          className={css({
            padding: '2',
            borderRadius: 'md',
            backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
            color: { base: 'gray.600', _dark: 'gray.400' },
            border: '1px dashed',
            borderColor: { base: 'gray.300', _dark: 'gray.600' },
            cursor: 'pointer',
            fontSize: 'sm',
            _hover: {
              backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
            },
          })}
        >
          + Add Test Case
        </button>
      )}
    </div>
  )
}

/**
 * Single test result row
 */
function TestResultRow({
  result,
  canEdit,
  onEdit,
  onDelete,
  onHoverSnapshots,
  onHoverNode,
}: {
  result: TestResult
  canEdit?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onHoverSnapshots?: (snapshots: StateSnapshot[] | null) => void
  onHoverNode?: (nodeId: string | null) => void
}) {
  const [isExpanded, setIsExpanded] = useState(!result.passed)

  // Use snapshots from the test result (captured during validation)
  const snapshots = result.snapshots || []

  return (
    <div
      data-element="test-result"
      className={css({
        padding: '2',
        borderRadius: 'md',
        backgroundColor: result.passed
          ? { base: 'green.50', _dark: 'green.900/20' }
          : { base: 'red.50', _dark: 'red.900/20' },
        border: '1px solid',
        borderColor: result.passed
          ? { base: 'green.200', _dark: 'green.800' }
          : { base: 'red.200', _dark: 'red.800' },
      })}
      onMouseEnter={() => snapshots.length > 0 && onHoverSnapshots?.(snapshots)}
      onMouseLeave={() => onHoverSnapshots?.(null)}
    >
      <div
        className={hstack({
          gap: '2',
          justifyContent: 'space-between',
          cursor: 'pointer',
        })}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={hstack({ gap: '2', flex: 1 })}>
          <span className={css({ fontSize: 'sm' })}>{result.passed ? '✓' : '✗'}</span>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: result.passed
                ? { base: 'green.700', _dark: 'green.300' }
                : { base: 'red.700', _dark: 'red.300' },
            })}
          >
            {result.example.name}
          </span>
        </div>
        <div className={hstack({ gap: '1' })}>
          {canEdit && (
            <>
              <button
                data-action="edit-test"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.()
                }}
                className={css({
                  padding: '1',
                  fontSize: 'xs',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'sm',
                  _hover: {
                    color: { base: 'blue.600', _dark: 'blue.400' },
                    backgroundColor: { base: 'blue.50', _dark: 'blue.900/30' },
                  },
                })}
                title="Edit test"
              >
                ✏️
              </button>
              <button
                data-action="delete-test"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Delete this test case?')) {
                    onDelete?.()
                  }
                }}
                className={css({
                  padding: '1',
                  fontSize: 'xs',
                  color: { base: 'gray.500', _dark: 'gray.400' },
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'sm',
                  _hover: {
                    color: { base: 'red.600', _dark: 'red.400' },
                    backgroundColor: { base: 'red.50', _dark: 'red.900/30' },
                  },
                })}
                title="Delete test"
              >
                🗑️
              </button>
            </>
          )}
          <span
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.400', _dark: 'gray.500' },
            })}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div
          className={css({
            marginTop: '2',
            paddingTop: '2',
            borderTop: '1px solid',
            borderColor: result.passed
              ? { base: 'green.200', _dark: 'green.800' }
              : { base: 'red.200', _dark: 'red.800' },
          })}
        >
          {!result.passed && (
            <p
              className={css({
                fontSize: 'xs',
                color: { base: 'red.600', _dark: 'red.400' },
                marginBottom: '2',
              })}
            >
              {formatTestFailure(result)}
            </p>
          )}
          <div
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            <p>
              <strong>Input:</strong> {JSON.stringify(result.example.values)}
            </p>
            <p>
              <strong>Expected:</strong> "{result.expectedAnswer}"
            </p>
            {result.actualAnswer !== null && (
              <p>
                <strong>Actual:</strong> "{result.actualAnswer}"
              </p>
            )}
          </div>

          {/* Computation Trace */}
          {snapshots.length > 0 && (
            <div
              data-element="test-trace"
              className={css({
                marginTop: '3',
                paddingTop: '3',
                borderTop: '1px solid',
                borderColor: { base: 'gray.200', _dark: 'gray.700' },
              })}
            >
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
                snapshots={snapshots}
                defaultExpanded={false}
                onHoverStep={onHoverNode}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Form for adding a new test case
 */
function AddTestForm({
  definition,
  onAdd,
  onCancel,
}: {
  definition: FlowchartDefinition
  onAdd: (example: ProblemExample) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [expectedAnswer, setExpectedAnswer] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})

  // Initialize values with empty strings for each field
  useEffect(() => {
    const initialValues: Record<string, string> = {}
    for (const field of definition.problemInput.fields) {
      if (field.type === 'mixed-number') {
        initialValues[`${field.name}Whole`] = ''
        initialValues[`${field.name}Num`] = ''
        initialValues[`${field.name}Denom`] = ''
      } else {
        initialValues[field.name] = ''
      }
    }
    setValues(initialValues)
  }, [definition])

  const handleSubmit = useCallback(() => {
    if (!name.trim() || !expectedAnswer.trim()) return

    // Convert string values to proper types
    const typedValues: Record<string, ProblemValue> = {}
    for (const field of definition.problemInput.fields) {
      if (field.type === 'mixed-number') {
        typedValues[field.name] = {
          whole: Number(values[`${field.name}Whole`]) || 0,
          num: Number(values[`${field.name}Num`]) || 0,
          denom: Number(values[`${field.name}Denom`]) || 1,
        }
      } else if (field.type === 'integer' || field.type === 'number') {
        typedValues[field.name] = Number(values[field.name]) || 0
      } else {
        typedValues[field.name] = values[field.name] || ''
      }
    }

    onAdd({
      name: name.trim(),
      values: typedValues,
      expectedAnswer: expectedAnswer.trim(),
    })
  }, [name, expectedAnswer, values, definition, onAdd])

  return (
    <div
      data-element="add-test-form"
      className={css({
        padding: '3',
        borderRadius: 'md',
        backgroundColor: { base: 'gray.50', _dark: 'gray.800' },
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
      })}
    >
      <h4
        className={css({
          fontWeight: 'medium',
          marginBottom: '3',
          color: { base: 'gray.800', _dark: 'gray.200' },
        })}
      >
        Add Test Case
      </h4>

      <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
        {/* Test name */}
        <div>
          <label
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            Test Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., 'Result becomes whole number'"
            className={css({
              width: '100%',
              padding: '2',
              borderRadius: 'md',
              border: '1px solid',
              borderColor: { base: 'gray.300', _dark: 'gray.600' },
              backgroundColor: { base: 'white', _dark: 'gray.900' },
              fontSize: 'sm',
            })}
          />
        </div>

        {/* Input values */}
        <div>
          <label
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            Input Values
          </label>
          <div
            className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2' })}
          >
            {definition.problemInput.fields.map((field) => {
              if (field.type === 'mixed-number') {
                return (
                  <div key={field.name} className={css({ gridColumn: 'span 2' })}>
                    <span className={css({ fontSize: 'xs' })}>{field.label || field.name}:</span>
                    <div className={hstack({ gap: '1' })}>
                      <input
                        type="number"
                        value={values[`${field.name}Whole`] || ''}
                        onChange={(e) =>
                          setValues({ ...values, [`${field.name}Whole`]: e.target.value })
                        }
                        placeholder="Whole"
                        className={css({
                          width: '60px',
                          padding: '1',
                          borderRadius: 'sm',
                          border: '1px solid',
                          borderColor: { base: 'gray.300', _dark: 'gray.600' },
                          fontSize: 'sm',
                        })}
                      />
                      <input
                        type="number"
                        value={values[`${field.name}Num`] || ''}
                        onChange={(e) =>
                          setValues({ ...values, [`${field.name}Num`]: e.target.value })
                        }
                        placeholder="Num"
                        className={css({
                          width: '50px',
                          padding: '1',
                          borderRadius: 'sm',
                          border: '1px solid',
                          borderColor: { base: 'gray.300', _dark: 'gray.600' },
                          fontSize: 'sm',
                        })}
                      />
                      <span>/</span>
                      <input
                        type="number"
                        value={values[`${field.name}Denom`] || ''}
                        onChange={(e) =>
                          setValues({ ...values, [`${field.name}Denom`]: e.target.value })
                        }
                        placeholder="Denom"
                        className={css({
                          width: '50px',
                          padding: '1',
                          borderRadius: 'sm',
                          border: '1px solid',
                          borderColor: { base: 'gray.300', _dark: 'gray.600' },
                          fontSize: 'sm',
                        })}
                      />
                    </div>
                  </div>
                )
              }
              return (
                <div key={field.name}>
                  <span className={css({ fontSize: 'xs' })}>{field.label || field.name}:</span>
                  <input
                    type={field.type === 'integer' || field.type === 'number' ? 'number' : 'text'}
                    value={values[field.name] || ''}
                    onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                    className={css({
                      width: '100%',
                      padding: '1',
                      borderRadius: 'sm',
                      border: '1px solid',
                      borderColor: { base: 'gray.300', _dark: 'gray.600' },
                      fontSize: 'sm',
                    })}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Expected answer */}
        <div>
          <label
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            Expected Answer
          </label>
          <input
            type="text"
            value={expectedAnswer}
            onChange={(e) => setExpectedAnswer(e.target.value)}
            placeholder="e.g., '5' or '3/4'"
            className={css({
              width: '100%',
              padding: '2',
              borderRadius: 'md',
              border: '1px solid',
              borderColor: { base: 'gray.300', _dark: 'gray.600' },
              backgroundColor: { base: 'white', _dark: 'gray.900' },
              fontSize: 'sm',
            })}
          />
        </div>

        {/* Buttons */}
        <div className={hstack({ gap: '2', justifyContent: 'flex-end' })}>
          <button
            onClick={onCancel}
            className={css({
              padding: '1.5 3',
              borderRadius: 'md',
              backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
              color: { base: 'gray.700', _dark: 'gray.300' },
              border: 'none',
              cursor: 'pointer',
              fontSize: 'sm',
              _hover: {
                backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
              },
            })}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !expectedAnswer.trim()}
            className={css({
              padding: '1.5 3',
              borderRadius: 'md',
              backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'sm',
              _hover: {
                backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            Add Test
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Form for editing an existing test case
 */
function EditTestForm({
  definition,
  example,
  onSave,
  onCancel,
}: {
  definition: FlowchartDefinition
  example: ProblemExample
  onSave: (example: ProblemExample) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(example.name)
  const [expectedAnswer, setExpectedAnswer] = useState(example.expectedAnswer || '')
  const [values, setValues] = useState<Record<string, string>>({})

  // Initialize values from example
  useEffect(() => {
    const initialValues: Record<string, string> = {}
    for (const field of definition.problemInput.fields) {
      if (field.type === 'mixed-number') {
        const val = example.values[field.name] as
          | { whole?: number; num?: number; denom?: number }
          | undefined
        initialValues[`${field.name}Whole`] = String(val?.whole ?? '')
        initialValues[`${field.name}Num`] = String(val?.num ?? '')
        initialValues[`${field.name}Denom`] = String(val?.denom ?? '')
      } else {
        initialValues[field.name] = String(example.values[field.name] ?? '')
      }
    }
    setValues(initialValues)
  }, [definition, example])

  const handleSubmit = useCallback(() => {
    if (!name.trim() || !expectedAnswer.trim()) return

    // Convert string values to proper types
    const typedValues: Record<string, ProblemValue> = {}
    for (const field of definition.problemInput.fields) {
      if (field.type === 'mixed-number') {
        typedValues[field.name] = {
          whole: Number(values[`${field.name}Whole`]) || 0,
          num: Number(values[`${field.name}Num`]) || 0,
          denom: Number(values[`${field.name}Denom`]) || 1,
        }
      } else if (field.type === 'integer' || field.type === 'number') {
        typedValues[field.name] = Number(values[field.name]) || 0
      } else {
        typedValues[field.name] = values[field.name] || ''
      }
    }

    onSave({
      name: name.trim(),
      description: example.description,
      values: typedValues,
      expectedAnswer: expectedAnswer.trim(),
    })
  }, [name, expectedAnswer, values, definition, example.description, onSave])

  return (
    <div
      data-element="edit-test-form"
      className={css({
        padding: '3',
        borderRadius: 'md',
        backgroundColor: { base: 'blue.50', _dark: 'blue.900/20' },
        border: '1px solid',
        borderColor: { base: 'blue.200', _dark: 'blue.700' },
      })}
    >
      <h4
        className={css({
          fontWeight: 'medium',
          marginBottom: '3',
          color: { base: 'gray.800', _dark: 'gray.200' },
        })}
      >
        Edit Test Case
      </h4>

      <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
        {/* Test name */}
        <div>
          <label
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            Test Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={css({
              width: '100%',
              padding: '2',
              borderRadius: 'md',
              border: '1px solid',
              borderColor: { base: 'gray.300', _dark: 'gray.600' },
              backgroundColor: { base: 'white', _dark: 'gray.900' },
              fontSize: 'sm',
            })}
          />
        </div>

        {/* Input values */}
        <div>
          <label
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            Input Values
          </label>
          <div
            className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2' })}
          >
            {definition.problemInput.fields.map((field) => {
              if (field.type === 'mixed-number') {
                return (
                  <div key={field.name} className={css({ gridColumn: 'span 2' })}>
                    <span className={css({ fontSize: 'xs' })}>{field.label || field.name}:</span>
                    <div className={hstack({ gap: '1' })}>
                      <input
                        type="number"
                        value={values[`${field.name}Whole`] || ''}
                        onChange={(e) =>
                          setValues({ ...values, [`${field.name}Whole`]: e.target.value })
                        }
                        placeholder="Whole"
                        className={css({
                          width: '60px',
                          padding: '1',
                          borderRadius: 'sm',
                          border: '1px solid',
                          borderColor: { base: 'gray.300', _dark: 'gray.600' },
                          fontSize: 'sm',
                        })}
                      />
                      <input
                        type="number"
                        value={values[`${field.name}Num`] || ''}
                        onChange={(e) =>
                          setValues({ ...values, [`${field.name}Num`]: e.target.value })
                        }
                        placeholder="Num"
                        className={css({
                          width: '50px',
                          padding: '1',
                          borderRadius: 'sm',
                          border: '1px solid',
                          borderColor: { base: 'gray.300', _dark: 'gray.600' },
                          fontSize: 'sm',
                        })}
                      />
                      <span>/</span>
                      <input
                        type="number"
                        value={values[`${field.name}Denom`] || ''}
                        onChange={(e) =>
                          setValues({ ...values, [`${field.name}Denom`]: e.target.value })
                        }
                        placeholder="Denom"
                        className={css({
                          width: '50px',
                          padding: '1',
                          borderRadius: 'sm',
                          border: '1px solid',
                          borderColor: { base: 'gray.300', _dark: 'gray.600' },
                          fontSize: 'sm',
                        })}
                      />
                    </div>
                  </div>
                )
              }
              return (
                <div key={field.name}>
                  <span className={css({ fontSize: 'xs' })}>{field.label || field.name}:</span>
                  <input
                    type={field.type === 'integer' || field.type === 'number' ? 'number' : 'text'}
                    value={values[field.name] || ''}
                    onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                    className={css({
                      width: '100%',
                      padding: '1',
                      borderRadius: 'sm',
                      border: '1px solid',
                      borderColor: { base: 'gray.300', _dark: 'gray.600' },
                      fontSize: 'sm',
                    })}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Expected answer */}
        <div>
          <label
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.600', _dark: 'gray.400' },
            })}
          >
            Expected Answer
          </label>
          <input
            type="text"
            value={expectedAnswer}
            onChange={(e) => setExpectedAnswer(e.target.value)}
            className={css({
              width: '100%',
              padding: '2',
              borderRadius: 'md',
              border: '1px solid',
              borderColor: { base: 'gray.300', _dark: 'gray.600' },
              backgroundColor: { base: 'white', _dark: 'gray.900' },
              fontSize: 'sm',
            })}
          />
        </div>

        {/* Buttons */}
        <div className={hstack({ gap: '2', justifyContent: 'flex-end' })}>
          <button
            onClick={onCancel}
            className={css({
              padding: '1.5 3',
              borderRadius: 'md',
              backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
              color: { base: 'gray.700', _dark: 'gray.300' },
              border: 'none',
              cursor: 'pointer',
              fontSize: 'sm',
              _hover: {
                backgroundColor: { base: 'gray.300', _dark: 'gray.600' },
              },
            })}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !expectedAnswer.trim()}
            className={css({
              padding: '1.5 3',
              borderRadius: 'md',
              backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'sm',
              _hover: {
                backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import { TutorialPlayer } from './TutorialPlayer'
import { css } from '../../../styled-system/css'
import { stack, hstack, vstack } from '../../../styled-system/patterns'
import { Tutorial, TutorialStep, PracticeStep, TutorialValidation, StepValidationError, createBasicSkillSet } from '../../types/tutorial'
import { PracticeStepEditor } from './PracticeStepEditor'
import { generateSingleProblem } from '../../utils/problemGenerator'
import { skillConfigurationToSkillSets, createBasicAllowedConfiguration } from '../../utils/skillConfiguration'
import { EditorLayout, TextInput, NumberInput, FormGroup, CompactStepItem, BetweenStepAdd } from './shared/EditorComponents'
import Resizable from 'react-resizable-layout'

// Modal component for tutorial metadata editing
interface TutorialInfoModalProps {
  tutorial: Tutorial
  isOpen: boolean
  onClose: () => void
  onUpdateTutorial: (updates: Partial<Tutorial>) => void
}

function TutorialInfoModal({ tutorial, isOpen, onClose, onUpdateTutorial }: TutorialInfoModalProps) {
  const [editingField, setEditingField] = useState<string | null>(null)

  if (!isOpen) return null

  const updateTutorialMeta = (updates: Partial<Tutorial>) => {
    onUpdateTutorial({ ...updates, updatedAt: new Date() })
  }

  return (
    <div className={css({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      bg: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    })}>
      <div className={css({
        bg: 'white',
        borderRadius: 'lg',
        p: 6,
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        shadow: 'xl'
      })}>
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 })}>
          <h2 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>Tutorial Settings</h2>
          <button
            onClick={onClose}
            className={css({
              p: 2,
              borderRadius: 'md',
              cursor: 'pointer',
              _hover: { bg: 'gray.100' }
            })}
          >
            ✕
          </button>
        </div>

        <div className={stack({ gap: 4 })}>
          {/* Description */}
          <div>
            <label className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.700', display: 'block', mb: 2 })}>
              Description
            </label>
            {editingField === 'description' ? (
              <textarea
                value={tutorial.description}
                onChange={(e) => updateTutorialMeta({ description: e.target.value })}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditingField(null)
                  }
                }}
                autoFocus
                rows={4}
                className={css({
                  w: 'full',
                  p: 3,
                  border: '1px solid',
                  borderColor: 'blue.300',
                  borderRadius: 'md',
                  fontSize: 'sm',
                  resize: 'vertical'
                })}
              />
            ) : (
              <div
                onClick={() => setEditingField('description')}
                className={css({
                  fontSize: 'sm',
                  cursor: 'pointer',
                  p: 3,
                  border: '1px solid',
                  borderColor: 'gray.200',
                  borderRadius: 'md',
                  _hover: { bg: 'gray.50', borderColor: 'gray.300' },
                  lineHeight: 'normal',
                  color: tutorial.description ? 'inherit' : 'gray.400',
                  minHeight: '100px'
                })}
              >
                {tutorial.description || 'Click to add description...'}
              </div>
            )}
          </div>

          {/* Category, Difficulty, Duration row */}
          <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 })}>
            {/* Category */}
            <div>
              <label className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.700', display: 'block', mb: 2 })}>
                Category
              </label>
              {editingField === 'category' ? (
                <input
                  type="text"
                  value={tutorial.category}
                  onChange={(e) => updateTutorialMeta({ category: e.target.value })}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      setEditingField(null)
                    }
                  }}
                  autoFocus
                  className={css({
                    w: 'full',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'blue.300',
                    borderRadius: 'md',
                    fontSize: 'sm'
                  })}
                />
              ) : (
                <div
                  onClick={() => setEditingField('category')}
                  className={css({
                    fontSize: 'sm',
                    cursor: 'pointer',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'gray.200',
                    borderRadius: 'md',
                    _hover: { bg: 'gray.50', borderColor: 'gray.300' }
                  })}
                >
                  {tutorial.category}
                </div>
              )}
            </div>

            {/* Difficulty */}
            <div>
              <label className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.700', display: 'block', mb: 2 })}>
                Difficulty
              </label>
              {editingField === 'difficulty' ? (
                <select
                  value={tutorial.difficulty}
                  onChange={(e) => {
                    updateTutorialMeta({ difficulty: e.target.value as any })
                    setEditingField(null)
                  }}
                  onBlur={() => setEditingField(null)}
                  autoFocus
                  className={css({
                    w: 'full',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'blue.300',
                    borderRadius: 'md',
                    fontSize: 'sm'
                  })}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              ) : (
                <div
                  onClick={() => setEditingField('difficulty')}
                  className={css({
                    fontSize: 'sm',
                    cursor: 'pointer',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'gray.200',
                    borderRadius: 'md',
                    _hover: { bg: 'gray.50', borderColor: 'gray.300' },
                    textTransform: 'capitalize'
                  })}
                >
                  {tutorial.difficulty}
                </div>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.700', display: 'block', mb: 2 })}>
                Duration (min)
              </label>
              {editingField === 'estimatedDuration' ? (
                <input
                  type="number"
                  value={tutorial.estimatedDuration}
                  onChange={(e) => updateTutorialMeta({ estimatedDuration: parseInt(e.target.value) || 0 })}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      setEditingField(null)
                    }
                  }}
                  autoFocus
                  className={css({
                    w: 'full',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'blue.300',
                    borderRadius: 'md',
                    fontSize: 'sm'
                  })}
                />
              ) : (
                <div
                  onClick={() => setEditingField('estimatedDuration')}
                  className={css({
                    fontSize: 'sm',
                    cursor: 'pointer',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'gray.200',
                    borderRadius: 'md',
                    _hover: { bg: 'gray.50', borderColor: 'gray.300' }
                  })}
                >
                  {tutorial.estimatedDuration}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.700', display: 'block', mb: 2 })}>
              Tags (comma-separated)
            </label>
            {editingField === 'tags' ? (
              <input
                type="text"
                value={tutorial.tags?.join(', ') || ''}
                onChange={(e) => updateTutorialMeta({
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                })}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setEditingField(null)
                  }
                }}
                autoFocus
                className={css({
                  w: 'full',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'blue.300',
                  borderRadius: 'md',
                  fontSize: 'sm'
                })}
              />
            ) : (
              <div
                onClick={() => setEditingField('tags')}
                className={css({
                  fontSize: 'sm',
                  cursor: 'pointer',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'gray.200',
                  borderRadius: 'md',
                  _hover: { bg: 'gray.50', borderColor: 'gray.300' },
                  color: tutorial.tags?.length ? 'inherit' : 'gray.400'
                })}
              >
                {tutorial.tags?.join(', ') || 'Click to add tags...'}
              </div>
            )}
          </div>

          {/* Author */}
          <div>
            <label className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.700', display: 'block', mb: 2 })}>
              Author
            </label>
            {editingField === 'author' ? (
              <input
                type="text"
                value={tutorial.author}
                onChange={(e) => updateTutorialMeta({ author: e.target.value })}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setEditingField(null)
                  }
                }}
                autoFocus
                className={css({
                  w: 'full',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'blue.300',
                  borderRadius: 'md',
                  fontSize: 'sm'
                })}
              />
            ) : (
              <div
                onClick={() => setEditingField('author')}
                className={css({
                  fontSize: 'sm',
                  cursor: 'pointer',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'gray.200',
                  borderRadius: 'md',
                  _hover: { bg: 'gray.50', borderColor: 'gray.300' }
                })}
              >
                {tutorial.author}
              </div>
            )}
          </div>
        </div>

        <div className={css({ mt: 6, display: 'flex', justifyContent: 'flex-end' })}>
          <button
            onClick={onClose}
            className={css({
              px: 4,
              py: 2,
              bg: 'blue.500',
              color: 'white',
              border: 'none',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'medium',
              cursor: 'pointer',
              _hover: { bg: 'blue.600' }
            })}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// Practice Step Preview Component
interface PracticeStepPreviewProps {
  step: PracticeStep
}

function PracticeStepPreview({ step }: PracticeStepPreviewProps) {
  const [problems, setProblems] = useState<Array<{
    id: string
    terms: number[]
    answer: number
    difficulty: 'easy' | 'medium' | 'hard'
    requiredSkills: string[]
  }>>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const generateProblems = useCallback(async () => {
    setIsGenerating(true)
    const generatedProblems = []
    const maxToShow = Math.min(6, step.problemCount) // Show up to 6 problems in preview
    const seenProblems = new Set<string>() // Track generated problems to avoid duplicates

    // Use a basic configuration for generating problems
    const config = createBasicAllowedConfiguration()
    const { required, target, forbidden } = skillConfigurationToSkillSets(config)

    let attempts = 0
    const maxAttempts = 200 // Prevent infinite loops

    while (generatedProblems.length < maxToShow && attempts < maxAttempts) {
      const problem = generateSingleProblem(
        {
          numberRange: step.numberRange || { min: 1, max: 9 },
          maxSum: step.sumConstraints?.maxSum,
          minSum: step.sumConstraints?.minSum,
          maxTerms: step.maxTerms,
          problemCount: step.problemCount
        },
        step.requiredSkills || required,
        step.targetSkills || target,
        step.forbiddenSkills || forbidden,
        50 // attempts
      )

      if (problem) {
        // Create a unique key for the problem based on terms and answer
        const problemKey = `${problem.terms.join('+')}_${problem.answer}`

        if (!seenProblems.has(problemKey)) {
          seenProblems.add(problemKey)
          generatedProblems.push(problem)
        }
      }

      attempts++
    }

    setProblems(generatedProblems)
    setIsGenerating(false)
  }, [step])

  useEffect(() => {
    generateProblems()
  }, [generateProblems])

  return (
    <div className={css({ p: 4, height: '100%', overflowY: 'auto' })}>
      <div className={vstack({ gap: 4, alignItems: 'stretch' })}>
        {/* Header */}
        <div className={css({ borderBottom: '1px solid', borderColor: 'gray.200', pb: 3 })}>
          <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'purple.800', mb: 2 })}>
            🎯 {step.title}
          </h2>
          <p className={css({ color: 'gray.600', mb: 2 })}>{step.description}</p>
          <div className={css({ fontSize: 'sm', color: 'gray.500' })}>
            {step.problemCount} problems • Max {step.maxTerms} terms • Numbers {step.numberRange?.min || 1}-{step.numberRange?.max || 9}
          </div>
        </div>

        {/* Action Button */}
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
          <h3 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>Sample Problems</h3>
          <button
            onClick={generateProblems}
            disabled={isGenerating}
            className={css({
              px: 4,
              py: 2,
              bg: isGenerating ? 'gray.200' : 'purple.500',
              color: isGenerating ? 'gray.500' : 'white',
              border: 'none',
              borderRadius: 'md',
              fontSize: 'sm',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              _hover: isGenerating ? {} : { bg: 'purple.600' }
            })}
          >
            {isGenerating ? 'Generating...' : 'Regenerate'}
          </button>
        </div>

        {/* Problems Flow */}
        {problems.length > 0 ? (
          <div className={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            overflowX: 'auto'
          })}>
            {problems.map((problem, index) => (
              <div key={problem.id} className={css({
                bg: 'white',
                border: '2px solid',
                borderColor: 'purple.200',
                borderRadius: 'lg',
                p: 3,
                textAlign: 'center',
                minWidth: '120px',
                flexShrink: 0
              })}>
                {/* Problem Number */}
                <div className={css({
                  fontSize: 'xs',
                  fontWeight: 'bold',
                  color: 'purple.600',
                  mb: 2
                })}>
                  Problem {index + 1}
                </div>

                {/* Problem Display */}
                <div className={css({
                  fontFamily: 'mono',
                  fontSize: 'lg',
                  fontWeight: 'bold',
                  mb: 2
                })}>
                  {problem.terms.map((term, termIndex) => (
                    <div key={termIndex} className={css({
                      textAlign: 'right',
                      lineHeight: 'tight'
                    })}>
                      {term}
                    </div>
                  ))}
                  <div className={css({
                    borderTop: '2px solid',
                    borderColor: 'gray.400',
                    mt: 1,
                    pt: 1,
                    fontSize: 'xl',
                    textAlign: 'right'
                  })}>
                    {problem.answer}
                  </div>
                </div>

                {/* Difficulty Badge */}
                <div className={css({
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  px: 2,
                  py: 1,
                  borderRadius: 'full',
                  bg: problem.difficulty === 'easy' ? 'green.100' :
                      problem.difficulty === 'medium' ? 'yellow.100' : 'red.100',
                  color: problem.difficulty === 'easy' ? 'green.800' :
                         problem.difficulty === 'medium' ? 'yellow.800' : 'red.800'
                })}>
                  {problem.difficulty}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={css({
            bg: 'gray.50',
            border: '2px dashed',
            borderColor: 'gray.300',
            borderRadius: 'lg',
            p: 8,
            textAlign: 'center',
            color: 'gray.500'
          })}>
            {isGenerating ? (
              <div>
                <div className={css({ fontSize: 'lg', mb: 2 })}>🔄</div>
                <div>Generating problems...</div>
              </div>
            ) : (
              <div>
                <div className={css({ fontSize: 'lg', mb: 2 })}>📝</div>
                <div>No problems generated yet</div>
                <div className={css({ fontSize: 'sm', mt: 1 })}>
                  Click "Regenerate" to create sample problems
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuration Summary */}
        <div className={css({
          bg: 'purple.50',
          border: '1px solid',
          borderColor: 'purple.200',
          borderRadius: 'md',
          p: 3
        })}>
          <h4 className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'purple.800', mb: 2 })}>
            Configuration Summary
          </h4>
          <div className={css({ fontSize: 'xs', color: 'purple.700', lineHeight: 'relaxed' })}>
            <div><strong>Total Problems:</strong> {step.problemCount}</div>
            <div><strong>Terms per Problem:</strong> Up to {step.maxTerms}</div>
            <div><strong>Number Range:</strong> {step.numberRange?.min || 1} to {step.numberRange?.max || 9}</div>
            <div><strong>Sum Limit:</strong> {step.sumConstraints?.maxSum || 'No limit'}</div>
            {step.sumConstraints?.minSum && (
              <div><strong>Min Sum:</strong> {step.sumConstraints.minSum}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


// Component for the "New" dropdown for empty state
interface NewItemDropdownProps {
  onAddStep: () => void
  onAddPracticeStep: () => void
}

function NewItemDropdown({ onAddStep, onAddPracticeStep }: NewItemDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={css({ position: 'relative', textAlign: 'center', my: 2 })}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={css({
          px: 3,
          py: 1,
          bg: 'gray.100',
          color: 'gray.600',
          border: '1px dashed',
          borderColor: 'gray.300',
          borderRadius: 'md',
          fontSize: 'sm',
          cursor: 'pointer',
          _hover: { bg: 'gray.200', borderColor: 'gray.400' }
        })}
      >
        + New
      </button>

      {isOpen && (
        <div className={css({
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          mt: 1,
          bg: 'white',
          border: '1px solid',
          borderColor: 'gray.200',
          borderRadius: 'md',
          shadow: 'md',
          zIndex: 10,
          minW: '150px'
        })}>
          <button
            onClick={() => {
              onAddStep()
              setIsOpen(false)
            }}
            className={css({
              w: 'full',
              px: 3,
              py: 2,
              textAlign: 'left',
              fontSize: 'sm',
              cursor: 'pointer',
              _hover: { bg: 'blue.50', color: 'blue.700' },
              borderBottom: '1px solid',
              borderColor: 'gray.100'
            })}
          >
            📝 Concept Step
          </button>
          <button
            onClick={() => {
              onAddPracticeStep()
              setIsOpen(false)
            }}
            className={css({
              w: 'full',
              px: 3,
              py: 2,
              textAlign: 'left',
              fontSize: 'sm',
              cursor: 'pointer',
              _hover: { bg: 'purple.50', color: 'purple.700' }
            })}
          >
            🎯 Problem Page
          </button>
        </div>
      )}
    </div>
  )
}

interface TutorialEditorProps {
  tutorial: Tutorial
  onSave?: (tutorial: Tutorial) => Promise<void>
  onValidate?: (tutorial: Tutorial) => Promise<TutorialValidation>
  onPreview?: (tutorial: Tutorial, stepIndex: number) => void
  className?: string
}

interface EditorState {
  isEditing: boolean
  isDirty: boolean
  selectedStepIndex: number | null
  selectedPracticeStepId: string | null
  previewStepIndex: number | null
  validation: TutorialValidation | null
  isSaving: boolean
  showTutorialInfoModal: boolean
}

export function TutorialEditor({
  tutorial: initialTutorial,
  onSave,
  onValidate,
  onPreview,
  className
}: TutorialEditorProps) {
  const [tutorial, setTutorial] = useState<Tutorial>(initialTutorial)
  const [editorState, setEditorState] = useState<EditorState>({
    isEditing: false,
    isDirty: false,
    selectedStepIndex: null,
    selectedPracticeStepId: null,
    previewStepIndex: null,
    validation: null,
    isSaving: false,
    showTutorialInfoModal: false
  })

  // Auto-validate when tutorial changes
  useEffect(() => {
    if (onValidate && editorState.isDirty) {
      onValidate(tutorial).then(validation => {
        setEditorState(prev => ({ ...prev, validation }))
      })
    }
  }, [tutorial, onValidate, editorState.isDirty])

  // Tutorial metadata handlers
  const updateTutorialMeta = useCallback((updates: Partial<Tutorial>) => {
    setTutorial(prev => ({ ...prev, ...updates, updatedAt: new Date() }))
    setEditorState(prev => ({ ...prev, isDirty: true }))
  }, [])

  // Step management
  const addStep = useCallback((position?: number) => {
    // Create unified sequence to determine proper positioning
    const unifiedSteps: Array<{
      type: 'concept' | 'practice'
      step: any
      originalIndex: number
      position: number
    }> = []

    // Add concept steps with positions
    tutorial.steps.forEach((step, index) => {
      unifiedSteps.push({
        type: 'concept',
        step,
        originalIndex: index,
        position: step.position ?? index
      })
    })

    // Add practice steps with positions
    ;(tutorial.practiceSteps || []).forEach((practiceStep, index) => {
      unifiedSteps.push({
        type: 'practice',
        step: practiceStep,
        originalIndex: index,
        position: practiceStep.position ?? (tutorial.steps.length + index)
      })
    })

    // Sort by position to get unified sequence
    unifiedSteps.sort((a, b) => a.position - b.position)

    // Determine the actual position value to assign to the new step
    let newStepPosition: number
    if (position === undefined || position >= unifiedSteps.length) {
      // Add at end
      newStepPosition = unifiedSteps.length > 0 ? unifiedSteps[unifiedSteps.length - 1].position + 1 : 0
    } else if (position === 0) {
      // Add at beginning
      newStepPosition = unifiedSteps.length > 0 ? unifiedSteps[0].position - 1 : 0
    } else {
      // Insert between existing steps
      const prevStep = unifiedSteps[position - 1]
      const nextStep = unifiedSteps[position]
      newStepPosition = (prevStep.position + nextStep.position) / 2
    }

    const newStep: TutorialStep = {
      id: `step-${Date.now()}`,
      title: 'New Step',
      problem: '0 + 0',
      description: 'Add step description here',
      startValue: 0,
      targetValue: 0,
      expectedAction: 'add',
      actionDescription: 'Describe the action to take',
      tooltip: {
        content: 'Tooltip title',
        explanation: 'Tooltip explanation'
      },
      errorMessages: {
        wrongBead: 'Wrong bead error message',
        wrongAction: 'Wrong action error message',
        hint: 'Hint message'
      },
      position: newStepPosition
    }

    // Add to concept steps array (position in array doesn't matter since we sort by position property)
    const newSteps = [...tutorial.steps, newStep]

    setTutorial(prev => ({
      ...prev,
      steps: newSteps,
      updatedAt: new Date()
    }))
    setEditorState(prev => ({
      ...prev,
      isDirty: true,
      selectedStepIndex: newSteps.length - 1 // Select the newly added step
    }))
  }, [tutorial.steps, tutorial.practiceSteps])

  const duplicateStep = useCallback((stepIndex: number) => {
    const stepToDuplicate = tutorial.steps[stepIndex]
    if (!stepToDuplicate) return

    const duplicatedStep: TutorialStep = {
      ...stepToDuplicate,
      id: `step-${Date.now()}`,
      title: `${stepToDuplicate.title} (Copy)`
    }

    const newSteps = [...tutorial.steps]
    newSteps.splice(stepIndex + 1, 0, duplicatedStep)

    setTutorial(prev => ({
      ...prev,
      steps: newSteps,
      updatedAt: new Date()
    }))
    setEditorState(prev => ({
      ...prev,
      isDirty: true,
      selectedStepIndex: stepIndex + 1
    }))
  }, [tutorial.steps])

  const deleteStep = useCallback((stepIndex: number) => {
    if (tutorial.steps.length <= 1) return // Don't delete the last step

    const newSteps = tutorial.steps.filter((_, index) => index !== stepIndex)
    setTutorial(prev => ({
      ...prev,
      steps: newSteps,
      updatedAt: new Date()
    }))
    setEditorState(prev => ({
      ...prev,
      isDirty: true,
      selectedStepIndex: prev.selectedStepIndex === stepIndex ? null : prev.selectedStepIndex
    }))
  }, [tutorial.steps])

  const moveStep = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    const newSteps = [...tutorial.steps]
    const [movedStep] = newSteps.splice(fromIndex, 1)
    newSteps.splice(toIndex, 0, movedStep)

    setTutorial(prev => ({
      ...prev,
      steps: newSteps,
      updatedAt: new Date()
    }))
    setEditorState(prev => ({
      ...prev,
      isDirty: true,
      selectedStepIndex: toIndex
    }))
  }, [tutorial.steps])

  // Practice step management
  const addPracticeStep = useCallback((position?: number) => {
    // Create unified sequence to determine proper positioning
    const unifiedSteps: Array<{
      type: 'concept' | 'practice'
      step: any
      originalIndex: number
      position: number
    }> = []

    // Add concept steps with positions
    tutorial.steps.forEach((step, index) => {
      unifiedSteps.push({
        type: 'concept',
        step,
        originalIndex: index,
        position: step.position ?? index
      })
    })

    // Add practice steps with positions
    ;(tutorial.practiceSteps || []).forEach((practiceStep, index) => {
      unifiedSteps.push({
        type: 'practice',
        step: practiceStep,
        originalIndex: index,
        position: practiceStep.position ?? (tutorial.steps.length + index)
      })
    })

    // Sort by position to get unified sequence
    unifiedSteps.sort((a, b) => a.position - b.position)

    // Determine the actual position value to assign to the new practice step
    let newStepPosition: number
    if (position === undefined || position >= unifiedSteps.length) {
      // Add at end
      newStepPosition = unifiedSteps.length > 0 ? unifiedSteps[unifiedSteps.length - 1].position + 1 : 0
    } else if (position === 0) {
      // Add at beginning
      newStepPosition = unifiedSteps.length > 0 ? unifiedSteps[0].position - 1 : 0
    } else {
      // Insert between existing steps
      const prevStep = unifiedSteps[position - 1]
      const nextStep = unifiedSteps[position]
      newStepPosition = (prevStep.position + nextStep.position) / 2
    }

    const newPracticeStep: PracticeStep = {
      id: `practice-${Date.now()}`,
      title: 'New Practice Step',
      description: 'Practice description here',
      problemCount: 10,
      maxTerms: 3,
      requiredSkills: createBasicSkillSet(),
      numberRange: { min: 1, max: 9 },
      sumConstraints: { maxSum: 9 },
      position: newStepPosition
    }

    // Add to practice steps array (position in array doesn't matter since we sort by position property)
    const newPracticeSteps = [...(tutorial.practiceSteps || []), newPracticeStep]

    setTutorial(prev => ({
      ...prev,
      practiceSteps: newPracticeSteps,
      updatedAt: new Date()
    }))
    setEditorState(prev => ({
      ...prev,
      isDirty: true,
      selectedPracticeStepId: newPracticeStep.id
    }))
  }, [tutorial.steps, tutorial.practiceSteps])

  const updatePracticeStep = useCallback((stepIndex: number, updates: Partial<PracticeStep>) => {
    const newPracticeSteps = [...(tutorial.practiceSteps || [])]
    if (newPracticeSteps[stepIndex]) {
      newPracticeSteps[stepIndex] = { ...newPracticeSteps[stepIndex], ...updates }

      setTutorial(prev => ({
        ...prev,
        practiceSteps: newPracticeSteps,
        updatedAt: new Date()
      }))
      setEditorState(prev => ({ ...prev, isDirty: true }))
    }
  }, [tutorial.practiceSteps])

  const deletePracticeStep = useCallback((stepIndex: number) => {
    const newPracticeSteps = (tutorial.practiceSteps || []).filter((_, index) => index !== stepIndex)
    setTutorial(prev => ({
      ...prev,
      practiceSteps: newPracticeSteps,
      updatedAt: new Date()
    }))
    setEditorState(prev => ({ ...prev, isDirty: true }))
  }, [tutorial.practiceSteps])

  const updateStep = useCallback((stepIndex: number, updates: Partial<TutorialStep>) => {
    const newSteps = [...tutorial.steps]
    newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates }

    setTutorial(prev => ({
      ...prev,
      steps: newSteps,
      updatedAt: new Date()
    }))
    setEditorState(prev => ({ ...prev, isDirty: true }))
  }, [tutorial.steps])

  // Editor actions
  const toggleEdit = useCallback(() => {
    setEditorState(prev => ({ ...prev, isEditing: !prev.isEditing }))
  }, [])

  const previewStep = useCallback((stepIndex: number) => {
    setEditorState(prev => ({ ...prev, previewStepIndex: stepIndex }))
    onPreview?.(tutorial, stepIndex)
  }, [tutorial, onPreview])

  const saveTutorial = useCallback(async () => {
    if (!onSave) return

    setEditorState(prev => ({ ...prev, isSaving: true }))
    try {
      await onSave(tutorial)
      setEditorState(prev => ({
        ...prev,
        isDirty: false,
        isSaving: false
      }))
    } catch (error) {
      console.error('Failed to save tutorial:', error)
      setEditorState(prev => ({ ...prev, isSaving: false }))
    }
  }, [tutorial, onSave])

  // Validation helpers
  const getStepErrors = useCallback((stepIndex: number): StepValidationError[] => {
    if (!editorState.validation) return []
    return editorState.validation.errors.filter(error =>
      error.stepId === tutorial.steps[stepIndex]?.id
    )
  }, [editorState.validation, tutorial.steps])

  const getStepWarnings = useCallback((stepIndex: number): StepValidationError[] => {
    if (!editorState.validation) return []
    return editorState.validation.warnings.filter(warning =>
      warning.stepId === tutorial.steps[stepIndex]?.id
    )
  }, [editorState.validation, tutorial.steps])

  return (
    <div className={css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      bg: 'gray.50'
    }, className)}>

      {editorState.isEditing ? (
        <Resizable
          axis="x"
          initial={400}
          min={300}
          max={800}
          step={1}
        >
          {({ position, separatorProps }) => (
            <div className={css({ display: 'flex', width: '100%', height: '100%' })}>
              {/* Editor sidebar */}
              <div
                className={css({
                  width: `${position}px`,
                  bg: 'white',
                  borderRight: '1px solid',
                  borderColor: 'gray.200',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  flexShrink: 0
                })}
              >
                  {/* Tutorial Settings Button */}
                  <div className={css({
                    p: 3,
                    borderBottom: '1px solid',
                    borderColor: 'gray.200',
                    flexShrink: 0
                  })}>
                    <button
                      onClick={() => setEditorState(prev => ({ ...prev, showTutorialInfoModal: true }))}
                      className={css({
                        w: 'full',
                        p: 3,
                        bg: 'white',
                        border: '1px solid',
                        borderColor: 'gray.300',
                        borderRadius: 'md',
                        fontSize: 'sm',
                        fontWeight: 'medium',
                        cursor: 'pointer',
                        textAlign: 'left',
                        _hover: { bg: 'gray.50', borderColor: 'gray.400' }
                      })}
                    >
                      <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
                        <div>
                          <div className={css({ fontWeight: 'medium', mb: 1 })}>Tutorial Settings</div>
                          <div className={css({ fontSize: 'xs', color: 'gray.600' })}>
                            {tutorial.category} • {tutorial.difficulty} • {tutorial.estimatedDuration}min
                          </div>
                        </div>
                        <div className={css({ fontSize: 'lg', color: 'gray.400' })}>⚙️</div>
                      </div>
                    </button>
                  </div>

                  {/* Tutorial Flow - Scrollable */}
                  <div className={css({
                    flex: 1,
                    overflowY: 'auto',
                    p: 4,
                    minHeight: 0
                  })}>
                    <div>
                      <h3 className={css({ fontWeight: 'bold', mb: 3 })}>
                        Tutorial Flow ({(tutorial.steps?.length || 0) + (tutorial.practiceSteps?.length || 0)} items)
                      </h3>

                      <div className={stack({ gap: 0 })}>
                        {(() => {
                          // Create unified sequence of all steps with positions
                          const unifiedSteps: Array<{
                            type: 'concept' | 'practice'
                            step: any
                            originalIndex: number
                            position: number
                          }> = []

                          // Add concept steps with positions
                          tutorial.steps.forEach((step, index) => {
                            unifiedSteps.push({
                              type: 'concept',
                              step,
                              originalIndex: index,
                              position: step.position ?? index
                            })
                          })

                          // Add practice steps with positions
                          ;(tutorial.practiceSteps || []).forEach((practiceStep, index) => {
                            unifiedSteps.push({
                              type: 'practice',
                              step: practiceStep,
                              originalIndex: index,
                              position: practiceStep.position ?? (tutorial.steps.length + index)
                            })
                          })

                          // Sort by position
                          unifiedSteps.sort((a, b) => a.position - b.position)

                          const items = []

                          // Add BetweenStepAdd at the beginning
                          items.push(
                            <BetweenStepAdd
                              key="add-0"
                              onAddStep={() => addStep(0)}
                              onAddPracticeStep={() => addPracticeStep(0)}
                            />
                          )

                          // Render each step with BetweenStepAdd after it
                          unifiedSteps.forEach((item, index) => {
                            if (item.type === 'concept') {
                              const errors = getStepErrors(item.originalIndex)
                              const warnings = getStepWarnings(item.originalIndex)
                              const isSelected = editorState.selectedStepIndex === item.originalIndex

                              items.push(
                                <div key={`concept-${item.step.id}`}>
                                  <CompactStepItem
                                    type="concept"
                                    index={index}
                                    title={item.step.title}
                                    subtitle={`${item.step.problem} → ${item.step.targetValue}`}
                                    isSelected={isSelected}
                                    hasErrors={errors.length > 0}
                                    hasWarnings={warnings.length > 0}
                                    errorCount={errors.length}
                                    warningCount={warnings.length}
                                    onClick={() => setEditorState(prev => ({
                                      ...prev,
                                      selectedStepIndex: item.originalIndex,
                                      selectedPracticeStepId: null
                                    }))}
                                    onPreview={() => previewStep(item.originalIndex)}
                                    onDelete={() => deleteStep(item.originalIndex)}
                                  >
                                    {/* Error/Warning Details - show when there are issues */}
                                    {(errors.length > 0 || warnings.length > 0) && (
                                      <div className={css({ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'gray.200' })}>
                                        {errors.map((error, errorIndex) => (
                                          <div key={errorIndex} className={css({ fontSize: 'xs', color: 'red.600', mb: 0.5 })}>
                                            ❌ {error.message}
                                          </div>
                                        ))}
                                        {warnings.map((warning, warningIndex) => (
                                          <div key={warningIndex} className={css({ fontSize: 'xs', color: 'orange.600', mb: 0.5 })}>
                                            ⚠️ {warning.message}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </CompactStepItem>
                                </div>
                              )
                            } else {
                              // Practice step
                              const isSelected = editorState.selectedPracticeStepId === item.step.id

                              items.push(
                                <div key={`practice-${item.step.id}`}>
                                  <CompactStepItem
                                    type="practice"
                                    index={index}
                                    title={item.step.title}
                                    subtitle={`${item.step.problemCount} problems • Max ${item.step.maxTerms} terms`}
                                    isSelected={isSelected}
                                    hasErrors={false}
                                    hasWarnings={false}
                                    onClick={() => setEditorState(prev => ({
                                      ...prev,
                                      selectedPracticeStepId: item.step.id,
                                      selectedStepIndex: null
                                    }))}
                                    onDelete={() => deletePracticeStep(item.originalIndex)}
                                  />
                                </div>
                              )
                            }

                            // Add BetweenStepAdd after each step
                            items.push(
                              <BetweenStepAdd
                                key={`add-${index + 1}`}
                                onAddStep={() => addStep(index + 1)}
                                onAddPracticeStep={() => addPracticeStep(index + 1)}
                              />
                            )
                          })

                          // Show empty state if no actual steps (only BetweenStepAdd components)
                          if (unifiedSteps.length === 0) {
                            return (
                              <div className={css({
                                textAlign: 'center',
                                py: 8,
                                color: 'gray.500'
                              })}>
                                <div className={css({ mb: 4, fontSize: 'lg' })}>📝</div>
                                <div className={css({ mb: 4, fontWeight: 'medium' })}>
                                  No steps yet
                                </div>
                                <div className={css({ mb: 4, fontSize: 'sm' })}>
                                  Add your first concept step or practice step to get started
                                </div>
                                <NewItemDropdown
                                  onAddStep={() => addStep(0)}
                                  onAddPracticeStep={() => addPracticeStep(0)}
                                />
                              </div>
                            )
                          }

                          return items
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resizable separator */}
                <hr
                  {...separatorProps}
                  className={css({
                    width: '4px',
                    height: 'auto',
                    border: 'none',
                    bg: 'gray.300',
                    cursor: 'ew-resize',
                    _hover: { bg: 'blue.400' },
                    transition: 'background-color 0.2s'
                  })}
                />

                {/* Main content - Split between Step Editor and Preview */}
                <div
                  className={css({
                    width: `calc(100% - ${position}px - 4px)`,
                    display: 'flex',
                    flexDirection: 'row',
                    height: '100%'
                  })}
                >
                  {/* Unified Step Editor - handles both concept and practice steps */}
                  {(editorState.selectedStepIndex !== null || editorState.selectedPracticeStepId) ? (
                    <div className={css({
                      flex: '0 0 400px',
                      bg: 'white',
                      borderRight: '1px solid',
                      borderColor: 'gray.200',
                      overflowY: 'auto',
                      height: '100%'
                    })}>
                      {/* Conditional Editor Content */}
                      {editorState.selectedStepIndex !== null ? (
                        /* Concept Step Editor */
                        <EditorLayout
                          title={`Edit Step ${editorState.selectedStepIndex + 1}`}
                          onClose={() => setEditorState(prev => ({
                            ...prev,
                            selectedStepIndex: null,
                            selectedPracticeStepId: null
                          }))}
                        >
                          <FormGroup>
                            <TextInput
                              label="Title"
                              value={tutorial.steps[editorState.selectedStepIndex].title}
                              onChange={(value) => updateStep(editorState.selectedStepIndex, { title: value })}
                            />

                            <TextInput
                              label="Problem"
                              value={tutorial.steps[editorState.selectedStepIndex].problem}
                              onChange={(value) => updateStep(editorState.selectedStepIndex, { problem: value })}
                            />

                            <FormGroup columns={2}>
                              <NumberInput
                                label="Start Value"
                                value={tutorial.steps[editorState.selectedStepIndex].startValue}
                                onChange={(value) => updateStep(editorState.selectedStepIndex, { startValue: value })}
                              />
                              <NumberInput
                                label="Target Value"
                                value={tutorial.steps[editorState.selectedStepIndex].targetValue}
                                onChange={(value) => updateStep(editorState.selectedStepIndex, { targetValue: value })}
                              />
                            </FormGroup>

                            <TextInput
                              label="Description"
                              value={tutorial.steps[editorState.selectedStepIndex].description}
                              onChange={(value) => updateStep(editorState.selectedStepIndex, { description: value })}
                              multiline
                              rows={3}
                            />
                          </FormGroup>
                        </EditorLayout>
                      ) : editorState.selectedPracticeStepId ? (
                        /* Practice Step Editor */
                        (() => {
                          const practiceStepIndex = (tutorial.practiceSteps || []).findIndex(
                            step => step.id === editorState.selectedPracticeStepId
                          )
                          const practiceStep = (tutorial.practiceSteps || [])[practiceStepIndex]

                          return practiceStep ? (
                            <PracticeStepEditor
                              step={practiceStep}
                              onChange={(updatedStep) => updatePracticeStep(practiceStepIndex, updatedStep)}
                              onDelete={() => {
                                deletePracticeStep(practiceStepIndex)
                                setEditorState(prev => ({
                                  ...prev,
                                  selectedPracticeStepId: null,
                                  selectedStepIndex: null
                                }))
                              }}
                            />
                          ) : null
                        })()
                      ) : null}
                    </div>
                  ) : null}

                  {/* Preview Section */}
                  <div className={css({
                    flex: 1,
                    overflowY: 'auto',
                    height: '100%',
                    minWidth: 0
                  })}>
                    {editorState.selectedPracticeStepId ? (
                      /* Practice Step Preview */
                      (() => {
                        const practiceStep = (tutorial.practiceSteps || []).find(
                          step => step.id === editorState.selectedPracticeStepId
                        )

                        return practiceStep ? (
                          <PracticeStepPreview step={practiceStep} />
                        ) : (
                          <div className={css({ p: 4, textAlign: 'center', color: 'gray.500' })}>
                            Practice step not found
                          </div>
                        )
                      })()
                    ) : (
                      /* Tutorial Player for Concept Steps */
                      <TutorialPlayer
                        key={`tutorial-player-${editorState.selectedStepIndex !== null ? editorState.selectedStepIndex : (editorState.previewStepIndex || 0)}`}
                        tutorial={tutorial}
                        initialStepIndex={editorState.selectedStepIndex !== null ? editorState.selectedStepIndex : (editorState.previewStepIndex || 0)}
                        isDebugMode={true}
                        showDebugPanel={editorState.isEditing}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </Resizable>
      ) : (
        /* Non-editing view - tutorial player with edit button */
        <div className={css({ width: '100%', height: '100%', position: 'relative' })}>
          {/* Edit Tutorial Button */}
          <div className={css({
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 10
          })}>
            <button
              onClick={() => setEditorState(prev => ({ ...prev, isEditing: true }))}
              className={css({
                px: 4,
                py: 2,
                bg: 'blue.500',
                color: 'white',
                border: 'none',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                shadow: 'md',
                _hover: { bg: 'blue.600' }
              })}
            >
              Edit Tutorial
            </button>
          </div>

          <TutorialPlayer
            key={`tutorial-player-${editorState.selectedStepIndex !== null ? editorState.selectedStepIndex : (editorState.previewStepIndex || 0)}`}
            tutorial={tutorial}
            initialStepIndex={editorState.selectedStepIndex !== null ? editorState.selectedStepIndex : (editorState.previewStepIndex || 0)}
            isDebugMode={true}
            showDebugPanel={editorState.isEditing}
          />
        </div>
      )}

      {/* Tutorial Info Modal */}
      <TutorialInfoModal
        tutorial={tutorial}
        isOpen={editorState.showTutorialInfoModal}
        onClose={() => setEditorState(prev => ({ ...prev, showTutorialInfoModal: false }))}
        onUpdateTutorial={updateTutorialMeta}
      />
    </div>
  )
}

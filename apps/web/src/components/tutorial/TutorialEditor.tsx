'use client'

import { useState, useCallback, useEffect } from 'react'
import { TutorialPlayer } from './TutorialPlayer'
import { css } from '../../styled-system/css'
import { stack, hstack, vstack } from '../../styled-system/patterns'
import { Tutorial, TutorialStep, TutorialValidation, StepValidationError } from '../../types/tutorial'

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
  previewStepIndex: number | null
  validation: TutorialValidation | null
  isSaving: boolean
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
    previewStepIndex: null,
    validation: null,
    isSaving: false
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
  const addStep = useCallback(() => {
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
      }
    }

    setTutorial(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
      updatedAt: new Date()
    }))
    setEditorState(prev => ({
      ...prev,
      isDirty: true,
      selectedStepIndex: tutorial.steps.length
    }))
  }, [tutorial.steps.length])

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
      height: '100vh',
      bg: 'gray.50'
    }, className)}>
      {/* Header */}
      <div className={css({
        bg: 'white',
        borderBottom: '1px solid',
        borderColor: 'gray.200',
        p: 4
      })}>
        <div className={hstack({ justifyContent: 'space-between', alignItems: 'center' })}>
          <div>
            <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>
              Tutorial Editor
            </h1>
            <p className={css({ color: 'gray.600' })}>
              {tutorial.title} {editorState.isDirty && '*'}
            </p>
          </div>

          <div className={hstack({ gap: 2 })}>
            <button
              onClick={toggleEdit}
              className={css({
                px: 4,
                py: 2,
                border: '1px solid',
                borderColor: 'blue.300',
                borderRadius: 'md',
                bg: editorState.isEditing ? 'blue.500' : 'white',
                color: editorState.isEditing ? 'white' : 'blue.700',
                cursor: 'pointer',
                _hover: { bg: editorState.isEditing ? 'blue.600' : 'blue.50' }
              })}
            >
              {editorState.isEditing ? 'Stop Editing' : 'Edit Tutorial'}
            </button>

            {editorState.isDirty && (
              <button
                onClick={saveTutorial}
                disabled={editorState.isSaving || !editorState.validation?.isValid}
                className={css({
                  px: 4,
                  py: 2,
                  border: '1px solid',
                  borderColor: 'green.300',
                  borderRadius: 'md',
                  bg: 'green.500',
                  color: 'white',
                  cursor: editorState.isSaving ? 'not-allowed' : 'pointer',
                  opacity: editorState.isSaving || !editorState.validation?.isValid ? 0.5 : 1,
                  _hover: !editorState.isSaving && editorState.validation?.isValid ? { bg: 'green.600' } : {}
                })}
              >
                {editorState.isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {/* Validation summary */}
        {editorState.validation && (
          <div className={css({ mt: 3 })}>
            {!editorState.validation.isValid && (
              <div className={css({
                p: 3,
                bg: 'red.50',
                border: '1px solid',
                borderColor: 'red.200',
                borderRadius: 'md',
                fontSize: 'sm'
              })}>
                <strong className={css({ color: 'red.800' })}>
                  {editorState.validation.errors.length} error(s) found
                </strong>
                {editorState.validation.warnings.length > 0 && (
                  <span className={css({ color: 'yellow.700', ml: 2 })}>
                    and {editorState.validation.warnings.length} warning(s)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={hstack({ flex: 1, gap: 0 })}>
        {/* Editor sidebar */}
        {editorState.isEditing && (
          <div className={css({
            w: '400px',
            bg: 'white',
            borderRight: '1px solid',
            borderColor: 'gray.200',
            p: 4,
            overflowY: 'auto'
          })}>
            {/* Tutorial metadata */}
            <div className={css({ mb: 6 })}>
              <h3 className={css({ fontWeight: 'bold', mb: 3 })}>Tutorial Info</h3>
              <div className={stack({ gap: 3 })}>
                <div>
                  <label className={css({ fontSize: 'sm', fontWeight: 'medium', mb: 1, display: 'block' })}>
                    Title
                  </label>
                  <input
                    type="text"
                    value={tutorial.title}
                    onChange={(e) => updateTutorialMeta({ title: e.target.value })}
                    className={css({
                      w: 'full',
                      p: 2,
                      border: '1px solid',
                      borderColor: 'gray.300',
                      borderRadius: 'md',
                      fontSize: 'sm'
                    })}
                  />
                </div>

                <div>
                  <label className={css({ fontSize: 'sm', fontWeight: 'medium', mb: 1, display: 'block' })}>
                    Description
                  </label>
                  <textarea
                    value={tutorial.description}
                    onChange={(e) => updateTutorialMeta({ description: e.target.value })}
                    rows={3}
                    className={css({
                      w: 'full',
                      p: 2,
                      border: '1px solid',
                      borderColor: 'gray.300',
                      borderRadius: 'md',
                      fontSize: 'sm',
                      resize: 'vertical'
                    })}
                  />
                </div>

                <div className={hstack({ gap: 2 })}>
                  <div>
                    <label className={css({ fontSize: 'sm', fontWeight: 'medium', mb: 1, display: 'block' })}>
                      Category
                    </label>
                    <input
                      type="text"
                      value={tutorial.category}
                      onChange={(e) => updateTutorialMeta({ category: e.target.value })}
                      className={css({
                        w: 'full',
                        p: 2,
                        border: '1px solid',
                        borderColor: 'gray.300',
                        borderRadius: 'md',
                        fontSize: 'sm'
                      })}
                    />
                  </div>

                  <div>
                    <label className={css({ fontSize: 'sm', fontWeight: 'medium', mb: 1, display: 'block' })}>
                      Difficulty
                    </label>
                    <select
                      value={tutorial.difficulty}
                      onChange={(e) => updateTutorialMeta({ difficulty: e.target.value as any })}
                      className={css({
                        w: 'full',
                        p: 2,
                        border: '1px solid',
                        borderColor: 'gray.300',
                        borderRadius: 'md',
                        fontSize: 'sm'
                      })}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={css({ fontSize: 'sm', fontWeight: 'medium', mb: 1, display: 'block' })}>
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tutorial.tags.join(', ')}
                    onChange={(e) => updateTutorialMeta({
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                    })}
                    className={css({
                      w: 'full',
                      p: 2,
                      border: '1px solid',
                      borderColor: 'gray.300',
                      borderRadius: 'md',
                      fontSize: 'sm'
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Steps list */}
            <div>
              <div className={hstack({ justifyContent: 'space-between', alignItems: 'center', mb: 3 })}>
                <h3 className={css({ fontWeight: 'bold' })}>Steps ({tutorial.steps.length})</h3>
                <button
                  onClick={addStep}
                  className={css({
                    px: 3,
                    py: 1,
                    bg: 'blue.500',
                    color: 'white',
                    borderRadius: 'md',
                    fontSize: 'sm',
                    cursor: 'pointer',
                    _hover: { bg: 'blue.600' }
                  })}
                >
                  + Add Step
                </button>
              </div>

              <div className={stack({ gap: 2 })}>
                {tutorial.steps.map((step, index) => {
                  const errors = getStepErrors(index)
                  const warnings = getStepWarnings(index)
                  const hasIssues = errors.length > 0 || warnings.length > 0

                  return (
                    <div
                      key={step.id}
                      className={css({
                        p: 3,
                        border: '1px solid',
                        borderColor: hasIssues ? 'red.300' :
                          editorState.selectedStepIndex === index ? 'blue.300' : 'gray.200',
                        borderRadius: 'md',
                        bg: editorState.selectedStepIndex === index ? 'blue.50' : 'white',
                        cursor: 'pointer',
                        _hover: { bg: editorState.selectedStepIndex === index ? 'blue.100' : 'gray.50' }
                      })}
                      onClick={() => setEditorState(prev => ({
                        ...prev,
                        selectedStepIndex: prev.selectedStepIndex === index ? null : index
                      }))}
                    >
                      <div className={hstack({ justifyContent: 'space-between', alignItems: 'center', mb: 1 })}>
                        <div className={css({ fontSize: 'sm', fontWeight: 'medium' })}>
                          {index + 1}. {step.title}
                        </div>
                        <div className={hstack({ gap: 1 })}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              previewStep(index)
                            }}
                            className={css({
                              px: 2,
                              py: 1,
                              fontSize: 'xs',
                              border: '1px solid',
                              borderColor: 'green.300',
                              borderRadius: 'sm',
                              bg: 'green.50',
                              color: 'green.700',
                              cursor: 'pointer',
                              _hover: { bg: 'green.100' }
                            })}
                          >
                            Preview
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              duplicateStep(index)
                            }}
                            className={css({
                              px: 2,
                              py: 1,
                              fontSize: 'xs',
                              border: '1px solid',
                              borderColor: 'gray.300',
                              borderRadius: 'sm',
                              bg: 'white',
                              cursor: 'pointer',
                              _hover: { bg: 'gray.50' }
                            })}
                          >
                            Copy
                          </button>
                          {tutorial.steps.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteStep(index)
                              }}
                              className={css({
                                px: 2,
                                py: 1,
                                fontSize: 'xs',
                                border: '1px solid',
                                borderColor: 'red.300',
                                borderRadius: 'sm',
                                bg: 'red.50',
                                color: 'red.700',
                                cursor: 'pointer',
                                _hover: { bg: 'red.100' }
                              })}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      <div className={css({ fontSize: 'xs', color: 'gray.600' })}>
                        {step.problem}
                      </div>

                      {hasIssues && (
                        <div className={css({ mt: 2, fontSize: 'xs' })}>
                          {errors.map((error, i) => (
                            <div key={i} className={css({ color: 'red.600' })}>
                              ⚠ {error.message}
                            </div>
                          ))}
                          {warnings.map((warning, i) => (
                            <div key={i} className={css({ color: 'yellow.600' })}>
                              ⚡ {warning.message}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Step details editor */}
                      {editorState.selectedStepIndex === index && (
                        <div className={css({ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'gray.200' })}>
                          <div className={stack({ gap: 2 })}>
                            <div>
                              <label className={css({ fontSize: 'xs', fontWeight: 'medium', mb: 1, display: 'block' })}>
                                Title
                              </label>
                              <input
                                type="text"
                                value={step.title}
                                onChange={(e) => updateStep(index, { title: e.target.value })}
                                className={css({
                                  w: 'full',
                                  p: 2,
                                  border: '1px solid',
                                  borderColor: 'gray.300',
                                  borderRadius: 'md',
                                  fontSize: 'xs'
                                })}
                              />
                            </div>

                            <div>
                              <label className={css({ fontSize: 'xs', fontWeight: 'medium', mb: 1, display: 'block' })}>
                                Problem
                              </label>
                              <input
                                type="text"
                                value={step.problem}
                                onChange={(e) => updateStep(index, { problem: e.target.value })}
                                className={css({
                                  w: 'full',
                                  p: 2,
                                  border: '1px solid',
                                  borderColor: 'gray.300',
                                  borderRadius: 'md',
                                  fontSize: 'xs'
                                })}
                              />
                            </div>

                            <div>
                              <label className={css({ fontSize: 'xs', fontWeight: 'medium', mb: 1, display: 'block' })}>
                                Description
                              </label>
                              <textarea
                                value={step.description}
                                onChange={(e) => updateStep(index, { description: e.target.value })}
                                rows={2}
                                className={css({
                                  w: 'full',
                                  p: 2,
                                  border: '1px solid',
                                  borderColor: 'gray.300',
                                  borderRadius: 'md',
                                  fontSize: 'xs',
                                  resize: 'vertical'
                                })}
                              />
                            </div>

                            <div className={hstack({ gap: 2 })}>
                              <div>
                                <label className={css({ fontSize: 'xs', fontWeight: 'medium', mb: 1, display: 'block' })}>
                                  Start Value
                                </label>
                                <input
                                  type="number"
                                  value={step.startValue}
                                  onChange={(e) => updateStep(index, { startValue: parseInt(e.target.value) || 0 })}
                                  className={css({
                                    w: 'full',
                                    p: 2,
                                    border: '1px solid',
                                    borderColor: 'gray.300',
                                    borderRadius: 'md',
                                    fontSize: 'xs'
                                  })}
                                />
                              </div>

                              <div>
                                <label className={css({ fontSize: 'xs', fontWeight: 'medium', mb: 1, display: 'block' })}>
                                  Target Value
                                </label>
                                <input
                                  type="number"
                                  value={step.targetValue}
                                  onChange={(e) => updateStep(index, { targetValue: parseInt(e.target.value) || 0 })}
                                  className={css({
                                    w: 'full',
                                    p: 2,
                                    border: '1px solid',
                                    borderColor: 'gray.300',
                                    borderRadius: 'md',
                                    fontSize: 'xs'
                                  })}
                                />
                              </div>
                            </div>

                            <div>
                              <label className={css({ fontSize: 'xs', fontWeight: 'medium', mb: 1, display: 'block' })}>
                                Action Description
                              </label>
                              <textarea
                                value={step.actionDescription}
                                onChange={(e) => updateStep(index, { actionDescription: e.target.value })}
                                rows={2}
                                className={css({
                                  w: 'full',
                                  p: 2,
                                  border: '1px solid',
                                  borderColor: 'gray.300',
                                  borderRadius: 'md',
                                  fontSize: 'xs',
                                  resize: 'vertical'
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Main content - Tutorial Player */}
        <div className={css({ flex: 1 })}>
          <TutorialPlayer
            tutorial={tutorial}
            initialStepIndex={editorState.previewStepIndex || 0}
            isDebugMode={true}
            showDebugPanel={editorState.isEditing}
          />
        </div>
      </div>
    </div>
  )
}
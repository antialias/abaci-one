'use client'

import { useState, useCallback } from 'react'
import { TutorialEditor } from '../../components/tutorial/TutorialEditor'
import { TutorialPlayer } from '../../components/tutorial/TutorialPlayer'
import { DevAccessProvider, EditorProtected } from '../../hooks/useAccessControl'
import { getTutorialForEditor, validateTutorialConversion } from '../../utils/tutorialConverter'
import { Tutorial, TutorialValidation, StepValidationError, TutorialEvent } from '../../types/tutorial'
import { css } from '../../styled-system/css'
import { hstack, vstack } from '../../styled-system/patterns'

interface EditorMode {
  mode: 'editor' | 'player' | 'split'
  showDebugInfo: boolean
  autoSave: boolean
}

export default function TutorialEditorPage() {
  const [tutorial, setTutorial] = useState<Tutorial>(() => getTutorialForEditor())
  const [editorMode, setEditorMode] = useState<EditorMode>({
    mode: 'editor',
    showDebugInfo: true,
    autoSave: false
  })
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [validationResult, setValidationResult] = useState(() => validateTutorialConversion())
  const [debugEvents, setDebugEvents] = useState<TutorialEvent[]>([])

  // Save tutorial (placeholder - would connect to actual backend)
  const handleSave = useCallback(async (updatedTutorial: Tutorial) => {
    setSaveStatus('saving')
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      // In real implementation, this would save to backend
      console.log('Saving tutorial:', updatedTutorial)

      setTutorial(updatedTutorial)
      setSaveStatus('saved')

      // Reset status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to save tutorial:', error)
      setSaveStatus('error')
    }
  }, [])

  // Validate tutorial (enhanced validation)
  const handleValidate = useCallback(async (tutorialToValidate: Tutorial): Promise<TutorialValidation> => {
    const errors: StepValidationError[] = []
    const warnings: StepValidationError[] = []

    // Validate tutorial metadata
    if (!tutorialToValidate.title.trim()) {
      errors.push({
        stepId: '',
        field: 'title',
        message: 'Tutorial title is required',
        severity: 'error'
      })
    }

    if (!tutorialToValidate.description.trim()) {
      warnings.push({
        stepId: '',
        field: 'description',
        message: 'Tutorial description is recommended',
        severity: 'warning'
      })
    }

    if (tutorialToValidate.steps.length === 0) {
      errors.push({
        stepId: '',
        field: 'steps',
        message: 'Tutorial must have at least one step',
        severity: 'error'
      })
    }

    // Validate each step
    tutorialToValidate.steps.forEach((step, index) => {
      // Required fields
      if (!step.title.trim()) {
        errors.push({
          stepId: step.id,
          field: 'title',
          message: `Step ${index + 1}: Title is required`,
          severity: 'error'
        })
      }

      if (!step.problem.trim()) {
        errors.push({
          stepId: step.id,
          field: 'problem',
          message: `Step ${index + 1}: Problem is required`,
          severity: 'error'
        })
      }

      if (!step.description.trim()) {
        warnings.push({
          stepId: step.id,
          field: 'description',
          message: `Step ${index + 1}: Description is recommended`,
          severity: 'warning'
        })
      }

      // Value validation
      if (step.startValue < 0 || step.targetValue < 0) {
        errors.push({
          stepId: step.id,
          field: 'values',
          message: `Step ${index + 1}: Values cannot be negative`,
          severity: 'error'
        })
      }

      if (step.startValue === step.targetValue) {
        warnings.push({
          stepId: step.id,
          field: 'values',
          message: `Step ${index + 1}: Start and target values are the same`,
          severity: 'warning'
        })
      }

      // Highlight beads validation
      if (step.highlightBeads) {
        step.highlightBeads.forEach((highlight, bIndex) => {
          if (highlight.columnIndex < 0 || highlight.columnIndex > 4) {
            errors.push({
              stepId: step.id,
              field: 'highlightBeads',
              message: `Step ${index + 1}: Highlight bead ${bIndex + 1} has invalid column index`,
              severity: 'error'
            })
          }

          if (highlight.beadType === 'earth' && highlight.position !== undefined) {
            if (highlight.position < 0 || highlight.position > 3) {
              errors.push({
                stepId: step.id,
                field: 'highlightBeads',
                message: `Step ${index + 1}: Earth bead position must be 0-3`,
                severity: 'error'
              })
            }
          }
        })
      }

      // Multi-step validation
      if (step.expectedAction === 'multi-step') {
        if (!step.multiStepInstructions || step.multiStepInstructions.length === 0) {
          errors.push({
            stepId: step.id,
            field: 'multiStepInstructions',
            message: `Step ${index + 1}: Multi-step actions require instructions`,
            severity: 'error'
          })
        }
      }

      // Tooltip validation
      if (!step.tooltip.content.trim() || !step.tooltip.explanation.trim()) {
        warnings.push({
          stepId: step.id,
          field: 'tooltip',
          message: `Step ${index + 1}: Tooltip content should be complete`,
          severity: 'warning'
        })
      }

      // Error messages validation
      if (!step.errorMessages.wrongBead.trim() || !step.errorMessages.wrongAction.trim() || !step.errorMessages.hint.trim()) {
        warnings.push({
          stepId: step.id,
          field: 'errorMessages',
          message: `Step ${index + 1}: All error messages should be provided`,
          severity: 'warning'
        })
      }
    })

    const validation: TutorialValidation = {
      isValid: errors.length === 0,
      errors,
      warnings
    }

    setValidationResult(validation)
    return validation
  }, [])

  // Preview step in player mode
  const handlePreview = useCallback((tutorialToPreview: Tutorial, stepIndex: number) => {
    setTutorial(tutorialToPreview)
    setEditorMode(prev => ({ ...prev, mode: 'player' }))
    // The TutorialPlayer will handle jumping to the specific step
  }, [])

  // Handle debug events from player
  const handleDebugEvent = useCallback((event: TutorialEvent) => {
    setDebugEvents(prev => [...prev.slice(-50), event]) // Keep last 50 events
  }, [])

  // Mode switching
  const switchMode = useCallback((mode: EditorMode['mode']) => {
    setEditorMode(prev => ({ ...prev, mode }))
  }, [])

  const toggleDebugInfo = useCallback(() => {
    setEditorMode(prev => ({ ...prev, showDebugInfo: !prev.showDebugInfo }))
  }, [])

  const toggleAutoSave = useCallback(() => {
    setEditorMode(prev => ({ ...prev, autoSave: !prev.autoSave }))
  }, [])

  // Export tutorial data for debugging
  const exportTutorialData = useCallback(() => {
    const data = {
      tutorial,
      validation: validationResult,
      debugEvents: debugEvents.slice(-20),
      timestamp: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tutorial-debug-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [tutorial, validationResult, debugEvents])

  return (
    <DevAccessProvider>
      <EditorProtected fallback={
        <div className={css({
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          textAlign: 'center'
        })}>
          <div>
            <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 4 })}>
              Access Restricted
            </h1>
            <p className={css({ color: 'gray.600', mb: 4 })}>
              Tutorial editor requires administrative privileges.
            </p>
            <p className={css({ fontSize: 'sm', color: 'gray.500' })}>
              In development mode, this would check your actual permissions.
            </p>
          </div>
        </div>
      }>
        <div className={css({ height: '100vh', display: 'flex', flexDirection: 'column' })}>
          {/* Header controls */}
          <div className={css({
            bg: 'white',
            borderBottom: '1px solid',
            borderColor: 'gray.200',
            p: 4
          })}>
            <div className={hstack({ justifyContent: 'space-between', alignItems: 'center' })}>
              <div>
                <h1 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>
                  Tutorial Editor & Debugger
                </h1>
                <p className={css({ fontSize: 'sm', color: 'gray.600' })}>
                  {tutorial.title} - {tutorial.steps.length} steps
                </p>
              </div>

              <div className={hstack({ gap: 4 })}>
                {/* Mode selector */}
                <div className={hstack({ gap: 1 })}>
                  {(['editor', 'player', 'split'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => switchMode(mode)}
                      className={css({
                        px: 3,
                        py: 1,
                        fontSize: 'sm',
                        border: '1px solid',
                        borderColor: editorMode.mode === mode ? 'blue.300' : 'gray.300',
                        borderRadius: 'md',
                        bg: editorMode.mode === mode ? 'blue.500' : 'white',
                        color: editorMode.mode === mode ? 'white' : 'gray.700',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        _hover: { bg: editorMode.mode === mode ? 'blue.600' : 'gray.50' }
                      })}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Options */}
                <div className={hstack({ gap: 2 })}>
                  <label className={hstack({ gap: 1, fontSize: 'sm' })}>
                    <input
                      type="checkbox"
                      checked={editorMode.showDebugInfo}
                      onChange={toggleDebugInfo}
                    />
                    Debug Info
                  </label>

                  <label className={hstack({ gap: 1, fontSize: 'sm' })}>
                    <input
                      type="checkbox"
                      checked={editorMode.autoSave}
                      onChange={toggleAutoSave}
                    />
                    Auto Save
                  </label>
                </div>

                {/* Actions */}
                <div className={hstack({ gap: 2 })}>
                  <button
                    onClick={exportTutorialData}
                    className={css({
                      px: 3,
                      py: 1,
                      fontSize: 'sm',
                      border: '1px solid',
                      borderColor: 'gray.300',
                      borderRadius: 'md',
                      bg: 'white',
                      cursor: 'pointer',
                      _hover: { bg: 'gray.50' }
                    })}
                  >
                    Export Debug
                  </button>

                  {saveStatus !== 'idle' && (
                    <div className={css({
                      px: 3,
                      py: 1,
                      fontSize: 'sm',
                      borderRadius: 'md',
                      bg: saveStatus === 'saving' ? 'blue.100' :
                          saveStatus === 'saved' ? 'green.100' : 'red.100',
                      color: saveStatus === 'saving' ? 'blue.700' :
                             saveStatus === 'saved' ? 'green.700' : 'red.700'
                    })}>
                      {saveStatus === 'saving' ? 'Saving...' :
                       saveStatus === 'saved' ? 'Saved!' : 'Error!'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Validation status */}
            {editorMode.showDebugInfo && validationResult && (
              <div className={css({ mt: 3 })}>
                {!validationResult.isValid ? (
                  <div className={css({
                    p: 2,
                    bg: 'red.50',
                    border: '1px solid',
                    borderColor: 'red.200',
                    borderRadius: 'md',
                    fontSize: 'sm'
                  })}>
                    <strong className={css({ color: 'red.800' })}>
                      {validationResult.errors.length} validation error(s)
                    </strong>
                    {validationResult.warnings.length > 0 && (
                      <span className={css({ color: 'yellow.700', ml: 2 })}>
                        and {validationResult.warnings.length} warning(s)
                      </span>
                    )}
                  </div>
                ) : validationResult.warnings.length > 0 ? (
                  <div className={css({
                    p: 2,
                    bg: 'yellow.50',
                    border: '1px solid',
                    borderColor: 'yellow.200',
                    borderRadius: 'md',
                    fontSize: 'sm',
                    color: 'yellow.700'
                  })}>
                    Tutorial is valid with {validationResult.warnings.length} warning(s)
                  </div>
                ) : (
                  <div className={css({
                    p: 2,
                    bg: 'green.50',
                    border: '1px solid',
                    borderColor: 'green.200',
                    borderRadius: 'md',
                    fontSize: 'sm',
                    color: 'green.700'
                  })}>
                    Tutorial validation passed ✓
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main content area */}
          <div className={css({ flex: 1, display: 'flex' })}>
            {editorMode.mode === 'editor' && (
              <TutorialEditor
                tutorial={tutorial}
                onSave={handleSave}
                onValidate={handleValidate}
                onPreview={handlePreview}
              />
            )}

            {editorMode.mode === 'player' && (
              <TutorialPlayer
                tutorial={tutorial}
                isDebugMode={true}
                showDebugPanel={editorMode.showDebugInfo}
                onEvent={handleDebugEvent}
                onTutorialComplete={(score, timeSpent) => {
                  console.log('Tutorial completed:', { score, timeSpent })
                }}
              />
            )}

            {editorMode.mode === 'split' && (
              <div className={css({ display: 'flex', width: '100%' })}>
                <div className={css({ width: '50%', borderRight: '1px solid', borderColor: 'gray.200' })}>
                  <TutorialEditor
                    tutorial={tutorial}
                    onSave={handleSave}
                    onValidate={handleValidate}
                    onPreview={handlePreview}
                  />
                </div>
                <div className={css({ width: '50%' })}>
                  <TutorialPlayer
                    tutorial={tutorial}
                    isDebugMode={true}
                    showDebugPanel={editorMode.showDebugInfo}
                    onEvent={handleDebugEvent}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Debug panel */}
          {editorMode.showDebugInfo && debugEvents.length > 0 && (
            <div className={css({
              maxHeight: '200px',
              bg: 'gray.900',
              color: 'white',
              p: 4,
              overflowY: 'auto',
              fontFamily: 'mono',
              fontSize: 'xs'
            })}>
              <h4 className={css({ fontWeight: 'bold', mb: 2 })}>
                Debug Events ({debugEvents.length})
              </h4>
              <div className={vstack({ gap: 1, alignItems: 'flex-start' })}>
                {debugEvents.slice(-10).reverse().map((event, index) => (
                  <div key={index} className={css({ opacity: 1 - (index * 0.1) })}>
                    <span className={css({ color: 'blue.300' })}>
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                    {' '}
                    <span className={css({ color: 'green.300' })}>
                      {event.type}
                    </span>
                    {' '}
                    {event.type === 'VALUE_CHANGED' && (
                      <span>{event.oldValue} → {event.newValue}</span>
                    )}
                    {event.type === 'STEP_COMPLETED' && (
                      <span className={css({ color: event.success ? 'green.400' : 'red.400' })}>
                        {event.success ? 'SUCCESS' : 'FAILED'}
                      </span>
                    )}
                    {event.type === 'ERROR_OCCURRED' && (
                      <span className={css({ color: 'red.400' })}>{event.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </EditorProtected>
    </DevAccessProvider>
  )
}
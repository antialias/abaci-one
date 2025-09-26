'use client'

import React, { createContext, useContext, useReducer, useRef, useState, useCallback, useMemo } from 'react'
import { Tutorial, TutorialEvent, UIState, TutorialStep } from '../../types/tutorial'
import { generateUnifiedInstructionSequence, type UnifiedStepData } from '../../utils/unifiedStepGenerator'

// Exact same interfaces from TutorialPlayer.tsx
interface TutorialPlayerState {
  currentStepIndex: number
  currentValue: number
  isStepCompleted: boolean
  error: string | null
  events: TutorialEvent[]
  stepStartTime: number
  multiStepStartTime: number // Track when current multi-step started
  uiState: UIState
  currentMultiStep: number // Current step within multi-step instructions (0-based)
}

interface ExpectedStep {
  index: number
  stepIndex: number
  targetValue: number
  startValue: number
  description: string
  mathematicalTerm?: string // Pedagogical term like "10", "(5 - 1)", "-6"
  termPosition?: { startIndex: number; endIndex: number } // Position in full decomposition
}

type TutorialPlayerAction =
  | { type: 'INITIALIZE_STEP'; stepIndex: number; startValue: number; stepId: string }
  | { type: 'USER_VALUE_CHANGE'; oldValue: number; newValue: number; stepId: string }
  | { type: 'COMPLETE_STEP'; stepId: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'ADD_EVENT'; event: TutorialEvent }
  | { type: 'UPDATE_UI_STATE'; updates: Partial<UIState> }
  | { type: 'ADVANCE_MULTI_STEP' }
  | { type: 'PREVIOUS_MULTI_STEP' }
  | { type: 'RESET_MULTI_STEP' }

// Exact same reducer from TutorialPlayer.tsx
function tutorialPlayerReducer(state: TutorialPlayerState, action: TutorialPlayerAction): TutorialPlayerState {
  switch (action.type) {
    case 'INITIALIZE_STEP':
      return {
        ...state,
        currentStepIndex: action.stepIndex,
        currentValue: action.startValue,
        isStepCompleted: false,
        error: null,
        stepStartTime: Date.now(),
        multiStepStartTime: Date.now(), // Start timing for first multi-step
        currentMultiStep: 0, // Reset to first multi-step
        events: [...state.events, {
          type: 'STEP_STARTED',
          stepId: action.stepId,
          timestamp: new Date()
        }]
      }

    case 'USER_VALUE_CHANGE':
      return {
        ...state,
        currentValue: action.newValue,
        events: [...state.events, {
          type: 'VALUE_CHANGED',
          stepId: action.stepId,
          oldValue: action.oldValue,
          newValue: action.newValue,
          timestamp: new Date()
        }]
      }

    case 'COMPLETE_STEP':
      return {
        ...state,
        isStepCompleted: true,
        error: null,
        events: [...state.events, {
          type: 'STEP_COMPLETED',
          stepId: action.stepId,
          success: true,
          timestamp: new Date()
        }]
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error
      }

    case 'ADD_EVENT':
      return {
        ...state,
        events: [...state.events, action.event]
      }

    case 'UPDATE_UI_STATE':
      return {
        ...state,
        uiState: { ...state.uiState, ...action.updates }
      }

    case 'ADVANCE_MULTI_STEP':
      return {
        ...state,
        currentMultiStep: state.currentMultiStep + 1,
        multiStepStartTime: Date.now() // Reset timer for new multi-step
      }

    case 'PREVIOUS_MULTI_STEP':
      return {
        ...state,
        currentMultiStep: Math.max(0, state.currentMultiStep - 1)
      }

    case 'RESET_MULTI_STEP':
      return {
        ...state,
        currentMultiStep: 0
      }

    default:
      return state
  }
}

// Context interfaces
interface TutorialContextType {
  state: TutorialPlayerState
  dispatch: React.Dispatch<TutorialPlayerAction>
  tutorial: Tutorial
  isProgrammaticChange: React.MutableRefObject<boolean>
  showHelpForCurrentStep: boolean
  setShowHelpForCurrentStep: React.Dispatch<React.SetStateAction<boolean>>
  beadRefs: React.MutableRefObject<Map<string, SVGElement>>

  // Computed values
  currentStep: TutorialStep
  expectedSteps: ExpectedStep[]
  fullDecomposition: string
  unifiedSteps: UnifiedStepData[]  // NEW: Add unified steps with provenance
  customStyles: any

  // Term-to-column highlighting state
  activeTermIndices: Set<number>
  setActiveTermIndices: (indices: Set<number>) => void
  activeIndividualTermIndex: number | null
  setActiveIndividualTermIndex: (index: number | null) => void
  activeGroupTargetColumn: number | null
  setActiveGroupTargetColumn: (columnIndex: number | null) => void
  getColumnFromTermIndex: (termIndex: number, useGroupColumn?: boolean) => number | null
  getTermIndicesFromColumn: (columnIndex: number) => number[]
  getGroupTermIndicesFromTermIndex: (termIndex: number) => number[]
  handleAbacusColumnHover: (columnIndex: number, isHovering: boolean) => void

  // Action functions
  goToStep: (stepIndex: number) => void
  goToNextStep: () => void
  goToPreviousStep: () => void
  handleValueChange: (newValue: number) => void
  advanceMultiStep: () => void
  previousMultiStep: () => void
  resetMultiStep: () => void
  handleBeadClick: (beadInfo: any) => void
  handleBeadRef: (bead: any, element: SVGElement | null) => void
  toggleDebugPanel: () => void
  toggleStepList: () => void
  toggleAutoAdvance: () => void
  notifyEvent: (event: TutorialEvent) => void
  getCurrentStepBeads: () => any[]
  getCurrentStepSummary: () => any
  renderHighlightedDecomposition: () => any
}

interface TutorialProviderProps {
  tutorial: Tutorial
  initialStepIndex?: number
  showDebugPanel?: boolean
  onStepChange?: (stepIndex: number, step: TutorialStep) => void
  onStepComplete?: (stepIndex: number, step: TutorialStep, success: boolean) => void
  onTutorialComplete?: (score: number, timeSpent: number) => void
  onEvent?: (event: TutorialEvent) => void
  children: React.ReactNode
}

// Create context
const TutorialContext = createContext<TutorialContextType | null>(null)

// Provider component
export function TutorialProvider({
  tutorial,
  initialStepIndex = 0,
  showDebugPanel = false,
  onStepChange,
  onStepComplete,
  onTutorialComplete,
  onEvent,
  children
}: TutorialProviderProps) {
  const isProgrammaticChange = useRef(false)
  const [showHelpForCurrentStep, setShowHelpForCurrentStep] = useState(false)
  const beadRefs = useRef<Map<string, SVGElement>>(new Map())

  // Term-to-column highlighting state
  const [activeTermIndices, setActiveTermIndices] = useState<Set<number>>(new Set())
  const [activeIndividualTermIndex, setActiveIndividualTermIndex] = useState<number | null>(null)
  const [activeGroupTargetColumn, setActiveGroupTargetColumn] = useState<number | null>(null)

  const [state, dispatch] = useReducer(tutorialPlayerReducer, {
    currentStepIndex: initialStepIndex,
    currentValue: 0,
    isStepCompleted: false,
    error: null,
    events: [],
    stepStartTime: Date.now(),
    multiStepStartTime: Date.now(),
    currentMultiStep: 0,
    uiState: {
      isPlaying: true,
      isPaused: false,
      isEditing: false,
      showDebugPanel,
      showStepList: false,
      autoAdvance: false,
      playbackSpeed: 1
    }
  })

  // Initialize the first step on mount
  React.useEffect(() => {
    if (tutorial.steps.length > 0) {
      const step = tutorial.steps[initialStepIndex]

      // Mark as programmatic change to prevent AbacusReact feedback loop
      isProgrammaticChange.current = true

      dispatch({
        type: 'INITIALIZE_STEP',
        stepIndex: initialStepIndex,
        startValue: step.startValue,
        stepId: step.id
      })
      onStepChange?.(initialStepIndex, step)
    }
  }, []) // Empty dependency array - only run on mount

  // Current step and computed values
  const currentStep = tutorial.steps[state.currentStepIndex]

  const { expectedSteps, fullDecomposition, unifiedSteps } = useMemo(() => {
    try {
      const unifiedSequence = generateUnifiedInstructionSequence(currentStep.startValue, currentStep.targetValue)

      // Map UnifiedStepData to ExpectedStep format
      const mappedSteps: ExpectedStep[] = unifiedSequence.steps.map((step, index) => ({
        index,
        stepIndex: step.stepIndex,
        targetValue: step.expectedValue,
        startValue: index === 0 ? currentStep.startValue : unifiedSequence.steps[index - 1].expectedValue,
        description: step.englishInstruction,
        mathematicalTerm: step.mathematicalTerm,
        termPosition: step.termPosition
      }))

      return {
        expectedSteps: mappedSteps,
        fullDecomposition: unifiedSequence.fullDecomposition,
        unifiedSteps: unifiedSequence.steps  // NEW: Include raw steps with provenance
      }
    } catch (error) {
      console.warn('Failed to generate unified sequence:', error)
      return { expectedSteps: [], fullDecomposition: '', unifiedSteps: [] }
    }
  }, [currentStep.startValue, currentStep.targetValue])

  // Term-to-column mapping function
  const getColumnFromTermIndex = useCallback((termIndex: number, useGroupColumn = false) => {
    const step = unifiedSteps[termIndex]
    if (!step?.provenance) return null

    // For group highlighting: use rhsPlace (target column)
    // For individual highlighting: use termPlace (individual term column)
    const placeValue = useGroupColumn
      ? step.provenance.rhsPlace
      : (step.provenance.termPlace ?? step.provenance.rhsPlace)

    // Convert place value (0=ones, 1=tens, 2=hundreds) to columnIndex (4=ones, 3=tens, 2=hundreds)
    return 4 - placeValue
  }, [unifiedSteps])

  // Column-to-terms mapping function (for bidirectional interaction)
  const getTermIndicesFromColumn = useCallback((columnIndex: number) => {
    const termIndices: number[] = []

    unifiedSteps.forEach((step, index) => {
      if (step.provenance) {
        // Use termPlace if available, otherwise fallback to rhsPlace
        const placeValue = step.provenance.termPlace ?? step.provenance.rhsPlace
        const stepColumnIndex = 4 - placeValue
        if (stepColumnIndex === columnIndex) {
          termIndices.push(index)
        }
      }
    })

    return termIndices
  }, [unifiedSteps])

  // Group-to-terms mapping function (for complement groups)
  const getGroupTermIndicesFromTermIndex = useCallback((termIndex: number) => {
    console.log('🔍 getGroupTermIndicesFromTermIndex called with termIndex:', termIndex)

    const step = unifiedSteps[termIndex]
    console.log('  - Step data:', {
      mathematicalTerm: step?.mathematicalTerm,
      hasProvenance: !!step?.provenance,
      groupId: step?.provenance?.groupId,
      rhsPlace: step?.provenance?.rhsPlace,
      rhsValue: step?.provenance?.rhsValue
    })

    if (!step?.provenance?.groupId) {
      console.log('  - No groupId found, returning empty array')
      return []
    }

    const groupId = step.provenance.groupId
    console.log('  - Found groupId:', groupId)

    const groupTermIndices: number[] = []

    unifiedSteps.forEach((groupStep, index) => {
      if (groupStep.provenance?.groupId === groupId) {
        groupTermIndices.push(index)
        console.log(`    - Found group member: term ${index} "${groupStep.mathematicalTerm}" (rhsPlace: ${groupStep.provenance.rhsPlace})`)
      }
    })

    console.log('  - Final group term indices:', groupTermIndices)
    return groupTermIndices
  }, [unifiedSteps])

  // Abacus column hover handler for bidirectional interaction
  const handleAbacusColumnHover = useCallback((columnIndex: number, isHovering: boolean) => {
    if (isHovering) {
      // Find all terms that correspond to this column
      const relatedTerms = getTermIndicesFromColumn(columnIndex)
      setActiveTermIndices(new Set(relatedTerms))
    } else {
      setActiveTermIndices(new Set())
    }
  }, [getTermIndicesFromColumn, setActiveTermIndices])

  // Navigation state
  const navigationState = useMemo(() => ({
    canGoNext: state.currentStepIndex < tutorial.steps.length - 1,
    canGoPrevious: state.currentStepIndex > 0
  }), [state.currentStepIndex, tutorial.steps.length])

  // Action functions
  const notifyEvent = useCallback((event: TutorialEvent) => {
    onEvent?.(event)
  }, [onEvent])

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < tutorial.steps.length) {
      const step = tutorial.steps[stepIndex]

      // Mark as programmatic change to prevent AbacusReact feedback loop
      isProgrammaticChange.current = true

      dispatch({
        type: 'INITIALIZE_STEP',
        stepIndex,
        startValue: step.startValue,
        stepId: step.id
      })
      onStepChange?.(stepIndex, step)
    }
  }, [tutorial.steps, onStepChange])

  // Clear isProgrammaticChange flag after external value changes have settled
  React.useEffect(() => {
    // Use a small timeout to ensure the AbacusReact has processed the value change
    const timeoutId = setTimeout(() => {
      if (isProgrammaticChange.current) {
        isProgrammaticChange.current = false
      }
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [state.currentValue])

  const goToNextStep = useCallback(() => {
    if (navigationState.canGoNext) {
      goToStep(state.currentStepIndex + 1)
    }
  }, [navigationState.canGoNext, goToStep, state.currentStepIndex])

  const goToPreviousStep = useCallback(() => {
    if (navigationState.canGoPrevious) {
      goToStep(state.currentStepIndex - 1)
    }
  }, [navigationState.canGoPrevious, goToStep, state.currentStepIndex])

  const handleValueChange = useCallback((newValue: number) => {
    if (isProgrammaticChange.current) {
      isProgrammaticChange.current = false
      return
    }

    const oldValue = state.currentValue
    dispatch({
      type: 'USER_VALUE_CHANGE',
      oldValue,
      newValue,
      stepId: currentStep.id
    })

    // Check if step is completed
    if (newValue === currentStep.targetValue) {
      dispatch({
        type: 'COMPLETE_STEP',
        stepId: currentStep.id
      })
      onStepComplete?.(state.currentStepIndex, currentStep, true)
    }
  }, [state.currentValue, currentStep, onStepComplete, state.currentStepIndex])

  const handleBeadClick = useCallback((beadInfo: any) => {
    dispatch({
      type: 'ADD_EVENT',
      event: {
        type: 'BEAD_CLICKED',
        stepId: currentStep.id,
        timestamp: new Date(),
        beadInfo
      }
    })
  }, [currentStep.id])

  const handleBeadRef = useCallback((bead: any, element: SVGElement | null) => {
    const key = `${bead.placeValue}-${bead.type}-${bead.position}`
    if (element) {
      beadRefs.current.set(key, element)
    } else {
      beadRefs.current.delete(key)
    }
  }, [])

  const toggleDebugPanel = useCallback(() => {
    dispatch({
      type: 'UPDATE_UI_STATE',
      updates: { showDebugPanel: !state.uiState.showDebugPanel }
    })
  }, [state.uiState.showDebugPanel])

  const toggleStepList = useCallback(() => {
    dispatch({
      type: 'UPDATE_UI_STATE',
      updates: { showStepList: !state.uiState.showStepList }
    })
  }, [state.uiState.showStepList])

  const toggleAutoAdvance = useCallback(() => {
    dispatch({
      type: 'UPDATE_UI_STATE',
      updates: { autoAdvance: !state.uiState.autoAdvance }
    })
  }, [state.uiState.autoAdvance])

  const advanceMultiStep = useCallback(() => {
    dispatch({ type: 'ADVANCE_MULTI_STEP' })
  }, [])

  const previousMultiStep = useCallback(() => {
    dispatch({ type: 'PREVIOUS_MULTI_STEP' })
  }, [])

  const resetMultiStep = useCallback(() => {
    dispatch({ type: 'RESET_MULTI_STEP' })
  }, [])

  const getCurrentStepBeads = useCallback(() => {
    if (expectedSteps.length === 0) return currentStep.stepBeadHighlights || []

    if (state.currentMultiStep < expectedSteps.length) {
      // Since we mapped from UnifiedStepData, we need to get the original step data
      // to access beadMovements. For now, fall back to existing stepBeadHighlights
      return currentStep.stepBeadHighlights || []
    }

    return []
  }, [expectedSteps, currentStep.stepBeadHighlights, state.currentMultiStep])

  const getCurrentStepSummary = useCallback(() => {
    if (expectedSteps.length === 0) return null

    if (state.currentMultiStep < expectedSteps.length) {
      const currentExpectedStep = expectedSteps[state.currentMultiStep]
      return {
        description: currentExpectedStep.description,
        mathematicalTerm: currentExpectedStep.mathematicalTerm,
        termPosition: currentExpectedStep.termPosition
      }
    }

    return null
  }, [expectedSteps, state.currentMultiStep])

  const renderHighlightedDecomposition = useCallback(() => {
    if (!fullDecomposition || expectedSteps.length === 0) return null

    const currentExpectedStep = expectedSteps[state.currentMultiStep]
    if (!currentExpectedStep?.termPosition) return fullDecomposition

    const { startIndex, endIndex } = currentExpectedStep.termPosition
    const before = fullDecomposition.slice(0, startIndex)
    const highlighted = fullDecomposition.slice(startIndex, endIndex + 1)
    const after = fullDecomposition.slice(endIndex + 1)

    return { before, highlighted, after }
  }, [fullDecomposition, expectedSteps, state.currentMultiStep])

  const customStyles = useMemo(() => {
    if (!currentStep.highlightBeads || !Array.isArray(currentStep.highlightBeads)) {
      return undefined
    }

    return {
      beads: currentStep.highlightBeads.reduce((acc, highlight) => {
        const columnIndex = 4 - highlight.placeValue

        if (!acc[columnIndex]) {
          acc[columnIndex] = {}
        }

        if (highlight.beadType === 'heaven') {
          acc[columnIndex].heaven = { backgroundColor: '#ffeb3b', border: '2px solid #ff9800' }
        } else if (highlight.beadType === 'earth') {
          if (!acc[columnIndex].earth) {
            acc[columnIndex].earth = {}
          }
          const position = highlight.position || 0
          acc[columnIndex].earth[position] = { backgroundColor: '#ffeb3b', border: '2px solid #ff9800' }
        }

        return acc
      }, {} as any)
    }
  }, [currentStep.highlightBeads])

  const value: TutorialContextType = {
    state,
    dispatch,
    tutorial,
    isProgrammaticChange,
    showHelpForCurrentStep,
    setShowHelpForCurrentStep,
    beadRefs,

    // Computed values
    currentStep,
    expectedSteps,
    fullDecomposition,
    unifiedSteps,
    customStyles,

    // Term-to-column highlighting state
    activeTermIndices,
    setActiveTermIndices,
    activeIndividualTermIndex,
    setActiveIndividualTermIndex,
    getColumnFromTermIndex,
    getTermIndicesFromColumn,
    getGroupTermIndicesFromTermIndex,
    handleAbacusColumnHover,

    // Action functions
    goToStep,
    goToNextStep,
    goToPreviousStep,
    handleValueChange,
    advanceMultiStep,
    previousMultiStep,
    resetMultiStep,
    handleBeadClick,
    handleBeadRef,
    toggleDebugPanel,
    toggleStepList,
    toggleAutoAdvance,
    notifyEvent,
    getCurrentStepBeads,
    getCurrentStepSummary,
    renderHighlightedDecomposition
  }

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  )
}

// Hook to use the context
export function useTutorialContext() {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorialContext must be used within a TutorialProvider')
  }
  return context
}

// Custom hooks for convenient access to specific context parts
export function useTutorialState() {
  const { state } = useTutorialContext()
  return state
}

export function useTutorialData() {
  const { tutorial, currentStep, expectedSteps, fullDecomposition } = useTutorialContext()
  return { tutorial, currentStep, expectedSteps, fullDecomposition }
}

export function useTutorialActions() {
  const {
    goToStep,
    goToNextStep,
    goToPreviousStep,
    handleValueChange,
    handleBeadClick,
    handleBeadRef,
    toggleDebugPanel,
    toggleStepList,
    toggleAutoAdvance,
    notifyEvent
  } = useTutorialContext()

  return {
    goToStep,
    goToNextStep,
    goToPreviousStep,
    handleValueChange,
    handleBeadClick,
    handleBeadRef,
    toggleDebugPanel,
    toggleStepList,
    toggleAutoAdvance,
    notifyEvent
  }
}

export function useTutorialHelpers() {
  const {
    getCurrentStepBeads,
    getCurrentStepSummary,
    renderHighlightedDecomposition,
    customStyles
  } = useTutorialContext()

  return {
    getCurrentStepBeads,
    getCurrentStepSummary,
    renderHighlightedDecomposition,
    customStyles
  }
}

export function useTutorialRefs() {
  const { isProgrammaticChange, beadRefs, showHelpForCurrentStep, setShowHelpForCurrentStep } = useTutorialContext()
  return { isProgrammaticChange, beadRefs, showHelpForCurrentStep, setShowHelpForCurrentStep }
}

// Export types for use in other components
export type { TutorialPlayerState, TutorialPlayerAction, ExpectedStep }
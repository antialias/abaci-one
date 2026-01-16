'use client'

import { useState, useCallback, useMemo } from 'react'
import type {
  ExecutableFlowchart,
  FlowchartState,
  ProblemValue,
  DecisionNode,
  CheckpointNode,
} from '@/lib/flowcharts/schema'
import {
  initializeState,
  getNextNode,
  isDecisionCorrect,
  validateCheckpoint,
  applyStateUpdate,
  applyWorkingProblemUpdate,
  advanceState,
  isTerminal,
  formatProblemDisplay,
} from '@/lib/flowcharts/loader'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'
import { FlowchartNodeContent } from './FlowchartNodeContent'
import { FlowchartDecision } from './FlowchartDecision'
import { FlowchartCheckpoint } from './FlowchartCheckpoint'
import { FlowchartPhaseRail } from './FlowchartPhaseRail'
import { MathDisplay } from './MathDisplay'

// =============================================================================
// Types
// =============================================================================

type WalkerPhase =
  | { type: 'showingNode' }
  | { type: 'awaitingDecision' }
  | { type: 'awaitingCheckpoint' }
  | {
      type: 'checkpointFeedback'
      correct: boolean
      expected: ProblemValue
      userAnswer: ProblemValue
    }
  | { type: 'complete' }

/** Track wrong decision for feedback (includes attempt counter to re-trigger animations) */
interface WrongDecisionState {
  value: string
  correctValue: string
  attempt: number
}

interface FlowchartWalkerProps {
  flowchart: ExecutableFlowchart
  problemInput: Record<string, ProblemValue>
  onComplete?: (state: FlowchartState) => void
  onRestart?: () => void
}

// =============================================================================
// Component
// =============================================================================

/**
 * FlowchartWalker - Main component for walking through a flowchart step by step.
 *
 * Manages state, navigation, and validation as the user progresses through
 * instruction, decision, and checkpoint nodes.
 */
export function FlowchartWalker({
  flowchart,
  problemInput,
  onComplete,
  onRestart,
}: FlowchartWalkerProps) {
  // Initialize state
  const [state, setState] = useState<FlowchartState>(() => initializeState(flowchart, problemInput))
  const [phase, setPhase] = useState<WalkerPhase>({ type: 'showingNode' })
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [wrongDecision, setWrongDecision] = useState<WrongDecisionState | null>(null)

  // Current node
  const currentNode = useMemo(
    () => flowchart.nodes[state.currentNode],
    [flowchart.nodes, state.currentNode]
  )

  // Problem display
  const problemDisplay = formatProblemDisplay(flowchart, state.problem)

  // =============================================================================
  // Navigation
  // =============================================================================

  const advanceToNext = useCallback(
    (userChoice?: string, userInput?: ProblemValue, correct?: boolean) => {
      const nextNodeId = getNextNode(flowchart, state, userChoice)

      if (!nextNodeId) {
        // No next node - might be terminal
        if (isTerminal(flowchart, state.currentNode)) {
          setPhase({ type: 'complete' })
          onComplete?.(state)
        }
        return
      }

      const action =
        currentNode?.definition.type === 'decision'
          ? 'decision'
          : currentNode?.definition.type === 'checkpoint'
            ? 'checkpoint'
            : 'advance'

      // Apply working problem update if configured (before advancing)
      let stateWithWorkingProblem = state
      if (correct !== false) {
        stateWithWorkingProblem = applyWorkingProblemUpdate(state, state.currentNode, flowchart, userInput)
      }

      const newState = advanceState(stateWithWorkingProblem, nextNodeId, action, userInput, correct)
      setState(newState)
      setPhase({ type: 'showingNode' })
      setWrongAttempts(0)

      // Check if new node is terminal
      if (isTerminal(flowchart, nextNodeId)) {
        setTimeout(() => {
          setPhase({ type: 'complete' })
          onComplete?.(newState)
        }, 500)
      }
    },
    [flowchart, state, currentNode, onComplete]
  )

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleInstructionAdvance = useCallback(() => {
    advanceToNext()
  }, [advanceToNext])

  const handleDecisionSelect = useCallback(
    (value: string) => {
      const correct = isDecisionCorrect(flowchart, state, state.currentNode, value)

      if (correct === null || correct === true) {
        // No validation defined or correct answer
        setWrongDecision(null)
        advanceToNext(value, value, true)
      } else {
        // Wrong answer - find correct value for feedback
        const node = flowchart.nodes[state.currentNode]
        const def = node?.definition
        let correctValue = ''
        if (def?.type === 'decision') {
          for (const opt of def.options) {
            if (isDecisionCorrect(flowchart, state, state.currentNode, opt.value) === true) {
              correctValue = opt.value
              break
            }
          }
        }

        setWrongAttempts((prev) => prev + 1)
        setState((prev) => ({ ...prev, mistakes: prev.mistakes + 1 }))
        // Set wrongDecision with incremented attempt to re-trigger animation
        setWrongDecision((prev) => ({
          value,
          correctValue,
          attempt: (prev?.attempt ?? 0) + 1,
        }))
      }
    },
    [flowchart, state, advanceToNext]
  )

  const handleCheckpointSubmit = useCallback(
    (value: number | string) => {
      const result = validateCheckpoint(flowchart, state, state.currentNode, value)

      if (result === null || result.correct) {
        // No validation or correct
        const newState = applyStateUpdate(state, state.currentNode, flowchart, value)
        setState(newState)
        setPhase({
          type: 'checkpointFeedback',
          correct: true,
          expected: result?.expected ?? value,
          userAnswer: value,
        })
        // Auto-advance after short delay
        setTimeout(() => {
          advanceToNext(undefined, value, true)
        }, 1000)
      } else {
        // Wrong answer
        setWrongAttempts((prev) => prev + 1)
        setState((prev) => ({ ...prev, mistakes: prev.mistakes + 1 }))
        setPhase({
          type: 'checkpointFeedback',
          correct: false,
          expected: result.expected,
          userAnswer: value,
        })
      }
    },
    [flowchart, state, advanceToNext]
  )

  const handleCheckpointRetry = useCallback(() => {
    setPhase({ type: 'awaitingCheckpoint' })
  }, [])

  // =============================================================================
  // Determine what to show based on node type and phase
  // =============================================================================

  const renderNodeInteraction = () => {
    if (!currentNode) return null

    const def = currentNode.definition

    switch (def.type) {
      case 'instruction':
        return (
          <button
            data-testid="instruction-advance-button"
            onClick={handleInstructionAdvance}
            className={css({
              padding: '4 8',
              fontSize: 'lg',
              fontWeight: 'semibold',
              borderRadius: 'lg',
              backgroundColor: { base: 'green.500', _dark: 'green.600' },
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                backgroundColor: { base: 'green.600', _dark: 'green.500' },
                transform: 'scale(1.02)',
              },
              _active: {
                transform: 'scale(0.98)',
              },
            })}
          >
            I did it!
          </button>
        )

      case 'decision': {
        // Add path preview info to each option
        const decisionDef = def as DecisionNode
        const optionsWithPaths = decisionDef.options.map((opt) => {
          const nextNode = flowchart.nodes[opt.next]
          return {
            ...opt,
            leadsTo: nextNode?.content?.title || opt.next,
          }
        })

        return (
          <FlowchartDecision
            key={`decision-${wrongDecision?.attempt ?? 0}`}
            options={optionsWithPaths}
            onSelect={handleDecisionSelect}
            wrongAnswer={wrongDecision?.value}
            correctAnswer={wrongDecision?.correctValue}
          />
        )
      }

      case 'checkpoint': {
        const checkpointDef = def as CheckpointNode
        const showHint = wrongAttempts >= 2

        if (phase.type === 'checkpointFeedback') {
          if (phase.correct) {
            return (
              <div
                data-testid="checkpoint-correct-feedback"
                className={css({
                  padding: '4',
                  backgroundColor: { base: 'green.100', _dark: 'green.800' },
                  borderRadius: 'lg',
                  color: { base: 'green.800', _dark: 'green.200' },
                  fontSize: 'lg',
                  fontWeight: 'semibold',
                  textAlign: 'center',
                })}
              >
                Correct! Moving on...
              </div>
            )
          }

          return (
            <div data-testid="checkpoint-wrong-feedback" className={vstack({ gap: '4' })}>
              <FlowchartCheckpoint
                prompt={checkpointDef.prompt}
                inputType={checkpointDef.inputType}
                onSubmit={handleCheckpointSubmit}
                feedback={{
                  correct: false,
                  expected: String(phase.expected),
                  userAnswer: String(phase.userAnswer),
                }}
                hint={showHint ? `Hint: The answer is ${phase.expected}` : undefined}
              />
              <button
                data-testid="checkpoint-retry-button"
                onClick={handleCheckpointRetry}
                className={css({
                  padding: '2 4',
                  fontSize: 'md',
                  borderRadius: 'md',
                  backgroundColor: { base: 'gray.200', _dark: 'gray.700' },
                  color: { base: 'gray.800', _dark: 'gray.200' },
                  cursor: 'pointer',
                })}
              >
                Try again
              </button>
            </div>
          )
        }

        return (
          <FlowchartCheckpoint
            prompt={checkpointDef.prompt}
            inputType={checkpointDef.inputType}
            onSubmit={handleCheckpointSubmit}
          />
        )
      }

      case 'milestone':
        // Auto-advance milestones
        setTimeout(() => advanceToNext(), 500)
        return (
          <div
            data-testid="milestone-display"
            className={css({
              fontSize: '4xl',
              textAlign: 'center',
            })}
          >
            {currentNode.content.title}
          </div>
        )

      case 'terminal':
        return null // Handled by complete phase

      default:
        return null
    }
  }

  // =============================================================================
  // Render
  // =============================================================================

  if (phase.type === 'complete') {
    return (
      <div
        data-testid="completion-screen"
        data-mistakes={state.mistakes}
        className={vstack({
          gap: '6',
          padding: '8',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
        })}
      >
        <div data-testid="celebration-emoji" className={css({ fontSize: '6xl' })}>🎉</div>
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: { base: 'green.700', _dark: 'green.300' },
          })}
        >
          Great job!
        </h2>
        <p className={css({ color: { base: 'gray.600', _dark: 'gray.400' } })}>
          You completed the problem: {problemDisplay}
        </p>
        <p className={css({ color: { base: 'gray.500', _dark: 'gray.500' }, fontSize: 'sm' })}>
          {state.mistakes === 0
            ? 'Perfect - no mistakes!'
            : `Finished with ${state.mistakes} mistake${state.mistakes === 1 ? '' : 's'}`}
        </p>
        {onRestart && (
          <button
            data-testid="restart-button"
            onClick={onRestart}
            className={css({
              padding: '3 6',
              fontSize: 'lg',
              fontWeight: 'semibold',
              borderRadius: 'lg',
              backgroundColor: { base: 'blue.500', _dark: 'blue.600' },
              color: 'white',
              cursor: 'pointer',
              marginTop: '4',
            })}
          >
            Try another problem
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="flowchart-walker"
      data-current-node={state.currentNode}
      data-phase={phase.type}
      className={vstack({ gap: '6', padding: '4', alignItems: 'stretch' })}
    >
      {/* Problem display header */}
      <div data-testid="problem-header" className={hstack({ justifyContent: 'center', fontSize: 'sm' })}>
        <span className={css({ color: { base: 'gray.500', _dark: 'gray.500' } })}>
          {problemDisplay}
        </span>
      </div>

      {/* Phase rail with flowchart navigation */}
      <FlowchartPhaseRail flowchart={flowchart} state={state} />

      {/* Working problem ledger */}
      {state.workingProblemHistory.length > 0 && (
        <div
          data-testid="working-problem-ledger"
          data-step-count={state.workingProblemHistory.length}
          className={css({
            padding: '4',
            backgroundColor: { base: 'blue.50', _dark: 'blue.900' },
            borderRadius: 'xl',
            border: '2px solid',
            borderColor: { base: 'blue.200', _dark: 'blue.700' },
          })}
        >
          <div className={vstack({ gap: '3', alignItems: 'stretch' })}>
            <span
              className={css({
                fontSize: 'xs',
                fontWeight: 'medium',
                color: { base: 'blue.600', _dark: 'blue.300' },
                textTransform: 'uppercase',
                letterSpacing: 'wide',
                textAlign: 'center',
              })}
            >
              Your Work
            </span>

            {/* Ledger entries */}
            <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
              {state.workingProblemHistory.map((step, idx) => {
                const isLatest = idx === state.workingProblemHistory.length - 1
                const nodeTitle = flowchart.nodes[step.nodeId]?.content?.title

                return (
                  <div
                    key={idx}
                    data-testid={`ledger-step-${idx}`}
                    data-step-index={idx}
                    data-is-latest={isLatest}
                    data-node-id={step.nodeId}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3',
                      padding: '2 3',
                      borderRadius: 'lg',
                      backgroundColor: isLatest
                        ? { base: 'blue.100', _dark: 'blue.800' }
                        : { base: 'transparent', _dark: 'transparent' },
                      border: isLatest ? '2px solid' : '1px solid',
                      borderColor: isLatest
                        ? { base: 'blue.400', _dark: 'blue.500' }
                        : { base: 'blue.200', _dark: 'blue.700' },
                      opacity: isLatest ? 1 : 0.7,
                    })}
                  >
                    {/* Step number */}
                    <span
                      className={css({
                        fontSize: 'xs',
                        fontWeight: 'bold',
                        color: { base: 'blue.500', _dark: 'blue.400' },
                        minWidth: '1.5rem',
                        textAlign: 'center',
                      })}
                    >
                      {idx + 1}
                    </span>

                    {/* Math expression */}
                    <div
                      className={css({
                        flex: 1,
                        color: { base: 'blue.900', _dark: 'blue.100' },
                      })}
                    >
                      <MathDisplay expression={step.value} size={isLatest ? 'lg' : 'md'} />
                    </div>

                    {/* Step label / what happened */}
                    <span
                      className={css({
                        fontSize: 'xs',
                        color: { base: 'blue.600', _dark: 'blue.400' },
                        textAlign: 'right',
                        maxWidth: '120px',
                      })}
                      title={nodeTitle ? `From: ${nodeTitle}` : undefined}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Node content */}
      <div
        data-testid="node-content-container"
        data-node-type={currentNode?.definition.type}
        className={css({
          padding: '6',
          backgroundColor: { base: 'white', _dark: 'gray.800' },
          borderRadius: 'xl',
          boxShadow: 'lg',
          border: '1px solid',
          borderColor: { base: 'gray.200', _dark: 'gray.700' },
        })}
      >
        {currentNode && <FlowchartNodeContent content={currentNode.content} />}
      </div>

      {/* Interaction area */}
      <div
        data-testid="interaction-area"
        className={css({
          padding: '4',
          display: 'flex',
          justifyContent: 'center',
        })}
      >
        {renderNodeInteraction()}
      </div>
    </div>
  )
}

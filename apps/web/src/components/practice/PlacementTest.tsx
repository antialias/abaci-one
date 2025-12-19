'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  DEFAULT_THRESHOLDS,
  generateProblemForSkill,
  getPlacementResults,
  initializePlacementTest,
  type PlacementTestState,
  type PlacementThresholds,
  type PresetKey,
  recordAnswer,
  SKILL_NAMES,
  SKILL_ORDER,
  THRESHOLD_PRESETS,
} from '@/lib/curriculum/placement-test'
import { css } from '../../../styled-system/css'
import { NumericKeypad } from './NumericKeypad'
import { VerticalProblem } from './VerticalProblem'

export interface PlacementTestProps {
  /** Student name (for display) */
  studentName: string
  /** Student ID for saving results */
  playerId: string
  /** Callback when test is complete */
  onComplete: (results: {
    masteredSkillIds: string[]
    practicingSkillIds: string[]
    totalProblems: number
    totalCorrect: number
  }) => void
  /** Callback to cancel/exit the test */
  onCancel: () => void
  /** Initial thresholds (defaults to standard) */
  initialThresholds?: PlacementThresholds
}

type TestPhase = 'setup' | 'testing' | 'results'

/**
 * PlacementTest - Adaptive diagnostic quiz for skill assessment
 *
 * Features:
 * - Configurable thresholds with presets
 * - Progressive skill testing following curriculum order
 * - Real-time feedback on answers
 * - Automatic skill level determination
 */
export function PlacementTest({
  studentName,
  playerId,
  onComplete,
  onCancel,
  initialThresholds = DEFAULT_THRESHOLDS,
}: PlacementTestProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [phase, setPhase] = useState<TestPhase>('setup')
  const [thresholds, setThresholds] = useState<PlacementThresholds>(initialThresholds)
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('standard')
  const [testState, setTestState] = useState<PlacementTestState | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false)
  const [problemStartTime, setProblemStartTime] = useState<number>(0)

  // Generate next problem when test state changes
  useEffect(() => {
    if (testState && !testState.isComplete && !testState.currentProblem && phase === 'testing') {
      const currentSkillId = SKILL_ORDER[testState.currentSkillIndex]
      const problem = generateProblemForSkill(currentSkillId)

      if (problem) {
        setTestState((prev) => (prev ? { ...prev, currentProblem: problem } : null))
        setProblemStartTime(Date.now())
      }
    }
  }, [testState, phase])

  // Check for test completion
  useEffect(() => {
    if (testState?.isComplete && phase === 'testing') {
      setPhase('results')
    }
  }, [testState?.isComplete, phase])

  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset)
    setThresholds(THRESHOLD_PRESETS[preset].thresholds)
  }

  const handleStartTest = () => {
    const initialState = initializePlacementTest(thresholds)
    setTestState(initialState)
    setPhase('testing')
  }

  const handleSubmitAnswer = useCallback(() => {
    if (!testState || !testState.currentProblem || showFeedback) return

    const answer = Number.parseInt(userAnswer)
    const isCorrect = answer === testState.currentProblem.answer

    setLastAnswerCorrect(isCorrect)
    setShowFeedback(true)

    // Show feedback briefly, then advance
    setTimeout(() => {
      const newState = recordAnswer(testState, isCorrect)
      setTestState({ ...newState, currentProblem: null })
      setUserAnswer('')
      setShowFeedback(false)
    }, 1000)
  }, [testState, userAnswer, showFeedback])

  const handleDigit = useCallback(
    (digit: string) => {
      if (showFeedback) return
      setUserAnswer((prev) => {
        // Limit to reasonable answer length
        if (prev.length >= 4) return prev
        return prev + digit
      })
    },
    [showFeedback]
  )

  const handleBackspace = useCallback(() => {
    if (showFeedback) return
    setUserAnswer((prev) => prev.slice(0, -1))
  }, [showFeedback])

  const handleKeypadSubmit = useCallback(() => {
    if (showFeedback || !userAnswer) return
    handleSubmitAnswer()
  }, [showFeedback, userAnswer, handleSubmitAnswer])

  const handleFinish = () => {
    if (!testState) return

    const results = getPlacementResults(testState)
    onComplete({
      masteredSkillIds: results.masteredSkills,
      practicingSkillIds: results.practicingSkills,
      totalProblems: results.totalProblems,
      totalCorrect: results.totalCorrect,
    })
  }

  // Setup phase - configure thresholds
  if (phase === 'setup') {
    return (
      <div
        data-component="placement-test"
        data-phase="setup"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2rem',
          padding: '2rem',
          maxWidth: '500px',
          margin: '0 auto',
        })}
      >
        <h1
          className={css({
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.800',
            textAlign: 'center',
          })}
        >
          Placement Test for {studentName}
        </h1>

        <p
          className={css({
            fontSize: '1rem',
            color: isDark ? 'gray.400' : 'gray.600',
            textAlign: 'center',
          })}
        >
          This test will determine which abacus skills {studentName} has already mastered.
        </p>

        {/* Preset selector */}
        <div className={css({ width: '100%' })}>
          <label
            className={css({
              display: 'block',
              fontSize: 'sm',
              fontWeight: 'semibold',
              color: isDark ? 'gray.300' : 'gray.700',
              mb: '2',
            })}
          >
            Test Intensity
          </label>
          <div className={css({ display: 'flex', gap: '2' })}>
            {(
              Object.entries(THRESHOLD_PRESETS) as [
                PresetKey,
                (typeof THRESHOLD_PRESETS)[PresetKey],
              ][]
            ).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetChange(key)}
                className={css({
                  flex: 1,
                  py: '3',
                  px: '3',
                  borderRadius: 'lg',
                  border: '2px solid',
                  borderColor:
                    selectedPreset === key ? 'blue.500' : isDark ? 'gray.600' : 'gray.200',
                  bg:
                    selectedPreset === key
                      ? isDark
                        ? 'blue.900'
                        : 'blue.50'
                      : isDark
                        ? 'gray.800'
                        : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    borderColor:
                      selectedPreset === key ? 'blue.500' : isDark ? 'gray.500' : 'gray.300',
                  },
                })}
              >
                <div
                  className={css({
                    fontWeight: 'bold',
                    color:
                      selectedPreset === key
                        ? isDark
                          ? 'blue.200'
                          : 'blue.700'
                        : isDark
                          ? 'gray.100'
                          : 'gray.800',
                    fontSize: 'sm',
                  })}
                >
                  {preset.name}
                </div>
                <div
                  className={css({
                    fontSize: 'xs',
                    color:
                      selectedPreset === key
                        ? isDark
                          ? 'blue.300'
                          : 'blue.600'
                        : isDark
                          ? 'gray.400'
                          : 'gray.500',
                    mt: '1',
                  })}
                >
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Threshold details */}
        <div
          className={css({
            width: '100%',
            p: '4',
            bg: isDark ? 'gray.700' : 'gray.50',
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.200',
          })}
        >
          <h3
            className={css({
              fontSize: 'sm',
              fontWeight: 'semibold',
              color: isDark ? 'gray.300' : 'gray.700',
              mb: '2',
            })}
          >
            Current Settings
          </h3>
          <ul
            className={css({
              fontSize: 'sm',
              color: isDark ? 'gray.400' : 'gray.600',
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '1',
            })}
          >
            <li>Practicing: {thresholds.practicingConsecutive} consecutive correct</li>
            <li>
              Mastered: {thresholds.masteredTotal} correct at{' '}
              {Math.round(thresholds.masteredAccuracy * 100)}% accuracy
            </li>
            <li>Stop testing: {thresholds.stopOnWrong} consecutive wrong</li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className={css({ display: 'flex', gap: '3', width: '100%' })}>
          <button
            type="button"
            onClick={onCancel}
            className={css({
              flex: 1,
              py: '3',
              fontSize: '1rem',
              fontWeight: 'medium',
              color: isDark ? 'gray.300' : 'gray.700',
              bg: isDark ? 'gray.700' : 'gray.100',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              _hover: { bg: isDark ? 'gray.600' : 'gray.200' },
            })}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartTest}
            data-action="start-test"
            className={css({
              flex: 2,
              py: '3',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: 'white',
              bg: 'blue.500',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              _hover: { bg: 'blue.600' },
            })}
          >
            Start Test
          </button>
        </div>
      </div>
    )
  }

  // Testing phase
  if (phase === 'testing' && testState) {
    const currentSkillId = SKILL_ORDER[testState.currentSkillIndex]
    const currentSkillState = testState.skillStates.get(currentSkillId)
    const skillName = SKILL_NAMES[currentSkillId] || currentSkillId

    // Calculate progress
    const completedSkills = Array.from(testState.skillStates.values()).filter(
      (s) => s.status !== 'pending' && s.status !== 'testing'
    ).length
    const progressPercent = Math.round((completedSkills / SKILL_ORDER.length) * 100)

    return (
      <div
        data-component="placement-test"
        data-phase="testing"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '1.5rem',
          maxWidth: '600px',
          margin: '0 auto',
        })}
      >
        {/* Header with progress */}
        <div className={css({ width: '100%' })}>
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: '2',
            })}
          >
            <span
              className={css({
                fontSize: 'sm',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Testing: {skillName}
            </span>
            <span
              className={css({
                fontSize: 'sm',
                color: isDark ? 'gray.500' : 'gray.500',
              })}
            >
              {testState.problemsAnswered} problems answered
            </span>
          </div>
          <div
            className={css({
              width: '100%',
              height: '8px',
              bg: isDark ? 'gray.700' : 'gray.200',
              borderRadius: '4px',
              overflow: 'hidden',
            })}
          >
            <div
              className={css({
                height: '100%',
                bg: 'blue.500',
                transition: 'width 0.3s ease',
              })}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {currentSkillState && (
            <div
              className={css({
                display: 'flex',
                gap: '3',
                mt: '2',
                fontSize: 'xs',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              <span>
                Skill: {currentSkillState.correct}/{currentSkillState.attempts} correct
              </span>
              <span>Streak: {currentSkillState.consecutive}</span>
            </div>
          )}
        </div>

        {/* Problem display */}
        {testState.currentProblem && (
          <div className={css({ my: '2' })}>
            <VerticalProblem
              terms={testState.currentProblem.terms}
              userAnswer={userAnswer}
              isFocused={!showFeedback}
              isCompleted={showFeedback}
              correctAnswer={testState.currentProblem.answer}
              size="large"
            />
          </div>
        )}

        {/* Feedback overlay */}
        {showFeedback && (
          <div
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color: lastAnswerCorrect
                ? isDark
                  ? 'green.400'
                  : 'green.600'
                : isDark
                  ? 'red.400'
                  : 'red.600',
              animation: 'pulse 0.5s ease-in-out',
            })}
          >
            {lastAnswerCorrect ? 'Correct!' : `${testState.currentProblem?.answer}`}
          </div>
        )}

        {/* Keypad */}
        {!showFeedback && (
          <NumericKeypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onSubmit={handleKeypadSubmit}
            disabled={showFeedback || !testState.currentProblem}
          />
        )}

        {/* Skip/Cancel button */}
        <button
          type="button"
          onClick={onCancel}
          className={css({
            mt: '2',
            fontSize: 'sm',
            color: isDark ? 'gray.400' : 'gray.500',
            bg: 'transparent',
            border: 'none',
            cursor: 'pointer',
            _hover: {
              color: isDark ? 'gray.200' : 'gray.700',
              textDecoration: 'underline',
            },
          })}
        >
          End Test Early
        </button>
      </div>
    )
  }

  // Results phase
  if (phase === 'results' && testState) {
    const results = getPlacementResults(testState)

    return (
      <div
        data-component="placement-test"
        data-phase="results"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2rem',
          padding: '2rem',
          maxWidth: '550px',
          margin: '0 auto',
        })}
      >
        <div className={css({ textAlign: 'center' })}>
          <h1
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
              mb: '2',
            })}
          >
            Placement Complete!
          </h1>
          <p
            className={css({
              fontSize: '1.25rem',
              color: isDark ? 'blue.300' : 'blue.600',
            })}
          >
            {studentName} placed at: <strong>{results.suggestedLevel}</strong>
          </p>
        </div>

        {/* Stats summary */}
        <div
          className={css({
            display: 'flex',
            gap: '3',
            width: '100%',
          })}
        >
          <div
            className={css({
              flex: 1,
              p: '3',
              bg: isDark ? 'green.900' : 'green.50',
              borderRadius: 'lg',
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'green.200' : 'green.700',
              })}
            >
              {results.masteredSkills.length}
            </div>
            <div
              className={css({
                fontSize: 'sm',
                color: isDark ? 'green.300' : 'green.600',
              })}
            >
              Skills Mastered
            </div>
          </div>
          <div
            className={css({
              flex: 1,
              p: '3',
              bg: isDark ? 'yellow.900' : 'yellow.50',
              borderRadius: 'lg',
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'yellow.200' : 'yellow.700',
              })}
            >
              {results.practicingSkills.length}
            </div>
            <div
              className={css({
                fontSize: 'sm',
                color: isDark ? 'yellow.300' : 'yellow.600',
              })}
            >
              Skills Practicing
            </div>
          </div>
          <div
            className={css({
              flex: 1,
              p: '3',
              bg: isDark ? 'blue.900' : 'blue.50',
              borderRadius: 'lg',
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'blue.200' : 'blue.700',
              })}
            >
              {Math.round(results.overallAccuracy * 100)}%
            </div>
            <div
              className={css({
                fontSize: 'sm',
                color: isDark ? 'blue.300' : 'blue.600',
              })}
            >
              Accuracy
            </div>
          </div>
        </div>

        {/* Skill lists */}
        {results.masteredSkills.length > 0 && (
          <div className={css({ width: '100%' })}>
            <h3
              className={css({
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: isDark ? 'gray.300' : 'gray.700',
                mb: '2',
              })}
            >
              Mastered Skills
            </h3>
            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
              {results.masteredSkills.map((skillId) => (
                <span
                  key={skillId}
                  className={css({
                    px: '3',
                    py: '1',
                    bg: isDark ? 'green.900' : 'green.100',
                    color: isDark ? 'green.200' : 'green.700',
                    borderRadius: 'full',
                    fontSize: 'xs',
                    fontWeight: 'medium',
                  })}
                >
                  {SKILL_NAMES[skillId] || skillId}
                </span>
              ))}
            </div>
          </div>
        )}

        {results.practicingSkills.length > 0 && (
          <div className={css({ width: '100%' })}>
            <h3
              className={css({
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: isDark ? 'gray.300' : 'gray.700',
                mb: '2',
              })}
            >
              Practicing Skills
            </h3>
            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
              {results.practicingSkills.map((skillId) => (
                <span
                  key={skillId}
                  className={css({
                    px: '3',
                    py: '1',
                    bg: isDark ? 'yellow.900' : 'yellow.100',
                    color: isDark ? 'yellow.200' : 'yellow.700',
                    borderRadius: 'full',
                    fontSize: 'xs',
                    fontWeight: 'medium',
                  })}
                >
                  {SKILL_NAMES[skillId] || skillId}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={handleFinish}
          data-action="save-results"
          className={css({
            width: '100%',
            py: '3',
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: 'white',
            bg: 'green.500',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            _hover: { bg: 'green.600' },
          })}
        >
          Save Results & Continue
        </button>
      </div>
    )
  }

  return null
}

export default PlacementTest

'use client'

import { AbacusReact } from '@soroban/abacus-react'
import { useCallback, useEffect, useState } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'
import type { PracticeStep } from '../../types/tutorial'
import { type GeneratedProblem, generateProblems } from '../../utils/problemGenerator'

interface PracticeProblemPlayerProps {
  practiceStep: PracticeStep
  onComplete?: (results: PracticeResults) => void
  onProblemComplete?: (problemIndex: number, correct: boolean, timeSpent: number) => void
  className?: string
}

export interface PracticeResults {
  totalProblems: number
  correctAnswers: number
  totalTime: number
  averageTime: number
  problemResults: Array<{
    problem: GeneratedProblem
    userAnswer: number
    correct: boolean
    timeSpent: number
  }>
}

export function PracticeProblemPlayer({
  practiceStep,
  onComplete,
  onProblemComplete,
  className,
}: PracticeProblemPlayerProps) {
  const [problems, setProblems] = useState<GeneratedProblem[]>([])
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0)
  const [currentSequenceStep, setCurrentSequenceStep] = useState(0) // Which number in sequence we're adding
  const [userAnswer, setUserAnswer] = useState(0)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [results, setResults] = useState<PracticeResults['problemResults']>([])
  const [startTime, _setStartTime] = useState<number>(Date.now())
  const [problemStartTime, setProblemStartTime] = useState<number>(Date.now())
  const [showExplanation, setShowExplanation] = useState(false)
  const [isGenerating, setIsGenerating] = useState(true)
  const [expectedValue, setExpectedValue] = useState(0) // Expected value at current step

  // Generate problems on mount
  useEffect(() => {
    const generatedProblems = generateProblems(practiceStep)
    setProblems(generatedProblems)
    setIsGenerating(false)
    setProblemStartTime(Date.now())
  }, [practiceStep])

  const currentProblem = problems[currentProblemIndex]

  // Calculate expected value at current step
  const calculateExpectedValue = useCallback((problem: GeneratedProblem, step: number): number => {
    return problem.terms.slice(0, step + 1).reduce((sum, term) => sum + term, 0)
  }, [])

  // Update expected value when problem or step changes
  useEffect(() => {
    if (currentProblem) {
      setExpectedValue(calculateExpectedValue(currentProblem, currentSequenceStep))
    }
  }, [currentProblem, currentSequenceStep, calculateExpectedValue])

  // Check answer when user changes abacus value
  const handleValueChange = useCallback(
    (newValue: number) => {
      setUserAnswer(newValue)

      if (currentProblem && newValue === expectedValue) {
        setIsCorrect(true)

        // Check if this was the final step
        if (currentSequenceStep === currentProblem.terms.length - 1) {
          // Problem completed
          const timeSpent = Date.now() - problemStartTime

          const problemResult = {
            problem: currentProblem,
            userAnswer: newValue,
            correct: true,
            timeSpent,
          }

          setResults((prev) => [...prev, problemResult])
          onProblemComplete?.(currentProblemIndex, true, timeSpent)

          // Auto-advance to next problem after delay
          setTimeout(() => {
            if (currentProblemIndex < problems.length - 1) {
              nextProblem()
            } else {
              completePractice()
            }
          }, 1500)
        } else {
          // Move to next step in sequence after short delay
          setTimeout(() => {
            setCurrentSequenceStep((prev) => prev + 1)
            setIsCorrect(null)
          }, 800)
        }
      } else if (currentProblem && newValue !== expectedValue && newValue !== 0) {
        // User has entered a value but it's wrong
        setIsCorrect(false)
      } else {
        setIsCorrect(null)
      }
    },
    [
      currentProblem,
      expectedValue,
      currentSequenceStep,
      currentProblemIndex,
      problems.length,
      problemStartTime,
      onProblemComplete,
      completePractice,
      nextProblem,
    ]
  )

  // Move to next problem
  const nextProblem = useCallback(() => {
    if (currentProblemIndex < problems.length - 1) {
      setCurrentProblemIndex((prev) => prev + 1)
      setCurrentSequenceStep(0)
      setUserAnswer(0)
      setIsCorrect(null)
      setShowExplanation(false)
      setProblemStartTime(Date.now())
    }
  }, [currentProblemIndex, problems.length])

  // Skip current problem (mark as incorrect)
  const skipProblem = useCallback(() => {
    if (currentProblem) {
      const timeSpent = Date.now() - problemStartTime
      const problemResult = {
        problem: currentProblem,
        userAnswer: userAnswer,
        correct: false,
        timeSpent,
      }

      setResults((prev) => [...prev, problemResult])
      onProblemComplete?.(currentProblemIndex, false, timeSpent)
    }

    if (currentProblemIndex < problems.length - 1) {
      nextProblem()
    } else {
      completePractice()
    }
  }, [
    currentProblem,
    currentProblemIndex,
    problems.length,
    userAnswer,
    problemStartTime,
    onProblemComplete,
    nextProblem,
    completePractice,
  ])

  // Reset to start of current problem
  const resetProblem = useCallback(() => {
    setCurrentSequenceStep(0)
    setUserAnswer(0)
    setIsCorrect(null)
    setProblemStartTime(Date.now())
  }, [])

  // Complete the practice session
  const completePractice = useCallback(() => {
    const totalTime = Date.now() - startTime
    const correctAnswers = results.filter((r) => r.correct).length

    const practiceResults: PracticeResults = {
      totalProblems: problems.length,
      correctAnswers,
      totalTime,
      averageTime: totalTime / problems.length,
      problemResults: results,
    }

    onComplete?.(practiceResults)
  }, [results, problems.length, startTime, onComplete])

  // Toggle explanation
  const toggleExplanation = useCallback(() => {
    setShowExplanation((prev) => !prev)
  }, [])

  if (isGenerating) {
    return (
      <div
        className={css({
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          textAlign: 'center',
        })}
      >
        <div>
          <div className={css({ fontSize: 'lg', fontWeight: 'medium', mb: 2 })}>
            Generating practice problems...
          </div>
          <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
            Creating {practiceStep.problemCount} problems based on your skill settings
          </div>
        </div>
      </div>
    )
  }

  if (problems.length === 0) {
    return (
      <div
        className={css({
          p: 6,
          bg: 'red.50',
          border: '1px solid',
          borderColor: 'red.200',
          borderRadius: 'lg',
          textAlign: 'center',
        })}
      >
        <h3 className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'red.800', mb: 2 })}>
          No Problems Generated
        </h3>
        <p className={css({ color: 'red.700', mb: 4 })}>
          Unable to generate problems with the current skill and constraint settings.
        </p>
        <p className={css({ fontSize: 'sm', color: 'red.600' })}>
          Try adjusting the skill requirements or number constraints.
        </p>
      </div>
    )
  }

  if (!currentProblem) {
    return <div>No current problem available</div>
  }

  const progress = ((currentProblemIndex + 1) / problems.length) * 100

  return (
    <div
      className={`${css({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '600px',
      })} ${className || ''}`}
    >
      {/* Header */}
      <div
        className={css({
          borderBottom: '1px solid',
          borderColor: 'gray.200',
          p: 4,
          bg: 'white',
        })}
      >
        <div className={hstack({ justifyContent: 'space-between', alignItems: 'center' })}>
          <div>
            <h2 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>{practiceStep.title}</h2>
            <p className={css({ fontSize: 'sm', color: 'gray.600' })}>
              Problem {currentProblemIndex + 1} of {problems.length}
            </p>
          </div>

          <div className={hstack({ gap: 2 })}>
            <button
              onClick={toggleExplanation}
              className={css({
                px: 3,
                py: 1,
                fontSize: 'sm',
                border: '1px solid',
                borderColor: 'blue.300',
                borderRadius: 'md',
                bg: showExplanation ? 'blue.100' : 'white',
                color: 'blue.700',
                cursor: 'pointer',
                _hover: { bg: 'blue.50' },
              })}
            >
              Hint
            </button>

            <button
              onClick={resetProblem}
              className={css({
                px: 3,
                py: 1,
                fontSize: 'sm',
                border: '1px solid',
                borderColor: 'orange.300',
                borderRadius: 'md',
                bg: 'white',
                color: 'orange.700',
                cursor: 'pointer',
                _hover: { bg: 'orange.50' },
              })}
            >
              Reset
            </button>

            <button
              onClick={skipProblem}
              className={css({
                px: 3,
                py: 1,
                fontSize: 'sm',
                border: '1px solid',
                borderColor: 'gray.300',
                borderRadius: 'md',
                bg: 'white',
                cursor: 'pointer',
                _hover: { bg: 'gray.50' },
              })}
            >
              Skip
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className={css({ mt: 3, bg: 'gray.200', borderRadius: 'full', h: 2 })}>
          <div
            className={css({
              bg: 'green.500',
              h: 'full',
              borderRadius: 'full',
              transition: 'width 0.3s ease',
            })}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className={css({ flex: 1, p: 6 })}>
        <div className={vstack({ gap: 6, alignItems: 'center' })}>
          {/* Problem statement */}
          <div className={css({ textAlign: 'center', maxW: '600px' })}>
            {/* Problem display - vertical stack */}
            <div className={css({ mb: 4 })}>
              <div
                className={css({
                  display: 'inline-block',
                  textAlign: 'right',
                  fontSize: '2xl',
                  fontWeight: 'bold',
                  fontFamily: 'mono',
                  bg: 'gray.50',
                  p: 4,
                  border: '1px solid',
                  borderColor: 'gray.200',
                  borderRadius: 'md',
                })}
              >
                {currentProblem.terms.map((term, index) => (
                  <div
                    key={index}
                    className={css({
                      py: 1,
                      color: index <= currentSequenceStep ? 'blue.800' : 'gray.400',
                    })}
                  >
                    {term}
                  </div>
                ))}
                <div
                  className={css({
                    borderTop: '2px solid',
                    borderColor: 'gray.800',
                    mt: 2,
                    pt: 2,
                    color: 'green.800',
                  })}
                >
                  {currentProblem.answer}
                </div>
              </div>
            </div>

            {/* Current step */}
            <div className={css({ mb: 3 })}>
              <h2 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 2 })}>
                {currentSequenceStep === 0
                  ? `Start with 0, then add ${currentProblem.terms[0]}`
                  : `Now add ${currentProblem.terms[currentSequenceStep]}`}
              </h2>
              <p className={css({ fontSize: 'lg', color: 'gray.700' })}>
                Step {currentSequenceStep + 1} of {currentProblem.terms.length}
              </p>
            </div>

            {/* Progress indicator */}
            <div className={css({ mb: 3 })}>
              <div
                className={hstack({
                  gap: 2,
                  justifyContent: 'center',
                  mb: 2,
                  alignItems: 'center',
                })}
              >
                <span className={css({ fontSize: 'sm', color: 'gray.600' })}>Adding:</span>
                {currentProblem.terms.map((term, index) => (
                  <div
                    key={index}
                    className={css({
                      px: 2,
                      py: 1,
                      rounded: 'md',
                      fontSize: 'md',
                      fontWeight: 'bold',
                      fontFamily: 'mono',
                      bg:
                        index < currentSequenceStep
                          ? 'green.100'
                          : index === currentSequenceStep
                            ? 'blue.100'
                            : 'gray.100',
                      color:
                        index < currentSequenceStep
                          ? 'green.800'
                          : index === currentSequenceStep
                            ? 'blue.800'
                            : 'gray.600',
                      border: '1px solid',
                      borderColor: index === currentSequenceStep ? 'blue.300' : 'transparent',
                    })}
                  >
                    {term}
                  </div>
                ))}
              </div>
              <p className={css({ fontSize: 'sm', color: 'gray.600' })}>
                Target for this step: {expectedValue}
              </p>
            </div>

            {/* Difficulty indicator */}
            <div className={css({ mt: 2 })}>
              <span
                className={css({
                  px: 2,
                  py: 1,
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  borderRadius: 'md',
                  bg:
                    currentProblem.difficulty === 'easy'
                      ? 'green.100'
                      : currentProblem.difficulty === 'medium'
                        ? 'yellow.100'
                        : 'red.100',
                  color:
                    currentProblem.difficulty === 'easy'
                      ? 'green.800'
                      : currentProblem.difficulty === 'medium'
                        ? 'yellow.800'
                        : 'red.800',
                })}
              >
                {currentProblem.difficulty.charAt(0).toUpperCase() +
                  currentProblem.difficulty.slice(1)}
              </span>
            </div>
          </div>

          {/* Feedback */}
          {isCorrect === true && (
            <div
              className={css({
                p: 4,
                bg: 'green.50',
                border: '1px solid',
                borderColor: 'green.200',
                borderRadius: 'md',
                color: 'green.700',
                maxW: '600px',
              })}
            >
              {currentSequenceStep === currentProblem.terms.length - 1
                ? `🎉 Problem completed! Final answer: ${currentProblem.answer}`
                : `✅ Correct! Moving to next step...`}
            </div>
          )}

          {isCorrect === false && (
            <div
              className={css({
                p: 4,
                bg: 'red.50',
                border: '1px solid',
                borderColor: 'red.200',
                borderRadius: 'md',
                color: 'red.700',
                maxW: '600px',
              })}
            >
              Not quite right. Current value: {userAnswer}. Target: {expectedValue}. Keep trying!
            </div>
          )}

          {/* Explanation */}
          {showExplanation && (
            <div
              className={css({
                p: 4,
                bg: 'blue.50',
                border: '1px solid',
                borderColor: 'blue.200',
                borderRadius: 'md',
                color: 'blue.700',
                maxW: '600px',
              })}
            >
              <h4 className={css({ fontWeight: 'bold', mb: 2 })}>Hint:</h4>
              <p>{currentProblem.explanation}</p>
              <div className={css({ mt: 2, fontSize: 'sm' })}>
                <strong>Skills used:</strong> {currentProblem.requiredSkills.join(', ')}
              </div>
            </div>
          )}

          {/* Abacus */}
          <div
            className={css({
              bg: 'white',
              border: '2px solid',
              borderColor: 'gray.200',
              borderRadius: 'lg',
              p: 6,
              shadow: 'lg',
            })}
          >
            <AbacusReact
              value={userAnswer}
              columns={3}
              interactive={true}
              animated={true}
              scaleFactor={2.5}
              colorScheme="place-value"
              onValueChange={handleValueChange}
            />
          </div>

          {/* Current progress info */}
          <div
            className={css({
              p: 3,
              bg: 'gray.50',
              border: '1px solid',
              borderColor: 'gray.200',
              borderRadius: 'md',
              fontSize: 'sm',
              color: 'gray.600',
              textAlign: 'center',
            })}
          >
            <div>Current step target: {expectedValue}</div>
            <div>Your current value: {userAnswer}</div>
            <div>Final target: {currentProblem.answer}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

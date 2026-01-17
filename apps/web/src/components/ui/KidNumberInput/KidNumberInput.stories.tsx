import type { Meta, StoryObj } from '@storybook/react'
import { useState, useEffect, useCallback } from 'react'
import { KidNumberInput, useKidNumberInput, type FeedbackState } from './index'

const meta: Meta<typeof KidNumberInput> = {
  title: 'UI/KidNumberInput',
  component: KidNumberInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{
          backgroundColor: '#ffffff',
          color: '#1f2937',
          minHeight: '100vh',
          padding: '20px',
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof KidNumberInput>

/**
 * Basic controlled input without auto-validation.
 * Try typing numbers or using the on-screen keypad.
 */
export const Basic: Story = {
  render: function BasicStory() {
    const [value, setValue] = useState('')

    const handleDigit = useCallback((d: string) => {
      setValue((prev) => prev + d)
    }, [])

    const handleBackspace = useCallback(() => {
      setValue((prev) => prev.slice(0, -1))
    }, [])

    // Global keyboard listener
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault()
          handleDigit(e.key)
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          handleBackspace()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleDigit, handleBackspace])

    return (
      <div style={{ padding: '40px', minHeight: '300px' }}>
        <KidNumberInput
          value={value}
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          showKeypad={true}
          keypadMode="inline"
        />
        <p style={{ marginTop: '20px', textAlign: 'center', color: '#666' }}>
          Current value: "{value}"
        </p>
      </div>
    )
  },
}

/**
 * With auto-validation using the useKidNumberInput hook.
 * The correct answer is 7. Type it to see the success feedback!
 */
export const WithAutoValidation: Story = {
  render: function AutoValidationStory() {
    const [feedback, setFeedback] = useState<FeedbackState>('none')
    const [message, setMessage] = useState('Type the number 7')
    const [correctCount, setCorrectCount] = useState(0)

    const { state, actions } = useKidNumberInput({
      correctAnswer: 7,
      onCorrect: (answer, responseTime) => {
        setFeedback('correct')
        setMessage(`Correct! (${responseTime}ms)`)
        setCorrectCount((c) => c + 1)
        setTimeout(() => {
          setFeedback('none')
          setMessage('Type the number 7 again!')
        }, 1000)
      },
      onIncorrect: (answer, correct, responseTime) => {
        setFeedback('incorrect')
        setMessage(`Nope, ${answer} is not ${correct}. Try again!`)
        setTimeout(() => setFeedback('none'), 300)
      },
    })

    return (
      <div style={{ padding: '40px', minHeight: '400px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '10px' }}>What is 3 + 4?</h3>
        <KidNumberInput
          value={state.value}
          onDigit={actions.addDigit}
          onBackspace={actions.backspace}
          feedback={feedback}
          showKeypad={true}
          keypadMode="inline"
        />
        <p style={{ marginTop: '20px', color: '#666' }}>{message}</p>
        <p style={{ color: '#10b981', fontWeight: 'bold' }}>Correct answers: {correctCount}</p>
      </div>
    )
  },
}

/**
 * Answer persists after correct entry - form-like behavior.
 * The input shows your answer and a "Continue" button appears.
 */
export const AnswerPersistsAfterCorrect: Story = {
  render: function PersistentAnswerStory() {
    const [feedback, setFeedback] = useState<FeedbackState>('none')
    const [isComplete, setIsComplete] = useState(false)

    const { state, actions } = useKidNumberInput({
      correctAnswer: 42,
      clearOnCorrect: false, // Keep the answer displayed!
      clearOnIncorrect: true,
      onCorrect: () => {
        setFeedback('correct')
        setIsComplete(true)
      },
      onIncorrect: () => {
        setFeedback('incorrect')
        setTimeout(() => setFeedback('none'), 400)
      },
    })

    const handleContinue = () => {
      alert('Navigating to next step!')
    }

    const handleReset = () => {
      actions.reset()
      setFeedback('none')
      setIsComplete(false)
    }

    return (
      <div style={{ padding: '40px', minHeight: '400px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '10px' }}>What is 6 × 7?</h3>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Answer stays visible after you get it right
        </p>

        <KidNumberInput
          value={state.value}
          onDigit={actions.addDigit}
          onBackspace={actions.backspace}
          feedback={feedback}
          showKeypad={!isComplete}
          keypadMode="inline"
          disabled={isComplete}
        />

        {isComplete && (
          <div
            style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center' }}
          >
            <button
              onClick={handleContinue}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Continue →
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    )
  },
}

/**
 * Two-digit answer validation.
 * Random two-digit addition problem.
 */
export const TwoDigitAnswer: Story = {
  render: function TwoDigitStory() {
    const [a, setA] = useState(23)
    const [b, setB] = useState(45)
    const [feedback, setFeedback] = useState<FeedbackState>('none')
    const [message, setMessage] = useState('')

    const correctAnswer = a + b

    const { state, actions } = useKidNumberInput({
      correctAnswer,
      onCorrect: (answer, responseTime) => {
        setFeedback('correct')
        setMessage(`Correct! ${a} + ${b} = ${answer} (${responseTime}ms)`)
        setTimeout(() => {
          setFeedback('none')
          setMessage('')
          // Generate new problem
          setA(Math.floor(Math.random() * 40) + 10)
          setB(Math.floor(Math.random() * 40) + 10)
        }, 1200)
      },
      onIncorrect: (answer) => {
        setFeedback('incorrect')
        setMessage(`${answer} is not correct. Try again!`)
        setTimeout(() => setFeedback('none'), 300)
      },
    })

    return (
      <div style={{ padding: '40px', minHeight: '400px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '20px', fontSize: '32px' }}>
          {a} + {b} = ?
        </h3>
        <KidNumberInput
          value={state.value}
          onDigit={actions.addDigit}
          onBackspace={actions.backspace}
          feedback={feedback}
          showKeypad={true}
          keypadMode="inline"
        />
        <p style={{ marginTop: '20px', color: '#666' }}>{message}</p>
        <p style={{ marginTop: '10px', color: '#999', fontSize: '14px' }}>
          (Answer has {correctAnswer.toString().length} digits)
        </p>
      </div>
    )
  },
}

// =============================================================================
// FLOWCHART WALKER DEMOS
// =============================================================================

/**
 * Multi-input form with focus management.
 * Demonstrates: multiple inputs, focus indication, auto-advance on correct,
 * navigation event on completion.
 *
 * This simulates a flowchart checkpoint asking for two related numbers.
 */
export const MultipleInputsWithFocus: Story = {
  render: function MultiInputStory() {
    // Two inputs: numerator and denominator for equivalent fractions
    // 1/2 = ?/6, so answers are 3 and 6
    const [focusedInput, setFocusedInput] = useState<0 | 1>(0)
    const [values, setValues] = useState(['', ''])
    const [feedbacks, setFeedbacks] = useState<[FeedbackState, FeedbackState]>(['none', 'none'])
    const [completed, setCompleted] = useState([false, false])
    const [navigationTriggered, setNavigationTriggered] = useState(false)

    const correctAnswers = [3, 6]

    const handleDigit = useCallback(
      (digit: string) => {
        if (completed[focusedInput]) return

        const newValues = [...values]
        const currentValue = newValues[focusedInput]
        const correctAnswer = correctAnswers[focusedInput]
        const maxDigits = correctAnswer.toString().length

        if (currentValue.length >= maxDigits) return

        const newValue = currentValue + digit
        newValues[focusedInput] = newValue
        setValues(newValues)

        // Check if we should validate
        if (newValue.length >= maxDigits) {
          const answer = parseInt(newValue, 10)
          const isCorrect = answer === correctAnswer

          const newFeedbacks = [...feedbacks] as [FeedbackState, FeedbackState]
          const newCompleted = [...completed]

          if (isCorrect) {
            newFeedbacks[focusedInput] = 'correct'
            newCompleted[focusedInput] = true
            setFeedbacks(newFeedbacks)
            setCompleted(newCompleted)

            // Auto-advance to next input or trigger navigation
            setTimeout(() => {
              if (focusedInput === 0 && !newCompleted[1]) {
                setFocusedInput(1)
              } else if (newCompleted[0] && newCompleted[1]) {
                // Both complete - trigger navigation!
                setNavigationTriggered(true)
              }
            }, 500)
          } else {
            newFeedbacks[focusedInput] = 'incorrect'
            setFeedbacks(newFeedbacks)

            // Clear after shake animation
            setTimeout(() => {
              const resetValues = [...newValues]
              resetValues[focusedInput] = ''
              setValues(resetValues)
              const resetFeedbacks = [...newFeedbacks] as [FeedbackState, FeedbackState]
              resetFeedbacks[focusedInput] = 'none'
              setFeedbacks(resetFeedbacks)
            }, 400)
          }
        }
      },
      [focusedInput, values, feedbacks, completed]
    )

    const handleBackspace = useCallback(() => {
      if (completed[focusedInput]) return
      const newValues = [...values]
      newValues[focusedInput] = newValues[focusedInput].slice(0, -1)
      setValues(newValues)
    }, [focusedInput, values, completed])

    // Global keyboard listener
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault()
          handleDigit(e.key)
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          handleBackspace()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleDigit, handleBackspace])

    const handleInputClick = (index: 0 | 1) => {
      if (!completed[index]) {
        setFocusedInput(index)
      }
    }

    const resetAll = () => {
      setValues(['', ''])
      setFeedbacks(['none', 'none'])
      setCompleted([false, false])
      setFocusedInput(0)
      setNavigationTriggered(false)
    }

    const InputDisplay = ({ index, label }: { index: 0 | 1; label: string }) => {
      const isFocused = focusedInput === index && !completed[index]
      const feedback = feedbacks[index]
      const value = values[index]

      let borderColor = '#d1d5db'
      let backgroundColor = '#f9fafb'
      let boxShadow = 'none'

      if (feedback === 'correct') {
        borderColor = '#10b981'
        backgroundColor = '#d1fae5'
      } else if (feedback === 'incorrect') {
        borderColor = '#ef4444'
        backgroundColor = '#fee2e2'
      } else if (isFocused) {
        borderColor = '#3b82f6'
        backgroundColor = '#eff6ff'
        boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)'
      } else if (completed[index]) {
        borderColor = '#10b981'
        backgroundColor = '#d1fae5'
      }

      return (
        <div
          onClick={() => handleInputClick(index)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            cursor: completed[index] ? 'default' : 'pointer',
          }}
        >
          <span style={{ fontSize: '14px', color: '#666', fontWeight: 500 }}>{label}</span>
          <div
            style={{
              width: '80px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: 'bold',
              borderRadius: '12px',
              border: `3px solid ${borderColor}`,
              backgroundColor,
              boxShadow,
              transition: 'all 0.15s ease-out',
              animation: feedback === 'incorrect' ? 'kid-input-shake 0.3s ease-out' : undefined,
            }}
          >
            {value || '?'}
          </div>
        </div>
      )
    }

    if (navigationTriggered) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎉</div>
          <h3 style={{ color: '#10b981', marginBottom: '20px' }}>Navigation Triggered!</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Both inputs completed correctly. In the flowchart walker, this would advance to the next
            step.
          </p>
          <button
            onClick={resetAll}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '10px' }}>Find the Equivalent Fraction</h3>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Click an input to focus it, or it auto-advances on correct answer
        </p>

        {/* Fraction equation display */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            marginBottom: '30px',
            fontSize: '24px',
          }}
        >
          {/* First fraction: 1/2 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ borderBottom: '3px solid #374151', padding: '0 10px' }}>1</span>
            <span style={{ padding: '0 10px' }}>2</span>
          </div>

          <span style={{ fontSize: '32px', color: '#6b7280' }}>=</span>

          {/* Second fraction: ?/6 */}
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <InputDisplay index={0} label="Numerator" />
            <div style={{ width: '80px', height: '3px', backgroundColor: '#374151' }} />
            <InputDisplay index={1} label="Denominator" />
          </div>
        </div>

        {/* Status */}
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Currently editing: <strong>{focusedInput === 0 ? 'Numerator' : 'Denominator'}</strong>
        </p>

        {/* Inline keypad */}
        <KidNumberInput
          value="" // Display is handled separately above
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          showKeypad={true}
          keypadMode="inline"
          disabled={completed[0] && completed[1]}
        />
      </div>
    )
  },
}

/**
 * Single input with all feedback states demonstrated.
 * Shows: typing, invalid shake, correct pulse, value retention.
 */
export const SingleInputAllStates: Story = {
  render: function SingleInputStory() {
    const [value, setValue] = useState('')
    const [feedback, setFeedback] = useState<FeedbackState>('none')
    const [isComplete, setIsComplete] = useState(false)
    const [attempts, setAttempts] = useState(0)
    const [lastWrongAnswer, setLastWrongAnswer] = useState<number | null>(null)

    const correctAnswer = 15 // 8 + 7

    const handleDigit = useCallback(
      (digit: string) => {
        if (isComplete) return
        if (value.length >= 2) return

        const newValue = value + digit
        setValue(newValue)

        if (newValue.length >= 2) {
          const answer = parseInt(newValue, 10)

          if (answer === correctAnswer) {
            setFeedback('correct')
            setIsComplete(true)
          } else {
            setFeedback('incorrect')
            setLastWrongAnswer(answer)
            setAttempts((a) => a + 1)

            setTimeout(() => {
              setValue('')
              setFeedback('none')
            }, 400)
          }
        }
      },
      [isComplete, value, correctAnswer]
    )

    const handleBackspace = useCallback(() => {
      if (isComplete) return
      setValue((v) => v.slice(0, -1))
    }, [isComplete])

    // Global keyboard listener
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault()
          handleDigit(e.key)
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          handleBackspace()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleDigit, handleBackspace])

    const handleContinue = () => {
      // This would trigger navigation in the real flowchart walker
      alert('Navigation triggered! Moving to next step...')
    }

    const handleReset = () => {
      setValue('')
      setFeedback('none')
      setIsComplete(false)
      setAttempts(0)
      setLastWrongAnswer(null)
    }

    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '10px' }}>What is 8 + 7?</h3>

        {/* Attempt counter */}
        {attempts > 0 && !isComplete && (
          <p style={{ color: '#f59e0b', marginBottom: '10px', fontSize: '14px' }}>
            Attempts: {attempts} {lastWrongAnswer !== null && `(Last answer: ${lastWrongAnswer})`}
          </p>
        )}

        {/* Main display */}
        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 40px',
            borderRadius: '16px',
            backgroundColor:
              feedback === 'correct' ? '#d1fae5' : feedback === 'incorrect' ? '#fee2e2' : '#f3f4f6',
            border: `3px solid ${
              feedback === 'correct' ? '#10b981' : feedback === 'incorrect' ? '#ef4444' : '#d1d5db'
            }`,
            transition: 'all 0.15s ease-out',
            animation: feedback === 'incorrect' ? 'kid-input-shake 0.3s ease-out' : undefined,
            marginBottom: '20px',
          }}
        >
          <span
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color:
                feedback === 'correct'
                  ? '#059669'
                  : feedback === 'incorrect'
                    ? '#dc2626'
                    : '#1f2937',
              minWidth: '100px',
            }}
          >
            {value || '?'}
          </span>

          {/* Feedback message */}
          {feedback === 'correct' && (
            <span style={{ color: '#059669', fontWeight: 600, marginTop: '10px' }}>✓ Correct!</span>
          )}
          {feedback === 'incorrect' && (
            <span style={{ color: '#dc2626', fontWeight: 600, marginTop: '10px' }}>
              ✗ Try again
            </span>
          )}
        </div>

        {/* Action buttons */}
        {isComplete ? (
          <div
            style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px' }}
          >
            <button
              onClick={handleContinue}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Continue →
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        ) : (
          <KidNumberInput
            value=""
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            showKeypad={true}
            keypadMode="inline"
          />
        )}
      </div>
    )
  },
}

/**
 * Sequential inputs that auto-advance.
 * Simulates a multi-step flowchart checkpoint.
 */
export const SequentialInputsAutoAdvance: Story = {
  render: function SequentialStory() {
    const steps = [
      { question: 'Step 1: What is 3 + 4?', answer: 7 },
      { question: 'Step 2: What is 7 + 5?', answer: 12 },
      { question: 'Step 3: What is 12 - 3?', answer: 9 },
    ]

    const [currentStep, setCurrentStep] = useState(0)
    const [values, setValues] = useState(['', '', ''])
    const [feedbacks, setFeedbacks] = useState<FeedbackState[]>(['none', 'none', 'none'])
    const [completedSteps, setCompletedSteps] = useState<boolean[]>([false, false, false])
    const [allComplete, setAllComplete] = useState(false)

    const currentQuestion = steps[currentStep]

    const handleDigit = useCallback(
      (digit: string) => {
        if (completedSteps[currentStep]) return

        const maxDigits = currentQuestion.answer.toString().length
        const currentValue = values[currentStep]

        if (currentValue.length >= maxDigits) return

        const newValue = currentValue + digit
        const newValues = [...values]
        newValues[currentStep] = newValue
        setValues(newValues)

        if (newValue.length >= maxDigits) {
          const answer = parseInt(newValue, 10)
          const isCorrect = answer === currentQuestion.answer

          const newFeedbacks = [...feedbacks]

          if (isCorrect) {
            newFeedbacks[currentStep] = 'correct'
            setFeedbacks(newFeedbacks)

            const newCompleted = [...completedSteps]
            newCompleted[currentStep] = true
            setCompletedSteps(newCompleted)

            // Auto-advance after delay
            setTimeout(() => {
              if (currentStep < steps.length - 1) {
                setCurrentStep(currentStep + 1)
              } else {
                setAllComplete(true)
              }
            }, 800)
          } else {
            newFeedbacks[currentStep] = 'incorrect'
            setFeedbacks(newFeedbacks)

            setTimeout(() => {
              const resetValues = [...newValues]
              resetValues[currentStep] = ''
              setValues(resetValues)
              const resetFeedbacks = [...newFeedbacks]
              resetFeedbacks[currentStep] = 'none'
              setFeedbacks(resetFeedbacks)
            }, 400)
          }
        }
      },
      [currentStep, currentQuestion, completedSteps, values, feedbacks, steps.length]
    )

    const handleBackspace = useCallback(() => {
      if (completedSteps[currentStep]) return
      const newValues = [...values]
      newValues[currentStep] = newValues[currentStep].slice(0, -1)
      setValues(newValues)
    }, [currentStep, completedSteps, values])

    // Global keyboard listener
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault()
          handleDigit(e.key)
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          handleBackspace()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleDigit, handleBackspace])

    const handleReset = () => {
      setCurrentStep(0)
      setValues(['', '', ''])
      setFeedbacks(['none', 'none', 'none'])
      setCompletedSteps([false, false, false])
      setAllComplete(false)
    }

    if (allComplete) {
      return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎉</div>
          <h3 style={{ color: '#10b981', marginBottom: '20px' }}>All Steps Complete!</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>You answered: {values.join(' → ')}</p>
          <button
            onClick={handleReset}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Start Over
          </button>
        </div>
      )
    }

    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        {/* Progress indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '30px',
          }}
        >
          {steps.map((step, idx) => (
            <div
              key={idx}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '16px',
                backgroundColor: completedSteps[idx]
                  ? '#10b981'
                  : idx === currentStep
                    ? '#3b82f6'
                    : '#e5e7eb',
                color: completedSteps[idx] || idx === currentStep ? 'white' : '#9ca3af',
                transition: 'all 0.2s ease-out',
              }}
            >
              {completedSteps[idx] ? '✓' : idx + 1}
            </div>
          ))}
        </div>

        {/* Current question */}
        <h3 style={{ marginBottom: '20px' }}>{currentQuestion.question}</h3>

        {/* Answer display */}
        <div
          style={{
            display: 'inline-block',
            padding: '20px 40px',
            borderRadius: '16px',
            backgroundColor:
              feedbacks[currentStep] === 'correct'
                ? '#d1fae5'
                : feedbacks[currentStep] === 'incorrect'
                  ? '#fee2e2'
                  : '#f3f4f6',
            border: `3px solid ${
              feedbacks[currentStep] === 'correct'
                ? '#10b981'
                : feedbacks[currentStep] === 'incorrect'
                  ? '#ef4444'
                  : '#3b82f6'
            }`,
            marginBottom: '20px',
            animation:
              feedbacks[currentStep] === 'incorrect' ? 'kid-input-shake 0.3s ease-out' : undefined,
          }}
        >
          <span style={{ fontSize: '48px', fontWeight: 'bold' }}>{values[currentStep] || '?'}</span>
        </div>

        {/* Previous answers */}
        {currentStep > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <span style={{ color: '#666', fontSize: '14px' }}>Previous answers: </span>
            {values.slice(0, currentStep).map((v, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  margin: '0 4px',
                  backgroundColor: '#d1fae5',
                  color: '#059669',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}
              >
                {v}
              </span>
            ))}
          </div>
        )}

        <KidNumberInput
          value=""
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          showKeypad={true}
          keypadMode="inline"
        />
      </div>
    )
  },
}

/**
 * Three-digit subtraction problem.
 */
export const ThreeDigitAnswer: Story = {
  render: function ThreeDigitStory() {
    const [a, setA] = useState(234)
    const [b, setB] = useState(156)
    const [feedback, setFeedback] = useState<FeedbackState>('none')
    const [score, setScore] = useState(0)

    const correctAnswer = a - b

    const { state, actions } = useKidNumberInput({
      correctAnswer,
      onCorrect: (answer, responseTime) => {
        setFeedback('correct')
        setScore((s) => s + 1)
        setTimeout(() => {
          setFeedback('none')
          // Generate new problem (ensure positive result)
          const newA = Math.floor(Math.random() * 400) + 200
          const newB = Math.floor(Math.random() * (newA - 100)) + 50
          setA(newA)
          setB(newB)
        }, 800)
      },
      onIncorrect: () => {
        setFeedback('incorrect')
        setTimeout(() => setFeedback('none'), 300)
      },
    })

    return (
      <div style={{ padding: '40px', minHeight: '400px', textAlign: 'center' }}>
        <p style={{ marginBottom: '10px', color: '#666' }}>
          Score: <strong style={{ color: '#3b82f6' }}>{score}</strong>
        </p>
        <h3 style={{ marginBottom: '20px', fontSize: '36px' }}>
          {a} − {b} = ?
        </h3>
        <KidNumberInput
          value={state.value}
          onDigit={actions.addDigit}
          onBackspace={actions.backspace}
          feedback={feedback}
          showKeypad={true}
          keypadMode="inline"
          displaySize="lg"
        />
        <p style={{ marginTop: '20px', color: '#999', fontSize: '14px' }}>
          (Answer: {correctAnswer}, {correctAnswer.toString().length} digits)
        </p>
      </div>
    )
  },
}

/**
 * Rapid-fire complement practice (like the complement race game).
 * Answer complements to 10 as fast as you can!
 */
export const ComplementPractice: Story = {
  render: function ComplementStory() {
    const [number, setNumber] = useState(3)
    const [feedback, setFeedback] = useState<FeedbackState>('none')
    const [score, setScore] = useState(0)
    const [streak, setStreak] = useState(0)

    const correctAnswer = 10 - number

    const { state, actions } = useKidNumberInput({
      correctAnswer,
      onCorrect: (answer, responseTime) => {
        setFeedback('correct')
        setScore((s) => s + Math.max(100, 1000 - responseTime))
        setStreak((s) => s + 1)

        // Generate new problem after brief delay
        setTimeout(() => {
          setFeedback('none')
          setNumber(Math.floor(Math.random() * 9) + 1)
        }, 300)
      },
      onIncorrect: () => {
        setFeedback('incorrect')
        setStreak(0)
        setTimeout(() => setFeedback('none'), 300)
      },
    })

    return (
      <div style={{ padding: '40px', minHeight: '500px', textAlign: 'center' }}>
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>Score: </span>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>{score}</span>
          <span style={{ marginLeft: '20px', fontSize: '14px', color: '#666' }}>Streak: </span>
          <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
            {streak} 🔥
          </span>
        </div>

        <div
          style={{
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          <span
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: 'white',
              padding: '10px 30px',
              borderRadius: '12px',
            }}
          >
            ?
          </span>
          <span style={{ color: '#6b7280' }}>+</span>
          <span>{number}</span>
          <span style={{ color: '#6b7280' }}>=</span>
          <span style={{ color: '#10b981' }}>10</span>
        </div>

        <KidNumberInput
          value={state.value}
          onDigit={actions.addDigit}
          onBackspace={actions.backspace}
          feedback={feedback}
          showKeypad={true}
          keypadMode="inline"
          displaySize="lg"
        />
      </div>
    )
  },
}

/**
 * Different display sizes.
 */
export const DisplaySizes: Story = {
  render: function SizesStory() {
    return (
      <div
        style={{
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '30px',
          alignItems: 'center',
        }}
      >
        <div>
          <p style={{ textAlign: 'center', marginBottom: '10px', color: '#666' }}>Small</p>
          <KidNumberInput
            value="123"
            onDigit={() => {}}
            onBackspace={() => {}}
            showKeypad={false}
            displaySize="sm"
          />
        </div>
        <div>
          <p style={{ textAlign: 'center', marginBottom: '10px', color: '#666' }}>Medium</p>
          <KidNumberInput
            value="123"
            onDigit={() => {}}
            onBackspace={() => {}}
            showKeypad={false}
            displaySize="md"
          />
        </div>
        <div>
          <p style={{ textAlign: 'center', marginBottom: '10px', color: '#666' }}>Large</p>
          <KidNumberInput
            value="123"
            onDigit={() => {}}
            onBackspace={() => {}}
            showKeypad={false}
            displaySize="lg"
          />
        </div>
        <div>
          <p style={{ textAlign: 'center', marginBottom: '10px', color: '#666' }}>
            Extra Large (default)
          </p>
          <KidNumberInput
            value="123"
            onDigit={() => {}}
            onBackspace={() => {}}
            showKeypad={false}
            displaySize="xl"
          />
        </div>
      </div>
    )
  },
}

/**
 * Feedback states demonstration.
 */
export const FeedbackStates: Story = {
  render: function FeedbackStory() {
    return (
      <div
        style={{
          padding: '40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '30px',
          alignItems: 'center',
        }}
      >
        <div>
          <p style={{ textAlign: 'center', marginBottom: '10px', color: '#666' }}>None (default)</p>
          <KidNumberInput
            value="5"
            onDigit={() => {}}
            onBackspace={() => {}}
            showKeypad={false}
            feedback="none"
          />
        </div>
        <div>
          <p style={{ textAlign: 'center', marginBottom: '10px', color: '#666' }}>Correct</p>
          <KidNumberInput
            value="7"
            onDigit={() => {}}
            onBackspace={() => {}}
            showKeypad={false}
            feedback="correct"
          />
        </div>
        <div>
          <p style={{ textAlign: 'center', marginBottom: '10px', color: '#666' }}>Incorrect</p>
          <KidNumberInput
            value="3"
            onDigit={() => {}}
            onBackspace={() => {}}
            showKeypad={false}
            feedback="incorrect"
          />
        </div>
      </div>
    )
  },
}

/**
 * Fixed keypad mode (default) - keypad attaches to screen edges.
 * Best for full-screen game experiences.
 */
export const FixedKeypadMode: Story = {
  render: function FixedKeypadStory() {
    const [value, setValue] = useState('')

    const handleDigit = useCallback((d: string) => {
      setValue((prev) => prev + d)
    }, [])

    const handleBackspace = useCallback(() => {
      setValue((prev) => prev.slice(0, -1))
    }, [])

    // Global keyboard listener
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault()
          handleDigit(e.key)
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          handleBackspace()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleDigit, handleBackspace])

    return (
      <div
        style={{
          padding: '40px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h3 style={{ marginBottom: '20px' }}>Fixed Keypad Mode</h3>
        <p style={{ marginBottom: '20px', color: '#666', maxWidth: '400px', textAlign: 'center' }}>
          The keypad is fixed to the bottom of the screen (portrait) or right side (landscape on
          small screens).
        </p>
        <KidNumberInput
          value={value}
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          showKeypad={true}
          keypadMode="fixed"
        />
      </div>
    )
  },
  parameters: {
    layout: 'fullscreen',
  },
}

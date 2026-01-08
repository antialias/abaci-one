import type { Meta, StoryObj } from '@storybook/react'
import { useState, useEffect } from 'react'
import { css } from '../../../styled-system/css'
import { VerticalProblem } from './VerticalProblem'

/**
 * Stories demonstrating the vision-powered abacus detection feature.
 * These showcase how the system provides real-time feedback as students
 * work through problems on their physical abacus.
 */
const meta: Meta = {
  title: 'Vision/Detection Feedback',
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj

/**
 * Shows checkmarks appearing on terms as the vision system detects
 * the student completing each step on their physical abacus.
 */
function VisionProgressDemo() {
  const terms = [45, 32, 18]
  const prefixSums = [45, 77, 95] // Running totals after each term
  const [detectedIndex, setDetectedIndex] = useState<number | undefined>(undefined)
  const [detectedValue, setDetectedValue] = useState<number | null>(null)

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        padding: '2rem',
        minWidth: '400px',
      })}
    >
      <div
        className={css({
          textAlign: 'center',
          marginBottom: '1rem',
        })}
      >
        <h3
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: 'gray.800',
            marginBottom: '0.5rem',
          })}
        >
          Vision Detection Progress
        </h3>
        <p className={css({ fontSize: '0.875rem', color: 'gray.600' })}>
          Checkmarks appear as the camera detects completed terms
        </p>
      </div>

      <VerticalProblem
        terms={terms}
        userAnswer={detectedValue?.toString() ?? ''}
        isFocused={true}
        isCompleted={false}
        correctAnswer={95}
        size="large"
        detectedPrefixIndex={detectedIndex}
      />

      {/* Simulated detection display */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem',
          backgroundColor: 'gray.100',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '300px',
        })}
      >
        <div
          className={css({
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'gray.500',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          })}
        >
          Detected on Abacus
        </div>
        <div
          className={css({
            fontSize: '2.5rem',
            fontWeight: 'bold',
            fontFamily: 'mono',
            color: detectedValue !== null ? 'green.600' : 'gray.400',
          })}
        >
          {detectedValue !== null ? detectedValue : '—'}
        </div>

        {/* Control buttons */}
        <div
          className={css({
            display: 'flex',
            gap: '0.5rem',
            marginTop: '0.5rem',
          })}
        >
          <button
            type="button"
            onClick={() => {
              setDetectedIndex(undefined)
              setDetectedValue(null)
            }}
            className={css({
              padding: '0.5rem 1rem',
              fontSize: '0.75rem',
              backgroundColor: 'gray.200',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              _hover: { backgroundColor: 'gray.300' },
            })}
          >
            Reset
          </button>
          {prefixSums.map((sum, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setDetectedIndex(i)
                setDetectedValue(sum)
              }}
              className={css({
                padding: '0.5rem 1rem',
                fontSize: '0.75rem',
                backgroundColor: detectedIndex === i ? 'green.500' : 'blue.500',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                _hover: { opacity: 0.9 },
              })}
            >
              {sum}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export const ProgressDemo: Meta = {
  render: () => <VisionProgressDemo />,
}

/**
 * Static example showing the first term completed
 */
export const FirstTermCompleted: Meta = {
  render: () => (
    <div className={css({ padding: '2rem' })}>
      <VerticalProblem
        terms={[45, 32, 18]}
        userAnswer="45"
        isFocused={true}
        isCompleted={false}
        correctAnswer={95}
        size="large"
        detectedPrefixIndex={0}
      />
    </div>
  ),
}

/**
 * Static example showing two terms completed
 */
export const TwoTermsCompleted: Meta = {
  render: () => (
    <div className={css({ padding: '2rem' })}>
      <VerticalProblem
        terms={[45, 32, 18]}
        userAnswer="77"
        isFocused={true}
        isCompleted={false}
        correctAnswer={95}
        size="large"
        detectedPrefixIndex={1}
      />
    </div>
  ),
}

/**
 * Gallery showing the progression of vision detection
 */
function VisionProgressGallery() {
  const terms = [45, 32, 18]
  const stages = [
    { label: 'Starting', userAnswer: '', detectedPrefixIndex: undefined },
    { label: 'First term (45)', userAnswer: '45', detectedPrefixIndex: 0 },
    { label: 'Two terms (77)', userAnswer: '77', detectedPrefixIndex: 1 },
    { label: 'Final answer (95)', userAnswer: '95', detectedPrefixIndex: undefined },
  ]

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
      })}
    >
      <h2
        className={css({
          fontSize: '1.5rem',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '1rem',
        })}
      >
        Vision Detection: Step by Step
      </h2>

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1.5rem',
        })}
      >
        {stages.map((stage, i) => (
          <div
            key={i}
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            })}
          >
            <div
              className={css({
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'gray.600',
                textAlign: 'center',
              })}
            >
              {stage.label}
            </div>
            <div
              className={css({
                padding: '1rem',
                backgroundColor: i === stages.length - 1 ? 'green.50' : 'white',
                borderRadius: '12px',
                border: '2px solid',
                borderColor: i === stages.length - 1 ? 'green.300' : 'gray.200',
              })}
            >
              <VerticalProblem
                terms={terms}
                userAnswer={stage.userAnswer}
                isFocused={i < stages.length - 1}
                isCompleted={i === stages.length - 1}
                correctAnswer={95}
                size="normal"
                detectedPrefixIndex={stage.detectedPrefixIndex}
              />
            </div>
            {i < stages.length - 1 && (
              <div className={css({ fontSize: '1.5rem', color: 'gray.400' })}>→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export const ProgressGallery: Meta = {
  render: () => <VisionProgressGallery />,
  parameters: {
    layout: 'fullscreen',
  },
}

/**
 * Simulated live detection with animated value changes
 */
function LiveDetectionSimulation() {
  const terms = [25, 17, 8]
  const prefixSums = [25, 42, 50]
  const [step, setStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setStep((s) => {
        if (s >= prefixSums.length) {
          setIsPlaying(false)
          return s
        }
        return s + 1
      })
    }, 2000)

    return () => clearInterval(timer)
  }, [isPlaying, prefixSums.length])

  const currentValue = step === 0 ? null : prefixSums[step - 1]
  const detectedIndex = step === 0 ? undefined : step - 1

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        padding: '2rem',
      })}
    >
      <div className={css({ textAlign: 'center' })}>
        <h3 className={css({ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' })}>
          Live Vision Detection
        </h3>
        <p className={css({ fontSize: '0.875rem', color: 'gray.600' })}>
          Watch checkmarks appear as values are detected
        </p>
      </div>

      {/* Detection indicator */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem 1.5rem',
          backgroundColor: 'gray.900',
          borderRadius: '12px',
          color: 'white',
        })}
      >
        <div
          className={css({
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: currentValue !== null ? 'green.400' : 'gray.500',
            animation: currentValue !== null ? 'pulse 1s infinite' : 'none',
          })}
        />
        <div className={css({ fontSize: '0.75rem', color: 'gray.400' })}>DETECTED</div>
        <div className={css({ fontSize: '2rem', fontFamily: 'mono', fontWeight: 'bold' })}>
          {currentValue ?? '—'}
        </div>
        <div className={css({ fontSize: '0.75rem', color: 'gray.500' })}>
          {currentValue !== null ? '98% confidence' : 'waiting...'}
        </div>
      </div>

      <VerticalProblem
        terms={terms}
        userAnswer={currentValue?.toString() ?? ''}
        isFocused={step < prefixSums.length}
        isCompleted={step >= prefixSums.length}
        correctAnswer={50}
        size="large"
        detectedPrefixIndex={detectedIndex}
      />

      <div className={css({ display: 'flex', gap: '1rem' })}>
        <button
          type="button"
          onClick={() => {
            setStep(0)
            setIsPlaying(true)
          }}
          disabled={isPlaying}
          className={css({
            padding: '0.75rem 1.5rem',
            backgroundColor: isPlaying ? 'gray.400' : 'green.500',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: isPlaying ? 'not-allowed' : 'pointer',
            _hover: { opacity: isPlaying ? 1 : 0.9 },
          })}
        >
          {isPlaying ? 'Detecting...' : 'Start Simulation'}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep(0)
            setIsPlaying(false)
          }}
          className={css({
            padding: '0.75rem 1.5rem',
            backgroundColor: 'gray.200',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            _hover: { backgroundColor: 'gray.300' },
          })}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export const LiveSimulation: Meta = {
  render: () => <LiveDetectionSimulation />,
}

/**
 * Simple side-by-side comparison for blog screenshot
 */
function BeforeAfterComparison() {
  return (
    <div
      className={css({
        display: 'flex',
        gap: '3rem',
        padding: '2rem',
        alignItems: 'flex-start',
      })}
    >
      <div className={css({ textAlign: 'center' })}>
        <div
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'gray.600',
            marginBottom: '1rem',
          })}
        >
          Without Vision
        </div>
        <div
          className={css({
            padding: '1.5rem',
            backgroundColor: 'gray.50',
            borderRadius: '12px',
            border: '2px solid',
            borderColor: 'gray.200',
          })}
        >
          <VerticalProblem
            terms={[45, 32, 18]}
            userAnswer=""
            isFocused={true}
            isCompleted={false}
            correctAnswer={95}
            size="large"
          />
        </div>
        <div className={css({ fontSize: '0.75rem', color: 'gray.500', marginTop: '0.75rem' })}>
          No feedback until answer is entered
        </div>
      </div>

      <div className={css({ textAlign: 'center' })}>
        <div
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'green.600',
            marginBottom: '1rem',
          })}
        >
          With Vision Detection
        </div>
        <div
          className={css({
            padding: '1.5rem',
            backgroundColor: 'green.50',
            borderRadius: '12px',
            border: '2px solid',
            borderColor: 'green.300',
          })}
        >
          <VerticalProblem
            terms={[45, 32, 18]}
            userAnswer="77"
            isFocused={true}
            isCompleted={false}
            correctAnswer={95}
            size="large"
            detectedPrefixIndex={1}
          />
        </div>
        <div className={css({ fontSize: '0.75rem', color: 'green.600', marginTop: '0.75rem' })}>
          Real-time checkmarks as terms complete
        </div>
      </div>
    </div>
  )
}

export const BeforeAfter: Meta = {
  render: () => <BeforeAfterComparison />,
}

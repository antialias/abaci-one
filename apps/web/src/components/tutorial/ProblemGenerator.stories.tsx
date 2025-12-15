import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'
import { createBasicSkillSet, type PracticeStep } from '../../types/tutorial'
import { generateProblems, validatePracticeStepConfiguration } from '../../utils/problemGenerator'
import { PracticeProblemPlayer } from './PracticeProblemPlayer'
import { PracticeStepEditor } from './PracticeStepEditor'

const meta: Meta = {
  title: 'Tutorial/Problem Generator',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

// Demo practice step for testing
const defaultPracticeStep: PracticeStep = {
  id: 'practice-basic-addition',
  type: 'practice',
  title: 'Basic Addition Practice',
  description: 'Practice basic addition problems using direct addition and heaven bead',
  problemCount: 5,
  maxTerms: 3,
  allowedSkills: {
    ...createBasicSkillSet(),
    basic: {
      directAddition: true,
      heavenBead: true,
      simpleCombinations: false,
    },
  },
  targetSkills: {
    basic: {
      directAddition: true,
      heavenBead: true,
      simpleCombinations: false,
    },
  },
  numberRange: { min: 1, max: 9 },
  sumConstraints: { maxSum: 9 },
}

const advancedPracticeStep: PracticeStep = {
  id: 'practice-five-complements',
  type: 'practice',
  title: 'Five Complements Practice',
  description: 'Practice problems requiring five complement techniques',
  problemCount: 8,
  maxTerms: 4,
  allowedSkills: {
    ...createBasicSkillSet(),
    basic: {
      directAddition: true,
      heavenBead: true,
      simpleCombinations: true,
    },
    fiveComplements: {
      '4=5-1': true,
      '3=5-2': true,
      '2=5-3': false,
      '1=5-4': false,
    },
  },
  targetSkills: {
    fiveComplements: {
      '4=5-1': true,
      '3=5-2': true,
      '2=5-3': false,
      '1=5-4': false,
    },
  },
  numberRange: { min: 1, max: 9 },
  sumConstraints: { maxSum: 15 },
}

// Interactive Problem Generator Demo
function ProblemGeneratorDemo() {
  const [practiceStep, setPracticeStep] = useState<PracticeStep>(defaultPracticeStep)
  const [mode, setMode] = useState<'editor' | 'player'>('editor')
  const [generatedProblems, setGeneratedProblems] = useState<any[]>([])
  const [validationResult, setValidationResult] = useState<any>(null)

  const handleGenerate = () => {
    const problems = generateProblems(practiceStep)
    setGeneratedProblems(problems)

    const validation = validatePracticeStepConfiguration(practiceStep)
    setValidationResult(validation)
  }

  const handlePracticeComplete = (results: any) => {
    console.log('Practice completed:', results)
    alert(`Practice completed! Score: ${results.correctAnswers}/${results.totalProblems}`)
  }

  return (
    <div className={css({ h: '100vh', display: 'flex', flexDirection: 'column' })}>
      {/* Header */}
      <div
        className={css({
          bg: 'white',
          borderBottom: '1px solid',
          borderColor: 'gray.200',
          p: 4,
        })}
      >
        <div
          className={hstack({
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <h1 className={css({ fontSize: '2xl', fontWeight: 'bold' })}>Problem Generator Demo</h1>

          <div className={hstack({ gap: 2 })}>
            <button
              onClick={() => setMode('editor')}
              className={css({
                px: 3,
                py: 2,
                rounded: 'md',
                bg: mode === 'editor' ? 'blue.500' : 'gray.200',
                color: mode === 'editor' ? 'white' : 'gray.700',
                cursor: 'pointer',
              })}
            >
              Editor
            </button>
            <button
              onClick={() => setMode('player')}
              className={css({
                px: 3,
                py: 2,
                rounded: 'md',
                bg: mode === 'player' ? 'blue.500' : 'gray.200',
                color: mode === 'player' ? 'white' : 'gray.700',
                cursor: 'pointer',
              })}
            >
              Player
            </button>
            <button
              onClick={handleGenerate}
              className={css({
                px: 3,
                py: 2,
                rounded: 'md',
                bg: 'green.500',
                color: 'white',
                cursor: 'pointer',
              })}
            >
              Generate Problems
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={css({ flex: 1, display: 'flex' })}>
        {mode === 'editor' ? (
          <div className={css({ w: '100%', display: 'flex' })}>
            {/* Editor */}
            <div className={css({ w: '50%', p: 4, overflowY: 'auto' })}>
              <PracticeStepEditor step={practiceStep} onChange={setPracticeStep} />
            </div>

            {/* Generated Problems Display */}
            <div
              className={css({
                w: '50%',
                p: 4,
                bg: 'gray.50',
                overflowY: 'auto',
              })}
            >
              <h3 className={css({ fontSize: 'lg', fontWeight: 'bold', mb: 4 })}>
                Generated Problems ({generatedProblems.length})
              </h3>

              {validationResult && (
                <div
                  className={css({
                    p: 3,
                    mb: 4,
                    rounded: 'md',
                    bg: validationResult.isValid ? 'green.50' : 'yellow.50',
                    border: '1px solid',
                    borderColor: validationResult.isValid ? 'green.200' : 'yellow.200',
                  })}
                >
                  <h4 className={css({ fontWeight: 'bold', mb: 2 })}>
                    {validationResult.isValid ? '✅ Valid Configuration' : '⚠️ Configuration Issues'}
                  </h4>
                  {validationResult.warnings.map((warning: string, i: number) => (
                    <div key={i} className={css({ fontSize: 'sm', color: 'yellow.700' })}>
                      • {warning}
                    </div>
                  ))}
                </div>
              )}

              <div className={vstack({ gap: 2 })}>
                {generatedProblems.map((problem, _index) => (
                  <div
                    key={problem.id}
                    className={css({
                      p: 3,
                      bg: 'white',
                      rounded: 'md',
                      border: '1px solid',
                      borderColor: 'gray.200',
                    })}
                  >
                    <div
                      className={hstack({
                        justifyContent: 'space-between',
                        mb: 2,
                      })}
                    >
                      <div className={hstack({ gap: 4, alignItems: 'center' })}>
                        <div
                          className={css({
                            textAlign: 'right',
                            fontFamily: 'mono',
                            fontSize: 'sm',
                            bg: 'gray.100',
                            p: 2,
                            rounded: 'sm',
                          })}
                        >
                          {problem.terms.map((term, index) => (
                            <div key={index}>{term}</div>
                          ))}
                          <div
                            className={css({
                              borderTop: '1px solid',
                              borderColor: 'gray.400',
                              pt: 1,
                            })}
                          >
                            {problem.answer}
                          </div>
                        </div>
                        <span className={css({ fontSize: 'sm', color: 'gray.600' })}>
                          = {problem.answer}
                        </span>
                      </div>
                      <span
                        className={css({
                          px: 2,
                          py: 1,
                          rounded: 'sm',
                          fontSize: 'xs',
                          bg:
                            problem.difficulty === 'easy'
                              ? 'green.100'
                              : problem.difficulty === 'medium'
                                ? 'yellow.100'
                                : 'red.100',
                          color:
                            problem.difficulty === 'easy'
                              ? 'green.800'
                              : problem.difficulty === 'medium'
                                ? 'yellow.800'
                                : 'red.800',
                        })}
                      >
                        {problem.difficulty}
                      </span>
                    </div>
                    <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
                      <div>Sequential skills: {problem.skillsUsed.join(', ')}</div>
                      <div className={css({ mt: 1 })}>{problem.explanation}</div>
                    </div>
                  </div>
                ))}
              </div>

              {generatedProblems.length === 0 && (
                <div
                  className={css({
                    textAlign: 'center',
                    py: 8,
                    color: 'gray.500',
                  })}
                >
                  Click "Generate Problems" to see sample problems
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Player */
          <div className={css({ w: '100%' })}>
            <PracticeProblemPlayer
              practiceStep={practiceStep}
              onComplete={handlePracticeComplete}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export const InteractiveDemo: StoryObj = {
  render: () => <ProblemGeneratorDemo />,
}

export const BasicAdditionPractice: StoryObj = {
  render: () => (
    <div className={css({ h: '100vh' })}>
      <PracticeProblemPlayer
        practiceStep={defaultPracticeStep}
        onComplete={(results) => {
          console.log('Practice completed:', results)
          alert(`Practice completed! Score: ${results.correctAnswers}/${results.totalProblems}`)
        }}
      />
    </div>
  ),
}

export const FiveComplementsPractice: StoryObj = {
  render: () => (
    <div className={css({ h: '100vh' })}>
      <PracticeProblemPlayer
        practiceStep={advancedPracticeStep}
        onComplete={(results) => {
          console.log('Practice completed:', results)
          alert(`Practice completed! Score: ${results.correctAnswers}/${results.totalProblems}`)
        }}
      />
    </div>
  ),
}

// Extract component wrapper for hooks
function PracticeStepEditorWrapper() {
  const [step, setStep] = useState<PracticeStep>(defaultPracticeStep)

  return (
    <div className={css({ p: 6, maxW: '800px', mx: 'auto' })}>
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 6 })}>Practice Step Editor</h1>
      <PracticeStepEditor step={step} onChange={setStep} />
    </div>
  )
}

export const PracticeStepEditorStory: StoryObj = {
  render: () => <PracticeStepEditorWrapper />,
}

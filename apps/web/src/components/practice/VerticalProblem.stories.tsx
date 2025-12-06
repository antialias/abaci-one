import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { createBasicSkillSet } from '@/types/tutorial'
import { generateSingleProblem, type ProblemConstraints } from '@/utils/problemGenerator'
import { css } from '../../../styled-system/css'
import { VerticalProblem } from './VerticalProblem'

const meta: Meta<typeof VerticalProblem> = {
  title: 'Practice/VerticalProblem',
  component: VerticalProblem,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof VerticalProblem>

/**
 * Generate a problem using the actual skill-based algorithm
 */
function generateProblem(skillConfig?: {
  basic?: boolean
  fiveComplements?: boolean
  tenComplements?: boolean
}): { terms: number[]; answer: number } {
  const baseSkills = createBasicSkillSet()

  // Enable requested skills
  if (skillConfig?.basic !== false) {
    baseSkills.basic.directAddition = true
    baseSkills.basic.heavenBead = true
    baseSkills.basic.simpleCombinations = true
  }

  if (skillConfig?.fiveComplements) {
    baseSkills.fiveComplements['4=5-1'] = true
    baseSkills.fiveComplements['3=5-2'] = true
    baseSkills.fiveComplements['2=5-3'] = true
    baseSkills.fiveComplements['1=5-4'] = true
  }

  if (skillConfig?.tenComplements) {
    baseSkills.tenComplements['9=10-1'] = true
    baseSkills.tenComplements['8=10-2'] = true
    baseSkills.tenComplements['7=10-3'] = true
    baseSkills.tenComplements['6=10-4'] = true
    baseSkills.tenComplements['5=10-5'] = true
  }

  const constraints: ProblemConstraints = {
    numberRange: { min: 1, max: skillConfig?.tenComplements ? 99 : 9 },
    maxTerms: 4,
    problemCount: 1,
  }

  const problem = generateSingleProblem(constraints, baseSkills)

  if (problem) {
    return { terms: problem.terms, answer: problem.answer }
  }

  // Fallback
  return { terms: [3, 4, 2], answer: 9 }
}

/**
 * Interactive demo allowing input
 */
function InteractiveProblemDemo() {
  const [problem] = useState(() => generateProblem({ basic: true }))
  const [userAnswer, setUserAnswer] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCompleted) return

    if (/^[0-9]$/.test(e.key)) {
      setUserAnswer((prev) => prev + e.key)
    } else if (e.key === 'Backspace') {
      setUserAnswer((prev) => prev.slice(0, -1))
    } else if (e.key === 'Enter' && userAnswer) {
      setIsCompleted(true)
    }
  }

  const handleReset = () => {
    setUserAnswer('')
    setIsCompleted(false)
  }

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem',
      })}
      onKeyDown={handleKeyDown}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Interactive demo needs keyboard focus
      tabIndex={0}
    >
      <VerticalProblem
        terms={problem.terms}
        userAnswer={userAnswer}
        isFocused={!isCompleted}
        isCompleted={isCompleted}
        correctAnswer={problem.answer}
        size="large"
      />

      <div
        className={css({
          fontSize: '0.875rem',
          color: 'gray.500',
          textAlign: 'center',
        })}
      >
        {isCompleted ? (
          <button
            onClick={handleReset}
            className={css({
              padding: '0.5rem 1rem',
              backgroundColor: 'blue.500',
              color: 'white',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
            })}
          >
            Try Again
          </button>
        ) : (
          'Type numbers and press Enter to submit'
        )}
      </div>
    </div>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveProblemDemo />,
}

// Static examples with skill-appropriate problems
const basicProblem = generateProblem({ basic: true })
const fiveComplementProblem = generateProblem({ basic: true, fiveComplements: true })
const tenComplementProblem = generateProblem({
  basic: true,
  fiveComplements: true,
  tenComplements: true,
})

export const BasicAddition: Story = {
  args: {
    terms: basicProblem.terms,
    userAnswer: '',
    isFocused: true,
    isCompleted: false,
    correctAnswer: basicProblem.answer,
    size: 'normal',
  },
}

export const WithFiveComplements: Story = {
  args: {
    terms: fiveComplementProblem.terms,
    userAnswer: '',
    isFocused: true,
    isCompleted: false,
    correctAnswer: fiveComplementProblem.answer,
    size: 'normal',
  },
}

export const WithTenComplements: Story = {
  args: {
    terms: tenComplementProblem.terms,
    userAnswer: '',
    isFocused: true,
    isCompleted: false,
    correctAnswer: tenComplementProblem.answer,
    size: 'large',
  },
}

export const PartialAnswer: Story = {
  args: {
    terms: [5, 3, 2],
    userAnswer: '1',
    isFocused: true,
    isCompleted: false,
    correctAnswer: 10,
    size: 'normal',
  },
}

export const CorrectAnswer: Story = {
  args: {
    terms: [5, 3, 2],
    userAnswer: '10',
    isFocused: false,
    isCompleted: true,
    correctAnswer: 10,
    size: 'normal',
  },
}

export const IncorrectAnswer: Story = {
  args: {
    terms: [5, 3, 2],
    userAnswer: '9',
    isFocused: false,
    isCompleted: true,
    correctAnswer: 10,
    size: 'normal',
  },
}

export const LargeSize: Story = {
  args: {
    terms: [45, 27, 18],
    userAnswer: '90',
    isFocused: false,
    isCompleted: true,
    correctAnswer: 90,
    size: 'large',
  },
}

export const MixedOperations: Story = {
  args: {
    terms: [25, -8, 13],
    userAnswer: '',
    isFocused: true,
    isCompleted: false,
    correctAnswer: 30,
    size: 'normal',
  },
}

/**
 * Gallery showing multiple problems at different states
 */
function ProblemGallery() {
  const problems = [
    generateProblem({ basic: true }),
    generateProblem({ basic: true, fiveComplements: true }),
    generateProblem({ basic: true, fiveComplements: true, tenComplements: true }),
  ]

  return (
    <div
      className={css({
        display: 'grid',
        gridTemplateColumns: 'repeat(3, auto)',
        gap: '2rem',
        padding: '2rem',
      })}
    >
      {problems.map((p, i) => (
        <div key={i} className={css({ textAlign: 'center' })}>
          <div
            className={css({
              fontSize: '0.75rem',
              color: 'gray.500',
              marginBottom: '0.5rem',
            })}
          >
            {i === 0 ? 'Basic' : i === 1 ? 'Five Complements' : 'Ten Complements'}
          </div>
          <VerticalProblem
            terms={p.terms}
            userAnswer=""
            isFocused={i === 1}
            isCompleted={false}
            correctAnswer={p.answer}
            size="normal"
          />
        </div>
      ))}
    </div>
  )
}

export const Gallery: Story = {
  render: () => <ProblemGallery />,
}

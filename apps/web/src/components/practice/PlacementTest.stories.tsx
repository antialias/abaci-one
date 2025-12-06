import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { PlacementTest } from './PlacementTest'
import { THRESHOLD_PRESETS } from '@/lib/curriculum/placement-test'

const meta: Meta<typeof PlacementTest> = {
  title: 'Practice/PlacementTest',
  component: PlacementTest,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof PlacementTest>

/**
 * Wrapper for consistent styling
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={css({
        backgroundColor: 'gray.100',
        minHeight: '100vh',
        padding: '1rem',
      })}
    >
      {children}
    </div>
  )
}

/**
 * Interactive demo with complete flow
 */
function InteractiveDemo({ studentName }: { studentName: string }) {
  const [results, setResults] = useState<{
    masteredSkillIds: string[]
    practicingSkillIds: string[]
    totalProblems: number
    totalCorrect: number
  } | null>(null)
  const [cancelled, setCancelled] = useState(false)

  const handleComplete = (data: {
    masteredSkillIds: string[]
    practicingSkillIds: string[]
    totalProblems: number
    totalCorrect: number
  }) => {
    console.log('Test complete:', data)
    setResults(data)
  }

  const handleCancel = () => {
    console.log('Test cancelled')
    setCancelled(true)
  }

  if (cancelled) {
    return (
      <TestWrapper>
        <div className={css({ textAlign: 'center', py: '8' })}>
          <p className={css({ fontSize: 'xl', color: 'gray.600', mb: '4' })}>
            Placement test was cancelled.
          </p>
          <button
            onClick={() => setCancelled(false)}
            className={css({
              px: '4',
              py: '2',
              bg: 'blue.500',
              color: 'white',
              borderRadius: 'md',
              border: 'none',
              cursor: 'pointer',
            })}
          >
            Restart Test
          </button>
        </div>
      </TestWrapper>
    )
  }

  if (results) {
    return (
      <TestWrapper>
        <div
          className={css({
            maxWidth: '500px',
            margin: '0 auto',
            py: '8',
            textAlign: 'center',
          })}
        >
          <h2 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: '4' })}>Results Saved!</h2>
          <div
            className={css({
              bg: 'white',
              p: '4',
              borderRadius: 'lg',
              boxShadow: 'md',
              mb: '4',
            })}
          >
            <p>
              <strong>Mastered:</strong> {results.masteredSkillIds.length} skills
            </p>
            <p>
              <strong>Practicing:</strong> {results.practicingSkillIds.length} skills
            </p>
            <p>
              <strong>Accuracy:</strong>{' '}
              {Math.round((results.totalCorrect / results.totalProblems) * 100)}%
            </p>
          </div>
          <button
            onClick={() => setResults(null)}
            className={css({
              px: '4',
              py: '2',
              bg: 'blue.500',
              color: 'white',
              borderRadius: 'md',
              border: 'none',
              cursor: 'pointer',
            })}
          >
            Run Another Test
          </button>
        </div>
      </TestWrapper>
    )
  }

  return (
    <TestWrapper>
      <PlacementTest
        studentName={studentName}
        playerId="player-123"
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </TestWrapper>
  )
}

export const Default: Story = {
  render: () => <InteractiveDemo studentName="Sonia" />,
}

export const DifferentStudent: Story = {
  render: () => <InteractiveDemo studentName="Marcus" />,
}

export const QuickPreset: Story = {
  render: () => (
    <TestWrapper>
      <PlacementTest
        studentName="Quick Test Student"
        playerId="player-123"
        onComplete={(r) => console.log('Complete:', r)}
        onCancel={() => console.log('Cancel')}
        initialThresholds={THRESHOLD_PRESETS.quick.thresholds}
      />
    </TestWrapper>
  ),
}

export const ThoroughPreset: Story = {
  render: () => (
    <TestWrapper>
      <PlacementTest
        studentName="Thorough Test Student"
        playerId="player-123"
        onComplete={(r) => console.log('Complete:', r)}
        onCancel={() => console.log('Cancel')}
        initialThresholds={THRESHOLD_PRESETS.thorough.thresholds}
      />
    </TestWrapper>
  ),
}

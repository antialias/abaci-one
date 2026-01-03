import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import { css } from '../../../styled-system/css'
import { PracticeHelpOverlay } from './PracticeHelpOverlay'

const meta: Meta<typeof PracticeHelpOverlay> = {
  title: 'Practice/PracticeHelpOverlay',
  component: PracticeHelpOverlay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof PracticeHelpOverlay>

/**
 * Interactive demo showing the help overlay with time-based escalation
 */
function InteractiveDemo() {
  const [currentValue, setCurrentValue] = useState(13)
  const [targetValue] = useState(33) // 13 + 20
  const [completed, setCompleted] = useState(false)

  const handleTargetReached = useCallback(() => {
    setCompleted(true)
    console.log('Target reached!')
    // After celebration, could reset or advance
    setTimeout(() => {
      setCompleted(false)
      setCurrentValue(33)
    }, 1000)
  }, [])

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem',
        maxWidth: '500px',
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
            marginBottom: '0.5rem',
          })}
        >
          Progressive Help Overlay Demo
        </h3>
        <p className={css({ fontSize: '0.875rem', color: 'gray.500' })}>
          Just the abacus with arrows. Bead tooltip appears after 3s (debug timing).
        </p>
        <p className={css({ fontSize: '0.75rem', color: 'gray.400' })}>
          Tooltip uses same system as TutorialPlayer.
        </p>
      </div>

      {/* Simulating how it appears in ActiveSession - with "Adding: +20" badge above */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        })}
      >
        <div
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.25rem 0.75rem',
            backgroundColor: 'purple.100',
            borderRadius: '20px',
            fontSize: '0.875rem',
            fontWeight: 'bold',
            color: 'purple.700',
          })}
        >
          <span>Adding:</span>
          <span className={css({ fontFamily: 'monospace', fontSize: '1rem' })}>+20</span>
        </div>

        {!completed && (
          <PracticeHelpOverlay
            currentValue={currentValue}
            targetValue={targetValue}
            columns={3}
            onTargetReached={handleTargetReached}
            debugTiming={true}
          />
        )}
      </div>

      {completed && (
        <div
          className={css({
            padding: '2rem',
            backgroundColor: 'green.100',
            borderRadius: '12px',
            textAlign: 'center',
          })}
        >
          <span className={css({ fontSize: '2rem' })}>🎉</span>
          <p
            className={css({
              fontSize: '1rem',
              color: 'green.700',
              fontWeight: 'bold',
            })}
          >
            Target Reached!
          </p>
        </div>
      )}
    </div>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
}

/**
 * Shows just the abacus overlay without any surrounding UI
 */
function MinimalDemo() {
  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        padding: '2rem',
      })}
    >
      <div className={css({ textAlign: 'center' })}>
        <h3
          className={css({
            fontSize: '0.875rem',
            fontWeight: 'bold',
            color: 'gray.500',
            marginBottom: '0.5rem',
          })}
        >
          Minimal: Just the Abacus
        </h3>
        <PracticeHelpOverlay currentValue={0} targetValue={23} columns={3} debugTiming={true} />
      </div>
    </div>
  )
}

export const Minimal: Story = {
  render: () => <MinimalDemo />,
}

// Static examples
export const Simple: Story = {
  args: {
    currentValue: 0,
    targetValue: 5,
    columns: 3,
    debugTiming: true,
  },
}

export const TwoDigit: Story = {
  args: {
    currentValue: 23,
    targetValue: 68,
    columns: 3,
    debugTiming: true,
  },
}

export const ThreeDigit: Story = {
  args: {
    currentValue: 123,
    targetValue: 456,
    columns: 3,
    debugTiming: true,
  },
}

export const ProductionTiming: Story = {
  args: {
    currentValue: 13,
    targetValue: 33,
    columns: 3,
    debugTiming: false, // Use production timing (10s for tooltip)
  },
  parameters: {
    docs: {
      description: {
        story: 'Uses production timing: Bead tooltip at 10s',
      },
    },
  },
}

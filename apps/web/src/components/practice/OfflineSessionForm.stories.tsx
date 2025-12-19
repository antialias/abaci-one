import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { OfflineSessionForm, type OfflineSessionData } from './OfflineSessionForm'

const meta: Meta<typeof OfflineSessionForm> = {
  title: 'Practice/OfflineSessionForm',
  component: OfflineSessionForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof OfflineSessionForm>

/**
 * Interactive demo with open/close functionality
 */
function InteractiveDemo({ studentName }: { studentName: string }) {
  const [isOpen, setIsOpen] = useState(true)
  const [lastSession, setLastSession] = useState<OfflineSessionData | null>(null)

  const handleSubmit = async (data: OfflineSessionData) => {
    console.log('Recording session:', data)
    setLastSession(data)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return (
    <div>
      <OfflineSessionForm
        open={isOpen}
        onClose={() => setIsOpen(false)}
        studentName={studentName}
        playerId="player-123"
        onSubmit={handleSubmit}
      />
      {!isOpen && (
        <div className={css({ textAlign: 'center', maxWidth: '400px' })}>
          {lastSession && (
            <div
              className={css({
                mb: '4',
                p: '4',
                bg: 'green.50',
                borderRadius: 'lg',
                border: '1px solid',
                borderColor: 'green.200',
              })}
            >
              <p
                className={css({
                  fontWeight: 'bold',
                  color: 'green.700',
                  mb: '2',
                })}
              >
                Session Recorded!
              </p>
              <ul
                className={css({
                  fontSize: 'sm',
                  color: 'green.600',
                  textAlign: 'left',
                  listStyle: 'none',
                })}
              >
                <li>Date: {lastSession.date}</li>
                <li>Problems: {lastSession.problemCount}</li>
                <li>Accuracy: {Math.round(lastSession.accuracy * 100)}%</li>
                <li>Focus: {lastSession.focusSkill}</li>
                {lastSession.notes && <li>Notes: {lastSession.notes}</li>}
              </ul>
            </div>
          )}
          <button
            onClick={() => setIsOpen(true)}
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
            Record Another Session
          </button>
        </div>
      )}
    </div>
  )
}

export const Default: Story = {
  render: () => <InteractiveDemo studentName="Sonia" />,
}

export const DifferentStudent: Story = {
  render: () => <InteractiveDemo studentName="Marcus" />,
}

/**
 * Shows the form with error display for validation
 */
function ValidationDemo() {
  const [isOpen, setIsOpen] = useState(true)

  const handleSubmit = async (data: OfflineSessionData) => {
    console.log('Would submit:', data)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return (
    <div>
      <OfflineSessionForm
        open={isOpen}
        onClose={() => setIsOpen(false)}
        studentName="Test Student"
        playerId="player-123"
        onSubmit={handleSubmit}
      />
      {!isOpen && (
        <div className={css({ textAlign: 'center' })}>
          <p className={css({ mb: '3', color: 'gray.600' })}>
            Try entering invalid values to see validation
          </p>
          <button
            onClick={() => setIsOpen(true)}
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
            Reopen Form
          </button>
        </div>
      )}
    </div>
  )
}

export const WithValidation: Story = {
  render: () => <ValidationDemo />,
}

/**
 * Shows the form submission flow
 */
function SubmittingDemo() {
  const [isOpen, setIsOpen] = useState(true)

  const handleSubmit = async (data: OfflineSessionData) => {
    console.log('Submitting...', data)
    // Simulate slow API
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  return (
    <OfflineSessionForm
      open={isOpen}
      onClose={() => setIsOpen(false)}
      studentName="Slow API Student"
      playerId="player-123"
      onSubmit={handleSubmit}
    />
  )
}

export const SlowSubmission: Story = {
  render: () => <SubmittingDemo />,
}

import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { NumericKeypad } from './NumericKeypad'

const meta: Meta<typeof NumericKeypad> = {
  title: 'Practice/NumericKeypad',
  component: NumericKeypad,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof NumericKeypad>

/**
 * Interactive demo showing the keypad in action
 */
function InteractiveKeypadDemo() {
  const [value, setValue] = useState('')
  const [submissions, setSubmissions] = useState<string[]>([])

  const handleDigit = (digit: string) => {
    setValue((prev) => prev + digit)
  }

  const handleBackspace = () => {
    setValue((prev) => prev.slice(0, -1))
  }

  const handleSubmit = () => {
    if (value) {
      setSubmissions((prev) => [...prev, value])
      setValue('')
    }
  }

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '2rem',
        backgroundColor: 'gray.50',
        borderRadius: '12px',
        minWidth: '350px',
      })}
    >
      {/* Current input display */}
      <div
        className={css({
          fontSize: '2rem',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          minHeight: '3rem',
          padding: '0.5rem 1rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '2px solid',
          borderColor: 'gray.300',
          minWidth: '200px',
          textAlign: 'center',
        })}
      >
        {value || <span className={css({ color: 'gray.400' })}>Type a number</span>}
      </div>

      {/* Keypad */}
      <NumericKeypad
        onDigit={handleDigit}
        onBackspace={handleBackspace}
        onSubmit={handleSubmit}
        currentValue={value}
      />

      {/* Submission history */}
      {submissions.length > 0 && (
        <div
          className={css({
            width: '100%',
            padding: '1rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'gray.200',
          })}
        >
          <div
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: 'gray.600',
              marginBottom: '0.5rem',
            })}
          >
            Submitted Values:
          </div>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            })}
          >
            {submissions.map((sub, i) => (
              <span
                key={i}
                className={css({
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'green.100',
                  color: 'green.700',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                })}
              >
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveKeypadDemo />,
}

export const Default: Story = {
  args: {
    onDigit: (digit) => console.log('Digit:', digit),
    onBackspace: () => console.log('Backspace'),
    onSubmit: () => console.log('Submit'),
    currentValue: '',
  },
}

export const WithValue: Story = {
  args: {
    onDigit: (digit) => console.log('Digit:', digit),
    onBackspace: () => console.log('Backspace'),
    onSubmit: () => console.log('Submit'),
    currentValue: '42',
  },
}

export const Disabled: Story = {
  args: {
    onDigit: (digit) => console.log('Digit:', digit),
    onBackspace: () => console.log('Backspace'),
    onSubmit: () => console.log('Submit'),
    currentValue: '123',
    disabled: true,
  },
}

import type { Meta, StoryObj } from '@storybook/react'
import { css } from '../../../styled-system/css'
import { PerfectSessionCelebration } from './PerfectSessionCelebration'

// ============================================================================
// Meta
// ============================================================================

const meta: Meta<typeof PerfectSessionCelebration> = {
  title: 'Practice/PerfectSessionCelebration',
  component: PerfectSessionCelebration,
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          maxWidth: '500px',
          margin: '0 auto',
        })}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof PerfectSessionCelebration>

// ============================================================================
// Stories
// ============================================================================

export const Default: Story = {
  args: {
    studentName: 'Sonia',
  },
}

export const LongName: Story = {
  args: {
    studentName: 'Alexandria Constantinopolous-McGillicuddy',
  },
}

// ============================================================================
// Dark Mode
// ============================================================================

export const DarkMode: Story = {
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          maxWidth: '500px',
          margin: '0 auto',
          backgroundColor: 'gray.900',
          borderRadius: '12px',
        })}
        data-theme="dark"
      >
        <Story />
      </div>
    ),
  ],
  args: {
    studentName: 'Sonia',
  },
}

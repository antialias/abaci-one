import type { Meta, StoryObj } from '@storybook/react'
import { SimpleLetterKeyboard } from './SimpleLetterKeyboard'

const meta: Meta<typeof SimpleLetterKeyboard> = {
  title: 'Arcade/KnowYourWorld/SimpleLetterKeyboard',
  component: SimpleLetterKeyboard,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', maxWidth: '500px', padding: '20px' }}>
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SimpleLetterKeyboard>

// Basic stories - use forceShow to display on desktop
export const Uppercase: Story = {
  args: {
    uppercase: true,
    isDark: false,
    forceShow: true,
    onKeyPress: (letter) => console.log('Pressed:', letter),
  },
}

export const Lowercase: Story = {
  args: {
    uppercase: false,
    isDark: false,
    forceShow: true,
    onKeyPress: (letter) => console.log('Pressed:', letter),
  },
}

export const DarkModeUppercase: Story = {
  args: {
    uppercase: true,
    isDark: true,
    forceShow: true,
    onKeyPress: (letter) => console.log('Pressed:', letter),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          backgroundColor: '#1e293b',
          padding: '40px',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '500px',
        }}
      >
        <Story />
      </div>
    ),
  ],
}

export const DarkModeLowercase: Story = {
  args: {
    uppercase: false,
    isDark: true,
    forceShow: true,
    onKeyPress: (letter) => console.log('Pressed:', letter),
  },
  decorators: [
    (Story) => (
      <div
        style={{
          backgroundColor: '#1e293b',
          padding: '40px',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '500px',
        }}
      >
        <Story />
      </div>
    ),
  ],
}

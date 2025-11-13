import type { Preview } from '@storybook/nextjs'
import React from 'react'
import { ThemeProvider } from '../src/contexts/ThemeContext'
import '../styled-system/styles.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
}

export default preview

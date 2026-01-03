import { AbacusDisplayProvider } from '@soroban/abacus-react'
import type { Preview } from '@storybook/nextjs'
import { NextIntlClientProvider } from 'next-intl'
import React from 'react'
import { ThemeProvider } from '../src/contexts/ThemeContext'
import tutorialEn from '../src/i18n/locales/tutorial/en.json'
import '../styled-system/styles.css'

// Merge messages for Storybook (add more as needed)
const messages = {
  tutorial: tutorialEn.tutorial,
}

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
        <NextIntlClientProvider locale="en" messages={messages}>
          <AbacusDisplayProvider>
            <Story />
          </AbacusDisplayProvider>
        </NextIntlClientProvider>
      </ThemeProvider>
    ),
  ],
}

export default preview

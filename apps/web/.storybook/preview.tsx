import { AbacusDisplayProvider } from "@soroban/abacus-react";
import type { Preview } from "@storybook/nextjs";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import tutorialEn from "../src/i18n/locales/tutorial/en.json";
// Panda CSS uses file-based chunking - import base styles + tokens
import "../styled-system/reset.css";
import "../styled-system/global.css";
// Note: utility styles are in chunks/ directory and loaded per-file by Next.js
// For Storybook, we need to import the CSS directly in globals.css
import "../src/app/globals.css";

// Merge messages for Storybook (add more as needed)
const messages = {
  tutorial: tutorialEn.tutorial,
};

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
};

export default preview;

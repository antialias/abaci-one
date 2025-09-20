import type { StorybookConfig } from '@storybook/nextjs';

import { join, dirname } from "path"

/**
* This function is used to resolve the absolute path of a package.
* It is needed in projects that use Yarn PnP or are set up within a monorepo.
*/
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')))
}
const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-onboarding')
  ],
  "framework": {
    "name": getAbsolutePath('@storybook/nextjs'),
    "options": {
      "nextConfigPath": "../next.config.js"
    }
  },
  "staticDirs": [
    "../public"
  ],
  "typescript": {
    "reactDocgen": "react-docgen-typescript"
  },
  "webpackFinal": async (config) => {
    // Handle PandaCSS styled-system imports
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Map styled-system imports to the actual directory
        '../../styled-system/css': join(__dirname, '../styled-system/css/index.mjs'),
        '../../styled-system/patterns': join(__dirname, '../styled-system/patterns/index.mjs'),
        '../styled-system/css': join(__dirname, '../styled-system/css/index.mjs'),
        '../styled-system/patterns': join(__dirname, '../styled-system/patterns/index.mjs')
      }
    }
    return config
  }
};
export default config;
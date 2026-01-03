import type { StorybookConfig } from "@storybook/nextjs";

import { dirname, join } from "path";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")));
}
const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/addon-onboarding"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/nextjs"),
    options: {
      nextConfigPath: "../next.config.js",
    },
  },
  staticDirs: ["../public"],
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  webpackFinal: async (config) => {
    // Handle PandaCSS styled-system imports
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Map @styled/* imports (from tsconfig paths)
        "@styled/css": join(__dirname, "../styled-system/css/index.mjs"),
        "@styled/patterns": join(
          __dirname,
          "../styled-system/patterns/index.mjs",
        ),
        "@styled/jsx": join(__dirname, "../styled-system/jsx/index.mjs"),
        "@styled/recipes": join(
          __dirname,
          "../styled-system/recipes/index.mjs",
        ),
        // Map relative styled-system imports
        "../../styled-system/css": join(
          __dirname,
          "../styled-system/css/index.mjs",
        ),
        "../../styled-system/patterns": join(
          __dirname,
          "../styled-system/patterns/index.mjs",
        ),
        "../styled-system/css": join(
          __dirname,
          "../styled-system/css/index.mjs",
        ),
        "../styled-system/patterns": join(
          __dirname,
          "../styled-system/patterns/index.mjs",
        ),
      };
    }
    return config;
  },
};
export default config;

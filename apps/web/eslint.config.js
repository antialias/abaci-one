// Minimal ESLint flat config ONLY for react-hooks rules

import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

const config = [
  {
    ignores: [
      "dist",
      ".next",
      "coverage",
      "node_modules",
      "styled-system",
      "storybook-static",
    ],
  },
  {
    files: ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        React: "readonly",
        JSX: "readonly",
        console: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        global: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default config;

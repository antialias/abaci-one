import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      description: {
        component: "Interactive Soroban (Japanese Abacus) Components",
      },
    },
    layout: "centered",
  },
  argTypes: {
    value: {
      control: { type: "number", min: 0, max: 99999 },
      description: "The numeric value to display on the abacus",
    },
    columns: {
      control: { type: "select" },
      options: ["auto", 1, 2, 3, 4, 5],
      description: "Number of columns or auto-calculate based on value",
    },
    beadShape: {
      control: { type: "select" },
      options: ["diamond", "square", "circle"],
      description: "Shape of the beads",
    },
    colorScheme: {
      control: { type: "select" },
      options: ["monochrome", "place-value", "alternating", "heaven-earth"],
      description: "Color scheme strategy",
    },
    colorPalette: {
      control: { type: "select" },
      options: ["default", "colorblind", "mnemonic", "grayscale", "nature"],
      description: "Color palette for place values",
    },
    scaleFactor: {
      control: { type: "range", min: 0.5, max: 3, step: 0.1 },
      description: "Scale multiplier for component size",
    },
    animated: {
      control: { type: "boolean" },
      description: "Enable react-spring animations",
    },
    draggable: {
      control: { type: "boolean" },
      description: "Enable drag interactions with @use-gesture/react",
    },
    hideInactiveBeads: {
      control: { type: "boolean" },
      description: "Hide inactive beads completely",
    },
    showEmptyColumns: {
      control: { type: "boolean" },
      description: "Show leading zero columns",
    },
  },
};

export default preview;

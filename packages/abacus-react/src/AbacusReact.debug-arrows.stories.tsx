import type { Meta, StoryObj } from "@storybook/react";
import { AbacusReact, StepBeadHighlight } from "./AbacusReact";
import React from "react";

const meta: Meta<typeof AbacusReact> = {
  title: "Debug/Arrow Positioning",
  component: AbacusReact,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
# Arrow Positioning Debug

Simple stories to debug arrow centering issues.
        `,
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof AbacusReact>;

// Single earth bead with up arrow - minimal test case
export const SingleEarthBeadUp: Story = {
  args: {
    value: 0,
    columns: 1,
    scaleFactor: 4, // Large scale to see details
    interactive: false,
    animated: false,
    colorScheme: "place-value",
    stepBeadHighlights: [
      {
        placeValue: 0,
        beadType: "earth",
        position: 0,
        stepIndex: 0,
        direction: "activate",
        order: 0,
      },
    ],
    currentStep: 0,
    showDirectionIndicators: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Single Earth Bead with Up Arrow**

- Value: 0 (no beads active)
- Shows green up arrow on first earth bead
- Large scale factor for debugging
- Should be centered on the bead
        `,
      },
    },
  },
};

// Single heaven bead with down arrow
export const SingleHeavenBeadDown: Story = {
  args: {
    value: 0,
    columns: 1,
    scaleFactor: 4,
    interactive: false,
    animated: false,
    colorScheme: "place-value",
    stepBeadHighlights: [
      {
        placeValue: 0,
        beadType: "heaven",
        stepIndex: 0,
        direction: "activate",
        order: 0,
      },
    ],
    currentStep: 0,
    showDirectionIndicators: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Single Heaven Bead with Down Arrow**

- Value: 0 (no beads active)
- Shows red down arrow on heaven bead
- Large scale factor for debugging
- Should be centered on the bead
        `,
      },
    },
  },
};

// Active earth bead with down arrow (deactivate)
export const ActiveEarthBeadDown: Story = {
  args: {
    value: 1,
    columns: 1,
    scaleFactor: 4,
    interactive: false,
    animated: false,
    colorScheme: "place-value",
    stepBeadHighlights: [
      {
        placeValue: 0,
        beadType: "earth",
        position: 0,
        stepIndex: 0,
        direction: "deactivate",
        order: 0,
      },
    ],
    currentStep: 0,
    showDirectionIndicators: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Active Earth Bead with Down Arrow**

- Value: 1 (first earth bead active)
- Shows red down arrow for deactivation
- Large scale factor for debugging
- Should be centered on the active bead
        `,
      },
    },
  },
};

// Active heaven bead with up arrow (deactivate)
export const ActiveHeavenBeadUp: Story = {
  args: {
    value: 5,
    columns: 1,
    scaleFactor: 4,
    interactive: false,
    animated: false,
    colorScheme: "place-value",
    stepBeadHighlights: [
      {
        placeValue: 0,
        beadType: "heaven",
        stepIndex: 0,
        direction: "deactivate",
        order: 0,
      },
    ],
    currentStep: 0,
    showDirectionIndicators: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Active Heaven Bead with Up Arrow**

- Value: 5 (heaven bead active)
- Shows green up arrow for deactivation
- Large scale factor for debugging
- Should be centered on the active bead
        `,
      },
    },
  },
};

// Multiple arrows for comparison
export const MultipleArrows: Story = {
  args: {
    value: 0,
    columns: 1,
    scaleFactor: 3,
    interactive: false,
    animated: false,
    colorScheme: "place-value",
    stepBeadHighlights: [
      {
        placeValue: 0,
        beadType: "heaven",
        stepIndex: 0,
        direction: "activate",
        order: 0,
      },
      {
        placeValue: 0,
        beadType: "earth",
        position: 0,
        stepIndex: 0,
        direction: "activate",
        order: 1,
      },
      {
        placeValue: 0,
        beadType: "earth",
        position: 1,
        stepIndex: 0,
        direction: "activate",
        order: 2,
      },
    ],
    currentStep: 0,
    showDirectionIndicators: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Multiple Arrows for Comparison**

- Shows arrows on heaven bead and first two earth beads
- All should point in correct directions
- All should be centered on their respective beads
- Helps identify if positioning is consistent across bead types
        `,
      },
    },
  },
};

// Raw SVG test - just arrows without beads
export const RawArrowTest: Story = {
  render: () => {
    return (
      <div style={{ textAlign: "center", padding: "20px" }}>
        <h3>Raw SVG Arrow Test</h3>
        <svg width="200" height="200" style={{ border: "1px solid #ccc" }}>
          {/* Grid lines for reference */}
          <line
            x1="0"
            y1="100"
            x2="200"
            y2="100"
            stroke="#eee"
            strokeWidth="1"
          />
          <line
            x1="100"
            y1="0"
            x2="100"
            y2="200"
            stroke="#eee"
            strokeWidth="1"
          />

          {/* Center point */}
          <circle cx="100" cy="100" r="2" fill="black" />

          {/* Up arrow at center */}
          <g transform="translate(100, 100)">
            <polygon
              points="-10,5 10,5 0,-10"
              fill="rgba(0, 150, 0, 0.8)"
              stroke="rgba(0, 100, 0, 1)"
              strokeWidth="1.5"
            />
          </g>

          {/* Text label */}
          <text x="100" y="180" textAnchor="middle" fontSize="12">
            Up Arrow (should be centered at intersection)
          </text>
        </svg>

        <svg
          width="200"
          height="200"
          style={{ border: "1px solid #ccc", marginLeft: "20px" }}
        >
          {/* Grid lines for reference */}
          <line
            x1="0"
            y1="100"
            x2="200"
            y2="100"
            stroke="#eee"
            strokeWidth="1"
          />
          <line
            x1="100"
            y1="0"
            x2="100"
            y2="200"
            stroke="#eee"
            strokeWidth="1"
          />

          {/* Center point */}
          <circle cx="100" cy="100" r="2" fill="black" />

          {/* Down arrow at center */}
          <g transform="translate(100, 100)">
            <polygon
              points="-10,-10 10,-10 0,10"
              fill="rgba(200, 0, 0, 0.8)"
              stroke="rgba(150, 0, 0, 1)"
              strokeWidth="1.5"
            />
          </g>

          {/* Text label */}
          <text x="100" y="180" textAnchor="middle" fontSize="12">
            Down Arrow (should be centered at intersection)
          </text>
        </svg>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
**Raw SVG Arrow Test**

Pure SVG arrows to verify our arrow shapes and positioning work correctly.
The arrows should be perfectly centered at the grid intersection.
        `,
      },
    },
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import { AbacusReact, StepBeadHighlight } from "./AbacusReact";
import React, { useState } from "react";

const meta: Meta<typeof AbacusReact> = {
  title: "Soroban/AbacusReact/Direction Arrows",
  component: AbacusReact,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
# Direction Arrows Feature

Progressive instruction system with direction indicators for tutorial guidance.

## Features

- 🎯 **Step-based highlighting** - Show beads for current instruction step only
- ⬆️ **Direction arrows** - Visual indicators showing which direction to move beads
- 🔄 **Progressive revelation** - Steps advance as user follows instructions
- 🎨 **Correct movement logic** - Heaven beads activate down, earth beads activate up

## Arrow Logic

- **Earth beads**: 'activate' → ⬆️ (push up), 'deactivate' → ⬇️ (release down)
- **Heaven beads**: 'activate' → ⬇️ (pull down), 'deactivate' → ⬆️ (release up)
        `,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    currentStep: {
      control: { type: "number", min: 0, max: 5 },
      description: "Current step index to highlight",
    },
    showDirectionIndicators: {
      control: { type: "boolean" },
      description: "Show direction arrows on beads",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AbacusReact>;

// Helper function to create step bead highlights for different scenarios
const createStepBeads = (
  scenario:
    | "earth-activate"
    | "heaven-activate"
    | "multi-step"
    | "heaven-earth-combo",
): StepBeadHighlight[] => {
  switch (scenario) {
    case "earth-activate":
      return [
        {
          placeValue: 0,
          beadType: "earth",
          position: 0,
          stepIndex: 0,
          direction: "activate",
          order: 0,
        },
      ];

    case "heaven-activate":
      return [
        {
          placeValue: 0,
          beadType: "heaven",
          stepIndex: 0,
          direction: "activate",
          order: 0,
        },
      ];

    case "multi-step":
      return [
        // Step 0: Add heaven bead (5)
        {
          placeValue: 0,
          beadType: "heaven",
          stepIndex: 0,
          direction: "activate",
          order: 0,
        },
        // Step 1: Remove 2 earth beads (subtract 2)
        {
          placeValue: 0,
          beadType: "earth",
          position: 0,
          stepIndex: 1,
          direction: "deactivate",
          order: 0,
        },
        {
          placeValue: 0,
          beadType: "earth",
          position: 1,
          stepIndex: 1,
          direction: "deactivate",
          order: 1,
        },
      ];

    case "heaven-earth-combo":
      return [
        // Step 0: Multiple beads in same step
        {
          placeValue: 1,
          beadType: "earth",
          position: 0,
          stepIndex: 0,
          direction: "activate",
          order: 0,
        },
        {
          placeValue: 0,
          beadType: "heaven",
          stepIndex: 0,
          direction: "deactivate",
          order: 1,
        },
        {
          placeValue: 0,
          beadType: "earth",
          position: 0,
          stepIndex: 0,
          direction: "deactivate",
          order: 2,
        },
      ];

    default:
      return [];
  }
};

export const EarthBeadActivate: Story = {
  args: {
    value: 0,
    columns: 1,
    scaleFactor: 3,
    interactive: true,
    animated: true,
    colorScheme: "place-value",
    colorPalette: "default",
    stepBeadHighlights: createStepBeads("earth-activate"),
    currentStep: 0,
    showDirectionIndicators: true,
    onValueChange: action("value-changed"),
  },
  parameters: {
    docs: {
      description: {
        story: `
**Earth Bead Activation (0 + 1)**

- Shows green up arrow on first earth bead
- Earth beads activate by moving UP
- Click the highlighted bead to see the value change to 1
        `,
      },
    },
  },
};

export const HeavenBeadActivate: Story = {
  args: {
    value: 0,
    columns: 1,
    scaleFactor: 3,
    interactive: true,
    animated: true,
    colorScheme: "place-value",
    stepBeadHighlights: createStepBeads("heaven-activate"),
    currentStep: 0,
    showDirectionIndicators: true,
    onValueChange: action("value-changed"),
  },
  parameters: {
    docs: {
      description: {
        story: `
**Heaven Bead Activation (0 + 5)**

- Shows red down arrow on heaven bead
- Heaven beads activate by moving DOWN
- Click the highlighted bead to see the value change to 5
        `,
      },
    },
  },
};

export const MultiStepSequence: Story = {
  args: {
    value: 2,
    columns: 1,
    scaleFactor: 3,
    interactive: true,
    animated: true,
    colorScheme: "place-value",
    stepBeadHighlights: createStepBeads("multi-step"),
    currentStep: 0,
    showDirectionIndicators: true,
    onValueChange: action("value-changed"),
  },
  parameters: {
    docs: {
      description: {
        story: `
**Multi-Step Complement (2 + 3 = 5)**

Step progression using five complement: 3 = 5 - 2

**Step 0**: Red down arrow on heaven bead (add 5)
**Step 1**: Red down arrows on earth beads (remove 2)

Use the currentStep control to see different steps highlighted.
        `,
      },
    },
  },
};

export const ComplexOperation: Story = {
  args: {
    value: 7,
    columns: 2,
    scaleFactor: 2.5,
    interactive: true,
    animated: true,
    colorScheme: "place-value",
    stepBeadHighlights: createStepBeads("heaven-earth-combo"),
    currentStep: 0,
    showDirectionIndicators: true,
    onValueChange: action("value-changed"),
  },
  parameters: {
    docs: {
      description: {
        story: `
**Complex Multi-Column Operation**

Shows multiple beads across different columns and types:
- Green up arrow on tens earth bead (activate)
- Red up arrow on ones heaven bead (deactivate)
- Red down arrow on ones earth bead (deactivate)

All beads are part of step 0, showing simultaneous actions.
        `,
      },
    },
  },
};

// Interactive story to demonstrate step progression
export const InteractiveStepProgression: Story = {
  render: (args) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [value, setValue] = useState(2);

    const stepBeads = createStepBeads("multi-step");
    const maxSteps = Math.max(...stepBeads.map((bead) => bead.stepIndex)) + 1;

    const handleValueChange = (newValue: number) => {
      setValue(newValue);
      action("value-changed")(newValue);

      // Auto-advance step when value changes (simple demo logic)
      if (currentStep < maxSteps - 1) {
        setTimeout(() => setCurrentStep((prev) => prev + 1), 500);
      }
    };

    const resetDemo = () => {
      setValue(2);
      setCurrentStep(0);
    };

    return (
      <div style={{ textAlign: "center" }}>
        <AbacusReact
          {...args}
          value={value}
          currentStep={currentStep}
          stepBeadHighlights={stepBeads}
          onValueChange={handleValueChange}
        />
        <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
          <p>
            <strong>
              Step {currentStep + 1} of {maxSteps}
            </strong>
          </p>
          <p>Value: {value}</p>
          <button
            onClick={resetDemo}
            style={{
              padding: "8px 16px",
              marginTop: "10px",
              backgroundColor: "#4A90E2",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reset Demo
          </button>
        </div>
      </div>
    );
  },
  args: {
    columns: 1,
    scaleFactor: 3,
    interactive: true,
    animated: true,
    colorScheme: "place-value",
    showDirectionIndicators: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
**Interactive Step Progression Demo**

Demonstrates automatic step advancement:
1. Start with value 2
2. Click the heaven bead (red down arrow) to add 5 → value becomes 7
3. Step automatically advances to show earth bead deactivation arrows
4. Click earth beads to remove 2 → final value becomes 5

This simulates the tutorial experience where steps progress as users follow instructions.
        `,
      },
    },
  },
};

// Static showcase of all arrow types
export const AllArrowTypes: Story = {
  render: () => {
    const earthActivate: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: "earth",
        position: 0,
        stepIndex: 0,
        direction: "activate",
      },
    ];

    const earthDeactivate: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: "earth",
        position: 0,
        stepIndex: 0,
        direction: "deactivate",
      },
    ];

    const heavenActivate: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: "heaven",
        stepIndex: 0,
        direction: "activate",
      },
    ];

    const heavenDeactivate: StepBeadHighlight[] = [
      {
        placeValue: 0,
        beadType: "heaven",
        stepIndex: 0,
        direction: "deactivate",
      },
    ];

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "20px",
          textAlign: "center",
        }}
      >
        <div>
          <h4>Earth Activate (⬆️)</h4>
          <AbacusReact
            value={0}
            columns={1}
            scaleFactor={2}
            stepBeadHighlights={earthActivate}
            currentStep={0}
            showDirectionIndicators={true}
          />
          <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
            Green up arrow - push earth bead up to activate
          </p>
        </div>

        <div>
          <h4>Earth Deactivate (⬇️)</h4>
          <AbacusReact
            value={1}
            columns={1}
            scaleFactor={2}
            stepBeadHighlights={earthDeactivate}
            currentStep={0}
            showDirectionIndicators={true}
          />
          <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
            Red down arrow - release earth bead down to deactivate
          </p>
        </div>

        <div>
          <h4>Heaven Activate (⬇️)</h4>
          <AbacusReact
            value={0}
            columns={1}
            scaleFactor={2}
            stepBeadHighlights={heavenActivate}
            currentStep={0}
            showDirectionIndicators={true}
          />
          <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
            Red down arrow - pull heaven bead down to activate
          </p>
        </div>

        <div>
          <h4>Heaven Deactivate (⬆️)</h4>
          <AbacusReact
            value={5}
            columns={1}
            scaleFactor={2}
            stepBeadHighlights={heavenDeactivate}
            currentStep={0}
            showDirectionIndicators={true}
          />
          <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
            Green up arrow - release heaven bead up to deactivate
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: `
**Complete Arrow Reference**

Shows all four arrow types with correct colors and directions:

- **Green arrows**: Positive/activating actions
- **Red arrows**: Negative/deactivating actions
- **Direction**: Based on physical bead movement direction
        `,
      },
    },
  },
};

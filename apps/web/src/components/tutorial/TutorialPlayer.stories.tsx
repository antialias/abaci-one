import { action } from "@storybook/addon-actions";
import type { Meta, StoryObj } from "@storybook/react";
import { DevAccessProvider } from "../../hooks/useAccessControl";
import { getTutorialForEditor } from "../../utils/tutorialConverter";
import { TutorialPlayer } from "./TutorialPlayer";

const meta: Meta<typeof TutorialPlayer> = {
  title: "Tutorial/TutorialPlayer",
  component: TutorialPlayer,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
The TutorialPlayer component provides an interactive environment for users to complete tutorial steps.
It includes navigation controls, step-by-step guidance, an interactive abacus, and optional debugging features.

## Features
- Step-by-step navigation with progress tracking
- Interactive abacus with highlighted beads
- Error handling and feedback
- Debug panel for development
- Event logging and analytics
- Auto-advance option for smoother experience
        `,
      },
    },
  },
  decorators: [
    (Story) => (
      <DevAccessProvider>
        <div style={{ height: "100vh" }}>
          <Story />
        </div>
      </DevAccessProvider>
    ),
  ],
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockTutorial = getTutorialForEditor();

export const Default: Story = {
  args: {
    tutorial: mockTutorial,
    initialStepIndex: 0,
    isDebugMode: false,
    showDebugPanel: false,
    onStepChange: action("step-changed"),
    onStepComplete: action("step-completed"),
    onTutorialComplete: action("tutorial-completed"),
    onEvent: action("tutorial-event"),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default tutorial player starting from the first step with minimal UI.",
      },
    },
  },
};

export const WithDebugMode: Story = {
  args: {
    ...Default.args,
    isDebugMode: true,
    showDebugPanel: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tutorial player with debug mode enabled, showing debug panel and additional controls for development.",
      },
    },
  },
};

export const StartingFromMiddle: Story = {
  args: {
    ...Default.args,
    initialStepIndex: 4, // Starting from heaven bead introduction
    isDebugMode: true,
    showDebugPanel: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tutorial player starting from the middle of the tutorial (heaven bead introduction).",
      },
    },
  },
};

export const ComplexStep: Story = {
  args: {
    ...Default.args,
    initialStepIndex: 6, // Five complement step
    isDebugMode: true,
    showDebugPanel: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tutorial player on a complex multi-step instruction (five complements) with full debugging enabled.",
      },
    },
  },
};

export const MinimalTutorial: Story = {
  args: {
    tutorial: {
      ...mockTutorial,
      steps: mockTutorial.steps.slice(0, 3), // Only first 3 steps
    },
    initialStepIndex: 0,
    isDebugMode: false,
    showDebugPanel: false,
    onStepChange: action("step-changed"),
    onStepComplete: action("step-completed"),
    onTutorialComplete: action("tutorial-completed"),
    onEvent: action("tutorial-event"),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Minimal tutorial with only the first 3 basic addition steps for testing shorter tutorials.",
      },
    },
  },
};

export const InteractiveDemo: Story = {
  args: {
    ...Default.args,
    isDebugMode: true,
    showDebugPanel: true,
  },
  parameters: {
    docs: {
      description: {
        story: `
Interactive demo showing all tutorial player features:

**Try these interactions:**
1. Click on highlighted beads to progress through steps
2. Use navigation buttons to jump between steps
3. Toggle the step list sidebar to see all available steps
4. Monitor the debug panel for real-time events
5. Enable auto-advance to automatically progress after completing steps

**Features demonstrated:**
- Bead highlighting and interaction feedback
- Progress tracking and validation
- Error messages for incorrect actions
- Tooltip guidance and explanations
- Event logging and debugging
        `,
      },
    },
  },
  play: async ({ canvasElement }) => {
    // Optional: Add play function for automated interactions in Storybook
    const canvas = canvasElement;
    console.log("Tutorial player ready for interaction", canvas);
  },
};

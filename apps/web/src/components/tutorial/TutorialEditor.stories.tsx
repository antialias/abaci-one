import { action } from "@storybook/addon-actions";
import type { Meta, StoryObj } from "@storybook/react";
import { DevAccessProvider } from "../../hooks/useAccessControl";
import {
  createBasicSkillSet,
  type TutorialValidation,
} from "../../types/tutorial";
import { getTutorialForEditor } from "../../utils/tutorialConverter";
import { TutorialEditor } from "./TutorialEditor";

const meta: Meta<typeof TutorialEditor> = {
  title: "Tutorial/TutorialEditor",
  component: TutorialEditor,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
The TutorialEditor component provides a comprehensive editing interface for creating and modifying tutorial content.
It includes both the editor interface and an integrated preview player for testing changes.

## Features
- Visual step editor with form-based editing
- Real-time validation and error reporting
- Integrated tutorial player for preview
- Step management (add, duplicate, delete, reorder)
- Tutorial metadata editing
- Save/load functionality hooks
- Access control integration

## Editor Capabilities
- Edit tutorial metadata (title, description, category, difficulty, tags)
- Manage tutorial steps with detailed form controls
- Set start/target values and highlight configurations
- Edit tooltips, error messages, and multi-step instructions
- Validate tutorial structure and content
- Preview changes in real-time
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

// Mock validation function that returns realistic validation results
const mockValidate = async (tutorial: any): Promise<TutorialValidation> => {
  const errors = [];
  const warnings = [];

  // Simulate some validation logic
  if (!tutorial.title.trim()) {
    errors.push({
      stepId: "",
      field: "title",
      message: "Tutorial title is required",
      severity: "error" as const,
    });
  }

  if (tutorial.steps.length === 0) {
    errors.push({
      stepId: "",
      field: "steps",
      message: "Tutorial must have at least one step",
      severity: "error" as const,
    });
  }

  // Add some warnings for demonstration
  if (tutorial.description.length < 50) {
    warnings.push({
      stepId: "",
      field: "description",
      message: "Tutorial description could be more detailed",
      severity: "warning" as const,
    });
  }

  tutorial.steps.forEach((step: any, index: number) => {
    if (step.startValue === step.targetValue) {
      warnings.push({
        stepId: step.id,
        field: "values",
        message: `Step ${index + 1}: Start and target values are the same`,
        severity: "warning" as const,
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

export const Default: Story = {
  args: {
    tutorial: mockTutorial,
    onSave: action("save-tutorial"),
    onValidate: mockValidate,
    onPreview: action("preview-step"),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default tutorial editor with the guided addition tutorial loaded for editing.",
      },
    },
  },
};

export const EditingMode: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    docs: {
      description: {
        story: `
Tutorial editor in editing mode. This story demonstrates:

**Editor Features:**
- Click "Edit Tutorial" to enable editing mode
- Modify tutorial metadata in the left sidebar
- Click on steps to expand detailed editing forms
- Add, duplicate, or delete steps using step controls
- Use "Preview" buttons to test steps in the integrated player
- Real-time validation shows errors and warnings

**Try These Actions:**
1. Click "Edit Tutorial" to enable editing
2. Modify the tutorial title or description
3. Click on a step to expand its editing form
4. Change step values and see validation updates
5. Add a new step using the "+ Add Step" button
6. Preview specific steps using the "Preview" buttons
        `,
      },
    },
  },
};

export const WithValidationErrors: Story = {
  args: {
    tutorial: {
      ...mockTutorial,
      title: "", // This will trigger a validation error
      description: "Short desc", // This will trigger a warning
      steps: mockTutorial.steps.map((step) => ({
        ...step,
        startValue: step.targetValue, // This will trigger warnings
      })),
    },
    onSave: action("save-tutorial"),
    onValidate: mockValidate,
    onPreview: action("preview-step"),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tutorial editor with validation errors and warnings to demonstrate the validation system.",
      },
    },
  },
};

export const MinimalTutorial: Story = {
  args: {
    tutorial: {
      ...mockTutorial,
      steps: mockTutorial.steps.slice(0, 2), // Only 2 steps for easier editing demo
    },
    onSave: action("save-tutorial"),
    onValidate: mockValidate,
    onPreview: action("preview-step"),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tutorial editor with a minimal tutorial (2 steps) for easier demonstration of editing features.",
      },
    },
  },
};

export const ReadOnlyPreview: Story = {
  args: {
    tutorial: mockTutorial,
    onSave: undefined, // No save function = read-only mode
    onValidate: mockValidate,
    onPreview: action("preview-step"),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tutorial editor in read-only mode (no save function provided) showing the preview functionality.",
      },
    },
  },
};

export const WithPracticeSteps: Story = {
  args: {
    tutorial: {
      ...mockTutorial,
      practiceSteps: [
        {
          id: "practice-basic",
          title: "Practice: Basic Addition (1-4)",
          description: "Practice adding numbers 1-4 using only earth beads",
          problemCount: 12,
          maxTerms: 3,
          allowedSkills: createBasicSkillSet(),
          numberRange: { min: 1, max: 4 },
          sumConstraints: { maxSum: 9 },
        },
        {
          id: "practice-five-complements",
          title: "Practice: Five Complements",
          description: "Practice using five complement techniques",
          problemCount: 15,
          maxTerms: 4,
          allowedSkills: {
            basic: {
              directAddition: true,
              heavenBead: true,
              simpleCombinations: true,
            },
            fiveComplements: {
              "4=5-1": true,
              "3=5-2": true,
              "2=5-3": false,
              "1=5-4": false,
            },
            tenComplements: {
              "9=10-1": false,
              "8=10-2": false,
              "7=10-3": false,
              "6=10-4": false,
              "5=10-5": false,
              "4=10-6": false,
              "3=10-7": false,
              "2=10-8": false,
              "1=10-9": false,
            },
          },
          targetSkills: {
            fiveComplements: {
              "4=5-1": true,
              "3=5-2": true,
            },
          },
          numberRange: { min: 1, max: 9 },
          sumConstraints: { maxSum: 9 },
        },
      ],
    },
    onSave: action("save-tutorial"),
    onValidate: mockValidate,
    onPreview: action("preview-step"),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tutorial editor with practice steps demonstrating the skill-based problem generation system.",
      },
    },
  },
};

export const CustomTutorial: Story = {
  args: {
    tutorial: {
      id: "custom-tutorial",
      title: "Custom Math Tutorial",
      description:
        "A custom tutorial for demonstrating the editor capabilities with different content.",
      category: "Advanced Operations",
      difficulty: "intermediate" as const,
      estimatedDuration: 15,
      steps: [
        {
          id: "custom-1",
          title: "Custom Step 1",
          problem: "5 + 5",
          description: "Add 5 to 5 using the heaven bead",
          startValue: 5,
          targetValue: 10,
          highlightBeads: [{ columnIndex: 4, beadType: "heaven" as const }],
          expectedAction: "add" as const,
          actionDescription: "Click the heaven bead",
          tooltip: {
            content: "Using heaven bead for 10",
            explanation: "When adding 5 to 5, use the tens place heaven bead",
          },
          errorMessages: {
            wrongBead: "Click the tens place heaven bead",
            wrongAction: "Move the bead down to activate",
            hint: "Think about place value",
          },
        },
        {
          id: "custom-2",
          title: "Custom Step 2",
          problem: "7 + 8",
          description: "A more complex addition problem",
          startValue: 7,
          targetValue: 15,
          highlightBeads: [
            { columnIndex: 1, beadType: "heaven" as const },
            { columnIndex: 4, beadType: "heaven" as const },
          ],
          expectedAction: "multi-step" as const,
          actionDescription: "Activate both heaven beads for 15",
          multiStepInstructions: [
            "Click the tens place heaven bead",
            "Click the ones place heaven bead",
          ],
          tooltip: {
            content: "Complex addition",
            explanation:
              "7 + 8 = 15, which needs both tens and ones heaven beads",
          },
          errorMessages: {
            wrongBead: "Follow the two-step process",
            wrongAction: "Activate both heaven beads",
            hint: "15 = 10 + 5",
          },
        },
      ],
      tags: ["custom", "demo", "advanced"],
      author: "Demo Author",
      version: "1.0.0",
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublished: false,
    },
    onSave: action("save-tutorial"),
    onValidate: mockValidate,
    onPreview: action("preview-step"),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tutorial editor with custom tutorial content to demonstrate editing different types of mathematical operations.",
      },
    },
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import type {
  MaintenanceMode,
  ProgressionMode,
  RemediationMode,
} from "@/lib/curriculum/session-mode";
import { css } from "../../../styled-system/css";
import { SessionModeBanner } from "./SessionModeBanner";

// ============================================================================
// Mock Data
// ============================================================================

const mockRemediationMode: RemediationMode = {
  type: "remediation",
  weakSkills: [
    { skillId: "add-3", displayName: "+3", pKnown: 0.35 },
    { skillId: "sub-5-complement-2", displayName: "+5 - 2", pKnown: 0.42 },
  ],
  focusDescription: "Strengthening: +3 and +5 - 2",
  blockedPromotion: {
    nextSkill: {
      skillId: "sub-5-complement-4",
      displayName: "+5 - 4",
      pKnown: 0,
    },
    reason: "Strengthen +3 and +5 - 2 first",
    phase: {
      id: "L1.sub.-4.five",
      levelId: 1,
      operation: "subtraction",
      targetNumber: -4,
      usesFiveComplement: true,
      usesTenComplement: false,
      name: "Five-Complement Subtraction 4",
      description: "Learn to subtract 4 using five-complement technique",
      primarySkillId: "sub-5-complement-4",
      order: 5,
    },
    tutorialReady: false,
  },
};

const mockRemediationModeNoBlockedPromotion: RemediationMode = {
  type: "remediation",
  weakSkills: [
    { skillId: "add-3", displayName: "+3", pKnown: 0.28 },
    { skillId: "add-4", displayName: "+4", pKnown: 0.31 },
    { skillId: "sub-5-complement-2", displayName: "+5 - 2", pKnown: 0.38 },
  ],
  focusDescription: "Strengthening: +3, +4, +5 - 2",
};

const mockProgressionModeWithTutorial: ProgressionMode = {
  type: "progression",
  nextSkill: {
    skillId: "sub-5-complement-4",
    displayName: "+5 - 4",
    pKnown: 0,
  },
  phase: {
    id: "L1.sub.-4.five",
    levelId: 1,
    operation: "subtraction",
    targetNumber: -4,
    usesFiveComplement: true,
    usesTenComplement: false,
    name: "Five-Complement Subtraction 4",
    description: "Learn to subtract 4 using five-complement technique",
    primarySkillId: "sub-5-complement-4",
    order: 5,
  },
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: "Learning: +5 - 4",
};

const mockProgressionModeNoTutorial: ProgressionMode = {
  type: "progression",
  nextSkill: { skillId: "add-4", displayName: "+4", pKnown: 0 },
  phase: {
    id: "L1.add.+4.direct",
    levelId: 1,
    operation: "addition",
    targetNumber: 4,
    usesFiveComplement: false,
    usesTenComplement: false,
    name: "Direct Addition 4",
    description: "Learn to add 4 using direct technique",
    primarySkillId: "add-4",
    order: 2,
  },
  tutorialRequired: false,
  skipCount: 2,
  focusDescription: "Practice: +4",
};

const mockMaintenanceMode: MaintenanceMode = {
  type: "maintenance",
  focusDescription: "Mixed practice",
  skillCount: 8,
};

// ============================================================================
// Meta
// ============================================================================

const meta: Meta<typeof SessionModeBanner> = {
  title: "Practice/SessionModeBanner",
  component: SessionModeBanner,
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: "2rem",
          maxWidth: "500px",
          margin: "0 auto",
        })}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["dashboard", "modal"],
    },
    isLoading: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SessionModeBanner>;

// ============================================================================
// Remediation Mode Stories
// ============================================================================

export const RemediationWithBlockedPromotion: Story = {
  args: {
    sessionMode: mockRemediationMode,
    onAction: () => alert("Starting remediation practice"),
    variant: "dashboard",
  },
};

export const RemediationWithBlockedPromotionModal: Story = {
  args: {
    sessionMode: mockRemediationMode,
    onAction: () => alert("Starting remediation practice"),
    variant: "modal",
  },
};

export const RemediationNoBlockedPromotion: Story = {
  args: {
    sessionMode: mockRemediationModeNoBlockedPromotion,
    onAction: () => alert("Starting remediation practice"),
    variant: "dashboard",
  },
};

export const RemediationLoading: Story = {
  args: {
    sessionMode: mockRemediationMode,
    onAction: () => {},
    isLoading: true,
    variant: "dashboard",
  },
};

// ============================================================================
// Progression Mode Stories
// ============================================================================

export const ProgressionWithTutorial: Story = {
  args: {
    sessionMode: mockProgressionModeWithTutorial,
    onAction: () => alert("Starting tutorial"),
    variant: "dashboard",
  },
};

export const ProgressionWithTutorialModal: Story = {
  args: {
    sessionMode: mockProgressionModeWithTutorial,
    onAction: () => alert("Starting tutorial"),
    variant: "modal",
  },
};

export const ProgressionNoTutorial: Story = {
  args: {
    sessionMode: mockProgressionModeNoTutorial,
    onAction: () => alert("Starting practice"),
    variant: "dashboard",
  },
};

export const ProgressionLoading: Story = {
  args: {
    sessionMode: mockProgressionModeWithTutorial,
    onAction: () => {},
    isLoading: true,
    variant: "dashboard",
  },
};

// ============================================================================
// Maintenance Mode Stories
// ============================================================================

export const Maintenance: Story = {
  args: {
    sessionMode: mockMaintenanceMode,
    onAction: () => alert("Starting maintenance practice"),
    variant: "dashboard",
  },
};

export const MaintenanceModal: Story = {
  args: {
    sessionMode: mockMaintenanceMode,
    onAction: () => alert("Starting maintenance practice"),
    variant: "modal",
  },
};

export const MaintenanceLoading: Story = {
  args: {
    sessionMode: mockMaintenanceMode,
    onAction: () => {},
    isLoading: true,
    variant: "dashboard",
  },
};

// ============================================================================
// All Modes Comparison
// ============================================================================

export const AllModesDashboard: Story = {
  render: () => (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      })}
    >
      <div>
        <h3
          className={css({
            fontSize: "0.875rem",
            fontWeight: "600",
            color: "gray.500",
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          })}
        >
          Remediation (with blocked promotion)
        </h3>
        <SessionModeBanner
          sessionMode={mockRemediationMode}
          onAction={() => alert("Starting remediation")}
          variant="dashboard"
        />
      </div>

      <div>
        <h3
          className={css({
            fontSize: "0.875rem",
            fontWeight: "600",
            color: "gray.500",
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          })}
        >
          Progression (tutorial required)
        </h3>
        <SessionModeBanner
          sessionMode={mockProgressionModeWithTutorial}
          onAction={() => alert("Starting progression")}
          variant="dashboard"
        />
      </div>

      <div>
        <h3
          className={css({
            fontSize: "0.875rem",
            fontWeight: "600",
            color: "gray.500",
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          })}
        >
          Maintenance
        </h3>
        <SessionModeBanner
          sessionMode={mockMaintenanceMode}
          onAction={() => alert("Starting maintenance")}
          variant="dashboard"
        />
      </div>
    </div>
  ),
};

export const AllModesModal: Story = {
  render: () => (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      })}
    >
      <div>
        <h3
          className={css({
            fontSize: "0.875rem",
            fontWeight: "600",
            color: "gray.500",
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          })}
        >
          Remediation (with blocked promotion)
        </h3>
        <SessionModeBanner
          sessionMode={mockRemediationMode}
          onAction={() => alert("Starting remediation")}
          variant="modal"
        />
      </div>

      <div>
        <h3
          className={css({
            fontSize: "0.875rem",
            fontWeight: "600",
            color: "gray.500",
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          })}
        >
          Progression (tutorial required)
        </h3>
        <SessionModeBanner
          sessionMode={mockProgressionModeWithTutorial}
          onAction={() => alert("Starting progression")}
          variant="modal"
        />
      </div>

      <div>
        <h3
          className={css({
            fontSize: "0.875rem",
            fontWeight: "600",
            color: "gray.500",
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          })}
        >
          Maintenance
        </h3>
        <SessionModeBanner
          sessionMode={mockMaintenanceMode}
          onAction={() => alert("Starting maintenance")}
          variant="modal"
        />
      </div>
    </div>
  ),
};

// ============================================================================
// Dark Mode Stories
// ============================================================================

export const DarkModeRemediation: Story = {
  parameters: {
    backgrounds: { default: "dark" },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: "2rem",
          maxWidth: "500px",
          margin: "0 auto",
          backgroundColor: "gray.900",
          borderRadius: "12px",
        })}
        data-theme="dark"
      >
        <Story />
      </div>
    ),
  ],
  args: {
    sessionMode: mockRemediationMode,
    onAction: () => alert("Starting remediation practice"),
    variant: "dashboard",
  },
};

export const DarkModeProgression: Story = {
  parameters: {
    backgrounds: { default: "dark" },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: "2rem",
          maxWidth: "500px",
          margin: "0 auto",
          backgroundColor: "gray.900",
          borderRadius: "12px",
        })}
        data-theme="dark"
      >
        <Story />
      </div>
    ),
  ],
  args: {
    sessionMode: mockProgressionModeWithTutorial,
    onAction: () => alert("Starting tutorial"),
    variant: "dashboard",
  },
};

export const DarkModeMaintenance: Story = {
  parameters: {
    backgrounds: { default: "dark" },
  },
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: "2rem",
          maxWidth: "500px",
          margin: "0 auto",
          backgroundColor: "gray.900",
          borderRadius: "12px",
        })}
        data-theme="dark"
      >
        <Story />
      </div>
    ),
  ],
  args: {
    sessionMode: mockMaintenanceMode,
    onAction: () => alert("Starting maintenance practice"),
    variant: "dashboard",
  },
};

// ============================================================================
// Edge Cases
// ============================================================================

export const RemediationManyWeakSkills: Story = {
  args: {
    sessionMode: {
      type: "remediation",
      weakSkills: [
        { skillId: "add-1", displayName: "+1", pKnown: 0.25 },
        { skillId: "add-2", displayName: "+2", pKnown: 0.28 },
        { skillId: "add-3", displayName: "+3", pKnown: 0.31 },
        { skillId: "add-4", displayName: "+4", pKnown: 0.35 },
        { skillId: "sub-5-complement-1", displayName: "+5 - 1", pKnown: 0.38 },
      ],
      focusDescription: "Strengthening: +1, +2, +3 +2 more",
    } satisfies RemediationMode,
    onAction: () => alert("Starting remediation"),
    variant: "dashboard",
  },
};

export const RemediationAlmostDone: Story = {
  args: {
    sessionMode: {
      type: "remediation",
      weakSkills: [{ skillId: "add-3", displayName: "+3", pKnown: 0.48 }],
      focusDescription: "Strengthening: +3",
      blockedPromotion: {
        nextSkill: { skillId: "add-4", displayName: "+4", pKnown: 0 },
        reason: "Strengthen +3 first",
        phase: {
          id: "L1.add.+4.direct",
          levelId: 1,
          operation: "addition",
          targetNumber: 4,
          usesFiveComplement: false,
          usesTenComplement: false,
          name: "Direct Addition 4",
          description: "Learn to add 4 using direct technique",
          primarySkillId: "add-4",
          order: 2,
        },
        tutorialReady: false,
      },
    } satisfies RemediationMode,
    onAction: () => alert("Starting remediation"),
    variant: "dashboard",
  },
};

export const MaintenanceManySkills: Story = {
  args: {
    sessionMode: {
      type: "maintenance",
      focusDescription: "Mixed practice",
      skillCount: 24,
    } satisfies MaintenanceMode,
    onAction: () => alert("Starting maintenance"),
    variant: "dashboard",
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SkillTutorialLauncher } from "./SkillTutorialLauncher";

// Create a query client for the story wrapper
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Story wrapper with query client
function StoryWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const meta: Meta<typeof SkillTutorialLauncher> = {
  title: "Tutorial/SkillTutorialLauncher",
  component: SkillTutorialLauncher,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <StoryWrapper>
        <div style={{ width: "600px", padding: "2rem", background: "#f0f0f0" }}>
          <Story />
        </div>
      </StoryWrapper>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SkillTutorialLauncher>;

// Default handlers
const defaultHandlers = {
  onComplete: () => console.log("Tutorial completed"),
  onSkip: () => console.log("Tutorial skipped"),
  onCancel: () => console.log("Tutorial cancelled"),
};

/**
 * Basic skill tutorial - Direct Addition
 */
export const BasicDirectAddition: Story = {
  args: {
    skillId: "basic.directAddition",
    playerId: "test-player-1",
    theme: "light",
    ...defaultHandlers,
  },
};

/**
 * Heaven bead tutorial
 */
export const BasicHeavenBead: Story = {
  args: {
    skillId: "basic.heavenBead",
    playerId: "test-player-1",
    theme: "light",
    ...defaultHandlers,
  },
};

/**
 * Five-complement addition tutorial
 */
export const FiveComplementAdd4: Story = {
  args: {
    skillId: "fiveComplements.4=5-1",
    playerId: "test-player-1",
    theme: "light",
    ...defaultHandlers,
  },
};

/**
 * Ten-complement addition tutorial
 */
export const TenComplementAdd9: Story = {
  args: {
    skillId: "tenComplements.9=10-1",
    playerId: "test-player-1",
    theme: "light",
    ...defaultHandlers,
  },
};

/**
 * Dark theme variant
 */
export const DarkTheme: Story = {
  args: {
    skillId: "fiveComplements.3=5-2",
    playerId: "test-player-1",
    theme: "dark",
    ...defaultHandlers,
  },
  decorators: [
    (Story) => (
      <StoryWrapper>
        <div
          style={{
            width: "600px",
            padding: "2rem",
            background: "#1a1a2e",
            borderRadius: "12px",
          }}
        >
          <Story />
        </div>
      </StoryWrapper>
    ),
  ],
};

/**
 * Unknown skill - shows fallback UI
 */
export const UnknownSkill: Story = {
  args: {
    skillId: "unknown.skill",
    playerId: "test-player-1",
    theme: "light",
    ...defaultHandlers,
  },
};

/**
 * Ten-complement subtraction tutorial
 */
export const TenComplementSubtract9: Story = {
  args: {
    skillId: "tenComplementsSub.-9=+1-10",
    playerId: "test-player-1",
    theme: "light",
    ...defaultHandlers,
  },
};

/**
 * Five-complement subtraction tutorial
 */
export const FiveComplementSubtract4: Story = {
  args: {
    skillId: "fiveComplementsSub.-4=-5+1",
    playerId: "test-player-1",
    theme: "light",
    ...defaultHandlers,
  },
};

import type { Meta, StoryObj } from "@storybook/react";
import type { ProblemSlot } from "@/db/schema/session-plans";
import { css } from "../../../styled-system/css";
import { Tooltip, TooltipProvider } from "../ui/Tooltip";

// =============================================================================
// Mock Data Factories
// =============================================================================

function createMockSlot(
  purpose: ProblemSlot["purpose"],
  skillOverride?: {
    category: string;
    skillKey: string;
  },
): ProblemSlot {
  const baseSlot: ProblemSlot = {
    index: 0,
    purpose,
    constraints: {
      termCount: { min: 2, max: 4 },
      digitRange: { min: 1, max: 2 },
    },
  };

  // For reinforce/review, add a specific skill constraint
  if (skillOverride) {
    baseSlot.constraints = {
      ...baseSlot.constraints,
      targetSkills: {
        [skillOverride.category]: {
          [skillOverride.skillKey]: true,
        },
      },
    };
  }

  return baseSlot;
}

// =============================================================================
// Helper Components (extracted from ActiveSession.tsx)
// =============================================================================

function extractTargetSkillName(slot: ProblemSlot): string | null {
  const targetSkills = slot.constraints?.targetSkills;
  if (!targetSkills) return null;

  for (const [category, skills] of Object.entries(targetSkills)) {
    if (skills && typeof skills === "object") {
      const skillKeys = Object.keys(skills);
      if (skillKeys.length === 1) {
        return formatSkillName(category, skillKeys[0]);
      }
    }
  }
  return null;
}

function formatSkillName(category: string, skillKey: string): string {
  if (category === "basic") {
    if (skillKey.startsWith("+")) {
      return `add ${skillKey.slice(1)}`;
    }
    if (skillKey.startsWith("-")) {
      return `subtract ${skillKey.slice(1)}`;
    }
    return skillKey;
  }

  if (category === "fiveComplements") {
    const match = skillKey.match(/^(\d+)=/);
    if (match) {
      return `5-complement for ${match[1]}`;
    }
    return skillKey;
  }

  if (category === "tenComplements") {
    const match = skillKey.match(/^(\d+)=/);
    if (match) {
      return `10-complement for ${match[1]}`;
    }
    return skillKey;
  }

  return `${category}: ${skillKey}`;
}

function PurposeTooltipContent({ slot }: { slot: ProblemSlot }) {
  const skillName = extractTargetSkillName(slot);

  const tooltipStyles = {
    container: css({
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
    }),
    header: css({
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      fontWeight: "bold",
      fontSize: "0.9375rem",
    }),
    emoji: css({
      fontSize: "1.125rem",
    }),
    description: css({
      color: "gray.300",
      lineHeight: "1.5",
    }),
    detail: css({
      display: "flex",
      alignItems: "center",
      gap: "0.375rem",
      padding: "0.375rem 0.5rem",
      backgroundColor: "gray.800",
      borderRadius: "6px",
      fontSize: "0.8125rem",
    }),
    detailLabel: css({
      color: "gray.400",
      fontWeight: "500",
    }),
    detailValue: css({
      color: "white",
      fontFamily: "mono",
    }),
    percentage: css({
      display: "inline-flex",
      alignItems: "center",
      padding: "0.125rem 0.375rem",
      backgroundColor: "orange.900",
      color: "orange.200",
      borderRadius: "4px",
      fontSize: "0.75rem",
      fontWeight: "bold",
    }),
  };

  switch (slot.purpose) {
    case "focus":
      return (
        <div className={tooltipStyles.container}>
          <div className={tooltipStyles.header}>
            <span className={tooltipStyles.emoji}>🎯</span>
            <span>Focus Practice</span>
          </div>
          <p className={tooltipStyles.description}>
            Building mastery of your current curriculum skills. These problems
            are at the heart of what you&apos;re learning right now.
          </p>
          <div className={tooltipStyles.detail}>
            <span className={tooltipStyles.detailLabel}>Distribution:</span>
            <span className={tooltipStyles.detailValue}>60% of session</span>
          </div>
        </div>
      );

    case "reinforce":
      return (
        <div className={tooltipStyles.container}>
          <div className={tooltipStyles.header}>
            <span className={tooltipStyles.emoji}>💪</span>
            <span>Reinforcement</span>
          </div>
          <p className={tooltipStyles.description}>
            Extra practice for skills identified as needing more work. These
            problems target areas where mastery is still developing.
          </p>
          {skillName && (
            <div className={tooltipStyles.detail}>
              <span className={tooltipStyles.detailLabel}>Targeting:</span>
              <span className={tooltipStyles.detailValue}>{skillName}</span>
            </div>
          )}
        </div>
      );

    case "review":
      return (
        <div className={tooltipStyles.container}>
          <div className={tooltipStyles.header}>
            <span className={tooltipStyles.emoji}>🔄</span>
            <span>Spaced Review</span>
          </div>
          <p className={tooltipStyles.description}>
            Keeping mastered skills fresh through spaced repetition. Regular
            review prevents forgetting and strengthens long-term memory.
          </p>
          {skillName && (
            <div className={tooltipStyles.detail}>
              <span className={tooltipStyles.detailLabel}>Reviewing:</span>
              <span className={tooltipStyles.detailValue}>{skillName}</span>
            </div>
          )}
          <div className={tooltipStyles.detail}>
            <span className={tooltipStyles.detailLabel}>Schedule:</span>
            <span className={tooltipStyles.detailValue}>
              Mastered: 14 days • Practicing: 7 days
            </span>
          </div>
        </div>
      );

    case "challenge":
      return (
        <div className={tooltipStyles.container}>
          <div className={tooltipStyles.header}>
            <span className={tooltipStyles.emoji}>⭐</span>
            <span>Mixed Practice</span>
          </div>
          <p className={tooltipStyles.description}>
            Problems that combine multiple mastered skills. Great for building
            fluency and applying what you&apos;ve learned in new ways.
          </p>
          <div className={tooltipStyles.detail}>
            <span className={tooltipStyles.detailLabel}>Skills:</span>
            <span className={tooltipStyles.detailValue}>All mastered</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// =============================================================================
// Purpose Badge Component
// =============================================================================

interface PurposeBadgeProps {
  slot: ProblemSlot;
  isDark?: boolean;
}

function PurposeBadge({ slot, isDark = false }: PurposeBadgeProps) {
  const getBadgeColors = () => {
    switch (slot.purpose) {
      case "focus":
        return {
          bg: isDark ? "blue.900" : "blue.100",
          color: isDark ? "blue.200" : "blue.700",
        };
      case "reinforce":
        return {
          bg: isDark ? "orange.900" : "orange.100",
          color: isDark ? "orange.200" : "orange.700",
        };
      case "review":
        return {
          bg: isDark ? "green.900" : "green.100",
          color: isDark ? "green.200" : "green.700",
        };
      case "challenge":
        return {
          bg: isDark ? "purple.900" : "purple.100",
          color: isDark ? "purple.200" : "purple.700",
        };
    }
  };

  const colors = getBadgeColors();

  return (
    <TooltipProvider>
      <Tooltip
        content={<PurposeTooltipContent slot={slot} />}
        side="bottom"
        delayDuration={300}
      >
        <div
          data-element="problem-purpose"
          data-purpose={slot.purpose}
          className={css({
            position: "relative",
            padding: "0.25rem 0.75rem",
            borderRadius: "20px",
            fontSize: "0.75rem",
            fontWeight: "bold",
            textTransform: "uppercase",
            cursor: "help",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
            backgroundColor: colors.bg,
            color: colors.color,
            _hover: {
              transform: "scale(1.05)",
              boxShadow: "sm",
            },
          })}
        >
          {slot.purpose}
        </div>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Storybook Meta
// =============================================================================

const meta: Meta<typeof PurposeBadge> = {
  title: "Practice/PurposeBadge",
  component: PurposeBadge,
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: "4rem",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
        })}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof PurposeBadge>;

// =============================================================================
// Focus Stories
// =============================================================================

export const Focus: Story = {
  args: {
    slot: createMockSlot("focus"),
    isDark: false,
  },
};

export const FocusDark: Story = {
  args: {
    slot: createMockSlot("focus"),
    isDark: true,
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// =============================================================================
// Reinforce Stories - Various Skills
// =============================================================================

export const ReinforceNoSkill: Story = {
  name: "Reinforce - No Specific Skill",
  args: {
    slot: createMockSlot("reinforce"),
    isDark: false,
  },
};

export const ReinforceBasicAdd: Story = {
  name: "Reinforce - Basic Add 3",
  args: {
    slot: createMockSlot("reinforce", { category: "basic", skillKey: "+3" }),
    isDark: false,
  },
};

export const ReinforceBasicSubtract: Story = {
  name: "Reinforce - Basic Subtract 4",
  args: {
    slot: createMockSlot("reinforce", { category: "basic", skillKey: "-4" }),
    isDark: false,
  },
};

export const ReinforceFiveComplement: Story = {
  name: "Reinforce - 5-Complement for 4",
  args: {
    slot: createMockSlot("reinforce", {
      category: "fiveComplements",
      skillKey: "4=5-1",
    }),
    isDark: false,
  },
};

export const ReinforceTenComplement: Story = {
  name: "Reinforce - 10-Complement for 9",
  args: {
    slot: createMockSlot("reinforce", {
      category: "tenComplements",
      skillKey: "9=10-1",
    }),
    isDark: false,
  },
};

export const ReinforceDark: Story = {
  name: "Reinforce - Dark Mode with Skill",
  args: {
    slot: createMockSlot("reinforce", {
      category: "fiveComplements",
      skillKey: "3=5-2",
    }),
    isDark: true,
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// =============================================================================
// Review Stories - Various Skills
// =============================================================================

export const ReviewNoSkill: Story = {
  name: "Review - No Specific Skill",
  args: {
    slot: createMockSlot("review"),
    isDark: false,
  },
};

export const ReviewBasicAdd: Story = {
  name: "Review - Basic Add 2",
  args: {
    slot: createMockSlot("review", { category: "basic", skillKey: "+2" }),
    isDark: false,
  },
};

export const ReviewFiveComplement: Story = {
  name: "Review - 5-Complement for 1",
  args: {
    slot: createMockSlot("review", {
      category: "fiveComplements",
      skillKey: "1=5-4",
    }),
    isDark: false,
  },
};

export const ReviewTenComplement: Story = {
  name: "Review - 10-Complement for 7",
  args: {
    slot: createMockSlot("review", {
      category: "tenComplements",
      skillKey: "7=10-3",
    }),
    isDark: false,
  },
};

export const ReviewDark: Story = {
  name: "Review - Dark Mode with Skill",
  args: {
    slot: createMockSlot("review", { category: "basic", skillKey: "+5" }),
    isDark: true,
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// =============================================================================
// Challenge Stories
// =============================================================================

export const Challenge: Story = {
  args: {
    slot: createMockSlot("challenge"),
    isDark: false,
  },
};

export const ChallengeDark: Story = {
  args: {
    slot: createMockSlot("challenge"),
    isDark: true,
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// =============================================================================
// All Badges Together
// =============================================================================

export const AllBadgesLight: Story = {
  name: "All Badges - Light Mode",
  render: () => (
    <div className={css({ display: "flex", gap: "1rem", flexWrap: "wrap" })}>
      <PurposeBadge slot={createMockSlot("focus")} isDark={false} />
      <PurposeBadge
        slot={createMockSlot("reinforce", {
          category: "fiveComplements",
          skillKey: "4=5-1",
        })}
        isDark={false}
      />
      <PurposeBadge
        slot={createMockSlot("review", { category: "basic", skillKey: "+3" })}
        isDark={false}
      />
      <PurposeBadge slot={createMockSlot("challenge")} isDark={false} />
    </div>
  ),
};

export const AllBadgesDark: Story = {
  name: "All Badges - Dark Mode",
  parameters: {
    backgrounds: { default: "dark" },
  },
  render: () => (
    <div className={css({ display: "flex", gap: "1rem", flexWrap: "wrap" })}>
      <PurposeBadge slot={createMockSlot("focus")} isDark={true} />
      <PurposeBadge
        slot={createMockSlot("reinforce", {
          category: "tenComplements",
          skillKey: "8=10-2",
        })}
        isDark={true}
      />
      <PurposeBadge
        slot={createMockSlot("review", {
          category: "fiveComplements",
          skillKey: "2=5-3",
        })}
        isDark={true}
      />
      <PurposeBadge slot={createMockSlot("challenge")} isDark={true} />
    </div>
  ),
};

// =============================================================================
// Edge Cases
// =============================================================================

export const AllSkillTypes: Story = {
  name: "All Skill Types Comparison",
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
            marginBottom: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: "bold",
          })}
        >
          Basic Skills
        </h3>
        <div className={css({ display: "flex", gap: "0.5rem" })}>
          <PurposeBadge
            slot={createMockSlot("reinforce", {
              category: "basic",
              skillKey: "+1",
            })}
          />
          <PurposeBadge
            slot={createMockSlot("reinforce", {
              category: "basic",
              skillKey: "+4",
            })}
          />
          <PurposeBadge
            slot={createMockSlot("reinforce", {
              category: "basic",
              skillKey: "-2",
            })}
          />
          <PurposeBadge
            slot={createMockSlot("reinforce", {
              category: "basic",
              skillKey: "-5",
            })}
          />
        </div>
      </div>

      <div>
        <h3
          className={css({
            marginBottom: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: "bold",
          })}
        >
          5-Complements
        </h3>
        <div className={css({ display: "flex", gap: "0.5rem" })}>
          <PurposeBadge
            slot={createMockSlot("review", {
              category: "fiveComplements",
              skillKey: "1=5-4",
            })}
          />
          <PurposeBadge
            slot={createMockSlot("review", {
              category: "fiveComplements",
              skillKey: "2=5-3",
            })}
          />
          <PurposeBadge
            slot={createMockSlot("review", {
              category: "fiveComplements",
              skillKey: "3=5-2",
            })}
          />
          <PurposeBadge
            slot={createMockSlot("review", {
              category: "fiveComplements",
              skillKey: "4=5-1",
            })}
          />
        </div>
      </div>

      <div>
        <h3
          className={css({
            marginBottom: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: "bold",
          })}
        >
          10-Complements
        </h3>
        <div className={css({ display: "flex", gap: "0.5rem" })}>
          <PurposeBadge
            slot={createMockSlot("reinforce", {
              category: "tenComplements",
              skillKey: "1=10-9",
            })}
          />
          <PurposeBadge
            slot={createMockSlot("reinforce", {
              category: "tenComplements",
              skillKey: "5=10-5",
            })}
          />
          <PurposeBadge
            slot={createMockSlot("reinforce", {
              category: "tenComplements",
              skillKey: "9=10-1",
            })}
          />
        </div>
      </div>
    </div>
  ),
};

export const MixedPurposesWithSkills: Story = {
  name: "Mixed Purposes with Different Skills",
  render: () => (
    <div
      className={css({ display: "flex", flexDirection: "column", gap: "1rem" })}
    >
      <div
        className={css({
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        })}
      >
        <span
          className={css({
            width: "100px",
            fontSize: "0.75rem",
            color: "gray.500",
          })}
        >
          Focus:
        </span>
        <PurposeBadge slot={createMockSlot("focus")} />
      </div>
      <div
        className={css({
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        })}
      >
        <span
          className={css({
            width: "100px",
            fontSize: "0.75rem",
            color: "gray.500",
          })}
        >
          Reinforce +3:
        </span>
        <PurposeBadge
          slot={createMockSlot("reinforce", {
            category: "basic",
            skillKey: "+3",
          })}
        />
      </div>
      <div
        className={css({
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        })}
      >
        <span
          className={css({
            width: "100px",
            fontSize: "0.75rem",
            color: "gray.500",
          })}
        >
          Review 5-comp:
        </span>
        <PurposeBadge
          slot={createMockSlot("review", {
            category: "fiveComplements",
            skillKey: "4=5-1",
          })}
        />
      </div>
      <div
        className={css({
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        })}
      >
        <span
          className={css({
            width: "100px",
            fontSize: "0.75rem",
            color: "gray.500",
          })}
        >
          Challenge:
        </span>
        <PurposeBadge slot={createMockSlot("challenge")} />
      </div>
    </div>
  ),
};

// =============================================================================
// In Context - Simulated Problem Area
// =============================================================================

export const InProblemContext: Story = {
  name: "In Problem Area Context",
  render: () => (
    <div
      className={css({
        padding: "2rem",
        backgroundColor: "white",
        borderRadius: "16px",
        boxShadow: "md",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        minWidth: "300px",
      })}
    >
      <PurposeBadge
        slot={createMockSlot("reinforce", {
          category: "fiveComplements",
          skillKey: "4=5-1",
        })}
      />

      {/* Simulated problem */}
      <div
        className={css({
          fontFamily: "mono",
          fontSize: "2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        })}
      >
        <div>45</div>
        <div>+ 27</div>
        <div
          className={css({
            borderTop: "2px solid black",
            paddingTop: "0.25rem",
            minWidth: "60px",
          })}
        >
          __
        </div>
      </div>
    </div>
  ),
};

export const InProblemContextDark: Story = {
  name: "In Problem Area Context - Dark",
  parameters: {
    backgrounds: { default: "dark" },
  },
  render: () => (
    <div
      className={css({
        padding: "2rem",
        backgroundColor: "gray.800",
        borderRadius: "16px",
        boxShadow: "md",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        minWidth: "300px",
      })}
    >
      <PurposeBadge
        slot={createMockSlot("review", {
          category: "tenComplements",
          skillKey: "7=10-3",
        })}
        isDark={true}
      />

      {/* Simulated problem */}
      <div
        className={css({
          fontFamily: "mono",
          fontSize: "2rem",
          color: "gray.200",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        })}
      >
        <div>83</div>
        <div>- 29</div>
        <div
          className={css({
            borderTop: "2px solid",
            borderColor: "gray.400",
            paddingTop: "0.25rem",
            minWidth: "60px",
          })}
        >
          __
        </div>
      </div>
    </div>
  ),
};

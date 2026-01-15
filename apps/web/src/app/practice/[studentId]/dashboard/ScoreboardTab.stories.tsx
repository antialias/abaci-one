"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { css } from "../../../../../styled-system/css";
import {
  ScoreboardTab,
  MasteryBar,
  SkillsProgressSection,
  SkillsLeaderboardSection,
} from "./ScoreboardTab";
import type {
  StudentSkillMetrics,
  ClassroomSkillsLeaderboard,
  SkillCategory,
} from "@/lib/curriculum/skill-metrics";

/**
 * Stories for ScoreboardTab - the dashboard tab showing game results, skill progress, and leaderboards
 *
 * Shows:
 * - Personal bests grid (best score per game)
 * - Recent games table (last 10 games)
 * - Skills progress section (individual mastery metrics)
 * - Classroom achievements (effort, improvement, speed champions)
 * - Classroom leaderboard (if enrolled)
 * - Dark/light mode variations
 */

// Create a query client for storybook
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

// Wrapper component to provide QueryClient
const QueryWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// ============================================================================
// Mock Data
// ============================================================================

const mockSkillMetricsBeginner: StudentSkillMetrics = {
  computedAt: new Date(),
  overallMastery: 0.25,
  categoryMastery: {
    basic: {
      pKnownAvg: 0.45,
      skillCount: 3,
      masteredCount: 1,
      practicedCount: 3,
    },
    fiveComplements: {
      pKnownAvg: 0.15,
      skillCount: 4,
      masteredCount: 0,
      practicedCount: 2,
    },
    fiveComplementsSub: {
      pKnownAvg: 0,
      skillCount: 4,
      masteredCount: 0,
      practicedCount: 0,
    },
    tenComplements: {
      pKnownAvg: 0,
      skillCount: 9,
      masteredCount: 0,
      practicedCount: 0,
    },
    tenComplementsSub: {
      pKnownAvg: 0,
      skillCount: 9,
      masteredCount: 0,
      practicedCount: 0,
    },
    advanced: {
      pKnownAvg: 0,
      skillCount: 0,
      masteredCount: 0,
      practicedCount: 0,
    },
  },
  timing: {
    avgSecondsPerTerm: 4.2,
    trend: "improving",
  },
  accuracy: {
    overallPercent: 68,
    recentPercent: 72,
    trend: "improving",
  },
  progress: {
    improvementRate: 8.5,
    practiceStreak: 3,
    totalProblems: 45,
    weeklyProblems: 28,
  },
};

const mockSkillMetricsIntermediate: StudentSkillMetrics = {
  computedAt: new Date(),
  overallMastery: 0.58,
  categoryMastery: {
    basic: {
      pKnownAvg: 0.92,
      skillCount: 3,
      masteredCount: 3,
      practicedCount: 3,
    },
    fiveComplements: {
      pKnownAvg: 0.78,
      skillCount: 4,
      masteredCount: 3,
      practicedCount: 4,
    },
    fiveComplementsSub: {
      pKnownAvg: 0.45,
      skillCount: 4,
      masteredCount: 1,
      practicedCount: 3,
    },
    tenComplements: {
      pKnownAvg: 0.32,
      skillCount: 9,
      masteredCount: 2,
      practicedCount: 5,
    },
    tenComplementsSub: {
      pKnownAvg: 0,
      skillCount: 9,
      masteredCount: 0,
      practicedCount: 0,
    },
    advanced: {
      pKnownAvg: 0,
      skillCount: 0,
      masteredCount: 0,
      practicedCount: 0,
    },
  },
  timing: {
    avgSecondsPerTerm: 2.8,
    trend: "stable",
  },
  accuracy: {
    overallPercent: 82,
    recentPercent: 85,
    trend: "improving",
  },
  progress: {
    improvementRate: 5.2,
    practiceStreak: 12,
    totalProblems: 320,
    weeklyProblems: 65,
  },
};

const mockSkillMetricsAdvanced: StudentSkillMetrics = {
  computedAt: new Date(),
  overallMastery: 0.89,
  categoryMastery: {
    basic: {
      pKnownAvg: 0.98,
      skillCount: 3,
      masteredCount: 3,
      practicedCount: 3,
    },
    fiveComplements: {
      pKnownAvg: 0.95,
      skillCount: 4,
      masteredCount: 4,
      practicedCount: 4,
    },
    fiveComplementsSub: {
      pKnownAvg: 0.92,
      skillCount: 4,
      masteredCount: 4,
      practicedCount: 4,
    },
    tenComplements: {
      pKnownAvg: 0.88,
      skillCount: 9,
      masteredCount: 8,
      practicedCount: 9,
    },
    tenComplementsSub: {
      pKnownAvg: 0.82,
      skillCount: 9,
      masteredCount: 7,
      practicedCount: 9,
    },
    advanced: {
      pKnownAvg: 0.65,
      skillCount: 2,
      masteredCount: 1,
      practicedCount: 2,
    },
  },
  timing: {
    avgSecondsPerTerm: 1.4,
    trend: "improving",
  },
  accuracy: {
    overallPercent: 94,
    recentPercent: 96,
    trend: "stable",
  },
  progress: {
    improvementRate: 2.1,
    practiceStreak: 45,
    totalProblems: 1250,
    weeklyProblems: 42,
  },
};

const mockSkillMetricsDeclining: StudentSkillMetrics = {
  computedAt: new Date(),
  overallMastery: 0.52,
  categoryMastery: {
    basic: {
      pKnownAvg: 0.85,
      skillCount: 3,
      masteredCount: 2,
      practicedCount: 3,
    },
    fiveComplements: {
      pKnownAvg: 0.62,
      skillCount: 4,
      masteredCount: 2,
      practicedCount: 4,
    },
    fiveComplementsSub: {
      pKnownAvg: 0.38,
      skillCount: 4,
      masteredCount: 0,
      practicedCount: 3,
    },
    tenComplements: {
      pKnownAvg: 0.25,
      skillCount: 9,
      masteredCount: 0,
      practicedCount: 4,
    },
    tenComplementsSub: {
      pKnownAvg: 0,
      skillCount: 9,
      masteredCount: 0,
      practicedCount: 0,
    },
    advanced: {
      pKnownAvg: 0,
      skillCount: 0,
      masteredCount: 0,
      practicedCount: 0,
    },
  },
  timing: {
    avgSecondsPerTerm: 3.5,
    trend: "slowing",
  },
  accuracy: {
    overallPercent: 75,
    recentPercent: 68,
    trend: "declining",
  },
  progress: {
    improvementRate: -2.3,
    practiceStreak: 0,
    totalProblems: 180,
    weeklyProblems: 5,
  },
};

const mockClassroomLeaderboard: ClassroomSkillsLeaderboard = {
  computedAt: new Date(),
  playerCount: 8,
  byWeeklyProblems: [
    {
      playerId: "p1",
      playerName: "Marcus",
      playerEmoji: "🦖",
      value: 95,
      rank: 1,
    },
    {
      playerId: "p2",
      playerName: "Luna",
      playerEmoji: "🌙",
      value: 78,
      rank: 2,
    },
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 65,
      rank: 3,
    },
    {
      playerId: "p4",
      playerName: "Kai",
      playerEmoji: "🐬",
      value: 42,
      rank: 4,
    },
    {
      playerId: "p5",
      playerName: "Emma",
      playerEmoji: "🌸",
      value: 38,
      rank: 5,
    },
  ],
  byTotalProblems: [
    {
      playerId: "p2",
      playerName: "Luna",
      playerEmoji: "🌙",
      value: 1850,
      rank: 1,
    },
    {
      playerId: "p1",
      playerName: "Marcus",
      playerEmoji: "🦖",
      value: 1620,
      rank: 2,
    },
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 1250,
      rank: 3,
    },
    {
      playerId: "p5",
      playerName: "Emma",
      playerEmoji: "🌸",
      value: 980,
      rank: 4,
    },
  ],
  byPracticeStreak: [
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 45,
      rank: 1,
    },
    {
      playerId: "p2",
      playerName: "Luna",
      playerEmoji: "🌙",
      value: 32,
      rank: 2,
    },
    {
      playerId: "p1",
      playerName: "Marcus",
      playerEmoji: "🦖",
      value: 28,
      rank: 3,
    },
    {
      playerId: "p4",
      playerName: "Kai",
      playerEmoji: "🐬",
      value: 15,
      rank: 4,
    },
  ],
  byImprovementRate: [
    {
      playerId: "p4",
      playerName: "Kai",
      playerEmoji: "🐬",
      value: 12.5,
      rank: 1,
    },
    {
      playerId: "p1",
      playerName: "Marcus",
      playerEmoji: "🦖",
      value: 8.2,
      rank: 2,
    },
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 5.8,
      rank: 3,
    },
    {
      playerId: "p2",
      playerName: "Luna",
      playerEmoji: "🌙",
      value: 3.1,
      rank: 4,
    },
  ],
  speedChampions: [
    {
      category: "basic" as SkillCategory,
      categoryName: "Basic Operations",
      leaders: [
        {
          playerId: "p2",
          playerName: "Luna",
          playerEmoji: "🌙",
          value: 0.8,
          rank: 1,
        },
        {
          playerId: "current",
          playerName: "Sonia",
          playerEmoji: "🦋",
          value: 1.1,
          rank: 2,
        },
        {
          playerId: "p1",
          playerName: "Marcus",
          playerEmoji: "🦖",
          value: 1.3,
          rank: 3,
        },
      ],
    },
    {
      category: "fiveComplements" as SkillCategory,
      categoryName: "Five Complements",
      leaders: [
        {
          playerId: "current",
          playerName: "Sonia",
          playerEmoji: "🦋",
          value: 1.4,
          rank: 1,
        },
        {
          playerId: "p2",
          playerName: "Luna",
          playerEmoji: "🌙",
          value: 1.6,
          rank: 2,
        },
        {
          playerId: "p1",
          playerName: "Marcus",
          playerEmoji: "🦖",
          value: 1.9,
          rank: 3,
        },
      ],
    },
    {
      category: "tenComplements" as SkillCategory,
      categoryName: "Ten Complements",
      leaders: [
        {
          playerId: "p1",
          playerName: "Marcus",
          playerEmoji: "🦖",
          value: 1.8,
          rank: 1,
        },
        {
          playerId: "p2",
          playerName: "Luna",
          playerEmoji: "🌙",
          value: 2.0,
          rank: 2,
        },
      ],
    },
  ],
};

const mockClassroomLeaderboardSmall: ClassroomSkillsLeaderboard = {
  computedAt: new Date(),
  playerCount: 3,
  byWeeklyProblems: [
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 42,
      rank: 1,
    },
    {
      playerId: "p2",
      playerName: "Alex",
      playerEmoji: "🚀",
      value: 28,
      rank: 2,
    },
  ],
  byTotalProblems: [
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 320,
      rank: 1,
    },
    {
      playerId: "p2",
      playerName: "Alex",
      playerEmoji: "🚀",
      value: 180,
      rank: 2,
    },
  ],
  byPracticeStreak: [
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 12,
      rank: 1,
    },
    {
      playerId: "p2",
      playerName: "Alex",
      playerEmoji: "🚀",
      value: 5,
      rank: 2,
    },
  ],
  byImprovementRate: [
    {
      playerId: "p2",
      playerName: "Alex",
      playerEmoji: "🚀",
      value: 15.2,
      rank: 1,
    },
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 8.5,
      rank: 2,
    },
  ],
  speedChampions: [],
};

const mockClassroomLeaderboardCurrentNotTop: ClassroomSkillsLeaderboard = {
  computedAt: new Date(),
  playerCount: 12,
  byWeeklyProblems: [
    {
      playerId: "p1",
      playerName: "Marcus",
      playerEmoji: "🦖",
      value: 120,
      rank: 1,
    },
    {
      playerId: "p2",
      playerName: "Luna",
      playerEmoji: "🌙",
      value: 95,
      rank: 2,
    },
    {
      playerId: "p3",
      playerName: "Kai",
      playerEmoji: "🐬",
      value: 88,
      rank: 3,
    },
    {
      playerId: "p4",
      playerName: "Emma",
      playerEmoji: "🌸",
      value: 72,
      rank: 4,
    },
    {
      playerId: "p5",
      playerName: "Oliver",
      playerEmoji: "🦁",
      value: 65,
      rank: 5,
    },
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 42,
      rank: 7,
    },
  ],
  byTotalProblems: [
    {
      playerId: "p2",
      playerName: "Luna",
      playerEmoji: "🌙",
      value: 2500,
      rank: 1,
    },
    {
      playerId: "p1",
      playerName: "Marcus",
      playerEmoji: "🦖",
      value: 2200,
      rank: 2,
    },
    {
      playerId: "p3",
      playerName: "Kai",
      playerEmoji: "🐬",
      value: 1800,
      rank: 3,
    },
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 1250,
      rank: 5,
    },
  ],
  byPracticeStreak: [
    {
      playerId: "p3",
      playerName: "Kai",
      playerEmoji: "🐬",
      value: 60,
      rank: 1,
    },
    {
      playerId: "p2",
      playerName: "Luna",
      playerEmoji: "🌙",
      value: 45,
      rank: 2,
    },
    {
      playerId: "p1",
      playerName: "Marcus",
      playerEmoji: "🦖",
      value: 38,
      rank: 3,
    },
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 12,
      rank: 6,
    },
  ],
  byImprovementRate: [
    {
      playerId: "p4",
      playerName: "Emma",
      playerEmoji: "🌸",
      value: 18.5,
      rank: 1,
    },
    {
      playerId: "p5",
      playerName: "Oliver",
      playerEmoji: "🦁",
      value: 14.2,
      rank: 2,
    },
    {
      playerId: "p1",
      playerName: "Marcus",
      playerEmoji: "🦖",
      value: 10.8,
      rank: 3,
    },
    {
      playerId: "current",
      playerName: "Sonia",
      playerEmoji: "🦋",
      value: 5.2,
      rank: 8,
    },
  ],
  speedChampions: [
    {
      category: "basic" as SkillCategory,
      categoryName: "Basic Operations",
      leaders: [
        {
          playerId: "p2",
          playerName: "Luna",
          playerEmoji: "🌙",
          value: 0.6,
          rank: 1,
        },
        {
          playerId: "p3",
          playerName: "Kai",
          playerEmoji: "🐬",
          value: 0.8,
          rank: 2,
        },
        {
          playerId: "p1",
          playerName: "Marcus",
          playerEmoji: "🦖",
          value: 0.9,
          rank: 3,
        },
      ],
    },
    {
      category: "fiveComplements" as SkillCategory,
      categoryName: "Five Complements",
      leaders: [
        {
          playerId: "p1",
          playerName: "Marcus",
          playerEmoji: "🦖",
          value: 1.2,
          rank: 1,
        },
        {
          playerId: "p2",
          playerName: "Luna",
          playerEmoji: "🌙",
          value: 1.4,
          rank: 2,
        },
        {
          playerId: "current",
          playerName: "Sonia",
          playerEmoji: "🦋",
          value: 1.5,
          rank: 3,
        },
      ],
    },
  ],
};

// ============================================================================
// Story Wrapper Components
// ============================================================================

function StoryWrapper({
  children,
  isDark = false,
}: {
  children: React.ReactNode;
  isDark?: boolean;
}) {
  return (
    <div
      className={css({
        backgroundColor: isDark ? "gray.900" : "white",
        padding: "2rem",
        borderRadius: "12px",
        minWidth: "600px",
        maxWidth: "800px",
      })}
    >
      {children}
    </div>
  );
}

function SectionWrapper({
  children,
  isDark = false,
  title,
}: {
  children: React.ReactNode;
  isDark?: boolean;
  title: string;
}) {
  return (
    <section
      className={css({
        backgroundColor: isDark ? "gray.800" : "gray.50",
        borderRadius: "16px",
        padding: "1.25rem",
      })}
    >
      <h2
        className={css({
          fontSize: "1.125rem",
          fontWeight: "bold",
          color: isDark ? "gray.100" : "gray.900",
          marginBottom: "1rem",
        })}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

// ============================================================================
// Meta
// ============================================================================

const meta: Meta<typeof ScoreboardTab> = {
  title: "Practice/Dashboard/ScoreboardTab",
  component: ScoreboardTab,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <QueryWrapper>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <Story />
        </div>
      </QueryWrapper>
    ),
  ],
  argTypes: {
    isDark: {
      control: "boolean",
      description: "Dark mode toggle",
    },
    classroomId: {
      control: "text",
      description:
        "Classroom ID for leaderboard (null/undefined hides leaderboard)",
    },
  },
};

export default meta;

type Story = StoryObj<typeof ScoreboardTab>;

// ============================================================================
// Full ScoreboardTab Stories (with loading states)
// ============================================================================

/**
 * Light mode with classroom - shows all sections
 */
export const LightModeWithClassroom: Story = {
  args: {
    studentId: "student-1",
    classroomId: "classroom-1",
    isDark: false,
  },
};

/**
 * Dark mode with classroom
 */
export const DarkModeWithClassroom: Story = {
  args: {
    studentId: "student-1",
    classroomId: "classroom-1",
    isDark: true,
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
};

/**
 * Light mode without classroom - hides leaderboard
 */
export const LightModeNoClassroom: Story = {
  args: {
    studentId: "student-1",
    classroomId: null,
    isDark: false,
  },
};

/**
 * Dark mode without classroom
 */
export const DarkModeNoClassroom: Story = {
  args: {
    studentId: "student-1",
    classroomId: null,
    isDark: true,
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// ============================================================================
// MasteryBar Component Stories
// ============================================================================

/**
 * Individual MasteryBar component - various states
 */
export const MasteryBarVariations: StoryObj = {
  render: () => (
    <StoryWrapper>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        })}
      >
        <div>
          <h3 className={css({ fontWeight: "bold", marginBottom: "0.5rem" })}>
            High Mastery (80%+)
          </h3>
          <MasteryBar
            value={0.92}
            label="Basic Operations"
            emoji="🔢"
            isDark={false}
          />
        </div>
        <div>
          <h3 className={css({ fontWeight: "bold", marginBottom: "0.5rem" })}>
            Medium Mastery (50-79%)
          </h3>
          <MasteryBar
            value={0.65}
            label="Five Complements"
            detail="3/4 mastered"
            emoji="✋"
            isDark={false}
          />
        </div>
        <div>
          <h3 className={css({ fontWeight: "bold", marginBottom: "0.5rem" })}>
            Low Mastery (&lt;50%)
          </h3>
          <MasteryBar
            value={0.25}
            label="Ten Complements"
            detail="1/9 mastered"
            emoji="🔟"
            isDark={false}
          />
        </div>
        <div>
          <h3 className={css({ fontWeight: "bold", marginBottom: "0.5rem" })}>
            Zero Progress
          </h3>
          <MasteryBar
            value={0}
            label="Advanced Combinations"
            detail="0/5 practiced"
            emoji="🚀"
            isDark={false}
          />
        </div>
        <div>
          <h3 className={css({ fontWeight: "bold", marginBottom: "0.5rem" })}>
            Full Mastery (100%)
          </h3>
          <MasteryBar
            value={1.0}
            label="Simple Combinations"
            detail="All mastered!"
            emoji="🌟"
            isDark={false}
          />
        </div>
      </div>
    </StoryWrapper>
  ),
};

/**
 * MasteryBar in dark mode
 */
export const MasteryBarDarkMode: StoryObj = {
  render: () => (
    <StoryWrapper isDark>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        })}
      >
        <MasteryBar
          value={0.85}
          label="Basic Operations"
          detail="3/3 mastered"
          emoji="🔢"
          isDark
        />
        <MasteryBar
          value={0.58}
          label="Five Complements"
          detail="2/4 mastered"
          emoji="✋"
          isDark
        />
        <MasteryBar
          value={0.22}
          label="Ten Complements"
          detail="2/9 practiced"
          emoji="🔟"
          isDark
        />
      </div>
    </StoryWrapper>
  ),
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// ============================================================================
// SkillsProgressSection Stories
// ============================================================================

/**
 * Skills Progress - Beginner student (low mastery, improving)
 */
export const SkillsProgressBeginner: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Skills Progress" isDark={false}>
        <SkillsProgressSection
          metrics={mockSkillMetricsBeginner}
          isLoading={false}
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Progress - Intermediate student (good progress)
 */
export const SkillsProgressIntermediate: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Skills Progress" isDark={false}>
        <SkillsProgressSection
          metrics={mockSkillMetricsIntermediate}
          isLoading={false}
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Progress - Advanced student (high mastery)
 */
export const SkillsProgressAdvanced: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Skills Progress" isDark={false}>
        <SkillsProgressSection
          metrics={mockSkillMetricsAdvanced}
          isLoading={false}
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Progress - Declining student (negative trends)
 */
export const SkillsProgressDeclining: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Skills Progress" isDark={false}>
        <SkillsProgressSection
          metrics={mockSkillMetricsDeclining}
          isLoading={false}
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Progress - Loading state
 */
export const SkillsProgressLoading: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Skills Progress" isDark={false}>
        <SkillsProgressSection
          metrics={undefined}
          isLoading={true}
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Progress - Empty state (no data)
 */
export const SkillsProgressEmpty: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Skills Progress" isDark={false}>
        <SkillsProgressSection
          metrics={{
            ...mockSkillMetricsBeginner,
            progress: {
              ...mockSkillMetricsBeginner.progress,
              totalProblems: 0,
            },
          }}
          isLoading={false}
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Progress - Dark mode
 */
export const SkillsProgressDarkMode: StoryObj = {
  render: () => (
    <StoryWrapper isDark>
      <SectionWrapper title="Skills Progress" isDark>
        <SkillsProgressSection
          metrics={mockSkillMetricsIntermediate}
          isLoading={false}
          isDark
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// ============================================================================
// SkillsLeaderboardSection Stories
// ============================================================================

/**
 * Skills Leaderboard - Full classroom with speed champions
 */
export const SkillsLeaderboardFull: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Classroom Achievements" isDark={false}>
        <SkillsLeaderboardSection
          leaderboard={mockClassroomLeaderboard}
          isLoading={false}
          currentPlayerId="current"
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Leaderboard - Small classroom (few students)
 */
export const SkillsLeaderboardSmall: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Classroom Achievements" isDark={false}>
        <SkillsLeaderboardSection
          leaderboard={mockClassroomLeaderboardSmall}
          isLoading={false}
          currentPlayerId="current"
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Leaderboard - Current student not in top 3
 * Shows the "Your rank" indicator below the top 3
 */
export const SkillsLeaderboardNotTop3: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Classroom Achievements" isDark={false}>
        <SkillsLeaderboardSection
          leaderboard={mockClassroomLeaderboardCurrentNotTop}
          isLoading={false}
          currentPlayerId="current"
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Leaderboard - Loading state
 */
export const SkillsLeaderboardLoading: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Classroom Achievements" isDark={false}>
        <SkillsLeaderboardSection
          leaderboard={undefined}
          isLoading={true}
          currentPlayerId="current"
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Leaderboard - Empty state (no players)
 */
export const SkillsLeaderboardEmpty: StoryObj = {
  render: () => (
    <StoryWrapper>
      <SectionWrapper title="Classroom Achievements" isDark={false}>
        <SkillsLeaderboardSection
          leaderboard={{ ...mockClassroomLeaderboard, playerCount: 0 }}
          isLoading={false}
          currentPlayerId="current"
          isDark={false}
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
};

/**
 * Skills Leaderboard - Dark mode
 */
export const SkillsLeaderboardDarkMode: StoryObj = {
  render: () => (
    <StoryWrapper isDark>
      <SectionWrapper title="Classroom Achievements" isDark>
        <SkillsLeaderboardSection
          leaderboard={mockClassroomLeaderboard}
          isLoading={false}
          currentPlayerId="current"
          isDark
        />
      </SectionWrapper>
    </StoryWrapper>
  ),
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// ============================================================================
// Combined Stories - All Progress Levels
// ============================================================================

/**
 * All student progress levels side by side
 */
export const AllProgressLevels: StoryObj = {
  render: () => (
    <div
      className={css({ display: "flex", flexDirection: "column", gap: "2rem" })}
    >
      <div>
        <h3
          className={css({
            fontSize: "1rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
            color: "blue.600",
          })}
        >
          Beginner (25% mastery)
        </h3>
        <StoryWrapper>
          <SectionWrapper title="Skills Progress" isDark={false}>
            <SkillsProgressSection
              metrics={mockSkillMetricsBeginner}
              isLoading={false}
              isDark={false}
            />
          </SectionWrapper>
        </StoryWrapper>
      </div>
      <div>
        <h3
          className={css({
            fontSize: "1rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
            color: "yellow.600",
          })}
        >
          Intermediate (58% mastery)
        </h3>
        <StoryWrapper>
          <SectionWrapper title="Skills Progress" isDark={false}>
            <SkillsProgressSection
              metrics={mockSkillMetricsIntermediate}
              isLoading={false}
              isDark={false}
            />
          </SectionWrapper>
        </StoryWrapper>
      </div>
      <div>
        <h3
          className={css({
            fontSize: "1rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
            color: "green.600",
          })}
        >
          Advanced (89% mastery)
        </h3>
        <StoryWrapper>
          <SectionWrapper title="Skills Progress" isDark={false}>
            <SkillsProgressSection
              metrics={mockSkillMetricsAdvanced}
              isLoading={false}
              isDark={false}
            />
          </SectionWrapper>
        </StoryWrapper>
      </div>
      <div>
        <h3
          className={css({
            fontSize: "1rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
            color: "red.600",
          })}
        >
          Declining (negative trends)
        </h3>
        <StoryWrapper>
          <SectionWrapper title="Skills Progress" isDark={false}>
            <SkillsProgressSection
              metrics={mockSkillMetricsDeclining}
              isLoading={false}
              isDark={false}
            />
          </SectionWrapper>
        </StoryWrapper>
      </div>
    </div>
  ),
};

/**
 * Tests for GameBreakDifficultyPresets component.
 * Shows Easy/Medium/Hard preset buttons when a game with presets is selected.
 */
import {
  render,
  screen,
  fireEvent,
  act,
  renderHook,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { SessionMode } from "@/lib/curriculum/session-mode";
import type { CurriculumPhase } from "@/lib/curriculum/definitions";
import {
  StartPracticeModalProvider,
  useStartPracticeModal,
} from "../StartPracticeModalContext";
import { GameBreakDifficultyPresets } from "../start-practice-modal/GameBreakDifficultyPresets";

// Mock ThemeContext
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

// Mock hooks and dependencies
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSessionPlan", () => ({
  useGenerateSessionPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useApproveSessionPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  useStartSessionPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  ActiveSessionExistsClientError: class extends Error {
    existingPlan = null;
  },
  NoSkillsEnabledClientError: class extends Error {},
  sessionPlanKeys: {
    active: (id: string) => ["session-plan", "active", id],
  },
}));

vi.mock("@/lib/arcade/practice-approved-games", () => ({
  getPracticeApprovedGames: () => [],
}));

vi.mock("@/lib/curriculum/skill-tutorial-config", () => ({
  getSkillTutorialConfig: () => null,
}));

// Mock curriculum phase for tests
const mockPhase: CurriculumPhase = {
  id: "L1.add.+1.direct",
  levelId: 1,
  operation: "addition",
  targetNumber: 1,
  usesFiveComplement: false,
  usesTenComplement: false,
  name: "Direct +1",
  description: "Learn direct addition of +1",
  primarySkillId: "add-direct-1",
  order: 1,
};

const defaultSessionMode: SessionMode = {
  type: "progression",
  nextSkill: { skillId: "test-skill", displayName: "Test Skill", pKnown: 0.8 },
  tutorialRequired: false,
  phase: mockPhase,
  skipCount: 0,
  focusDescription: "Test focus",
};

// Games with different configurations
const gamesWithPresets = [
  {
    manifest: {
      name: "memory-quiz",
      displayName: "Memory Quiz",
      shortName: "Memory Quiz",
      icon: "🧠",
      practiceBreakConfig: {
        suggestedConfig: { selectedCount: 5, displayTime: 2.0 },
        lockedFields: [] as string[],
        difficultyPresets: {
          easy: { selectedCount: 2, displayTime: 3.0 },
          medium: { selectedCount: 5, displayTime: 2.0 },
          hard: { selectedCount: 8, displayTime: 1.5 },
        },
      },
    },
  },
  {
    manifest: {
      name: "matching",
      displayName: "Matching",
      icon: "⚔️",
      // No practiceBreakConfig - no presets
    },
  },
];

const gameWithNoPresets = [
  {
    manifest: {
      name: "no-presets",
      displayName: "No Presets Game",
      icon: "🎮",
      practiceBreakConfig: {
        suggestedConfig: { cardCount: 5 },
        lockedFields: [] as string[],
        // No difficultyPresets
      },
    },
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createWrapper(games: any[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StartPracticeModalProvider
        studentId="test-student"
        studentName="Test Student"
        focusDescription="Test focus"
        sessionMode={defaultSessionMode}
        practiceApprovedGamesOverride={games}
      >
        {children}
      </StartPracticeModalProvider>
    );
  };
}

describe("GameBreakDifficultyPresets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Visibility", () => {
    it("should not render when no game is selected", () => {
      const { container } = render(<GameBreakDifficultyPresets />, {
        wrapper: createWrapper(gamesWithPresets),
      });

      expect(
        container.querySelector('[data-element="game-break-difficulty"]'),
      ).toBeNull();
    });

    it("should not render when selected game has no practiceBreakConfig", () => {
      // Use a component that sets the game and renders the presets
      const TestComponent = () => {
        const context = useStartPracticeModal();
        // Effect to select game
        if (context.gameBreakSelectedGame !== "matching") {
          context.setGameBreakSelectedGame("matching");
        }
        return <GameBreakDifficultyPresets />;
      };

      const { container } = render(<TestComponent />, {
        wrapper: createWrapper(gamesWithPresets),
      });

      expect(
        container.querySelector('[data-element="game-break-difficulty"]'),
      ).toBeNull();
    });

    it("should not render when selected game has no difficulty presets", () => {
      const TestComponent = () => {
        const context = useStartPracticeModal();
        if (context.gameBreakSelectedGame !== "no-presets") {
          context.setGameBreakSelectedGame("no-presets");
        }
        return <GameBreakDifficultyPresets />;
      };

      const { container } = render(<TestComponent />, {
        wrapper: createWrapper(gameWithNoPresets),
      });

      expect(
        container.querySelector('[data-element="game-break-difficulty"]'),
      ).toBeNull();
    });
  });

  describe("Display", () => {
    it("should render Easy, Medium, Hard buttons when game with presets is selected", () => {
      const TestComponent = () => {
        const context = useStartPracticeModal();
        if (context.gameBreakSelectedGame !== "memory-quiz") {
          context.setGameBreakSelectedGame("memory-quiz");
        }
        return <GameBreakDifficultyPresets />;
      };

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithPresets),
      });

      expect(screen.getByText("Easy")).toBeInTheDocument();
      expect(screen.getByText("Medium")).toBeInTheDocument();
      expect(screen.getByText("Hard")).toBeInTheDocument();
    });

    it("should show the emoji icons for each preset", () => {
      const TestComponent = () => {
        const context = useStartPracticeModal();
        if (context.gameBreakSelectedGame !== "memory-quiz") {
          context.setGameBreakSelectedGame("memory-quiz");
        }
        return <GameBreakDifficultyPresets />;
      };

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithPresets),
      });

      expect(screen.getByText("🌱")).toBeInTheDocument(); // Easy
      expect(screen.getByText("🌿")).toBeInTheDocument(); // Medium
      expect(screen.getByText("🌳")).toBeInTheDocument(); // Hard
    });

    it("should show medium as selected by default", () => {
      const TestComponent = () => {
        const context = useStartPracticeModal();
        if (context.gameBreakSelectedGame !== "memory-quiz") {
          context.setGameBreakSelectedGame("memory-quiz");
        }
        return <GameBreakDifficultyPresets />;
      };

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithPresets),
      });

      const mediumButton = screen.getByRole("button", { name: /medium/i });
      expect(mediumButton).toHaveAttribute("data-selected", "true");
    });
  });

  describe("Selection", () => {
    it("should update preset when clicking a different option", () => {
      const TestComponent = () => {
        const context = useStartPracticeModal();
        if (context.gameBreakSelectedGame !== "memory-quiz") {
          context.setGameBreakSelectedGame("memory-quiz");
        }
        return (
          <div>
            <GameBreakDifficultyPresets />
            <div data-testid="current-preset">
              {context.gameBreakDifficultyPreset}
            </div>
          </div>
        );
      };

      render(<TestComponent />, {
        wrapper: createWrapper(gamesWithPresets),
      });

      // Initially medium
      expect(screen.getByTestId("current-preset").textContent).toBe("medium");

      // Click easy
      fireEvent.click(screen.getByRole("button", { name: /easy/i }));
      expect(screen.getByTestId("current-preset").textContent).toBe("easy");

      // Click hard
      fireEvent.click(screen.getByRole("button", { name: /hard/i }));
      expect(screen.getByTestId("current-preset").textContent).toBe("hard");
    });
  });

  describe("Customize Interaction", () => {
    it("should be hidden when customize view is shown", () => {
      const TestComponent = () => {
        const context = useStartPracticeModal();
        if (context.gameBreakSelectedGame !== "memory-quiz") {
          context.setGameBreakSelectedGame("memory-quiz");
        }
        if (!context.gameBreakShowCustomize) {
          context.setGameBreakShowCustomize(true);
        }
        return <GameBreakDifficultyPresets />;
      };

      const { container } = render(<TestComponent />, {
        wrapper: createWrapper(gamesWithPresets),
      });

      // Presets should be hidden when customize is shown
      expect(
        container.querySelector('[data-element="game-break-difficulty"]'),
      ).toBeNull();
    });
  });
});

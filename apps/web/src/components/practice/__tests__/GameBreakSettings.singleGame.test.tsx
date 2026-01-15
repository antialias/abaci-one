/**
 * Tests for GameBreakSettings component when only one practice-approved game exists.
 * This is a separate file because the mock must be set at module level.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { SessionMode } from "@/lib/curriculum/session-mode";
import type { CurriculumPhase } from "@/lib/curriculum/definitions";
import { StartPracticeModalProvider } from "../StartPracticeModalContext";
import { GameBreakSettings } from "../start-practice-modal";

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

// Mock with SINGLE game to test single-game mode
vi.mock("@/lib/arcade/practice-approved-games", () => ({
  getPracticeApprovedGames: () => [
    {
      manifest: {
        name: "matching",
        displayName: "Matching Pairs Battle",
        shortName: "Matching Pairs",
        icon: "⚔️",
      },
    },
  ],
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

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StartPracticeModalProvider
        studentId="test-student"
        studentName="Test Student"
        focusDescription="Test focus"
        sessionMode={defaultSessionMode}
      >
        {children}
      </StartPracticeModalProvider>
    );
  };
}

describe("GameBreakSettings - Single Game Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with single-game mode attribute", () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    const container = document.querySelector('[data-setting="game-break"]');
    expect(container).toHaveAttribute("data-mode", "single-game");
  });

  it("should show the Game Breaks label", () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    expect(screen.getByText("Game Breaks")).toBeInTheDocument();
  });

  it("should show the game icon and shortName", () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    // Should show the game icon
    expect(screen.getByText("⚔️")).toBeInTheDocument();
    // Should show the shortName (not displayName)
    expect(screen.getByText("Matching Pairs")).toBeInTheDocument();
    // Should NOT show the full displayName
    expect(screen.queryByText("Matching Pairs Battle")).not.toBeInTheDocument();
  });

  it("should show compact duration options (2m, 3m, 5m)", () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    expect(screen.getByText("2m")).toBeInTheDocument();
    expect(screen.getByText("3m")).toBeInTheDocument();
    expect(screen.getByText("5m")).toBeInTheDocument();
    // Should NOT show 10m option (that's only in multi-game mode)
    expect(screen.queryByText("10m")).not.toBeInTheDocument();
  });

  it('should show "More games coming soon!" hint', () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    expect(screen.getByText("More games coming soon!")).toBeInTheDocument();
  });

  it('should show "Starts automatically between parts" helper text', () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    expect(
      screen.getByText("Starts automatically between parts"),
    ).toBeInTheDocument();
  });

  it("should NOT show selection mode toggle (Auto-start/Kid picks)", () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    expect(screen.queryByText("Auto-start")).not.toBeInTheDocument();
    expect(screen.queryByText("Kid picks")).not.toBeInTheDocument();
    expect(screen.queryByText("How to start")).not.toBeInTheDocument();
  });

  it("should NOT show game selection dropdown", () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    // Should not have the game dropdown trigger
    expect(
      document.querySelector('[data-element="game-select-trigger"]'),
    ).not.toBeInTheDocument();
    // Should not show "Random" option
    expect(screen.queryByText("Random")).not.toBeInTheDocument();
  });

  it("should toggle game break off when clicking toggle", () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    // Initially shows "On"
    expect(screen.getByText("On")).toBeInTheDocument();

    const toggleButton = screen.getByRole("button", { name: /on/i });
    fireEvent.click(toggleButton);

    // Now shows "Off"
    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("should hide game info and duration when disabled", () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    // First, disable game breaks
    const toggleButton = screen.getByRole("button", { name: /on/i });
    fireEvent.click(toggleButton);

    // Game icon and name should be hidden
    expect(screen.queryByText("⚔️")).not.toBeInTheDocument();
    expect(screen.queryByText("Matching Pairs")).not.toBeInTheDocument();
    // Duration options should be hidden
    expect(screen.queryByText("2m")).not.toBeInTheDocument();
    // Helper texts should be hidden
    expect(
      screen.queryByText("More games coming soon!"),
    ).not.toBeInTheDocument();
  });

  it("should allow changing duration", () => {
    render(<GameBreakSettings />, { wrapper: createWrapper() });

    // Click the 5m button
    const fiveMinButton = screen.getByRole("button", { name: "5m" });
    fireEvent.click(fiveMinButton);

    // Should be selected
    expect(fiveMinButton).toHaveAttribute("data-selected", "true");
  });
});

import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  GameBreakResultsScreen,
  RESULTS_COUNTDOWN_MS,
} from "../GameBreakResultsScreen";
import type {
  GameResultsReport,
  PlayerResult,
} from "@/lib/arcade/game-sdk/types";

// Mock ThemeContext
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

// Mock requestAnimationFrame for testing
let rafCallbacks: FrameRequestCallback[] = [];
let rafId = 0;

vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
  rafCallbacks.push(callback);
  return ++rafId;
});

vi.stubGlobal("cancelAnimationFrame", (id: number) => {
  rafCallbacks = rafCallbacks.filter((_, index) => index !== id - 1);
});

describe("GameBreakResultsScreen", () => {
  const mockOnComplete = vi.fn();

  const mockStudent = {
    name: "Sonia",
    emoji: "🌟",
  };

  const createMockResults = (
    overrides: Partial<GameResultsReport> = {},
  ): GameResultsReport => ({
    gameName: "matching",
    gameDisplayName: "Matching Pairs Battle",
    gameIcon: "⚔️",
    durationMs: 45000,
    completedNormally: true,
    startedAt: Date.now() - 45000,
    endedAt: Date.now(),
    gameMode: "single-player",
    playerCount: 1,
    playerResults: [
      {
        playerId: "player-1",
        playerName: "Sonia",
        playerEmoji: "🌟",
        userId: "user-1",
        score: 8,
        rank: 1,
        correctCount: 8,
        totalAttempts: 16,
        accuracy: 100,
        bestStreak: 4,
      },
    ],
    itemsCompleted: 8,
    itemsTotal: 8,
    completionPercent: 100,
    customStats: [
      { label: "Pairs Found", value: "8/8", icon: "🎯", highlight: true },
      { label: "Total Moves", value: 16, icon: "👆" },
      { label: "Time", value: "0:45", icon: "⏱️" },
      { label: "Accuracy", value: "100%", icon: "📊", highlight: true },
    ],
    headline: "Perfect Memory!",
    resultTheme: "success",
    celebrationType: "confetti",
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = [];
    rafId = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Visibility Tests
  // ============================================================================

  describe("visibility", () => {
    it("renders nothing when isVisible is false", () => {
      const { container } = render(
        <GameBreakResultsScreen
          isVisible={false}
          results={createMockResults()}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders content when isVisible is true", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults()}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Perfect Memory!")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Result Theme Tests
  // ============================================================================

  describe("result themes", () => {
    it("displays success theme correctly", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            headline: "Perfect Memory!",
            resultTheme: "success",
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Perfect Memory!")).toBeInTheDocument();
      expect(screen.getByText("⚔️")).toBeInTheDocument();
    });

    it("displays good theme correctly", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            headline: "Great Job!",
            resultTheme: "good",
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Great Job!")).toBeInTheDocument();
    });

    it("displays neutral theme correctly", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            headline: "Nice Work!",
            resultTheme: "neutral",
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Nice Work!")).toBeInTheDocument();
    });

    it("displays needs-practice theme correctly", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            headline: "Keep Practicing!",
            resultTheme: "needs-practice",
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Keep Practicing!")).toBeInTheDocument();
    });

    it("displays subheadline when provided", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            subheadline: "You matched all pairs without any mistakes!",
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(
        screen.getByText("You matched all pairs without any mistakes!"),
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Player Results Tests
  // ============================================================================

  describe("player results", () => {
    it("displays single player result correctly", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            playerResults: [
              {
                playerId: "player-1",
                playerName: "Sonia",
                playerEmoji: "🌟",
                userId: "user-1",
                score: 8,
                rank: 1,
              },
            ],
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Sonia")).toBeInTheDocument();
      expect(screen.getByText("🌟")).toBeInTheDocument();
      expect(screen.getByText("- 8 points")).toBeInTheDocument();
    });

    it("does not display points when score is undefined", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            playerResults: [
              {
                playerId: "player-1",
                playerName: "Sonia",
                playerEmoji: "🌟",
                userId: "user-1",
                score: undefined as any, // No score
                rank: 1,
              },
            ],
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Sonia")).toBeInTheDocument();
      expect(screen.queryByText(/points/)).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Custom Stats Tests
  // ============================================================================

  describe("custom stats", () => {
    it("displays highlighted stats", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            customStats: [
              {
                label: "Pairs Found",
                value: "6/8",
                icon: "🎯",
                highlight: true,
              },
              { label: "Accuracy", value: "95%", icon: "📊", highlight: true },
            ],
            // Override items to avoid duplicate text
            itemsCompleted: undefined,
            itemsTotal: undefined,
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Pairs Found:")).toBeInTheDocument();
      expect(screen.getByText("6/8")).toBeInTheDocument();
      expect(screen.getByText("Accuracy:")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
    });

    it("displays regular stats in grid", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            customStats: [
              { label: "Total Moves", value: 16, icon: "👆" },
              { label: "Time", value: "0:45", icon: "⏱️" },
            ],
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Total Moves:")).toBeInTheDocument();
      expect(screen.getByText("16")).toBeInTheDocument();
      expect(screen.getByText("Time:")).toBeInTheDocument();
      expect(screen.getByText("0:45")).toBeInTheDocument();
    });

    it("displays stat icons", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            customStats: [
              { label: "Pairs", value: 8, icon: "🎯", highlight: true },
            ],
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("🎯")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Completion Info Tests
  // ============================================================================

  describe("completion info", () => {
    it("displays completion progress", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            itemsCompleted: 6,
            itemsTotal: 8,
            completionPercent: 75,
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Completed:")).toBeInTheDocument();
      expect(screen.getByText("6/8")).toBeInTheDocument();
      expect(screen.getByText("(75%)")).toBeInTheDocument();
    });

    it("does not display completion when items are undefined", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({
            itemsCompleted: undefined,
            itemsTotal: undefined,
          })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.queryByText("Completed:")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Continue Button Tests
  // ============================================================================

  describe("continue button", () => {
    it("displays continue button", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults()}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Back to Practice" }),
      ).toBeInTheDocument();
    });

    it("calls onComplete when continue button is clicked", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults()}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Back to Practice" }));

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it("only calls onComplete once even with multiple clicks", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults()}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      const button = screen.getByRole("button", { name: "Back to Practice" });
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Should only be called once due to hasCompletedRef guard
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Data Attributes Tests
  // ============================================================================

  describe("data attributes", () => {
    it("includes data-component on root element", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({ gameName: "matching" })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      const component = document.querySelector(
        '[data-component="game-break-results-screen"]',
      );
      expect(component).toBeInTheDocument();
    });

    it("includes data-game attribute", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({ gameName: "matching" })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      const component = document.querySelector('[data-game="matching"]');
      expect(component).toBeInTheDocument();
    });

    it("includes data-theme attribute", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({ resultTheme: "success" })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      const component = document.querySelector('[data-theme="success"]');
      expect(component).toBeInTheDocument();
    });

    it("includes data-action on continue button", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults()}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      const button = document.querySelector(
        '[data-action="continue-to-practice"]',
      );
      expect(button).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Game Icon Tests
  // ============================================================================

  describe("game icon", () => {
    it("displays the game icon", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({ gameIcon: "🎮" })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("🎮")).toBeInTheDocument();
    });

    it("displays different game icons", () => {
      const { rerender } = render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({ gameIcon: "🏁" })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("🏁")).toBeInTheDocument();

      rerender(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({ gameIcon: "🧠" })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("🧠")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Default Values Tests
  // ============================================================================

  describe("default values", () => {
    it("uses default headline when not provided", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({ headline: undefined })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Game Complete!")).toBeInTheDocument();
    });

    it("uses default countdown when not provided", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults()}
          student={mockStudent}
          onComplete={mockOnComplete}
          // No countdownMs prop - should use default RESULTS_COUNTDOWN_MS
        />,
      );

      // Component should render without errors
      expect(screen.getByText("Perfect Memory!")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Empty Stats Handling Tests
  // ============================================================================

  describe("empty stats handling", () => {
    it("renders without error when customStats is undefined", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({ customStats: undefined })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Perfect Memory!")).toBeInTheDocument();
    });

    it("renders without error when customStats is empty", () => {
      render(
        <GameBreakResultsScreen
          isVisible={true}
          results={createMockResults({ customStats: [] })}
          student={mockStudent}
          onComplete={mockOnComplete}
        />,
      );

      expect(screen.getByText("Perfect Memory!")).toBeInTheDocument();
    });
  });
});

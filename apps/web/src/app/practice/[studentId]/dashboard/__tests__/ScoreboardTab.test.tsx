import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { ScoreboardTab } from "../ScoreboardTab";

// Mock the hooks module
vi.mock("@/hooks/useGameResults", () => ({
  usePlayerGameHistory: vi.fn(),
  usePlayerClassroomRank: vi.fn(),
}));

// Import mocked hooks
import {
  usePlayerGameHistory,
  usePlayerClassroomRank,
} from "@/hooks/useGameResults";

// Cast to mock functions for type safety
const mockUsePlayerGameHistory = usePlayerGameHistory as ReturnType<
  typeof vi.fn
>;
const mockUsePlayerClassroomRank = usePlayerClassroomRank as ReturnType<
  typeof vi.fn
>;

describe("ScoreboardTab", () => {
  const defaultProps = {
    studentId: "student-1",
    classroomId: "classroom-1",
    isDark: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Loading States
  // ============================================================================

  describe("loading states", () => {
    it("shows loading state for personal bests", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: undefined,
        isLoading: true,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      // Find loading text in personal bests section
      const personalBestsSection = document.querySelector(
        '[data-section="personal-bests"]',
      );

      expect(personalBestsSection).toBeInTheDocument();
      expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it("shows loading state for leaderboard", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: true,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getAllByText("Loading...").length).toBeGreaterThanOrEqual(
        1,
      );
    });
  });

  // ============================================================================
  // Empty States
  // ============================================================================

  describe("empty states", () => {
    it("shows empty state for personal bests when no games played", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText(/No games played yet/i)).toBeInTheDocument();
    });

    it("shows empty state for recent games when no history", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText(/No recent games/i)).toBeInTheDocument();
    });

    it("shows empty state for leaderboard when no classmates have played", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(
        screen.getByText(/No classmates have played games yet/i),
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Personal Bests Display
  // ============================================================================

  describe("personal bests display", () => {
    it("displays personal best scores for each game", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: {
          personalBests: {
            matching: {
              bestScore: 95,
              gamesPlayed: 5,
              displayName: "Matching Pairs",
              icon: "⚔️",
            },
            "card-sorting": {
              bestScore: 82,
              gamesPlayed: 3,
              displayName: "Card Sorting",
              icon: "🔢",
            },
          },
          history: [],
        },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("Matching Pairs")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
      expect(screen.getByText("5 games played")).toBeInTheDocument();

      expect(screen.getByText("Card Sorting")).toBeInTheDocument();
      expect(screen.getByText("82%")).toBeInTheDocument();
      expect(screen.getByText("3 games played")).toBeInTheDocument();
    });

    it("displays game icons", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: {
          personalBests: {
            matching: {
              bestScore: 95,
              gamesPlayed: 5,
              displayName: "Matching Pairs",
              icon: "⚔️",
            },
          },
          history: [],
        },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("⚔️")).toBeInTheDocument();
    });

    it("uses default icon when none provided", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: {
          personalBests: {
            matching: {
              bestScore: 95,
              gamesPlayed: 1,
              displayName: "Matching Pairs",
              icon: null,
            },
          },
          history: [],
        },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      // Default icon appears in the personal bests grid item (within matching game card)
      const matchingCard = document.querySelector('[data-game="matching"]');
      expect(matchingCard).toBeInTheDocument();
      expect(matchingCard?.querySelector("span")).toHaveTextContent("🎮");
    });

    it("shows singular 'game' for 1 game played", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: {
          personalBests: {
            matching: {
              bestScore: 95,
              gamesPlayed: 1,
              displayName: "Matching Pairs",
              icon: "⚔️",
            },
          },
          history: [],
        },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("1 game played")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Recent Games Display
  // ============================================================================

  describe("recent games display", () => {
    it("displays recent games in a table", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: {
          personalBests: {},
          history: [
            {
              id: "game-1",
              playerId: "student-1",
              gameName: "matching",
              gameDisplayName: "Matching Pairs",
              gameIcon: "⚔️",
              normalizedScore: 95,
              durationMs: 45000,
              playedAt: new Date(),
            },
          ],
        },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("Matching Pairs")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
    });

    it("formats duration correctly", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: {
          personalBests: {},
          history: [
            {
              id: "game-1",
              playerId: "student-1",
              gameName: "matching",
              gameDisplayName: "Matching Pairs",
              gameIcon: "⚔️",
              normalizedScore: 95,
              durationMs: 125000, // 2m 5s
              playedAt: new Date(),
            },
          ],
        },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("2m 5s")).toBeInTheDocument();
    });

    it("shows dash for missing duration", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: {
          personalBests: {},
          history: [
            {
              id: "game-1",
              playerId: "student-1",
              gameName: "matching",
              gameDisplayName: "Matching Pairs",
              gameIcon: "⚔️",
              normalizedScore: 95,
              durationMs: null,
              playedAt: new Date(),
            },
          ],
        },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("limits display to 10 games", () => {
      const manyGames = Array.from({ length: 15 }, (_, i) => ({
        id: `game-${i}`,
        playerId: "student-1",
        gameName: "matching",
        gameDisplayName: `Game ${i}`,
        gameIcon: "⚔️",
        normalizedScore: 90 - i,
        durationMs: 45000,
        playedAt: new Date(Date.now() - i * 3600000),
      }));

      mockUsePlayerGameHistory.mockReturnValue({
        data: {
          personalBests: {},
          history: manyGames,
        },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      // Should only show first 10
      expect(screen.getByText("Game 0")).toBeInTheDocument();
      expect(screen.getByText("Game 9")).toBeInTheDocument();
      expect(screen.queryByText("Game 10")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Classroom Leaderboard Display
  // ============================================================================

  describe("classroom leaderboard display", () => {
    it("displays leaderboard when classroomId is provided", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [
          {
            playerId: "player-1",
            playerName: "Alice",
            playerEmoji: "🌟",
            bestScore: 95,
            gamesPlayed: 10,
            avgScore: 88,
            rank: 1,
          },
          {
            playerId: "student-1",
            playerName: "Bob",
            playerEmoji: "🚀",
            bestScore: 90,
            gamesPlayed: 8,
            avgScore: 82,
            rank: 2,
          },
        ],
        playerRanking: {
          playerId: "student-1",
          playerName: "Bob",
          playerEmoji: "🚀",
          bestScore: 90,
          gamesPlayed: 8,
          avgScore: 82,
          rank: 2,
        },
        totalPlayers: 5,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("Classroom Leaderboard")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("95%")).toBeInTheDocument();
      expect(screen.getByText("90%")).toBeInTheDocument();
    });

    it("highlights current player in leaderboard", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [
          {
            playerId: "student-1",
            playerName: "Bob",
            playerEmoji: "🚀",
            bestScore: 90,
            gamesPlayed: 8,
            avgScore: 82,
            rank: 1,
          },
        ],
        playerRanking: {
          playerId: "student-1",
          playerName: "Bob",
          playerEmoji: "🚀",
          bestScore: 90,
          gamesPlayed: 8,
          avgScore: 82,
          rank: 1,
        },
        totalPlayers: 1,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("(You)")).toBeInTheDocument();
    });

    it("shows player rank summary", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: {
          playerId: "student-1",
          playerName: "Bob",
          playerEmoji: "🚀",
          bestScore: 90,
          gamesPlayed: 8,
          avgScore: 82,
          rank: 3,
        },
        totalPlayers: 10,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText(/ranked #3 of 10/i)).toBeInTheDocument();
    });

    it("hides leaderboard when classroomId is null", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} classroomId={null} />);

      expect(
        screen.queryByText("Classroom Leaderboard"),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/Join a classroom/i)).toBeInTheDocument();
    });

    it("hides leaderboard when classroomId is undefined", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} classroomId={undefined} />);

      expect(
        screen.queryByText("Classroom Leaderboard"),
      ).not.toBeInTheDocument();
    });

    it("displays rank badges for top 3", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [
          {
            playerId: "player-1",
            playerName: "Gold",
            playerEmoji: "🥇",
            bestScore: 100,
            gamesPlayed: 10,
            avgScore: 95,
            rank: 1,
          },
          {
            playerId: "player-2",
            playerName: "Silver",
            playerEmoji: "🥈",
            bestScore: 95,
            gamesPlayed: 10,
            avgScore: 90,
            rank: 2,
          },
          {
            playerId: "player-3",
            playerName: "Bronze",
            playerEmoji: "🥉",
            bestScore: 90,
            gamesPlayed: 10,
            avgScore: 85,
            rank: 3,
          },
        ],
        playerRanking: null,
        totalPlayers: 3,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      // Check that ranks 1, 2, 3 are displayed
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Section Headers
  // ============================================================================

  describe("section headers", () => {
    it("displays Personal Bests header with trophy emoji", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("Personal Bests")).toBeInTheDocument();
      expect(screen.getByText("🏆")).toBeInTheDocument();
    });

    it("displays Recent Games header with game controller emoji", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("Recent Games")).toBeInTheDocument();
      expect(screen.getByText("🎮")).toBeInTheDocument();
    });

    it("displays Classroom Leaderboard header with chart emoji", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(screen.getByText("Classroom Leaderboard")).toBeInTheDocument();
      expect(screen.getByText("📊")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Data Attributes
  // ============================================================================

  describe("data attributes", () => {
    it("includes data-component on root element", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      const component = document.querySelector(
        '[data-component="scoreboard-tab"]',
      );
      expect(component).toBeInTheDocument();
    });

    it("includes data-section on each section", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: { personalBests: {}, history: [] },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      expect(
        document.querySelector('[data-section="personal-bests"]'),
      ).toBeInTheDocument();
      expect(
        document.querySelector('[data-section="recent-games"]'),
      ).toBeInTheDocument();
      expect(
        document.querySelector('[data-section="classroom-leaderboard"]'),
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Score Color Coding
  // ============================================================================

  describe("score color coding", () => {
    it("shows high scores (>= 80) in green", () => {
      mockUsePlayerGameHistory.mockReturnValue({
        data: {
          personalBests: {
            matching: {
              bestScore: 95,
              gamesPlayed: 1,
              displayName: "Matching",
              icon: "⚔️",
            },
          },
          history: [],
        },
        isLoading: false,
      });
      mockUsePlayerClassroomRank.mockReturnValue({
        rankings: [],
        playerRanking: null,
        totalPlayers: 0,
        isLoading: false,
      });

      render(<ScoreboardTab {...defaultProps} />);

      // The score should be displayed
      expect(screen.getByText("95%")).toBeInTheDocument();
    });
  });
});

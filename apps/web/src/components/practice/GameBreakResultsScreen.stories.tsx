"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { GameBreakResultsScreen } from "./GameBreakResultsScreen";
import type { GameResultsReport } from "@/lib/arcade/game-sdk/types";

/**
 * Stories for GameBreakResultsScreen - the interstitial shown after a game break
 * when the game completes normally.
 *
 * Shows:
 * - Different result themes (success, good, neutral, needs-practice)
 * - Single-player vs multiplayer results
 * - Various stat configurations
 * - Countdown timer behavior
 */

const meta: Meta<typeof GameBreakResultsScreen> = {
  title: "Practice/GameBreakResultsScreen",
  component: GameBreakResultsScreen,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  argTypes: {
    countdownMs: {
      control: { type: "number", min: 1000, max: 30000, step: 1000 },
      description: "Countdown duration in milliseconds",
    },
  },
};

export default meta;

type Story = StoryObj<typeof GameBreakResultsScreen>;

// ============================================================================
// Mock Data
// ============================================================================

const mockStudent = {
  name: "Sonia",
  emoji: "🌟",
};

const createMatchingResults = (
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

const createCardSortingResults = (
  overrides: Partial<GameResultsReport> = {},
): GameResultsReport => ({
  gameName: "card-sorting",
  gameDisplayName: "Card Sorting Challenge",
  gameIcon: "🔢",
  durationMs: 62000,
  completedNormally: true,
  startedAt: Date.now() - 62000,
  endedAt: Date.now(),
  gameMode: "single-player",
  playerCount: 1,
  playerResults: [
    {
      playerId: "player-1",
      playerName: "Sonia",
      playerEmoji: "🌟",
      userId: "user-1",
      score: 85,
      rank: 1,
      correctCount: 6,
      totalAttempts: 8,
      accuracy: 75,
    },
  ],
  scoreBreakdown: [
    {
      component: "Exact Position",
      points: 30,
      maxPoints: 100,
      description: "Cards in perfect position",
    },
    {
      component: "Relative Order",
      points: 35,
      maxPoints: 100,
      description: "Longest correct sequence",
    },
    {
      component: "Inversions",
      points: 20,
      maxPoints: 100,
      description: "Fewer out-of-order pairs",
    },
  ],
  customStats: [
    { label: "Final Score", value: "85/100", icon: "🏆", highlight: true },
    { label: "Exact Matches", value: "6/8", icon: "✓" },
    { label: "Time", value: "1:02", icon: "⏱️" },
  ],
  headline: "Great Sorting!",
  resultTheme: "good",
  celebrationType: "stars",
  ...overrides,
});

const createMemoryQuizResults = (
  overrides: Partial<GameResultsReport> = {},
): GameResultsReport => ({
  gameName: "memory-quiz",
  gameDisplayName: "Memory Quiz",
  gameIcon: "🧠",
  durationMs: 90000,
  completedNormally: true,
  startedAt: Date.now() - 90000,
  endedAt: Date.now(),
  gameMode: "cooperative",
  playerCount: 2,
  playerResults: [
    {
      playerId: "player-1",
      playerName: "Sonia",
      playerEmoji: "🌟",
      userId: "user-1",
      score: 5,
      rank: 1,
      correctCount: 5,
      incorrectCount: 2,
      accuracy: 71,
    },
    {
      playerId: "player-2",
      playerName: "Alex",
      playerEmoji: "🚀",
      userId: "user-2",
      score: 4,
      rank: 2,
      correctCount: 4,
      incorrectCount: 3,
      accuracy: 57,
    },
  ],
  teamScore: 9,
  teamAccuracy: 64,
  itemsCompleted: 9,
  itemsTotal: 12,
  completionPercent: 75,
  customStats: [
    { label: "Numbers Found", value: "9/12", icon: "🎯", highlight: true },
    { label: "Wrong Guesses", value: 5, icon: "❌" },
    { label: "Time", value: "1:30", icon: "⏱️" },
  ],
  headline: "Good Effort!",
  resultTheme: "neutral",
  celebrationType: "none",
  ...overrides,
});

// ============================================================================
// Stories
// ============================================================================

/**
 * Perfect game - Success theme with confetti celebration
 */
export const PerfectGame: Story = {
  args: {
    isVisible: true,
    results: createMatchingResults(),
    student: mockStudent,
    countdownMs: 5000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * Good performance - Blue theme with stars
 */
export const GoodPerformance: Story = {
  args: {
    isVisible: true,
    results: createCardSortingResults(),
    student: mockStudent,
    countdownMs: 5000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * Needs practice - Yellow theme, no celebration
 */
export const NeedsPractice: Story = {
  args: {
    isVisible: true,
    results: createMatchingResults({
      headline: "Keep Practicing!",
      resultTheme: "needs-practice",
      celebrationType: "none",
      completionPercent: 50,
      itemsCompleted: 4,
      playerResults: [
        {
          playerId: "player-1",
          playerName: "Sonia",
          playerEmoji: "🌟",
          userId: "user-1",
          score: 4,
          rank: 1,
          correctCount: 4,
          totalAttempts: 20,
          accuracy: 40,
          bestStreak: 2,
        },
      ],
      customStats: [
        { label: "Pairs Found", value: "4/8", icon: "🎯", highlight: true },
        { label: "Total Moves", value: 20, icon: "👆" },
        { label: "Time", value: "2:30", icon: "⏱️" },
        { label: "Accuracy", value: "40%", icon: "📊" },
      ],
    }),
    student: mockStudent,
    countdownMs: 5000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * Neutral result - Gray theme
 */
export const NeutralResult: Story = {
  args: {
    isVisible: true,
    results: createMemoryQuizResults(),
    student: mockStudent,
    countdownMs: 5000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * Card Sorting with score breakdown
 */
export const WithScoreBreakdown: Story = {
  args: {
    isVisible: true,
    results: createCardSortingResults(),
    student: mockStudent,
    countdownMs: 5000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * Cooperative game with team results
 */
export const CooperativeGame: Story = {
  args: {
    isVisible: true,
    results: createMemoryQuizResults({
      headline: "Great Teamwork!",
      resultTheme: "good",
    }),
    student: mockStudent,
    countdownMs: 5000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * Quick countdown (2 seconds) for testing
 */
export const QuickCountdown: Story = {
  args: {
    isVisible: true,
    results: createMatchingResults(),
    student: mockStudent,
    countdownMs: 2000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * Long countdown (10 seconds)
 */
export const LongCountdown: Story = {
  args: {
    isVisible: true,
    results: createMatchingResults(),
    student: mockStudent,
    countdownMs: 10000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * Minimal stats - just the essentials
 */
export const MinimalStats: Story = {
  args: {
    isVisible: true,
    results: createMatchingResults({
      customStats: [{ label: "Score", value: 8, icon: "🏆", highlight: true }],
      headline: "Game Complete!",
      subheadline: undefined,
      resultTheme: "neutral",
    }),
    student: mockStudent,
    countdownMs: 5000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * With subheadline
 */
export const WithSubheadline: Story = {
  args: {
    isVisible: true,
    results: createMatchingResults({
      headline: "Perfect Memory!",
      subheadline: "You matched all pairs without any mistakes!",
    }),
    student: mockStudent,
    countdownMs: 5000,
    onComplete: () => console.log("Results complete"),
  },
};

/**
 * Different game - Complement Race
 */
export const ComplementRaceResults: Story = {
  args: {
    isVisible: true,
    results: {
      gameName: "complement-race",
      gameDisplayName: "Complement Race",
      gameIcon: "🏁",
      durationMs: 120000,
      completedNormally: true,
      startedAt: Date.now() - 120000,
      endedAt: Date.now(),
      gameMode: "competitive",
      playerCount: 1,
      playerResults: [
        {
          playerId: "player-1",
          playerName: "Sonia",
          playerEmoji: "🌟",
          userId: "user-1",
          score: 15,
          rank: 1,
          isWinner: true,
          correctCount: 15,
          totalAttempts: 18,
          accuracy: 83,
          bestStreak: 7,
        },
      ],
      winnerId: "player-1",
      winCondition: "completion",
      customStats: [
        { label: "Questions", value: "15/18", icon: "🎯", highlight: true },
        { label: "Best Streak", value: 7, icon: "🔥" },
        { label: "Race Time", value: "2:00", icon: "⏱️" },
        { label: "Accuracy", value: "83%", icon: "📊" },
      ],
      headline: "Race Complete!",
      resultTheme: "success",
      celebrationType: "fireworks",
    },
    student: mockStudent,
    countdownMs: 5000,
    onComplete: () => console.log("Results complete"),
  },
};

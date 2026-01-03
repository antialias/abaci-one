import type { GameConfig, GameState } from "@/lib/arcade/game-sdk";
import type { PlayerMetadata } from "@/lib/arcade/player-ownership.client";

export interface QuizCard {
  number: number;
  svgComponent: JSX.Element | null;
  element: HTMLElement | null;
}

export interface PlayerScore {
  correct: number;
  incorrect: number;
}

// Memory Quiz Configuration
export interface MemoryQuizConfig extends GameConfig {
  selectedCount: 2 | 5 | 8 | 12 | 15;
  displayTime: number;
  selectedDifficulty: DifficultyLevel;
  playMode: "cooperative" | "competitive";
}

// Memory Quiz State
export interface MemoryQuizState extends GameState {
  // Core game data
  cards: QuizCard[];
  quizCards: QuizCard[];
  correctAnswers: number[];

  // Game progression
  currentCardIndex: number;
  displayTime: number;
  selectedCount: number;
  selectedDifficulty: DifficultyLevel;

  // Input system state
  foundNumbers: number[];
  guessesRemaining: number;
  currentInput: string;
  incorrectGuesses: number;

  // Multiplayer state
  activePlayers: string[];
  playerMetadata: Record<string, PlayerMetadata>;
  playerScores: Record<string, PlayerScore>;
  playMode: "cooperative" | "competitive";
  numberFoundBy: Record<number, string>; // Maps number to userId who found it

  // UI state
  gamePhase: "setup" | "display" | "input" | "results";
  prefixAcceptanceTimeout: NodeJS.Timeout | null;
  finishButtonsBound: boolean;
  wrongGuessAnimations: Array<{
    number: number;
    id: string;
    timestamp: number;
  }>;

  // Keyboard state (moved from InputPhase to persist across re-renders)
  hasPhysicalKeyboard: boolean | null;
  testingMode: boolean;
  showOnScreenKeyboard: boolean;
}

// Legacy reducer actions (deprecated - will be removed)
export type QuizAction =
  | { type: "SET_CARDS"; cards: QuizCard[] }
  | { type: "SET_DISPLAY_TIME"; time: number }
  | { type: "SET_SELECTED_COUNT"; count: number }
  | { type: "SET_DIFFICULTY"; difficulty: DifficultyLevel }
  | { type: "SET_PLAY_MODE"; playMode: "cooperative" | "competitive" }
  | { type: "START_QUIZ"; quizCards: QuizCard[] }
  | { type: "NEXT_CARD" }
  | { type: "SHOW_INPUT_PHASE" }
  | { type: "ACCEPT_NUMBER"; number: number; playerId?: string }
  | { type: "REJECT_NUMBER"; playerId?: string }
  | { type: "ADD_WRONG_GUESS_ANIMATION"; number: number }
  | { type: "CLEAR_WRONG_GUESS_ANIMATIONS" }
  | { type: "SET_INPUT"; input: string }
  | { type: "SET_PREFIX_TIMEOUT"; timeout: NodeJS.Timeout | null }
  | { type: "SHOW_RESULTS" }
  | { type: "RESET_QUIZ" }
  | { type: "SET_PHYSICAL_KEYBOARD"; hasKeyboard: boolean | null }
  | { type: "SET_TESTING_MODE"; enabled: boolean }
  | { type: "TOGGLE_ONSCREEN_KEYBOARD" };

// Difficulty levels with progressive number ranges
export const DIFFICULTY_LEVELS = {
  beginner: {
    name: "Beginner",
    range: { min: 1, max: 9 },
    description: "Single digits (1-9)",
  },
  easy: {
    name: "Easy",
    range: { min: 10, max: 99 },
    description: "Two digits (10-99)",
  },
  medium: {
    name: "Medium",
    range: { min: 100, max: 499 },
    description: "Three digits (100-499)",
  },
  hard: {
    name: "Hard",
    range: { min: 500, max: 999 },
    description: "Large numbers (500-999)",
  },
  expert: {
    name: "Expert",
    range: { min: 1, max: 999 },
    description: "Mixed range (1-999)",
  },
} as const;

export type DifficultyLevel = keyof typeof DIFFICULTY_LEVELS;

// Memory Quiz Move Types (SDK-compatible)
export type MemoryQuizMove =
  | {
      type: "START_QUIZ";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        numbers: number[];
        quizCards?: QuizCard[];
        activePlayers: string[];
        playerMetadata: Record<string, PlayerMetadata>;
      };
    }
  | {
      type: "NEXT_CARD";
      playerId: string;
      userId: string;
      timestamp: number;
      data: Record<string, never>;
    }
  | {
      type: "SHOW_INPUT_PHASE";
      playerId: string;
      userId: string;
      timestamp: number;
      data: Record<string, never>;
    }
  | {
      type: "ACCEPT_NUMBER";
      playerId: string;
      userId: string;
      timestamp: number;
      data: { number: number };
    }
  | {
      type: "REJECT_NUMBER";
      playerId: string;
      userId: string;
      timestamp: number;
      data: Record<string, never>;
    }
  | {
      type: "SET_INPUT";
      playerId: string;
      userId: string;
      timestamp: number;
      data: { input: string };
    }
  | {
      type: "SHOW_RESULTS";
      playerId: string;
      userId: string;
      timestamp: number;
      data: Record<string, never>;
    }
  | {
      type: "RESET_QUIZ";
      playerId: string;
      userId: string;
      timestamp: number;
      data: Record<string, never>;
    }
  | {
      type: "SET_CONFIG";
      playerId: string;
      userId: string;
      timestamp: number;
      data: {
        field:
          | "selectedCount"
          | "displayTime"
          | "selectedDifficulty"
          | "playMode";
        value: any;
      };
    };

export type MemoryQuizSetConfigMove = Extract<
  MemoryQuizMove,
  { type: "SET_CONFIG" }
>;

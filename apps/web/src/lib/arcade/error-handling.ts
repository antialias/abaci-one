/**
 * Enhanced error handling system for arcade games
 * Provides user-friendly error messages, retry logic, and recovery suggestions
 */

import type { GameMove } from "@/lib/arcade/validation";

export type ErrorSeverity = "info" | "warning" | "error" | "fatal";
export type ErrorCategory =
  | "version-conflict"
  | "permission"
  | "validation"
  | "network"
  | "game-rule"
  | "unknown";

export interface EnhancedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string; // User-friendly message
  technicalMessage: string; // For console/debugging
  autoRetry: boolean; // Is this being auto-retried?
  retryCount?: number; // Current retry attempt
  suggestion?: string; // What the user should do
  recoverable: boolean; // Can the user recover from this?
}

export interface RetryState {
  isRetrying: boolean;
  retryCount: number;
  move: GameMove | null;
  timestamp: number | null;
}

/**
 * Parse raw error messages into enhanced error objects
 */
export function parseError(
  error: string,
  move?: GameMove,
  retryCount?: number,
): EnhancedError {
  // Version conflict errors
  if (
    error.includes("version conflict") ||
    error.includes("Version conflict")
  ) {
    return {
      category: "version-conflict",
      severity: retryCount && retryCount > 3 ? "warning" : "info",
      userMessage:
        retryCount && retryCount > 2
          ? "Multiple players are making moves quickly, still syncing..."
          : "Another player made a move, syncing...",
      technicalMessage: `Version conflict on ${move?.type || "unknown move"}`,
      autoRetry: true,
      retryCount,
      suggestion:
        retryCount && retryCount > 4
          ? "Wait a moment for the game to stabilize"
          : undefined,
      recoverable: true,
    };
  }

  // Permission errors (403)
  if (error.includes("Only the host") || error.includes("403")) {
    return {
      category: "permission",
      severity: "warning",
      userMessage: "Only the room host can change this setting",
      technicalMessage: `403 Forbidden: ${error}`,
      autoRetry: false,
      suggestion: "Ask the host to make this change",
      recoverable: false,
    };
  }

  // Network errors
  if (
    error.includes("network") ||
    error.includes("Network") ||
    error.includes("timeout") ||
    error.includes("fetch")
  ) {
    return {
      category: "network",
      severity: "error",
      userMessage: "Network connection issue",
      technicalMessage: error,
      autoRetry: false,
      suggestion: "Check your internet connection",
      recoverable: true,
    };
  }

  // Validation/game rule errors (from validator)
  if (
    error.includes("Invalid") ||
    error.includes("cannot") ||
    error.includes("not allowed") ||
    error.includes("must")
  ) {
    return {
      category: "game-rule",
      severity: "warning",
      userMessage: error, // Validator messages are already user-friendly
      technicalMessage: error,
      autoRetry: false,
      recoverable: true,
    };
  }

  // Not in room
  if (error.includes("not in this room")) {
    return {
      category: "permission",
      severity: "error",
      userMessage: "You are not in this room",
      technicalMessage: error,
      autoRetry: false,
      suggestion: "Rejoin the room to continue playing",
      recoverable: false,
    };
  }

  // Unknown errors
  return {
    category: "unknown",
    severity: "error",
    userMessage: "Something went wrong",
    technicalMessage: error,
    autoRetry: false,
    suggestion: "Try refreshing the page",
    recoverable: false,
  };
}

/**
 * Get user-friendly action name for a move type
 */
export function getMoveActionName(move: GameMove): string {
  switch (move.type) {
    case "START_GAME":
      return "starting game";
    case "MAKE_MOVE":
      return "moving piece";
    case "DECLARE_HARMONY":
      return "declaring harmony";
    case "RESIGN":
      return "resigning";
    case "OFFER_DRAW":
      return "offering draw";
    case "ACCEPT_DRAW":
      return "accepting draw";
    case "CLAIM_REPETITION":
      return "claiming repetition";
    case "CLAIM_FIFTY_MOVE":
      return "claiming fifty-move rule";
    case "SET_CONFIG":
      return "updating settings";
    case "RESET_GAME":
      return "resetting game";
    default:
      return "performing action";
  }
}

/**
 * Determine if an error should show a toast notification
 */
export function shouldShowToast(error: EnhancedError): boolean {
  // Version conflicts: only show toast after 2+ retries
  if (error.category === "version-conflict") {
    return (error.retryCount ?? 0) >= 2;
  }

  // Permission errors: always show toast
  if (error.category === "permission") {
    return true;
  }

  // Network errors: always show toast
  if (error.category === "network") {
    return true;
  }

  // Game rule errors: show in banner, not toast
  if (error.category === "game-rule") {
    return false;
  }

  // Unknown errors: show toast
  return true;
}

/**
 * Determine if an error should show a banner (in-game persistent error display)
 */
export function shouldShowBanner(error: EnhancedError): boolean {
  // Version conflicts: only show banner if max retries exceeded
  if (error.category === "version-conflict") {
    return (error.retryCount ?? 0) >= 5;
  }

  // Game rule errors: always show in banner
  if (error.category === "game-rule") {
    return true;
  }

  // Fatal errors: show in banner
  if (error.severity === "fatal") {
    return true;
  }

  // Network errors after retry
  if (error.category === "network") {
    return true;
  }

  return false;
}

/**
 * Get toast type from error severity
 */
export function getToastType(
  severity: ErrorSeverity,
): "success" | "error" | "info" {
  switch (severity) {
    case "info":
      return "info";
    case "warning":
      return "error"; // Use error styling for warnings
    case "error":
    case "fatal":
      return "error";
  }
}

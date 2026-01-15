/**
 * Guidance Visibility Utilities
 *
 * Pure functions for determining which guidance options should be visible
 * based on assistance level configuration. These are extracted for testability.
 */

import type { AssistanceLevelConfig } from "../maps";

/**
 * Determines if the guidance dropdown should be shown at all.
 * Hidden when there are no configurable guidance options.
 */
export function shouldShowGuidanceDropdown(
  config: AssistanceLevelConfig,
): boolean {
  return config.hintsMode !== "none" || config.hotColdEnabled;
}

/**
 * Determines if the "Auto-Show Hints" toggle should be visible.
 * Only shown when hints are available in any form.
 */
export function shouldShowAutoHintToggle(
  config: AssistanceLevelConfig,
): boolean {
  return config.hintsMode !== "none";
}

/**
 * Determines if the "Auto Speak" toggle should be visible.
 * Only shown when hints are available (speech reads hints aloud).
 */
export function shouldShowAutoSpeakToggle(
  config: AssistanceLevelConfig,
): boolean {
  return config.hintsMode !== "none";
}

/**
 * Determines if the "Hot/Cold" toggle should be visible.
 * Only shown when the assistance level enables hot/cold feedback.
 */
export function shouldShowHotColdToggle(
  config: AssistanceLevelConfig,
): boolean {
  return config.hotColdEnabled;
}

/**
 * Feature badge for display in setup UI
 */
export interface FeatureBadge {
  label: string;
  icon: string;
}

/**
 * Generates feature badges for an assistance level.
 * Used in the setup UI to show what features are enabled.
 */
export function getFeatureBadges(level: AssistanceLevelConfig): FeatureBadge[] {
  const badges: FeatureBadge[] = [];

  // Name confirmation requirement (Learning mode)
  if (level.nameConfirmationLetters) {
    badges.push({ label: "Type to unlock", icon: "⌨️" });
  }

  if (level.hotColdEnabled) {
    badges.push({ label: "Hot/cold", icon: "🔥" });
  }

  if (level.hintsMode === "onRequest") {
    if (level.autoHintDefault) {
      badges.push({ label: "Auto-hints", icon: "💡" });
    } else {
      badges.push({ label: "Hints", icon: "💡" });
    }
  } else if (level.hintsMode === "limited" && level.hintLimit) {
    badges.push({ label: `${level.hintLimit} hints`, icon: "💡" });
  }

  // Wrong click feedback
  if (level.wrongClickShowsName) {
    badges.push({ label: "Shows names", icon: "👁️" });
  }

  return badges;
}

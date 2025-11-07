// Type definitions for double-digit addition worksheet creator

import type { AdditionConfigV2 } from "../config-schemas";

/**
 * Complete, validated configuration for worksheet generation
 * Extends V2 config with additional derived fields needed for rendering
 *
 * Note: Includes V1 compatibility fields during migration period
 */
export type WorksheetConfig = AdditionConfigV2 & {
  // Problem set - DERIVED state
  total: number; // total = problemsPerPage * pages
  rows: number; // rows = (problemsPerPage / cols) * pages

  // Personalization
  date: string;
  seed: number;

  // Layout
  page: {
    wIn: number;
    hIn: number;
  };
  margins: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };

  // V1 compatibility: Include individual boolean flags during migration
  // These will be derived from displayRules during validation
  showCarryBoxes: boolean;
  showAnswerBoxes: boolean;
  showPlaceValueColors: boolean;
  showProblemNumbers: boolean;
  showCellBorder: boolean;
  showTenFrames: boolean;
};

/**
 * Partial form state - user may be editing, fields optional
 * Based on V2 config with additional derived state
 *
 * Note: For backwards compatibility during migration, this type accepts either:
 * - V2 displayRules (preferred)
 * - V1 individual boolean flags (will be converted to displayRules)
 */
export type WorksheetFormState = Partial<Omit<AdditionConfigV2, "version">> & {
  // DERIVED state (calculated from primary state)
  rows?: number;
  total?: number;
  date?: string;
  seed?: number;

  // V1 compatibility: Accept individual boolean flags
  // These will be converted to displayRules internally
  showCarryBoxes?: boolean;
  showAnswerBoxes?: boolean;
  showPlaceValueColors?: boolean;
  showProblemNumbers?: boolean;
  showCellBorder?: boolean;
  showTenFrames?: boolean;
};

/**
 * A single addition problem
 */
export interface AdditionProblem {
  a: number;
  b: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  config?: WorksheetConfig;
  errors?: string[];
}

/**
 * Problem category for difficulty control
 */
export type ProblemCategory = "non" | "onesOnly" | "both";

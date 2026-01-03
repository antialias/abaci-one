/**
 * Practice App Styles - Reusable style functions
 *
 * These functions return Panda CSS style objects that can be spread
 * into the css() function or used directly in className.
 */

import type { SystemStyleObject } from "../../../../styled-system/types";
import { themed } from "./practiceTheme";

// ============================================================================
// Container Styles
// ============================================================================

/**
 * Card - elevated surface with shadow
 * Used for main content areas, stat displays, etc.
 */
export function cardStyles(isDark: boolean): SystemStyleObject {
  return {
    padding: "1.5rem",
    backgroundColor: themed("surface", isDark),
    borderRadius: "12px",
    boxShadow: "md",
    border: "1px solid",
    borderColor: themed("border", isDark),
  };
}

/**
 * Section - subtle container for grouping content
 * Less prominent than cards, used for sub-sections
 */
export function sectionStyles(isDark: boolean): SystemStyleObject {
  return {
    padding: "1rem",
    backgroundColor: themed("surfaceMuted", isDark),
    borderRadius: "12px",
    border: "1px solid",
    borderColor: themed("borderMuted", isDark),
  };
}

/**
 * Panel - colored section for emphasis
 * Used for help panels, alerts, focus areas
 */
export function panelStyles(
  isDark: boolean,
  variant:
    | "info"
    | "success"
    | "warning"
    | "error"
    | "purple"
    | "orange" = "info",
): SystemStyleObject {
  return {
    padding: "1rem",
    backgroundColor: themed(variant, isDark),
    borderRadius: "12px",
    border: "2px solid",
    borderColor: themed(
      `${variant}Border` as keyof typeof import("./practiceTheme").practiceColors,
      isDark,
    ),
  };
}

/**
 * Page container - max-width centered layout
 */
export function pageContainerStyles(): SystemStyleObject {
  return {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    padding: "1.5rem",
    maxWidth: "600px",
    margin: "0 auto",
  };
}

// ============================================================================
// Button Styles
// ============================================================================

/**
 * Primary button - main call to action
 */
export function primaryButtonStyles(): SystemStyleObject {
  return {
    padding: "1rem",
    fontSize: "1.125rem",
    fontWeight: "bold",
    color: "white",
    backgroundColor: "blue.500",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    _hover: { backgroundColor: "blue.600" },
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  };
}

/**
 * Success button - positive actions (approve, start)
 */
export function successButtonStyles(): SystemStyleObject {
  return {
    padding: "1rem",
    fontSize: "1.125rem",
    fontWeight: "bold",
    color: "white",
    backgroundColor: "green.500",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    _hover: { backgroundColor: "green.600" },
  };
}

/**
 * Secondary button - alternative actions
 */
export function secondaryButtonStyles(isDark: boolean): SystemStyleObject {
  return {
    padding: "0.75rem",
    fontSize: "1rem",
    color: themed("text", isDark),
    backgroundColor: themed("surfaceMuted", isDark),
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    _hover: {
      backgroundColor: isDark ? "gray.600" : "gray.200",
    },
  };
}

/**
 * Ghost button - minimal style for tertiary actions
 */
export function ghostButtonStyles(isDark: boolean): SystemStyleObject {
  return {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    color: themed("textMuted", isDark),
    backgroundColor: "transparent",
    border: "1px solid",
    borderColor: themed("border", isDark),
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    _hover: {
      backgroundColor: themed("surfaceMuted", isDark),
    },
  };
}

/**
 * Link button - text-only button that looks like a link
 */
export function linkButtonStyles(isDark: boolean): SystemStyleObject {
  return {
    padding: 0,
    fontSize: "0.875rem",
    color: isDark ? "blue.400" : "blue.500",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    _hover: {
      textDecoration: "underline",
    },
  };
}

/**
 * Icon button - square button for icons
 */
export function iconButtonStyles(
  isDark: boolean,
  size: "sm" | "md" | "lg" = "md",
): SystemStyleObject {
  const sizeMap = {
    sm: { width: "32px", height: "32px", fontSize: "1rem" },
    md: { width: "48px", height: "48px", fontSize: "1.5rem" },
    lg: { width: "56px", height: "56px", fontSize: "2rem" },
  };
  return {
    ...sizeMap[size],
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    backgroundColor: "gray.700",
    borderRadius: "8px",
    border: "2px solid",
    borderColor: "gray.600",
    cursor: "pointer",
    transition: "all 0.15s ease",
    _hover: {
      backgroundColor: "gray.600",
      transform: "scale(1.05)",
    },
    _active: {
      transform: "scale(0.95)",
    },
  };
}

/**
 * Tool button - styled button with semantic color
 */
export function toolButtonStyles(
  isDark: boolean,
  variant:
    | "info"
    | "success"
    | "warning"
    | "error"
    | "purple"
    | "orange" = "info",
): SystemStyleObject {
  const variantKey =
    variant as keyof typeof import("./practiceTheme").practiceColors;
  return {
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    color: themed(
      `${variantKey}Text` as keyof typeof import("./practiceTheme").practiceColors,
      isDark,
    ),
    backgroundColor: themed(variantKey, isDark),
    borderRadius: "6px",
    border: "1px solid",
    borderColor: themed(
      `${variantKey}Border` as keyof typeof import("./practiceTheme").practiceColors,
      isDark,
    ),
    cursor: "pointer",
    transition: "all 0.2s ease",
    _hover: {
      backgroundColor: themed(
        `${variantKey}Muted` as keyof typeof import("./practiceTheme").practiceColors,
        isDark,
      ),
    },
  };
}

// ============================================================================
// Badge Styles
// ============================================================================

/**
 * Badge - small pill-shaped label
 */
export function badgeStyles(
  isDark: boolean,
  variant:
    | "success"
    | "warning"
    | "error"
    | "info"
    | "purple"
    | "orange"
    | "neutral" = "neutral",
): SystemStyleObject {
  if (variant === "neutral") {
    return {
      fontSize: "0.75rem",
      fontWeight: "medium",
      padding: "0.25rem 0.75rem",
      borderRadius: "9999px",
      backgroundColor: themed("surfaceMuted", isDark),
      color: themed("textMuted", isDark),
    };
  }

  const variantKey =
    variant as keyof typeof import("./practiceTheme").practiceColors;
  return {
    fontSize: "0.75rem",
    fontWeight: "medium",
    padding: "0.25rem 0.75rem",
    borderRadius: "9999px",
    backgroundColor: themed(variantKey, isDark),
    color: themed(
      `${variantKey}Text` as keyof typeof import("./practiceTheme").practiceColors,
      isDark,
    ),
  };
}

/**
 * Purpose badge - styled for problem purposes
 */
export function purposeBadgeStyles(
  isDark: boolean,
  purpose: "focus" | "reinforce" | "review" | "challenge",
): SystemStyleObject {
  const variantMap = {
    focus: "info",
    reinforce: "orange",
    review: "success",
    challenge: "purple",
  } as const;

  return {
    ...badgeStyles(isDark, variantMap[purpose]),
    textTransform: "uppercase",
    fontWeight: "bold",
  };
}

// ============================================================================
// Progress Styles
// ============================================================================

/**
 * Progress bar container
 */
export function progressBarContainerStyles(
  isDark: boolean,
  height: "sm" | "md" | "lg" = "md",
): SystemStyleObject {
  const heightMap = { sm: "4px", md: "8px", lg: "12px" };
  return {
    width: "100%",
    height: heightMap[height],
    backgroundColor: isDark ? "gray.700" : "gray.200",
    borderRadius: "4px",
    overflow: "hidden",
  };
}

/**
 * Progress bar fill
 */
export function progressBarFillStyles(
  isDark: boolean,
  variant: "success" | "info" | "warning" = "success",
): SystemStyleObject {
  const colorMap = {
    success: isDark ? "green.400" : "green.500",
    info: isDark ? "blue.400" : "blue.500",
    warning: isDark ? "yellow.400" : "yellow.500",
  };
  return {
    height: "100%",
    backgroundColor: colorMap[variant],
    borderRadius: "4px",
    transition: "width 0.5s ease",
  };
}

// ============================================================================
// Typography Styles
// ============================================================================

/**
 * Page title
 */
export function pageTitleStyles(isDark: boolean): SystemStyleObject {
  return {
    fontSize: "1.75rem",
    fontWeight: "bold",
    color: themed("text", isDark),
    textAlign: "center",
  };
}

/**
 * Section heading
 */
export function sectionHeadingStyles(isDark: boolean): SystemStyleObject {
  return {
    fontSize: "1rem",
    fontWeight: "bold",
    color: themed("text", isDark),
    marginBottom: "0.75rem",
  };
}

/**
 * Label text (small, uppercase)
 */
export function labelStyles(isDark: boolean): SystemStyleObject {
  return {
    fontSize: "0.75rem",
    fontWeight: "bold",
    color: themed("textMuted", isDark),
    textTransform: "uppercase",
  };
}

/**
 * Body text
 */
export function bodyTextStyles(isDark: boolean): SystemStyleObject {
  return {
    fontSize: "1rem",
    color: themed("textMuted", isDark),
    lineHeight: "1.5",
  };
}

/**
 * Small/caption text
 */
export function captionStyles(isDark: boolean): SystemStyleObject {
  return {
    fontSize: "0.75rem",
    color: themed("textSubtle", isDark),
  };
}

// ============================================================================
// Stat Display Styles
// ============================================================================

/**
 * Stat card - for displaying a single metric
 */
export function statCardStyles(isDark: boolean): SystemStyleObject {
  return {
    textAlign: "center",
    padding: "1rem",
    backgroundColor: themed("surface", isDark),
    borderRadius: "12px",
    boxShadow: "sm",
  };
}

/**
 * Stat value (large number)
 */
export function statValueStyles(
  isDark: boolean,
  variant:
    | "success"
    | "warning"
    | "error"
    | "info"
    | "purple"
    | "neutral" = "neutral",
): SystemStyleObject {
  const colorMap = {
    success: isDark ? "green.400" : "green.600",
    warning: isDark ? "yellow.400" : "yellow.600",
    error: isDark ? "red.400" : "red.600",
    info: isDark ? "blue.400" : "blue.600",
    purple: isDark ? "purple.400" : "purple.600",
    neutral: themed("text", isDark),
  };
  return {
    fontSize: "2rem",
    fontWeight: "bold",
    color: colorMap[variant],
  };
}

/**
 * Stat label
 */
export function statLabelStyles(isDark: boolean): SystemStyleObject {
  return {
    fontSize: "0.75rem",
    color: themed("textSubtle", isDark),
  };
}

// ============================================================================
// Input Styles
// ============================================================================

/**
 * Input field container (for answer boxes, etc.)
 */
export function inputContainerStyles(
  isDark: boolean,
  state: "default" | "focused" | "correct" | "incorrect" = "default",
): SystemStyleObject {
  const stateStyles = {
    default: {
      backgroundColor: themed("surface", isDark),
      borderColor: themed("border", isDark),
    },
    focused: {
      backgroundColor: themed("info", isDark),
      borderColor: themed("infoBorder", isDark),
    },
    correct: {
      backgroundColor: themed("success", isDark),
      borderColor: themed("successBorder", isDark),
    },
    incorrect: {
      backgroundColor: themed("error", isDark),
      borderColor: themed("errorBorder", isDark),
    },
  };

  return {
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "2px solid",
    transition: "all 0.2s ease",
    ...stateStyles[state],
  };
}

// ============================================================================
// Avatar Styles
// ============================================================================

/**
 * Avatar container
 */
export function avatarStyles(
  size: "sm" | "md" | "lg" | "xl" = "md",
): SystemStyleObject {
  const sizeMap = {
    sm: { width: "40px", height: "40px", fontSize: "1.25rem" },
    md: { width: "60px", height: "60px", fontSize: "2rem" },
    lg: { width: "80px", height: "80px", fontSize: "3rem" },
    xl: { width: "100px", height: "100px", fontSize: "4rem" },
  };
  return {
    ...sizeMap[size],
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

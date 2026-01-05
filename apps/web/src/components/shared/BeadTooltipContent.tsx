"use client";

/**
 * BeadTooltipContent - Shared tooltip content for bead instruction overlays
 *
 * Extracted from TutorialPlayer for reuse in practice help overlay.
 * Ensures consistent tooltip display across tutorial and practice modes.
 */

import * as Tooltip from "@radix-ui/react-tooltip";
import { PedagogicalDecompositionDisplay } from "../tutorial/PedagogicalDecompositionDisplay";

export interface BeadTooltipContentProps {
  /** Whether to show celebration state (step completed) */
  showCelebration?: boolean;
  /** The bead diff summary (e.g., "add 2 earth beads in tens") */
  currentStepSummary: string | null;
  /** Whether the decomposition is pedagogically meaningful */
  isMeaningfulDecomposition?: boolean;
  /** Rendered decomposition with highlighted term (from renderHighlightedDecomposition) */
  decomposition?: {
    before: string;
    highlighted: string;
    after: string;
  } | null;
  /** Which side the tooltip appears on */
  side: "top" | "left";
  /** Theme: 'light' or 'dark' */
  theme?: "light" | "dark";
}

/**
 * Tooltip content that matches TutorialPlayer's exact implementation
 *
 * Shows either:
 * - Celebration state with 🎉 emoji
 * - Instructions with optional decomposition display and bead diff summary
 */
export function BeadTooltipContent({
  showCelebration = false,
  currentStepSummary,
  isMeaningfulDecomposition = false,
  decomposition,
  side,
  theme = "light",
}: BeadTooltipContentProps) {
  const isDark = theme === "dark";

  return (
    <Tooltip.Provider>
      <Tooltip.Root open={true}>
        <Tooltip.Trigger asChild>
          <div style={{ width: "1px", height: "1px", opacity: 0 }} />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            align="center"
            sideOffset={20}
            style={{
              background: showCelebration
                ? "linear-gradient(135deg, rgba(34, 197, 94, 0.95) 0%, rgba(21, 128, 61, 0.95) 100%)"
                : isDark
                  ? "#1e40af"
                  : "#1e3a8a",
              color: "#ffffff",
              padding: "12px 16px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 700,
              boxShadow: showCelebration
                ? "0 8px 25px rgba(34, 197, 94, 0.4), 0 0 0 2px rgba(255, 255, 255, 0.2)"
                : isDark
                  ? "0 4px 12px rgba(0,0,0,0.3)"
                  : "0 4px 12px rgba(0,0,0,0.2)",
              whiteSpace: "normal",
              maxWidth: "200px",
              minWidth: "150px",
              wordBreak: "break-word",
              zIndex: 50,
              opacity: 0.95,
              transition: "all 0.3s ease",
              transform: showCelebration ? "scale(1.05)" : "scale(1)",
              animation: showCelebration
                ? "celebrationPulse 0.6s ease-out"
                : "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.85";
            }}
          >
            <div style={{ fontSize: "12px", opacity: 0.9 }}>
              {showCelebration ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>🎉</span>
                  <span>Excellent work!</span>
                </div>
              ) : (
                <>
                  {isMeaningfulDecomposition && decomposition && (
                    <PedagogicalDecompositionDisplay
                      variant="tooltip"
                      showLabel={true}
                      decomposition={decomposition}
                    />
                  )}
                  <span style={{ fontSize: "18px" }}>💡</span>{" "}
                  {currentStepSummary}
                </>
              )}
            </div>
            <Tooltip.Arrow
              style={{
                fill: showCelebration ? "#15803d" : "#1e40af",
              }}
            />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export default BeadTooltipContent;

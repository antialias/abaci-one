"use client";

import type React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { css } from "@styled/css";
import type { DifficultyMode } from "../../difficultyProfiles";
import { useTheme } from "@/contexts/ThemeContext";

export interface DifficultyChangeResult {
  changeDescription: string;
  pAnyStart: number;
  pAllStart: number;
  displayRules: any;
  difficultyProfile?: string;
}

export interface MakeEasierHarderButtonsProps {
  easierResultBoth: DifficultyChangeResult;
  easierResultChallenge: DifficultyChangeResult;
  easierResultSupport: DifficultyChangeResult;
  harderResultBoth: DifficultyChangeResult;
  harderResultChallenge: DifficultyChangeResult;
  harderResultSupport: DifficultyChangeResult;
  canMakeEasierBoth: boolean;
  canMakeEasierChallenge: boolean;
  canMakeEasierSupport: boolean;
  canMakeHarderBoth: boolean;
  canMakeHarderChallenge: boolean;
  canMakeHarderSupport: boolean;
  onEasier: (mode: DifficultyMode) => void;
  onHarder: (mode: DifficultyMode) => void;
}

export function MakeEasierHarderButtons({
  easierResultBoth,
  easierResultChallenge,
  easierResultSupport,
  harderResultBoth,
  harderResultChallenge,
  harderResultSupport,
  canMakeEasierBoth,
  canMakeEasierChallenge,
  canMakeEasierSupport,
  canMakeHarderBoth,
  canMakeHarderChallenge,
  canMakeHarderSupport,
  onEasier,
  onHarder,
}: MakeEasierHarderButtonsProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  // Determine which mode is alternative for easier
  const easierAlternativeMode =
    easierResultBoth.changeDescription ===
    easierResultChallenge.changeDescription
      ? "support"
      : "challenge";
  const easierAlternativeResult =
    easierAlternativeMode === "support"
      ? easierResultSupport
      : easierResultChallenge;
  const easierAlternativeLabel =
    easierAlternativeMode === "support" ? "↑ More support" : "← Less challenge";
  const canEasierAlternative =
    easierAlternativeMode === "support"
      ? canMakeEasierSupport
      : canMakeEasierChallenge;

  // Determine which mode is alternative for harder
  const harderAlternativeMode =
    harderResultBoth.changeDescription ===
    harderResultChallenge.changeDescription
      ? "support"
      : "challenge";
  const harderAlternativeResult =
    harderAlternativeMode === "support"
      ? harderResultSupport
      : harderResultChallenge;
  const harderAlternativeLabel =
    harderAlternativeMode === "support" ? "↓ Less support" : "→ More challenge";
  const canHarderAlternative =
    harderAlternativeMode === "support"
      ? canMakeHarderSupport
      : canMakeHarderChallenge;

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "2",
        pt: "1",
        borderTop: "1px solid",
        borderColor: isDark ? "gray.700" : "gray.200",
      })}
    >
      {/* Four-Button Layout: [Alt-35%][Rec-65%][Rec-65%][Alt-35%] */}
      <Tooltip.Provider delayDuration={300}>
        <div className={css({ display: "flex", gap: "2" })}>
          {/* EASIER SECTION */}
          <div className={css({ display: "flex", flex: "1" })}>
            {/* Alternative Easier Button - Hidden if disabled and main is enabled */}
            {canEasierAlternative && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => onEasier(easierAlternativeMode)}
                    disabled={!canEasierAlternative}
                    data-action={`easier-${easierAlternativeMode}`}
                    className={css({
                      flexShrink: 0,
                      width: "10",
                      h: "16",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2xs",
                      fontWeight: "medium",
                      color: isDark ? "gray.300" : "gray.700",
                      bg: isDark ? "gray.700" : "gray.100",
                      border: "1.5px solid",
                      borderColor: isDark ? "gray.600" : "gray.300",
                      borderRight: "none",
                      borderTopLeftRadius: "lg",
                      borderBottomLeftRadius: "lg",
                      cursor: "pointer",
                      _hover: {
                        bg: isDark ? "gray.600" : "gray.200",
                      },
                    })}
                  >
                    {easierAlternativeLabel}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    className={css({
                      bg: "gray.800",
                      color: "white",
                      px: "3",
                      py: "2",
                      rounded: "md",
                      fontSize: "xs",
                      maxW: "250px",
                      shadow: "lg",
                      zIndex: 1000,
                    })}
                  >
                    {easierAlternativeResult.changeDescription}
                    <Tooltip.Arrow className={css({ fill: "gray.800" })} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}

            {/* Recommended Easier Button - Expands to full width if alternative is hidden */}
            <button
              onClick={() => onEasier("both")}
              disabled={!canMakeEasierBoth}
              data-action="easier-both"
              className={css({
                flex: "1",
                h: "16",
                px: "3",
                py: "2",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.5",
                color: canMakeEasierBoth
                  ? "brand.700"
                  : isDark
                    ? "gray.500"
                    : "gray.400",
                bg: isDark ? "gray.800" : "white",
                border: "1.5px solid",
                borderColor: canMakeEasierBoth
                  ? "brand.500"
                  : isDark
                    ? "gray.600"
                    : "gray.300",
                borderTopLeftRadius: canEasierAlternative ? "none" : "lg",
                borderBottomLeftRadius: canEasierAlternative ? "none" : "lg",
                borderTopRightRadius: "lg",
                borderBottomRightRadius: "lg",
                cursor: canMakeEasierBoth ? "pointer" : "not-allowed",
                opacity: canMakeEasierBoth ? 1 : 0.5,
                _hover: canMakeEasierBoth
                  ? {
                      bg: isDark ? "gray.700" : "brand.50",
                    }
                  : {},
              })}
            >
              <div
                className={css({
                  fontSize: "xs",
                  fontWeight: "semibold",
                  flexShrink: 0,
                })}
              >
                ← Make Easier
              </div>
              {canMakeEasierBoth && (
                <div
                  className={css({
                    fontSize: "2xs",
                    fontWeight: "normal",
                    lineHeight: "1.3",
                    textAlign: "left",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                  })}
                  style={
                    {
                      WebkitBoxOrient: "vertical",
                    } as React.CSSProperties
                  }
                >
                  {easierResultBoth.changeDescription}
                </div>
              )}
            </button>
          </div>

          {/* HARDER SECTION */}
          <div className={css({ display: "flex", flex: "1" })}>
            {/* Recommended Harder Button - Expands to full width if alternative is hidden */}
            <button
              onClick={() => onHarder("both")}
              disabled={!canMakeHarderBoth}
              data-action="harder-both"
              className={css({
                flex: "1",
                h: "16",
                px: "3",
                py: "2",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.5",
                color: canMakeHarderBoth
                  ? "brand.700"
                  : isDark
                    ? "gray.500"
                    : "gray.400",
                bg: isDark ? "gray.800" : "white",
                border: "1.5px solid",
                borderColor: canMakeHarderBoth
                  ? "brand.500"
                  : isDark
                    ? "gray.600"
                    : "gray.300",
                borderTopLeftRadius: "lg",
                borderBottomLeftRadius: "lg",
                borderTopRightRadius: canHarderAlternative ? "none" : "lg",
                borderBottomRightRadius: canHarderAlternative ? "none" : "lg",
                cursor: canMakeHarderBoth ? "pointer" : "not-allowed",
                opacity: canMakeHarderBoth ? 1 : 0.5,
                _hover: canMakeHarderBoth
                  ? {
                      bg: isDark ? "gray.700" : "brand.50",
                    }
                  : {},
              })}
            >
              <div
                className={css({
                  fontSize: "xs",
                  fontWeight: "semibold",
                  flexShrink: 0,
                })}
              >
                Make Harder →
              </div>
              {canMakeHarderBoth && (
                <div
                  className={css({
                    fontSize: "2xs",
                    fontWeight: "normal",
                    lineHeight: "1.3",
                    textAlign: "left",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                  })}
                  style={
                    {
                      WebkitBoxOrient: "vertical",
                    } as React.CSSProperties
                  }
                >
                  {harderResultBoth.changeDescription}
                </div>
              )}
            </button>

            {/* Alternative Harder Button - Hidden if disabled and main is enabled */}
            {canHarderAlternative && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    onClick={() => onHarder(harderAlternativeMode)}
                    disabled={!canHarderAlternative}
                    data-action={`harder-${harderAlternativeMode}`}
                    className={css({
                      flexShrink: 0,
                      width: "10",
                      h: "16",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2xs",
                      fontWeight: "medium",
                      color: isDark ? "gray.300" : "gray.700",
                      bg: isDark ? "gray.700" : "gray.100",
                      border: "1.5px solid",
                      borderColor: isDark ? "gray.600" : "gray.300",
                      borderLeft: "none",
                      borderTopRightRadius: "lg",
                      borderBottomRightRadius: "lg",
                      cursor: "pointer",
                      _hover: {
                        bg: isDark ? "gray.600" : "gray.200",
                      },
                    })}
                  >
                    {harderAlternativeLabel}
                  </button>
                </Tooltip.Trigger>
                {canHarderAlternative && (
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="top"
                      className={css({
                        bg: "gray.800",
                        color: "white",
                        px: "3",
                        py: "2",
                        rounded: "md",
                        fontSize: "xs",
                        maxW: "250px",
                        shadow: "lg",
                        zIndex: 1000,
                      })}
                    >
                      {harderAlternativeResult.changeDescription}
                      <Tooltip.Arrow className={css({ fill: "gray.800" })} />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                )}
              </Tooltip.Root>
            )}
          </div>
        </div>
      </Tooltip.Provider>
    </div>
  );
}

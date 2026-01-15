"use client";

import { css } from "../../../../../styled-system/css";

interface NumeralSelectorProps {
  /** Count of images per digit (0-9) */
  digitCounts: Record<number, number>;
  /** Currently selected digit */
  selectedDigit: number;
  /** Callback when digit is selected */
  onSelectDigit: (digit: number) => void;
  /** Minimum count to be considered "good" */
  goodThreshold?: number;
  /** Minimum count to be considered "minimal" */
  minimalThreshold?: number;
  /** Compact mode for mobile */
  compact?: boolean;
}

type HealthStatus = "critical" | "low" | "good" | "excellent";

const HEALTH_CONFIG: Record<
  HealthStatus,
  { color: string; bgColor: string; borderColor: string }
> = {
  critical: {
    color: "red.400",
    bgColor: "red.950",
    borderColor: "red.700",
  },
  low: {
    color: "yellow.400",
    bgColor: "yellow.950",
    borderColor: "yellow.700",
  },
  good: {
    color: "green.400",
    bgColor: "green.950",
    borderColor: "green.700",
  },
  excellent: {
    color: "blue.400",
    bgColor: "blue.950",
    borderColor: "blue.700",
  },
};

/**
 * Numeral selector bar showing all 10 digits (0-9) with counts and health indicators.
 * Click any digit to select it for browsing/capturing.
 */
export function NumeralSelector({
  digitCounts,
  selectedDigit,
  onSelectDigit,
  goodThreshold = 20,
  minimalThreshold = 5,
  compact = false,
}: NumeralSelectorProps) {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const maxCount = Math.max(...Object.values(digitCounts), 1);

  const getHealthStatus = (count: number): HealthStatus => {
    if (count < minimalThreshold) return "critical";
    if (count < goodThreshold) return "low";
    if (count < goodThreshold * 2) return "good";
    return "excellent";
  };

  const getBarHeight = (count: number): string => {
    const percentage = Math.min((count / maxCount) * 100, 100);
    return `${Math.max(percentage, 5)}%`; // Minimum 5% so it's visible
  };

  return (
    <div
      data-component="numeral-selector"
      className={css({
        display: "flex",
        gap: compact ? 1 : 1,
        p: compact ? 1 : 2,
        bg: "gray.900",
        borderRadius: "lg",
        justifyContent: "center",
        flexWrap: compact ? "wrap" : "nowrap",
      })}
    >
      {digits.map((digit) => {
        const count = digitCounts[digit] || 0;
        const health = getHealthStatus(count);
        const config = HEALTH_CONFIG[health];
        const isSelected = selectedDigit === digit;

        return (
          <button
            key={digit}
            type="button"
            data-action="select-digit"
            onClick={() => onSelectDigit(digit)}
            data-digit={digit}
            data-selected={isSelected}
            data-health={health}
            data-count={count}
            className={css({
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
              p: compact ? 1.5 : 2,
              minWidth: compact ? "32px" : "48px",
              bg: isSelected ? config.bgColor : "gray.850",
              border: "2px solid",
              borderColor: isSelected ? config.borderColor : "transparent",
              borderRadius: "md",
              cursor: "pointer",
              transition: "all 0.15s ease",
              _hover: {
                bg: isSelected ? config.bgColor : "gray.800",
                borderColor: isSelected ? config.borderColor : "gray.700",
              },
              _active: {
                transform: "translateY(0)",
              },
            })}
          >
            {/* Digit numeral */}
            <span
              data-element="digit-numeral"
              className={css({
                fontSize: compact ? "md" : "lg",
                fontWeight: "bold",
                fontFamily: "mono",
                color: isSelected ? config.color : "gray.300",
                lineHeight: 1,
              })}
            >
              {digit}
            </span>

            {/* Count bar visualization */}
            <div
              data-element="count-bar-container"
              className={css({
                width: "100%",
                height: compact ? "16px" : "20px",
                bg: "gray.800",
                borderRadius: "sm",
                overflow: "hidden",
                position: "relative",
              })}
            >
              {/* Fill bar */}
              <div
                data-element="count-bar-fill"
                className={css({
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  bg: config.color,
                  opacity: isSelected ? 1 : 0.6,
                  transition: "all 0.2s ease",
                  borderRadius: "sm",
                })}
                style={{ height: getBarHeight(count) }}
              />
              {/* Count text overlay */}
              <span
                data-element="count-text"
                className={css({
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2xs",
                  fontWeight: "bold",
                  fontFamily: "mono",
                  color: "white",
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                  zIndex: 1,
                })}
              >
                {count}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default NumeralSelector;

"use client";

import { css } from "@styled/css";
import { useTheme } from "@/contexts/ThemeContext";

interface LayoutPreviewProps {
  orientation: "portrait" | "landscape";
  cols: number;
  rows: number;
  className?: string;
  onClick?: () => void;
  isSelected?: boolean;
  maxSize?: number;
}

/**
 * Visual preview of worksheet layout showing page orientation and problem grid
 * Can act as a button when onClick is provided
 */
export function LayoutPreview({
  orientation,
  cols,
  rows,
  className,
  onClick,
  isSelected = false,
  maxSize = 48,
}: LayoutPreviewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Page dimensions (aspect ratios)
  const pageAspect = orientation === "portrait" ? 8.5 / 11 : 11 / 8.5;

  // Scale to fit in button (max dimensions)
  let pageWidth: number;
  let pageHeight: number;

  if (orientation === "portrait") {
    pageHeight = maxSize;
    pageWidth = pageHeight * pageAspect;
  } else {
    pageWidth = maxSize;
    pageHeight = pageWidth / pageAspect;
  }

  // Problem cell dimensions with padding
  const padding = 3;
  const cellWidth = (pageWidth - padding * 2) / cols;
  const cellHeight = (pageHeight - padding * 2) / rows;
  const cellPadding = 1;

  const svgContent = (
    <svg
      viewBox={`0 0 ${pageWidth} ${pageHeight}`}
      className={css({
        rounded: "sm",
        width: "100%",
        height: "100%",
      })}
      style={{
        backgroundColor: isDark ? "#1f2937" : "white",
      }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Problem grid */}
      {Array.from({ length: rows }).map((_, rowIdx) =>
        Array.from({ length: cols }).map((_, colIdx) => (
          <rect
            key={`${rowIdx}-${colIdx}`}
            x={padding + colIdx * cellWidth + cellPadding}
            y={padding + rowIdx * cellHeight + cellPadding}
            width={cellWidth - cellPadding * 2}
            height={cellHeight - cellPadding * 2}
            fill={isDark ? "#6b7280" : "#d1d5db"}
            rx={0.5}
          />
        )),
      )}
    </svg>
  );

  // If used as a button, wrap in button element with styling
  if (onClick) {
    const aspectRatio = orientation === "portrait" ? 8.5 / 11 : 11 / 8.5;

    return (
      <button
        type="button"
        onClick={onClick}
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid",
          borderColor: isSelected
            ? "brand.500"
            : isDark
              ? "gray.600"
              : "gray.300",
          bg: isSelected
            ? isDark
              ? "brand.900"
              : "brand.50"
            : isDark
              ? "gray.700"
              : "white",
          rounded: "lg",
          cursor: "pointer",
          transition: "all 0.15s",
          p: "2",
          width: "100%",
          maxWidth: "32",
          _hover: {
            borderColor: "brand.400",
          },
        })}
        style={{
          aspectRatio: aspectRatio.toString(),
        }}
      >
        {svgContent}
      </button>
    );
  }

  // Otherwise just return the SVG with border
  const aspectRatio = orientation === "portrait" ? 8.5 / 11 : 11 / 8.5;

  return (
    <div
      className={css({
        border: "1px solid",
        borderColor: isDark ? "gray.600" : "gray.300",
        rounded: "sm",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        p: "1",
      })}
      style={{
        width: `${maxSize}px`,
        aspectRatio: aspectRatio.toString(),
      }}
    >
      {svgContent}
    </div>
  );
}

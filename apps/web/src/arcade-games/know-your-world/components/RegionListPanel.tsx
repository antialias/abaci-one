"use client";

import { memo } from "react";
import { css } from "@styled/css";

interface RegionListItemProps {
  name: string;
  onHover?: (name: string | null) => void;
  isDark?: boolean;
}

/**
 * Individual region list item with hover interaction.
 * Memoized to prevent unnecessary re-renders when list is large.
 */
const RegionListItem = memo(function RegionListItem({
  name,
  onHover,
  isDark = false,
}: RegionListItemProps) {
  return (
    <div
      onMouseEnter={() => onHover?.(name)}
      onMouseLeave={() => onHover?.(null)}
      className={css({
        px: "2",
        py: "1",
        fontSize: "xs",
        color: isDark ? "gray.300" : "gray.600",
        cursor: onHover ? "pointer" : "default",
        rounded: "md",
        overflowWrap: "break-word",
        _hover: {
          bg: isDark ? "gray.700" : "gray.200",
          color: isDark ? "gray.100" : "gray.900",
        },
      })}
    >
      {name}
    </div>
  );
});

interface RegionListPanelProps {
  /** List of region names to display */
  regions: string[];
  /** Callback when hovering over a region name (for map preview) */
  onRegionHover?: (name: string | null) => void;
  /** Maximum height of the scrollable list */
  maxHeight?: string;
  /** Dark mode styling */
  isDark?: boolean;
  /** Sort regions alphabetically (default: true) */
  sortAlphabetically?: boolean;
}

/**
 * Scrollable panel displaying a list of region names.
 * Used in DrillDownMapSelector for displaying selected regions on desktop.
 */
export function RegionListPanel({
  regions,
  onRegionHover,
  maxHeight = "200px",
  isDark = false,
  sortAlphabetically = true,
}: RegionListPanelProps) {
  const displayRegions = sortAlphabetically
    ? [...regions].sort((a, b) => a.localeCompare(b))
    : regions;

  return (
    <div
      data-element="region-list-panel"
      className={css({
        display: "flex",
        flexDirection: "column",
        maxHeight,
        overflow: "hidden",
      })}
    >
      {/* Scrollable list */}
      <div
        className={css({
          overflowY: "auto",
          flex: 1,
        })}
      >
        {displayRegions.map((name) => (
          <RegionListItem
            key={name}
            name={name}
            onHover={onRegionHover}
            isDark={isDark}
          />
        ))}
      </div>
    </div>
  );
}

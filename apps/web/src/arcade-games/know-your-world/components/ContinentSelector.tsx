"use client";

import { useState } from "react";
import { css } from "@styled/css";
import { useTheme } from "@/contexts/ThemeContext";
import { WORLD_MAP } from "../maps";
import {
  getContinentForCountry,
  CONTINENTS,
  type ContinentId,
} from "../continents";
import { getRegionColor } from "../mapColors";

interface ContinentSelectorProps {
  selectedContinent: ContinentId | "all" | null;
  onSelectContinent: (continent: ContinentId | "all") => void;
}

export function ContinentSelector({
  selectedContinent,
  onSelectContinent,
}: ContinentSelectorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [hoveredContinent, setHoveredContinent] = useState<
    ContinentId | "all" | null
  >(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // Group regions by continent
  const regionsByContinent = new Map<
    ContinentId | "all",
    typeof WORLD_MAP.regions
  >();
  regionsByContinent.set("all", []); // Initialize all continents

  CONTINENTS.forEach((continent) => {
    regionsByContinent.set(continent.id, []);
  });

  WORLD_MAP.regions.forEach((region) => {
    const continent = getContinentForCountry(region.id);
    if (continent) {
      regionsByContinent.get(continent)?.push(region);
    }
  });

  // Get color for a region based on its continent's state
  const getRegionColorForSelector = (
    regionId: string,
    continentId: ContinentId | "all",
  ): string => {
    const isSelected = selectedContinent === continentId;
    const isHovered =
      hoveredContinent === continentId || hoveredRegion === regionId;

    // Use the game's color algorithm, but adjust opacity based on selection state
    const baseColor = getRegionColor(regionId, isSelected, isHovered, isDark);

    // If this continent is not selected and not hovered, make it more transparent
    if (!isSelected && !isHovered) {
      // Extract the color and add low opacity
      return baseColor.includes("#") ? `${baseColor}33` : baseColor; // 20% opacity
    }

    return baseColor;
  };

  const getRegionStroke = (
    continentId: ContinentId | "all",
    regionId: string,
  ): string => {
    const isSelected = selectedContinent === continentId;
    const isHovered =
      hoveredContinent === continentId || hoveredRegion === regionId;

    if (isSelected) {
      return isDark ? "#60a5fa" : "#1d4ed8";
    }
    if (isHovered) {
      return isDark ? "#93c5fd" : "#3b82f6";
    }
    return isDark ? "#374151" : "#9ca3af";
  };

  const getRegionStrokeWidth = (
    continentId: ContinentId | "all",
    regionId: string,
  ): number => {
    const isSelected = selectedContinent === continentId;
    const isHovered =
      hoveredContinent === continentId || hoveredRegion === regionId;

    if (isHovered) return 1.5;
    if (isSelected) return 1;
    return 0.3;
  };

  return (
    <div data-component="continent-selector">
      <div
        className={css({
          fontSize: "sm",
          color: isDark ? "gray.400" : "gray.600",
          textAlign: "center",
          marginBottom: "2",
        })}
      >
        Click the map to focus on a continent
      </div>

      {/* Interactive Map */}
      <div
        className={css({
          width: "100%",
          padding: "4",
          bg: isDark ? "gray.900" : "gray.50",
          rounded: "xl",
          border: "2px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
        })}
      >
        <svg
          viewBox={WORLD_MAP.viewBox}
          className={css({
            width: "100%",
            height: "auto",
            cursor: "pointer",
          })}
        >
          {/* Background */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={isDark ? "#111827" : "#f9fafb"}
          />

          {/* Render each continent as a group */}
          {CONTINENTS.map((continent) => {
            const regions = regionsByContinent.get(continent.id) || [];
            if (regions.length === 0) return null;

            return (
              <g key={continent.id} data-continent={continent.id}>
                {/* All regions in this continent - each individually clickable */}
                {regions.map((region) => (
                  <path
                    key={region.id}
                    d={region.path}
                    fill={getRegionColorForSelector(region.id, continent.id)}
                    stroke={getRegionStroke(continent.id, region.id)}
                    strokeWidth={getRegionStrokeWidth(continent.id, region.id)}
                    onMouseEnter={() => {
                      setHoveredContinent(continent.id);
                      setHoveredRegion(region.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredContinent(null);
                      setHoveredRegion(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectContinent(continent.id);
                    }}
                    style={{
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      pointerEvents: "all",
                    }}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Featured "All" option - full width */}
      <button
        data-action="select-all-continents"
        onClick={() => onSelectContinent("all")}
        onMouseEnter={() => setHoveredContinent("all")}
        onMouseLeave={() => setHoveredContinent(null)}
        className={css({
          width: "100%",
          padding: "3",
          marginTop: "3",
          rounded: "lg",
          border: "2px solid",
          borderColor:
            selectedContinent === "all" || selectedContinent === null
              ? "blue.500"
              : "transparent",
          bg:
            selectedContinent === "all" || selectedContinent === null
              ? isDark
                ? "blue.900"
                : "blue.50"
              : hoveredContinent === "all"
                ? isDark
                  ? "gray.700"
                  : "gray.200"
                : isDark
                  ? "gray.800"
                  : "gray.100",
          color: isDark ? "gray.100" : "gray.900",
          cursor: "pointer",
          transition: "all 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "2",
          _hover: {
            borderColor: "blue.400",
          },
        })}
      >
        <span className={css({ fontSize: "xl" })}>🌍</span>
        <span className={css({ fontWeight: "bold" })}>
          Explore All 256 Countries
        </span>
      </button>

      {/* Continent buttons - smaller, for focusing */}
      <div
        className={css({
          fontSize: "xs",
          color: isDark ? "gray.500" : "gray.500",
          marginTop: "3",
          marginBottom: "2",
          textAlign: "center",
        })}
      >
        Or focus on a continent:
      </div>
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "2",
        })}
      >
        {/* Continent buttons */}
        {CONTINENTS.map((continent) => (
          <button
            key={continent.id}
            data-action={`select-${continent.id}-continent`}
            onClick={() => onSelectContinent(continent.id)}
            onMouseEnter={() => setHoveredContinent(continent.id)}
            onMouseLeave={() => setHoveredContinent(null)}
            className={css({
              padding: "2",
              rounded: "lg",
              border: "2px solid",
              borderColor:
                selectedContinent === continent.id ? "blue.500" : "transparent",
              bg:
                selectedContinent === continent.id
                  ? isDark
                    ? "blue.900"
                    : "blue.50"
                  : hoveredContinent === continent.id
                    ? isDark
                      ? "gray.700"
                      : "gray.200"
                    : isDark
                      ? "gray.800"
                      : "gray.100",
              color: isDark ? "gray.100" : "gray.900",
              cursor: "pointer",
              transition: "all 0.2s",
              fontSize: "xs",
              fontWeight:
                selectedContinent === continent.id ? "bold" : "normal",
              _hover: {
                borderColor: "blue.400",
              },
            })}
          >
            <div className={css({ fontSize: "lg" })}>{continent.emoji}</div>
            <div>{continent.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { getHints, hasHints, type HintMap } from "../messages";
import type { Locale } from "@/i18n/messages";

/**
 * Hook to get hints for a region with cycling support.
 * Starts with a random hint, and can cycle to the next hint when user is struggling.
 *
 * Returns:
 * - currentHint: The current hint text (null if no hints)
 * - hintIndex: Current index (0-based)
 * - totalHints: Total number of hints available
 * - nextHint: Function to advance to the next hint (cycles)
 * - hasMoreHints: Whether there are hints the user hasn't seen yet
 */
export interface UseRegionHintResult {
  currentHint: string | null;
  hintIndex: number;
  totalHints: number;
  nextHint: () => void;
  hasMoreHints: boolean;
}

export function useRegionHint(
  map: HintMap,
  regionId: string | null,
): UseRegionHintResult {
  const locale = useLocale() as Locale;
  // Track which region we're showing hints for
  const lastRegionRef = useRef<string | null>(null);
  // Track the starting index (randomized on region change)
  const startIndexRef = useRef<number>(0);
  // Track how many hints we've cycled through for this region
  const [cycleOffset, setCycleOffset] = useState(0);

  // Get all hints for this region
  const allHints = useMemo(() => {
    if (!regionId) return [];
    return getHints(locale, map, regionId) ?? [];
  }, [locale, map, regionId]);

  // Reset cycle offset when region changes
  if (regionId !== lastRegionRef.current) {
    lastRegionRef.current = regionId;
    // Pick a random starting index for this region
    startIndexRef.current =
      allHints.length > 0 ? Math.floor(Math.random() * allHints.length) : 0;
    // Reset cycle offset (can't call setState in render, so we check in useMemo below)
  }

  // Calculate current hint
  const result = useMemo(() => {
    // Reset cycle offset if region changed (detected by mismatch)
    const effectiveCycleOffset =
      regionId === lastRegionRef.current ? cycleOffset : 0;

    if (allHints.length === 0) {
      return {
        currentHint: null,
        hintIndex: 0,
        totalHints: 0,
        hasMoreHints: false,
      };
    }

    const currentIndex =
      (startIndexRef.current + effectiveCycleOffset) % allHints.length;
    return {
      currentHint: allHints[currentIndex],
      hintIndex: effectiveCycleOffset,
      totalHints: allHints.length,
      hasMoreHints: effectiveCycleOffset < allHints.length - 1,
    };
  }, [allHints, cycleOffset, regionId]);

  // Reset cycle offset when region changes
  const prevRegionRef = useRef<string | null>(null);
  if (regionId !== prevRegionRef.current) {
    prevRegionRef.current = regionId;
    if (cycleOffset !== 0) {
      setCycleOffset(0);
    }
  }

  // Function to advance to the next hint
  const nextHint = useCallback(() => {
    if (allHints.length > 1) {
      setCycleOffset((prev) => prev + 1);
    }
  }, [allHints.length]);

  return {
    ...result,
    nextHint,
  };
}

// Legacy function signature for backwards compatibility
export function useRegionHintSimple(
  map: HintMap,
  regionId: string | null,
): string | null {
  const { currentHint } = useRegionHint(map, regionId);
  return currentHint;
}

/**
 * Hook to check if hints exist for a region in the current locale
 */
export function useHasRegionHint(
  map: HintMap,
  regionId: string | null,
): boolean {
  const locale = useLocale() as Locale;

  if (!regionId) {
    return false;
  }

  return hasHints(locale, map, regionId);
}

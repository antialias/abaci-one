/**
 * Give Up Reveal Animation Hook
 *
 * Manages the zoom and pulsing animation effect when the player gives up
 * and the target region is revealed on the map.
 *
 * Features:
 * - Zooms in on the revealed region using CSS transforms
 * - Pulsing flash animation to highlight the region
 * - Smooth zoom-out after animation completes
 * - Saves button position to prevent layout jumping during zoom
 *
 * Usage:
 * ```tsx
 * const {
 *   giveUpFlashProgress,
 *   isGiveUpAnimating,
 *   giveUpZoomTarget,
 *   savedButtonPosition,
 * } = useGiveUpReveal({
 *   giveUpReveal: props.giveUpReveal,
 *   svgRef,
 *   containerRef,
 *   fillContainer,
 * })
 * ```
 */

"use client";

import { useEffect, useState } from "react";
import { usePulsingAnimation } from "../animations";

// ============================================================================
// Types
// ============================================================================

export interface GiveUpReveal {
  regionId: string;
  regionName: string;
  timestamp: number;
}

export interface ZoomTarget {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface ButtonPosition {
  top: number;
  right: number;
}

export interface UseGiveUpRevealOptions {
  /** The give-up reveal state, or null if not revealing */
  giveUpReveal: GiveUpReveal | null;
  /** Reference to the SVG element */
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** Reference to the container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the map fills the container (affects nav offset) */
  fillContainer: boolean;
  /** Nav height offset for full-viewport mode (default: 150) */
  navHeightOffset?: number;
}

export interface UseGiveUpRevealReturn {
  /** Pulsing value 0-1 for flash animation */
  giveUpFlashProgress: number;
  /** Whether animation is currently in progress */
  isGiveUpAnimating: boolean;
  /** CSS transform target values for zoom animation */
  giveUpZoomTarget: ZoomTarget;
  /** Saved button position to prevent jumping during zoom */
  savedButtonPosition: ButtonPosition | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Duration of the give-up animation in milliseconds */
const GIVE_UP_ANIMATION_DURATION = 2000;

/** Number of pulses during the give-up animation */
const GIVE_UP_ANIMATION_PULSES = 3;

/** Default nav height offset */
const DEFAULT_NAV_HEIGHT_OFFSET = 150;

/** Default zoom target (no transformation) */
const DEFAULT_ZOOM_TARGET: ZoomTarget = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing give-up reveal animation.
 *
 * When giveUpReveal changes (detected by timestamp), triggers a zoom-in
 * animation to the revealed region with a pulsing flash effect.
 *
 * @param options - Configuration options
 * @returns Give-up reveal animation state
 */
export function useGiveUpReveal(
  options: UseGiveUpRevealOptions,
): UseGiveUpRevealReturn {
  const {
    giveUpReveal,
    svgRef,
    containerRef,
    fillContainer,
    navHeightOffset = DEFAULT_NAV_HEIGHT_OFFSET,
  } = options;

  // Animation state
  const [giveUpFlashProgress, setGiveUpFlashProgress] = useState(0);
  const [isGiveUpAnimating, setIsGiveUpAnimating] = useState(false);
  const [giveUpZoomTarget, setGiveUpZoomTarget] =
    useState<ZoomTarget>(DEFAULT_ZOOM_TARGET);
  const [savedButtonPosition, setSavedButtonPosition] =
    useState<ButtonPosition | null>(null);

  // Animation controller
  const giveUpAnimation = usePulsingAnimation();

  // Give up reveal animation effect
  useEffect(() => {
    if (!giveUpReveal) {
      setGiveUpFlashProgress(0);
      setIsGiveUpAnimating(false);
      setSavedButtonPosition(null);
      // Reset transform to default when animation clears
      setGiveUpZoomTarget(DEFAULT_ZOOM_TARGET);
      return;
    }

    // Track if this effect has been cleaned up (prevents stale animations)
    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Start animation
    setIsGiveUpAnimating(true);

    // Save current button position before zoom changes the layout
    if (svgRef.current && containerRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const svgOffsetX = svgRect.left - containerRect.left;
      const svgOffsetY = svgRect.top - containerRect.top;
      // Add nav offset when in full-viewport mode
      const buttonTop = svgOffsetY + 8 + (fillContainer ? navHeightOffset : 0);
      const buttonRight =
        containerRect.width - (svgOffsetX + svgRect.width) + 8;
      setSavedButtonPosition({ top: buttonTop, right: buttonRight });
    }

    // Calculate CSS transform to zoom and center on the revealed region
    if (svgRef.current && containerRef.current) {
      const path = svgRef.current.querySelector(
        `path[data-region-id="${giveUpReveal.regionId}"]`,
      );
      if (path && path instanceof SVGGeometryElement) {
        const bbox = path.getBoundingClientRect();
        const svgRect = svgRef.current.getBoundingClientRect();

        // Calculate CSS transform for zoom animation
        // Region center relative to SVG element
        const regionCenterX = bbox.left + bbox.width / 2 - svgRect.left;
        const regionCenterY = bbox.top + bbox.height / 2 - svgRect.top;

        // SVG center
        const svgCenterX = svgRect.width / 2;
        const svgCenterY = svgRect.height / 2;

        // Calculate scale: zoom in so region is clearly visible
        // For tiny regions, zoom more; for larger ones, zoom less
        const regionSize = Math.max(bbox.width, bbox.height);
        const targetSize = Math.min(svgRect.width, svgRect.height) * 0.3; // Region should be ~30% of viewport
        const scale = Math.min(
          8,
          Math.max(2, targetSize / Math.max(regionSize, 1)),
        );

        // Calculate translation to center the region
        // After scaling, we need to translate so the region center is at SVG center
        const translateX = (svgCenterX - regionCenterX) * scale;
        const translateY = (svgCenterY - regionCenterY) * scale;

        // Start zoom-in animation using CSS transform
        setGiveUpZoomTarget({ scale, translateX, translateY });
      }
    }

    // Animation: 3 pulses over 2 seconds using shared pulsing hook
    giveUpAnimation.start({
      duration: GIVE_UP_ANIMATION_DURATION,
      pulses: GIVE_UP_ANIMATION_PULSES,
      onProgress: (pulseProgress) => {
        if (!isCancelled) {
          setGiveUpFlashProgress(pulseProgress);
        }
      },
      onComplete: () => {
        if (isCancelled) return;
        // Animation complete - zoom back out to default
        setGiveUpZoomTarget(DEFAULT_ZOOM_TARGET);

        // Clear reveal state after a short delay to let zoom-out start
        timeoutId = setTimeout(() => {
          if (!isCancelled) {
            setGiveUpFlashProgress(0);
            setIsGiveUpAnimating(false);
            setSavedButtonPosition(null);
          }
        }, 100);
      },
    });

    // Cleanup: cancel animation if giveUpReveal changes before animation completes
    return () => {
      isCancelled = true;
      giveUpAnimation.cancel();
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    giveUpReveal?.timestamp,
    giveUpAnimation,
    svgRef,
    containerRef,
    fillContainer,
    navHeightOffset,
  ]);

  return {
    giveUpFlashProgress,
    isGiveUpAnimating,
    giveUpZoomTarget,
    savedButtonPosition,
  };
}

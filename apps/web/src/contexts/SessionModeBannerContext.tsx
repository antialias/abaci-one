"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SessionMode } from "@/lib/curriculum/session-mode";
import type { ActiveSessionState } from "@/components/practice/ActiveSessionBanner";

// ============================================================================
// Types
// ============================================================================

export type BannerSlot = "content" | "nav" | "hidden";

// Re-export for convenience
export type { ActiveSessionState } from "@/components/practice/ActiveSessionBanner";

export interface SlotBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SlotDimensions {
  width: number;
  height: number;
}

interface SessionModeBannerContextValue {
  // Which slot is currently active (computed from registered slots + visibility)
  activeSlot: BannerSlot;

  // Slot registration - components call these to register/unregister
  registerContentSlot: () => void;
  unregisterContentSlot: () => void;
  registerNavSlot: () => void;
  unregisterNavSlot: () => void;

  // Bounds reporting - slots report their position
  setContentBounds: (bounds: SlotBounds | null) => void;
  setNavBounds: (bounds: SlotBounds | null) => void;

  // Dimensions reporting - slots report their measured content size
  setContentDimensions: (dimensions: SlotDimensions | null) => void;
  setNavDimensions: (dimensions: SlotDimensions | null) => void;
  contentDimensions: SlotDimensions | null;
  navDimensions: SlotDimensions | null;

  // Visibility reporting - content slot reports when scrolled out of view
  setContentSlotVisible: (visible: boolean) => void;

  // Current target bounds for the banner (from active slot)
  targetBounds: SlotBounds | null;

  // Session mode data
  sessionMode: SessionMode | null;
  isLoading: boolean;

  // Active session state (if there's an in-progress session)
  activeSession: ActiveSessionState | null;

  // Action callbacks
  onAction: () => void;
  setOnAction: (callback: () => void) => void;
  onResume: () => void;
  setOnResume: (callback: () => void) => void;
  onStartFresh: () => void;
  setOnStartFresh: (callback: () => void) => void;

  // Skip animation on rapid navigation
  shouldAnimate: boolean;
}

const SessionModeBannerContext =
  createContext<SessionModeBannerContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface SessionModeBannerProviderProps {
  children: ReactNode;
  sessionMode: SessionMode | null;
  isLoading: boolean;
  activeSession?: ActiveSessionState | null;
}

export function SessionModeBannerProvider({
  children,
  sessionMode,
  isLoading,
  activeSession = null,
}: SessionModeBannerProviderProps) {
  // Track which slots are currently registered
  const [contentSlotCount, setContentSlotCount] = useState(0);
  const [navSlotCount, setNavSlotCount] = useState(0);

  // Track bounds from each slot
  const [contentBounds, setContentBoundsState] = useState<SlotBounds | null>(
    null,
  );
  const [navBounds, setNavBoundsState] = useState<SlotBounds | null>(null);

  // Track measured dimensions from each slot's content
  const [contentDimensions, setContentDimensionsState] =
    useState<SlotDimensions | null>(null);
  const [navDimensions, setNavDimensionsState] =
    useState<SlotDimensions | null>(null);

  // Track content slot visibility (for scroll-based projection)
  const [isContentSlotVisible, setContentSlotVisibleState] = useState(true);

  // Track last slot change time for animation skipping
  const lastSlotChangeRef = useRef<number>(0);
  const [shouldAnimate, setShouldAnimate] = useState(true);

  // Compute active slot based on which slots are registered AND visibility
  // Priority: content (if visible) > nav > hidden
  // When content slot scrolls under nav, project to nav slot
  const activeSlot: BannerSlot =
    contentSlotCount > 0 && isContentSlotVisible
      ? "content"
      : navSlotCount > 0
        ? "nav"
        : "hidden";

  // Compute target bounds based on active slot
  const targetBounds =
    activeSlot === "content"
      ? contentBounds
      : activeSlot === "nav"
        ? navBounds
        : null;

  // When slot changes, check if we should animate
  const previousSlotRef = useRef<BannerSlot>(activeSlot);
  useEffect(() => {
    if (previousSlotRef.current !== activeSlot) {
      const now = Date.now();
      const timeSinceLastChange = now - lastSlotChangeRef.current;

      // Skip animation if navigating rapidly (< 300ms between changes)
      setShouldAnimate(timeSinceLastChange > 300);
      lastSlotChangeRef.current = now;
      previousSlotRef.current = activeSlot;
    }
  }, [activeSlot]);

  // Registration callbacks
  const registerContentSlot = useCallback(() => {
    setContentSlotCount((c) => c + 1);
  }, []);

  const unregisterContentSlot = useCallback(() => {
    setContentSlotCount((c) => Math.max(0, c - 1));
  }, []);

  const registerNavSlot = useCallback(() => {
    setNavSlotCount((c) => c + 1);
  }, []);

  const unregisterNavSlot = useCallback(() => {
    setNavSlotCount((c) => Math.max(0, c - 1));
  }, []);

  // Bounds setters (wrapped for stability)
  const setContentBounds = useCallback((bounds: SlotBounds | null) => {
    setContentBoundsState(bounds);
  }, []);

  const setNavBounds = useCallback((bounds: SlotBounds | null) => {
    setNavBoundsState(bounds);
  }, []);

  // Dimensions setters (for measured content size)
  const setContentDimensions = useCallback(
    (dimensions: SlotDimensions | null) => {
      setContentDimensionsState(dimensions);
    },
    [],
  );

  const setNavDimensions = useCallback((dimensions: SlotDimensions | null) => {
    setNavDimensionsState(dimensions);
  }, []);

  // Visibility setter (for scroll-based projection)
  const setContentSlotVisible = useCallback((visible: boolean) => {
    setContentSlotVisibleState(visible);
  }, []);

  // Action callback refs (to avoid re-renders when callbacks change)
  const onActionRef = useRef<() => void>(() => {});
  const onResumeRef = useRef<() => void>(() => {});
  const onStartFreshRef = useRef<() => void>(() => {});

  const onAction = useCallback(() => {
    onActionRef.current();
  }, []);

  const setOnAction = useCallback((callback: () => void) => {
    onActionRef.current = callback;
  }, []);

  const onResume = useCallback(() => {
    onResumeRef.current();
  }, []);

  const setOnResume = useCallback((callback: () => void) => {
    onResumeRef.current = callback;
  }, []);

  const onStartFresh = useCallback(() => {
    onStartFreshRef.current();
  }, []);

  const setOnStartFresh = useCallback((callback: () => void) => {
    onStartFreshRef.current = callback;
  }, []);

  const value = useMemo(
    () => ({
      activeSlot,
      registerContentSlot,
      unregisterContentSlot,
      registerNavSlot,
      unregisterNavSlot,
      setContentBounds,
      setNavBounds,
      setContentDimensions,
      setNavDimensions,
      contentDimensions,
      navDimensions,
      setContentSlotVisible,
      targetBounds,
      sessionMode,
      isLoading,
      activeSession,
      onAction,
      setOnAction,
      onResume,
      setOnResume,
      onStartFresh,
      setOnStartFresh,
      shouldAnimate,
    }),
    [
      activeSlot,
      registerContentSlot,
      unregisterContentSlot,
      registerNavSlot,
      unregisterNavSlot,
      setContentBounds,
      setNavBounds,
      setContentDimensions,
      setNavDimensions,
      contentDimensions,
      navDimensions,
      setContentSlotVisible,
      targetBounds,
      sessionMode,
      isLoading,
      activeSession,
      onAction,
      setOnAction,
      onResume,
      setOnResume,
      onStartFresh,
      setOnStartFresh,
      shouldAnimate,
    ],
  );

  return (
    <SessionModeBannerContext.Provider value={value}>
      {children}
    </SessionModeBannerContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access the session mode banner context.
 * Throws if used outside SessionModeBannerProvider.
 */
export function useSessionModeBanner() {
  const context = useContext(SessionModeBannerContext);
  if (!context) {
    throw new Error(
      "useSessionModeBanner must be used within SessionModeBannerProvider",
    );
  }
  return context;
}

/**
 * Optional hook that returns null if used outside SessionModeBannerProvider.
 * Use this in components that need to work both with and without the provider.
 */
export function useSessionModeBannerOptional() {
  return useContext(SessionModeBannerContext);
}

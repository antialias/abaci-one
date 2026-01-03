"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "visual-debug-enabled";
const PRODUCTION_DEBUG_KEY = "allow-production-debug";

interface VisualDebugContextType {
  /** Whether visual debug elements are enabled */
  isVisualDebugEnabled: boolean;
  /** Toggle visual debug mode on/off */
  toggleVisualDebug: () => void;
  /** Whether we're in development mode */
  isDevelopment: boolean;
  /** Whether debug mode is allowed (dev mode OR production debug unlocked) */
  isDebugAllowed: boolean;
}

const VisualDebugContext = createContext<VisualDebugContextType | null>(null);

export function VisualDebugProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [productionDebugAllowed, setProductionDebugAllowed] = useState(false);
  const isDevelopment = process.env.NODE_ENV === "development";

  // Check for production debug unlock via URL param or localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check URL param: ?debug=1 or ?debug=true
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get("debug");
    if (debugParam === "1" || debugParam === "true") {
      // Unlock production debug permanently
      localStorage.setItem(PRODUCTION_DEBUG_KEY, "true");
      setProductionDebugAllowed(true);
      return;
    }

    // Check localStorage for previously unlocked
    const stored = localStorage.getItem(PRODUCTION_DEBUG_KEY);
    if (stored === "true") {
      setProductionDebugAllowed(true);
    }
  }, []);

  // Load debug enabled state from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setIsEnabled(true);
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(isEnabled));
  }, [isEnabled]);

  const toggleVisualDebug = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  // Debug is allowed in development OR if production debug is unlocked
  const isDebugAllowed = isDevelopment || productionDebugAllowed;

  // Enable visual debug if allowed AND user has toggled it on
  const isVisualDebugEnabled = isDebugAllowed && isEnabled;

  return (
    <VisualDebugContext.Provider
      value={{
        isVisualDebugEnabled,
        toggleVisualDebug,
        isDevelopment,
        isDebugAllowed,
      }}
    >
      {children}
    </VisualDebugContext.Provider>
  );
}

export function useVisualDebug(): VisualDebugContextType {
  const context = useContext(VisualDebugContext);
  if (!context) {
    throw new Error("useVisualDebug must be used within a VisualDebugProvider");
  }
  return context;
}

/**
 * Hook for components that may be rendered outside the provider.
 * Returns safe defaults (debug disabled) if no provider is found.
 */
export function useVisualDebugSafe(): VisualDebugContextType {
  const context = useContext(VisualDebugContext);
  if (!context) {
    const isDev = process.env.NODE_ENV === "development";
    return {
      isVisualDebugEnabled: false,
      toggleVisualDebug: () => {},
      isDevelopment: isDev,
      isDebugAllowed: isDev,
    };
  }
  return context;
}

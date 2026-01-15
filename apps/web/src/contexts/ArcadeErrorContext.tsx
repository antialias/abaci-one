"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useToast } from "@/components/common/ToastContext";

interface ArcadeErrorContextValue {
  addError: (message: string, details?: string) => void;
}

export const ArcadeErrorContext = createContext<ArcadeErrorContextValue | null>(
  null,
);

/**
 * Provider for arcade error management
 * Uses the existing Radix-based toast system for error notifications
 */
export function ArcadeErrorProvider({ children }: { children: ReactNode }) {
  const { showError } = useToast();

  const addError = useCallback(
    (message: string, details?: string) => {
      showError(message, details);
    },
    [showError],
  );

  return (
    <ArcadeErrorContext.Provider value={{ addError }}>
      {children}
    </ArcadeErrorContext.Provider>
  );
}

/**
 * Hook to access arcade error context
 */
export function useArcadeError() {
  const context = useContext(ArcadeErrorContext);
  if (!context) {
    throw new Error("useArcadeError must be used within ArcadeErrorProvider");
  }
  return context;
}

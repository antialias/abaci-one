"use client";

import { createContext, useContext, useMemo } from "react";
import type { WorksheetFormState } from "@/app/create/worksheets/types";

/**
 * Context for worksheet configuration state
 * Eliminates prop drilling for formState, onChange, and operator
 */
export interface WorksheetConfigContextValue {
  formState: WorksheetFormState;
  onChange: (updates: Partial<WorksheetFormState>) => void;
  operator: "addition" | "subtraction" | "mixed";
  isReadOnly?: boolean;
}

export const WorksheetConfigContext =
  createContext<WorksheetConfigContextValue | null>(null);

/**
 * Hook to access worksheet configuration context
 * @throws Error if used outside of WorksheetConfigProvider
 */
export function useWorksheetConfig() {
  const context = useContext(WorksheetConfigContext);
  if (!context) {
    throw new Error(
      "useWorksheetConfig must be used within WorksheetConfigProvider",
    );
  }
  return context;
}

export interface WorksheetConfigProviderProps {
  formState: WorksheetFormState;
  updateFormState: (updates: Partial<WorksheetFormState>) => void;
  children: React.ReactNode;
  isReadOnly?: boolean;
}

/**
 * Provider component for worksheet configuration context
 * Wrap config panel components to provide access to formState, onChange, and operator
 */
export function WorksheetConfigProvider({
  formState,
  updateFormState,
  children,
  isReadOnly = false,
}: WorksheetConfigProviderProps) {
  const value = useMemo(
    () => ({
      formState,
      onChange: updateFormState,
      operator: formState.operator || "addition",
      isReadOnly,
    }),
    [formState, updateFormState, isReadOnly],
  );

  return (
    <WorksheetConfigContext.Provider value={value}>
      {children}
    </WorksheetConfigContext.Provider>
  );
}

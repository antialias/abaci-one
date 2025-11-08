"use client";

import type React from "react";
import { createContext, useContext, useState, useCallback } from "react";

interface MyAbacusContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MyAbacusContext = createContext<MyAbacusContextValue | undefined>(
  undefined,
);

export function MyAbacusProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <MyAbacusContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </MyAbacusContext.Provider>
  );
}

export function useMyAbacus() {
  const context = useContext(MyAbacusContext);
  if (!context) {
    throw new Error("useMyAbacus must be used within MyAbacusProvider");
  }
  return context;
}

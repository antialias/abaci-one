"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface DeploymentInfoContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const DeploymentInfoContext = createContext<DeploymentInfoContextType | null>(
  null,
);

export function DeploymentInfoProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <DeploymentInfoContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </DeploymentInfoContext.Provider>
  );
}

export function useDeploymentInfo() {
  const context = useContext(DeploymentInfoContext);
  if (!context) {
    throw new Error(
      "useDeploymentInfo must be used within DeploymentInfoProvider",
    );
  }
  return context;
}

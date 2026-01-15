"use client";

import { createContext } from "react";

/**
 * Preview mode context - used to detect when rendering inside GamePreview
 * Allows components like useArcadeSession to use mock state in preview mode
 */
export const PreviewModeContext = createContext<{
  isPreview: boolean;
  mockState: any;
} | null>(null);

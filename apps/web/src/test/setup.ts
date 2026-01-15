import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

// Mock next-intl for tests
// This provides a passthrough translation function that returns the key
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useNow: () => new Date(),
  useTimeZone: () => "America/Los_Angeles",
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString(),
    number: (num: number) => String(num),
    relativeTime: () => "some time ago",
  }),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// Mock @soroban/abacus-react for tests
// This provides mock implementations of abacus display context and components
const mockAbacusConfig = {
  colorScheme: "place-value" as const,
  beadShape: "diamond" as const,
  colorPalette: "default" as const,
  hideInactiveBeads: false,
  coloredNumerals: false,
  scaleFactor: 1.0,
  showNumbers: true,
  animated: true,
  interactive: false,
  gestures: false,
  soundEnabled: false,
  soundVolume: 0.8,
  physicalAbacusColumns: 4,
};

vi.mock("@soroban/abacus-react", () => ({
  AbacusReact: ({ value }: { value: number }) =>
    React.createElement("div", {
      "data-testid": "abacus",
      "data-value": value,
    }),
  AbacusStatic: ({ value }: { value: number }) =>
    React.createElement("div", {
      "data-testid": "abacus-static",
      "data-value": value,
    }),
  StandaloneBead: () =>
    React.createElement("div", { "data-testid": "standalone-bead" }),
  AbacusDisplayProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useAbacusConfig: () => mockAbacusConfig,
  useAbacusDisplay: () => ({
    config: mockAbacusConfig,
    updateConfig: vi.fn(),
    resetToDefaults: vi.fn(),
  }),
  getDefaultAbacusConfig: () => mockAbacusConfig,
  useAbacusDiff: () => ({ beads: [], changes: [] }),
  useAbacusState: (value: number) => ({
    state: { columns: [] },
    setValue: vi.fn(),
    value,
  }),
  useSystemTheme: () => "light",
  ABACUS_THEMES: {},
  // Utility functions
  numberToAbacusState: vi.fn(() => ({ columns: [] })),
  abacusStateToNumber: vi.fn(() => 0),
  calculateBeadChanges: vi.fn(() => []),
  calculateBeadDiff: vi.fn(() => ({ additions: [], removals: [] })),
  calculateBeadDiffFromValues: vi.fn(() => ({ additions: [], removals: [] })),
  validateAbacusValue: vi.fn(() => true),
  areStatesEqual: vi.fn(() => true),
  calculateAbacusDimensions: vi.fn(() => ({ width: 100, height: 200 })),
  calculateStandardDimensions: vi.fn(() => ({})),
  calculateBeadPosition: vi.fn(() => ({ x: 0, y: 0 })),
  calculateBeadDimensions: vi.fn(() => ({ width: 10, height: 10 })),
  calculateActiveBeadsBounds: vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 200,
  })),
  calculateAbacusCrop: vi.fn(() => ({})),
}));

// Mock canvas Image constructor to prevent jsdom errors when rendering
// images with data URIs (e.g., data:image/jpeg;base64,...)
// This works by patching HTMLImageElement.prototype before jsdom uses it
// Guard for node environment where HTMLImageElement doesn't exist
if (typeof HTMLImageElement !== "undefined") {
  const originalSetAttribute = HTMLImageElement.prototype.setAttribute;
  HTMLImageElement.prototype.setAttribute = function (
    name: string,
    value: string,
  ) {
    if (name === "src" && value.startsWith("data:image/")) {
      // Store the value but don't trigger jsdom's image loading
      Object.defineProperty(this, "src", {
        value,
        writable: true,
        configurable: true,
      });
      return;
    }
    return originalSetAttribute.call(this, name, value);
  };
}

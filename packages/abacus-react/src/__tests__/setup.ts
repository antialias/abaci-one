import "@testing-library/jest-dom";
import React from "react";

// Mock for @react-spring/web
vi.mock("@react-spring/web", () => ({
  useSpring: () => [
    {
      x: 0,
      y: 0,
      transform: "translate(0px, 0px)",
      opacity: 1,
    },
    {
      start: vi.fn(),
      stop: vi.fn(),
      set: vi.fn(),
    },
  ],
  animated: {
    g: ({ children, ...props }: any) =>
      React.createElement("g", props, children),
    div: ({ children, ...props }: any) =>
      React.createElement("div", props, children),
  },
  config: {
    gentle: {},
  },
  to: (values: any[], fn: Function) => {
    if (Array.isArray(values) && typeof fn === "function") {
      return fn(...values);
    }
    return "translate(0px, 0px)";
  },
}));

// Mock for @use-gesture/react
vi.mock("@use-gesture/react", () => ({
  useDrag: () => () => ({}), // Return a function that returns an empty object
}));

// Mock for @number-flow/react
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) =>
    React.createElement("span", {}, value.toString()),
}));

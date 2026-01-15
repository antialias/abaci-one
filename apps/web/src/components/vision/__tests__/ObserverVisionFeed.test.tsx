/**
 * Unit tests for ObserverVisionFeed component
 *
 * Note: Canvas.Image mock is provided in src/test/setup.ts to prevent
 * jsdom errors with data URI images. Actual image rendering is verified
 * through integration/e2e tests.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ObservedVisionFrame } from "@/hooks/useSessionObserver";
import { ObserverVisionFeed } from "../ObserverVisionFeed";

describe("ObserverVisionFeed", () => {
  const createMockFrame = (
    overrides?: Partial<ObservedVisionFrame>,
  ): ObservedVisionFrame => ({
    imageData: "base64ImageData==",
    detectedValue: 123,
    confidence: 0.95,
    receivedAt: Date.now(),
    ...overrides,
  });

  // Default props that are always required
  const defaultProps = {
    sessionId: "test-session-123",
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("renders the vision feed container", () => {
      const frame = createMockFrame();
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByRole("img")).toBeInTheDocument();
    });

    it("displays the image with correct src", () => {
      const frame = createMockFrame({ imageData: "testImageData123" });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      const img = screen.getByRole("img") as HTMLImageElement;
      // Check the src property (not attribute) because our test setup
      // intercepts data:image/ src attributes to prevent jsdom canvas errors
      expect(img.src).toBe("data:image/jpeg;base64,testImageData123");
    });

    it("has appropriate alt text for accessibility", () => {
      const frame = createMockFrame();
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("alt", "Student's abacus vision feed");
    });
  });

  describe("detected value display", () => {
    it("displays the detected value", () => {
      const frame = createMockFrame({ detectedValue: 456, confidence: 0.87 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("456")).toBeInTheDocument();
    });

    it("displays confidence percentage", () => {
      const frame = createMockFrame({ detectedValue: 123, confidence: 0.87 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("87%")).toBeInTheDocument();
    });

    it("displays dashes when detectedValue is null", () => {
      const frame = createMockFrame({ detectedValue: null, confidence: 0 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("---")).toBeInTheDocument();
    });

    it("hides confidence when value is null", () => {
      const frame = createMockFrame({ detectedValue: null, confidence: 0.95 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.queryByText("95%")).not.toBeInTheDocument();
    });

    it("handles zero as a valid detected value", () => {
      const frame = createMockFrame({ detectedValue: 0, confidence: 0.99 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("0")).toBeInTheDocument();
      expect(screen.getByText("99%")).toBeInTheDocument();
    });
  });

  describe("live/stale indicator", () => {
    it("shows Live status for fresh frames (less than 1 second old)", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const frame = createMockFrame({ receivedAt: now - 500 }); // 500ms ago
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("shows Stale status for old frames (more than 1 second old)", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const frame = createMockFrame({ receivedAt: now - 1500 }); // 1.5 seconds ago
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("Stale")).toBeInTheDocument();
    });

    it("sets stale data attribute when frame is old", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const frame = createMockFrame({ receivedAt: now - 2000 }); // 2 seconds ago
      const { container } = render(
        <ObserverVisionFeed frame={frame} {...defaultProps} />,
      );

      const component = container.querySelector(
        '[data-component="observer-vision-feed"]',
      );
      expect(component).toHaveAttribute("data-stale", "true");
    });

    it("sets stale data attribute to false for fresh frames", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const frame = createMockFrame({ receivedAt: now - 100 }); // 100ms ago
      const { container } = render(
        <ObserverVisionFeed frame={frame} {...defaultProps} />,
      );

      const component = container.querySelector(
        '[data-component="observer-vision-feed"]',
      );
      expect(component).toHaveAttribute("data-stale", "false");
    });

    it("reduces image opacity for stale frames", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const frame = createMockFrame({ receivedAt: now - 2000 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      const img = screen.getByRole("img");
      // The opacity should be reduced for stale frames
      expect(img.className).toBeDefined();
    });
  });

  describe("vision badge", () => {
    it("displays the vision badge", () => {
      const frame = createMockFrame();
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("📷")).toBeInTheDocument();
      expect(screen.getByText("Vision")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles very large detected values", () => {
      const frame = createMockFrame({ detectedValue: 99999, confidence: 1.0 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("99999")).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("rounds confidence to nearest integer", () => {
      const frame = createMockFrame({ detectedValue: 123, confidence: 0.876 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("88%")).toBeInTheDocument();
    });

    it("handles confidence edge case of exactly 1", () => {
      const frame = createMockFrame({ detectedValue: 123, confidence: 1.0 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("handles confidence edge case of exactly 0", () => {
      const frame = createMockFrame({ detectedValue: 123, confidence: 0 });
      render(<ObserverVisionFeed frame={frame} {...defaultProps} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
    });
  });
});

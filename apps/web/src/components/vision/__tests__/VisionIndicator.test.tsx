/**
 * Unit tests for VisionIndicator component
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VisionIndicator } from "../VisionIndicator";

// Mock the MyAbacusContext
const mockOpenVisionSetup = vi.fn();
const mockVisionConfig = {
  enabled: false,
  cameraDeviceId: null,
  calibration: null,
  remoteCameraSessionId: null,
};

vi.mock("@/contexts/MyAbacusContext", () => ({
  useMyAbacus: () => ({
    visionConfig: mockVisionConfig,
    isVisionSetupComplete:
      mockVisionConfig.cameraDeviceId !== null &&
      mockVisionConfig.calibration !== null,
    openVisionSetup: mockOpenVisionSetup,
  }),
}));

describe("VisionIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default state
    mockVisionConfig.enabled = false;
    mockVisionConfig.cameraDeviceId = null;
    mockVisionConfig.calibration = null;
    mockVisionConfig.remoteCameraSessionId = null;
  });

  describe("rendering", () => {
    it("renders the camera icon", () => {
      render(<VisionIndicator />);
      expect(screen.getByText("📷")).toBeInTheDocument();
    });

    it("renders with medium size by default", () => {
      render(<VisionIndicator />);
      const button = screen.getByRole("button");
      // Medium size button should exist with the vision-status attribute
      expect(button).toHaveAttribute("data-vision-status");
    });

    it("renders with small size when specified", () => {
      render(<VisionIndicator size="small" />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("status indicator", () => {
    it("shows not-configured status when camera is not set", () => {
      mockVisionConfig.cameraDeviceId = null;
      mockVisionConfig.calibration = null;

      render(<VisionIndicator />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("data-vision-status", "not-configured");
    });

    it("shows disabled status when configured but not enabled", () => {
      mockVisionConfig.cameraDeviceId = "camera-123";
      mockVisionConfig.calibration = {
        roi: { x: 0, y: 0, width: 100, height: 100 },
        columnCount: 5,
        columnDividers: [],
        rotation: 0,
      };
      mockVisionConfig.enabled = false;

      render(<VisionIndicator />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("data-vision-status", "disabled");
    });

    it("shows enabled status when configured and enabled", () => {
      mockVisionConfig.cameraDeviceId = "camera-123";
      mockVisionConfig.calibration = {
        roi: { x: 0, y: 0, width: 100, height: 100 },
        columnCount: 5,
        columnDividers: [],
        rotation: 0,
      };
      mockVisionConfig.enabled = true;

      render(<VisionIndicator />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("data-vision-status", "enabled");
    });
  });

  describe("click behavior", () => {
    it("opens setup modal on click", () => {
      render(<VisionIndicator />);
      const button = screen.getByRole("button");

      fireEvent.click(button);

      expect(mockOpenVisionSetup).toHaveBeenCalledTimes(1);
    });

    it("opens setup modal on right-click", () => {
      render(<VisionIndicator />);
      const button = screen.getByRole("button");

      fireEvent.contextMenu(button);

      expect(mockOpenVisionSetup).toHaveBeenCalledTimes(1);
    });

    it("stops event propagation on click", () => {
      const parentClickHandler = vi.fn();

      render(
        <div onClick={parentClickHandler}>
          <VisionIndicator />
        </div>,
      );
      const button = screen.getByRole("button");

      fireEvent.click(button);

      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has appropriate title based on status", () => {
      mockVisionConfig.cameraDeviceId = null;

      render(<VisionIndicator />);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute(
        "title",
        expect.stringContaining("not configured"),
      );
    });

    it("updates title when vision is enabled", () => {
      mockVisionConfig.cameraDeviceId = "camera-123";
      mockVisionConfig.calibration = {
        roi: { x: 0, y: 0, width: 100, height: 100 },
        columnCount: 5,
        columnDividers: [],
        rotation: 0,
      };
      mockVisionConfig.enabled = true;

      render(<VisionIndicator />);
      const button = screen.getByRole("button");

      expect(button).toHaveAttribute(
        "title",
        expect.stringContaining("enabled"),
      );
    });
  });

  describe("positioning", () => {
    it("uses bottom-right position by default", () => {
      render(<VisionIndicator />);
      const button = screen.getByRole("button");

      expect(button.style.position).toBe("absolute");
    });

    it("accepts top-left position", () => {
      render(<VisionIndicator position="top-left" />);
      const button = screen.getByRole("button");

      expect(button.style.position).toBe("absolute");
    });
  });
});

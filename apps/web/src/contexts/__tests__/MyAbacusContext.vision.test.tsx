/**
 * Unit tests for MyAbacusContext vision functionality
 */
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MyAbacusProvider,
  useMyAbacus,
  type VisionFrameData,
} from "../MyAbacusContext";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("MyAbacusContext - vision functionality", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MyAbacusProvider>{children}</MyAbacusProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe("visionConfig state", () => {
    it("starts with vision disabled", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      expect(result.current.visionConfig.enabled).toBe(false);
    });

    it("starts with null cameraDeviceId", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      expect(result.current.visionConfig.cameraDeviceId).toBeNull();
    });

    it("starts with null calibration", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      expect(result.current.visionConfig.calibration).toBeNull();
    });

    it("starts with null remoteCameraSessionId", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      expect(result.current.visionConfig.remoteCameraSessionId).toBeNull();
    });
  });

  describe("isVisionSetupComplete", () => {
    it("returns false when camera is not set", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      expect(result.current.isVisionSetupComplete).toBe(false);
    });

    it("returns false when calibration is not set", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionCamera("camera-123");
      });

      expect(result.current.isVisionSetupComplete).toBe(false);
    });

    it("returns true when both camera and calibration are set", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionCamera("camera-123");
        result.current.setVisionCalibration({
          roi: { x: 0, y: 0, width: 100, height: 100 },
          columnCount: 5,
          columnDividers: [],
          rotation: 0,
        });
      });

      expect(result.current.isVisionSetupComplete).toBe(true);
    });
  });

  describe("setVisionEnabled", () => {
    it("enables vision mode", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionEnabled(true);
      });

      expect(result.current.visionConfig.enabled).toBe(true);
    });

    it("disables vision mode", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionEnabled(true);
      });

      act(() => {
        result.current.setVisionEnabled(false);
      });

      expect(result.current.visionConfig.enabled).toBe(false);
    });

    it("persists to localStorage", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionEnabled(true);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "abacus-vision-config",
        expect.stringContaining('"enabled":true'),
      );
    });
  });

  describe("setVisionCamera", () => {
    it("sets camera device ID", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionCamera("camera-device-123");
      });

      expect(result.current.visionConfig.cameraDeviceId).toBe(
        "camera-device-123",
      );
    });

    it("clears camera device ID when set to null", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionCamera("camera-123");
      });

      act(() => {
        result.current.setVisionCamera(null);
      });

      expect(result.current.visionConfig.cameraDeviceId).toBeNull();
    });

    it("persists to localStorage", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionCamera("camera-abc");
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "abacus-vision-config",
        expect.stringContaining('"cameraDeviceId":"camera-abc"'),
      );
    });
  });

  describe("setVisionCalibration", () => {
    it("sets calibration grid", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      const calibration = {
        roi: { x: 10, y: 20, width: 200, height: 100 },
        columnCount: 5,
        columnDividers: [0.2, 0.4, 0.6, 0.8],
        rotation: 0,
      };

      act(() => {
        result.current.setVisionCalibration(calibration);
      });

      expect(result.current.visionConfig.calibration).toEqual(calibration);
    });

    it("clears calibration when set to null", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionCalibration({
          roi: { x: 0, y: 0, width: 100, height: 100 },
          columnCount: 5,
          columnDividers: [],
          rotation: 0,
        });
      });

      act(() => {
        result.current.setVisionCalibration(null);
      });

      expect(result.current.visionConfig.calibration).toBeNull();
    });
  });

  describe("setVisionRemoteSession", () => {
    it("sets remote camera session ID", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionRemoteSession("remote-session-456");
      });

      expect(result.current.visionConfig.remoteCameraSessionId).toBe(
        "remote-session-456",
      );
    });

    it("clears remote session when set to null", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.setVisionRemoteSession("session-123");
      });

      act(() => {
        result.current.setVisionRemoteSession(null);
      });

      expect(result.current.visionConfig.remoteCameraSessionId).toBeNull();
    });
  });

  describe("vision setup modal", () => {
    it("starts with modal closed", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      expect(result.current.isVisionSetupOpen).toBe(false);
    });

    it("opens the setup modal", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.openVisionSetup();
      });

      expect(result.current.isVisionSetupOpen).toBe(true);
    });

    it("closes the setup modal", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      act(() => {
        result.current.openVisionSetup();
      });

      act(() => {
        result.current.closeVisionSetup();
      });

      expect(result.current.isVisionSetupOpen).toBe(false);
    });
  });

  describe("vision frame callback", () => {
    it("setVisionFrameCallback sets the callback", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      const callback = vi.fn();

      act(() => {
        result.current.setVisionFrameCallback(callback);
      });

      // The callback should be stored (we can verify by emitting a frame)
      const frame: VisionFrameData = {
        imageData: "test",
        detectedValue: 123,
        confidence: 0.9,
      };

      act(() => {
        result.current.emitVisionFrame(frame);
      });

      expect(callback).toHaveBeenCalledWith(frame);
    });

    it("emitVisionFrame calls the registered callback", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      const callback = vi.fn();

      act(() => {
        result.current.setVisionFrameCallback(callback);
      });

      const frame: VisionFrameData = {
        imageData: "base64data",
        detectedValue: 456,
        confidence: 0.85,
      };

      act(() => {
        result.current.emitVisionFrame(frame);
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(frame);
    });

    it("emitVisionFrame does nothing when no callback is set", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      // This should not throw
      const frame: VisionFrameData = {
        imageData: "test",
        detectedValue: 123,
        confidence: 0.9,
      };

      expect(() => {
        act(() => {
          result.current.emitVisionFrame(frame);
        });
      }).not.toThrow();
    });

    it("clearing callback stops emissions", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      const callback = vi.fn();

      act(() => {
        result.current.setVisionFrameCallback(callback);
      });

      act(() => {
        result.current.setVisionFrameCallback(null);
      });

      const frame: VisionFrameData = {
        imageData: "test",
        detectedValue: 123,
        confidence: 0.9,
      };

      act(() => {
        result.current.emitVisionFrame(frame);
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("handles null detectedValue in frame", () => {
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      const callback = vi.fn();

      act(() => {
        result.current.setVisionFrameCallback(callback);
      });

      const frame: VisionFrameData = {
        imageData: "test",
        detectedValue: null,
        confidence: 0,
      };

      act(() => {
        result.current.emitVisionFrame(frame);
      });

      expect(callback).toHaveBeenCalledWith({
        imageData: "test",
        detectedValue: null,
        confidence: 0,
      });
    });
  });

  describe("localStorage persistence", () => {
    it("loads saved config from localStorage on mount", () => {
      const savedConfig = {
        enabled: false, // Always starts disabled per the code logic
        cameraDeviceId: "saved-camera",
        calibration: {
          roi: { x: 0, y: 0, width: 100, height: 100 },
          columnCount: 5,
          columnDividers: [],
          rotation: 0,
        },
        remoteCameraSessionId: "saved-session",
      };

      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedConfig));

      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      // Wait for effect to run
      expect(result.current.visionConfig.cameraDeviceId).toBe("saved-camera");
      // Note: enabled is always false on load per the implementation
      expect(result.current.visionConfig.enabled).toBe(false);
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorageMock.getItem.mockReturnValueOnce("invalid json {{{");

      // Should not throw
      const { result } = renderHook(() => useMyAbacus(), { wrapper });

      expect(result.current.visionConfig).toBeDefined();
      expect(result.current.visionConfig.enabled).toBe(false);
    });
  });

  describe("negative cases", () => {
    it("throws when useMyAbacus is used outside provider", () => {
      // Using renderHook without the wrapper should throw
      expect(() => {
        renderHook(() => useMyAbacus());
      }).toThrow("useMyAbacus must be used within MyAbacusProvider");
    });
  });
});

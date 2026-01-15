/**
 * Unit tests for useSessionBroadcast vision frame broadcasting
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BroadcastState } from "@/components/practice";
import { useSessionBroadcast } from "../useSessionBroadcast";

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

describe("useSessionBroadcast - vision frame broadcasting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.on.mockReset();
    mockSocket.emit.mockReset();
  });

  const createMockBroadcastState = (): BroadcastState => ({
    currentProblem: { terms: [5, 3], answer: 8 },
    phase: "problem",
    studentAnswer: "",
    isCorrect: null,
    startedAt: Date.now(),
    purpose: "focus",
    complexity: undefined,
    currentProblemNumber: 1,
    totalProblems: 10,
    sessionParts: [],
    currentPartIndex: 0,
    currentSlotIndex: 0,
    slotResults: [],
  });

  describe("sendVisionFrame", () => {
    it("returns sendVisionFrame function", () => {
      const { result } = renderHook(() =>
        useSessionBroadcast(
          "session-123",
          "player-456",
          createMockBroadcastState(),
        ),
      );

      expect(result.current.sendVisionFrame).toBeDefined();
      expect(typeof result.current.sendVisionFrame).toBe("function");
    });

    it("emits vision-frame event with correct payload when connected", async () => {
      // Simulate connection
      let connectHandler: (() => void) | undefined;
      mockSocket.on.mockImplementation((event: string, handler: unknown) => {
        if (event === "connect") {
          connectHandler = handler as () => void;
        }
        return mockSocket;
      });

      const { result } = renderHook(() =>
        useSessionBroadcast(
          "session-123",
          "player-456",
          createMockBroadcastState(),
        ),
      );

      // Trigger connect
      act(() => {
        connectHandler?.();
      });

      // Send vision frame
      const imageData = "base64ImageData==";
      const detectedValue = 456;
      const confidence = 0.92;

      act(() => {
        result.current.sendVisionFrame(imageData, detectedValue, confidence);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "vision-frame",
        expect.objectContaining({
          sessionId: "session-123",
          imageData: "base64ImageData==",
          detectedValue: 456,
          confidence: 0.92,
          timestamp: expect.any(Number),
        }),
      );
    });

    it("includes timestamp in vision-frame event", async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      let connectHandler: (() => void) | undefined;
      mockSocket.on.mockImplementation((event: string, handler: unknown) => {
        if (event === "connect") {
          connectHandler = handler as () => void;
        }
        return mockSocket;
      });

      const { result } = renderHook(() =>
        useSessionBroadcast(
          "session-123",
          "player-456",
          createMockBroadcastState(),
        ),
      );

      act(() => {
        connectHandler?.();
      });

      act(() => {
        result.current.sendVisionFrame("imageData", 123, 0.95);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "vision-frame",
        expect.objectContaining({
          timestamp: now,
        }),
      );

      vi.useRealTimers();
    });

    it("handles null detectedValue", async () => {
      let connectHandler: (() => void) | undefined;
      mockSocket.on.mockImplementation((event: string, handler: unknown) => {
        if (event === "connect") {
          connectHandler = handler as () => void;
        }
        return mockSocket;
      });

      const { result } = renderHook(() =>
        useSessionBroadcast(
          "session-123",
          "player-456",
          createMockBroadcastState(),
        ),
      );

      act(() => {
        connectHandler?.();
      });

      act(() => {
        result.current.sendVisionFrame("imageData", null, 0);
      });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "vision-frame",
        expect.objectContaining({
          detectedValue: null,
          confidence: 0,
        }),
      );
    });
  });

  describe("negative cases", () => {
    it("does not emit when sessionId is undefined", () => {
      const { result } = renderHook(() =>
        useSessionBroadcast(
          undefined,
          "player-456",
          createMockBroadcastState(),
        ),
      );

      act(() => {
        result.current.sendVisionFrame("imageData", 123, 0.95);
      });

      expect(mockSocket.emit).not.toHaveBeenCalledWith(
        "vision-frame",
        expect.anything(),
      );
    });

    it("does not emit when not connected", () => {
      // Don't trigger connect handler
      const { result } = renderHook(() =>
        useSessionBroadcast(
          "session-123",
          "player-456",
          createMockBroadcastState(),
        ),
      );

      act(() => {
        result.current.sendVisionFrame("imageData", 123, 0.95);
      });

      // The join-session emit happens on connect, but vision-frame should not
      const visionFrameCalls = mockSocket.emit.mock.calls.filter(
        ([event]) => event === "vision-frame",
      );
      expect(visionFrameCalls).toHaveLength(0);
    });

    it("does not emit when state is null", () => {
      const { result } = renderHook(() =>
        useSessionBroadcast("session-123", "player-456", null),
      );

      act(() => {
        result.current.sendVisionFrame("imageData", 123, 0.95);
      });

      // Should still not emit vision-frame (no connection due to null state cleanup logic)
      const visionFrameCalls = mockSocket.emit.mock.calls.filter(
        ([event]) => event === "vision-frame",
      );
      expect(visionFrameCalls).toHaveLength(0);
    });
  });

  describe("result interface", () => {
    it("includes sendVisionFrame in the result", () => {
      const { result } = renderHook(() =>
        useSessionBroadcast(
          "session-123",
          "player-456",
          createMockBroadcastState(),
        ),
      );

      expect(result.current).toHaveProperty("sendVisionFrame");
      expect(result.current).toHaveProperty("isConnected");
      expect(result.current).toHaveProperty("isBroadcasting");
      expect(result.current).toHaveProperty("sendPartTransition");
      expect(result.current).toHaveProperty("sendPartTransitionComplete");
    });
  });
});

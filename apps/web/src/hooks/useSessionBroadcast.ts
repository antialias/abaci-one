"use client";

import { useCallback, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { BroadcastState } from "@/components/practice";
import type { SessionPartType } from "@/db/schema/session-plans";
import type {
  AbacusControlEvent,
  PartTransitionCompleteEvent,
  PartTransitionEvent,
  PracticeStateEvent,
  SessionPausedEvent,
  SessionResumedEvent,
  VisionFrameEvent,
} from "@/lib/classroom/socket-events";

/**
 * Abacus control action received from teacher
 */
export type ReceivedAbacusControl =
  | { type: "show-abacus" }
  | { type: "hide-abacus" }
  | { type: "set-value"; value: number };

/**
 * Pause request from teacher
 */
export interface TeacherPauseRequest {
  /** Optional message from teacher to display on pause screen */
  message?: string;
}

/**
 * Options for useSessionBroadcast hook
 */
export interface UseSessionBroadcastOptions {
  /** Callback when an abacus control event is received from teacher */
  onAbacusControl?: (control: ReceivedAbacusControl) => void;
  /** Callback when teacher pauses the session */
  onTeacherPause?: (request: TeacherPauseRequest) => void;
  /** Callback when teacher resumes the session */
  onTeacherResume?: () => void;
}

/**
 * Hook to broadcast practice session state to observers via WebSocket
 *
 * Broadcasts to any observer (teacher in classroom or parent at home).
 * Always connects when there's an active session - observers join the channel.
 *
 * @param sessionId - The session plan ID
 * @param playerId - The student's player ID
 * @param state - Current practice state (or null if not in active practice)
 * @param options - Optional callbacks for receiving observer control events
 */
export interface UseSessionBroadcastResult {
  isConnected: boolean;
  isBroadcasting: boolean;
  /** Whether vision recording is active */
  isRecording: boolean;
  /** Recording ID if currently recording */
  recordingId: string | null;
  /** Send part transition event to observers */
  sendPartTransition: (
    previousPartType: SessionPartType | null,
    nextPartType: SessionPartType,
    countdownStartTime: number,
    countdownDurationMs: number,
  ) => void;
  /** Send part transition complete event to observers */
  sendPartTransitionComplete: () => void;
  /** Send vision frame to observers (when student has vision mode enabled) */
  sendVisionFrame: (
    imageData: string,
    detectedValue: number | null,
    confidence: number,
  ) => void;
  /** Start vision recording for this session */
  startVisionRecording: () => void;
  /** Stop vision recording for this session */
  stopVisionRecording: () => void;
  /** Send a problem marker for timeline synchronization */
  sendProblemMarker: (
    problemNumber: number,
    partIndex: number,
    eventType: "problem-shown" | "answer-submitted" | "feedback-shown",
    isCorrect?: boolean,
    /** Retry context for multi-attempt support */
    retryContext?: {
      epochNumber: number;
      attemptNumber: number;
      isRetry: boolean;
      isManualRedo: boolean;
    },
  ) => void;
}

export function useSessionBroadcast(
  sessionId: string | undefined,
  playerId: string | undefined,
  state: BroadcastState | null,
  options?: UseSessionBroadcastOptions,
): UseSessionBroadcastResult {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  // Keep state in a ref so socket event handlers can access current state
  const stateRef = useRef<BroadcastState | null>(null);
  stateRef.current = state;

  // Keep options in a ref so socket event handlers can access current callbacks
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Vision recording state
  const isRecordingRef = useRef(false);
  const recordingIdRef = useRef<string | null>(null);

  // Helper to broadcast current state
  const broadcastState = useCallback(() => {
    const currentState = stateRef.current;
    if (
      !socketRef.current ||
      !isConnectedRef.current ||
      !sessionId ||
      !currentState
    ) {
      return;
    }

    const event: PracticeStateEvent = {
      sessionId,
      currentProblem: currentState.currentProblem,
      phase: currentState.phase,
      studentAnswer: currentState.studentAnswer,
      isCorrect: currentState.isCorrect,
      timing: {
        startedAt: currentState.startedAt,
        elapsed: Date.now() - currentState.startedAt,
      },
      purpose: currentState.purpose,
      complexity: currentState.complexity,
      currentProblemNumber: currentState.currentProblemNumber,
      totalProblems: currentState.totalProblems,
      // Session structure for progress indicator
      sessionParts: currentState.sessionParts,
      currentPartIndex: currentState.currentPartIndex,
      currentSlotIndex: currentState.currentSlotIndex,
      slotResults: currentState.slotResults,
    };

    socketRef.current.emit("practice-state", event);
    console.log("[SessionBroadcast] Emitted practice-state:", {
      phase: currentState.phase,
      answer: currentState.studentAnswer,
      isCorrect: currentState.isCorrect,
    });
  }, [sessionId]);

  // Connect to socket and join session channel when there's an active session
  // This enables both teachers (classroom) and parents (home) to observe
  useEffect(() => {
    // Only connect if we have a session
    if (!sessionId || !playerId) {
      // Clean up if we were connected
      if (socketRef.current) {
        console.log("[SessionBroadcast] Disconnecting - session ended");
        socketRef.current.disconnect();
        socketRef.current = null;
        isConnectedRef.current = false;
      }
      return;
    }

    // Create socket connection
    const socket = io({
      path: "/api/socket",
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    // Handler for when socket connects
    const handleConnect = () => {
      console.log(
        "[SessionBroadcast] Connected, joining session channel:",
        sessionId,
      );
      isConnectedRef.current = true;
      // Join the session channel so we can receive 'observer-joined' events
      socket.emit("join-session", { sessionId });
      // Broadcast current state immediately so any waiting observers get it
      broadcastState();
    };

    socket.on("connect", handleConnect);

    // IMPORTANT: If socket is already connected (shared Manager), the 'connect' event
    // won't fire. We need to manually trigger the connect logic in this case.
    if (socket.connected) {
      console.log(
        "[SessionBroadcast] Socket already connected, triggering connect logic",
      );
      handleConnect();
    }

    socket.on("disconnect", () => {
      console.log("[SessionBroadcast] Disconnected");
      isConnectedRef.current = false;
    });

    // When an observer joins, re-broadcast current state so they see it immediately
    socket.on("observer-joined", (data: { observerId: string }) => {
      console.log(
        "[SessionBroadcast] Observer joined:",
        data.observerId,
        "- re-broadcasting state",
      );
      broadcastState();
    });

    // Listen for abacus control events from teacher
    socket.on("abacus-control", (data: AbacusControlEvent) => {
      console.log("[SessionBroadcast] Received abacus-control:", data);
      // Only handle controls for our session and the main practice abacus ('hero')
      if (data.sessionId !== sessionId || data.target !== "hero") {
        return;
      }

      // Map the socket event to our ReceivedAbacusControl type
      let control: ReceivedAbacusControl;
      switch (data.action) {
        case "show":
          control = { type: "show-abacus" };
          break;
        case "hide":
          control = { type: "hide-abacus" };
          break;
        case "set-value":
          if (data.value === undefined) return; // Invalid event
          control = { type: "set-value", value: data.value };
          break;
        default:
          return; // Unknown action
      }

      // Call the callback if provided
      optionsRef.current?.onAbacusControl?.(control);
    });

    // Listen for pause events from teacher
    socket.on("session-paused", (data: SessionPausedEvent) => {
      console.log("[SessionBroadcast] Received session-paused:", data);
      if (data.sessionId !== sessionId) return;

      optionsRef.current?.onTeacherPause?.({ message: data.message });
    });

    // Listen for resume events from teacher
    socket.on("session-resumed", (data: SessionResumedEvent) => {
      console.log("[SessionBroadcast] Received session-resumed:", data);
      if (data.sessionId !== sessionId) return;

      optionsRef.current?.onTeacherResume?.();
    });

    // Listen for recording started event
    socket.on(
      "vision-recording-started",
      (data: { sessionId: string; recordingId: string }) => {
        console.log("[SessionBroadcast] Recording started:", data.recordingId);
        if (data.sessionId === sessionId) {
          isRecordingRef.current = true;
          recordingIdRef.current = data.recordingId;
        }
      },
    );

    // Listen for recording stopped event
    socket.on(
      "vision-recording-stopped",
      (data: { sessionId: string; durationMs: number }) => {
        console.log(
          "[SessionBroadcast] Recording stopped, duration:",
          data.durationMs,
        );
        if (data.sessionId === sessionId) {
          isRecordingRef.current = false;
          recordingIdRef.current = null;
        }
      },
    );

    return () => {
      console.log("[SessionBroadcast] Cleaning up socket connection");
      socket.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
    };
  }, [sessionId, playerId, broadcastState]);

  // Broadcast state changes
  useEffect(() => {
    broadcastState();
  }, [
    broadcastState,
    state?.currentProblem?.answer, // New problem
    state?.phase, // Phase change
    state?.studentAnswer, // Answer submitted
    state?.isCorrect, // Result received
    state?.purpose, // Purpose change
  ]);

  // Broadcast part transition to observers
  const sendPartTransition = useCallback(
    (
      previousPartType: SessionPartType | null,
      nextPartType: SessionPartType,
      countdownStartTime: number,
      countdownDurationMs: number,
    ) => {
      if (!socketRef.current || !isConnectedRef.current || !sessionId) {
        return;
      }

      const event: PartTransitionEvent = {
        sessionId,
        previousPartType,
        nextPartType,
        countdownStartTime,
        countdownDurationMs,
      };

      socketRef.current.emit("part-transition", event);
      console.log("[SessionBroadcast] Emitted part-transition:", {
        previousPartType,
        nextPartType,
        countdownDurationMs,
      });
    },
    [sessionId],
  );

  // Broadcast part transition complete to observers
  const sendPartTransitionComplete = useCallback(() => {
    if (!socketRef.current || !isConnectedRef.current || !sessionId) {
      return;
    }

    const event: PartTransitionCompleteEvent = {
      sessionId,
    };

    socketRef.current.emit("part-transition-complete", event);
    console.log("[SessionBroadcast] Emitted part-transition-complete");
  }, [sessionId]);

  // Broadcast vision frame to observers
  const sendVisionFrame = useCallback(
    (imageData: string, detectedValue: number | null, confidence: number) => {
      if (!socketRef.current || !isConnectedRef.current || !sessionId) {
        return;
      }

      const event: VisionFrameEvent = {
        sessionId,
        imageData,
        detectedValue,
        confidence,
        timestamp: Date.now(),
      };

      socketRef.current.emit("vision-frame", event);
    },
    [sessionId],
  );

  // Start vision recording for this session
  const startVisionRecording = useCallback(() => {
    console.log("[SessionBroadcast] startVisionRecording called", {
      hasSocket: !!socketRef.current,
      isConnected: isConnectedRef.current,
      sessionId,
      playerId,
      isRecording: isRecordingRef.current,
    });

    if (
      !socketRef.current ||
      !isConnectedRef.current ||
      !sessionId ||
      !playerId
    ) {
      console.warn(
        "[SessionBroadcast] Cannot start recording - not connected or missing IDs",
      );
      return;
    }

    if (isRecordingRef.current) {
      console.log("[SessionBroadcast] Recording already active");
      return;
    }

    console.log("[SessionBroadcast] Emitting start-vision-recording event");
    socketRef.current.emit("start-vision-recording", { sessionId, playerId });
  }, [sessionId, playerId]);

  // Stop vision recording for this session
  const stopVisionRecording = useCallback(() => {
    if (!socketRef.current || !isConnectedRef.current || !sessionId) {
      console.warn("[SessionBroadcast] Cannot stop recording - not connected");
      return;
    }

    if (!isRecordingRef.current) {
      console.log("[SessionBroadcast] No recording active");
      return;
    }

    console.log("[SessionBroadcast] Stopping vision recording");
    socketRef.current.emit("stop-vision-recording", { sessionId });
  }, [sessionId]);

  // Send a problem marker for timeline synchronization
  const sendProblemMarker = useCallback(
    (
      problemNumber: number,
      partIndex: number,
      eventType: "problem-shown" | "answer-submitted" | "feedback-shown",
      isCorrect?: boolean,
      retryContext?: {
        epochNumber: number;
        attemptNumber: number;
        isRetry: boolean;
        isManualRedo: boolean;
      },
    ) => {
      if (!socketRef.current || !isConnectedRef.current || !sessionId) {
        return;
      }

      // Always send markers - server will capture metadata even without video frames
      // This enables playback of student answers even when camera wasn't enabled

      socketRef.current.emit("vision-problem-marker", {
        sessionId,
        playerId, // Include playerId for auto-starting metadata-only sessions
        problemNumber,
        partIndex,
        eventType,
        isCorrect,
        epochNumber: retryContext?.epochNumber ?? 0,
        attemptNumber: retryContext?.attemptNumber ?? 1,
        isRetry: retryContext?.isRetry ?? false,
        isManualRedo: retryContext?.isManualRedo ?? false,
      });
      console.log("[SessionBroadcast] Sent problem marker:", {
        problemNumber,
        partIndex,
        eventType,
        isCorrect,
        retryContext,
      });
    },
    [sessionId, playerId],
  );

  return {
    isConnected: isConnectedRef.current,
    isBroadcasting: isConnectedRef.current && !!state,
    isRecording: isRecordingRef.current,
    recordingId: recordingIdRef.current,
    sendPartTransition,
    sendPartTransitionComplete,
    sendVisionFrame,
    startVisionRecording,
    stopVisionRecording,
    sendProblemMarker,
  };
}

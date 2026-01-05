"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateForEvent } from "@/lib/classroom/query-invalidations";
import type {
  EnrollmentApprovedEvent,
  EnrollmentRequestApprovedEvent,
  EnrollmentRequestCreatedEvent,
  EnrollmentRequestDeniedEvent,
  SessionEndedEvent,
  SessionStartedEvent,
  StudentEnteredEvent,
  StudentLeftEvent,
  StudentUnenrolledEvent,
} from "@/lib/classroom/socket-events";

/**
 * Hook for real-time classroom presence updates via WebSocket
 *
 * When a student enters or leaves the classroom, this hook receives the event
 * and automatically invalidates the React Query cache so the UI updates.
 *
 * @param classroomId - The classroom to subscribe to
 * @returns Whether the socket is connected
 */
export function useClassroomSocket(classroomId: string | undefined): {
  connected: boolean;
} {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!classroomId) return;

    // Create socket connection
    const socket = io({
      path: "/api/socket",
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[ClassroomSocket] Connected");
      setConnected(true);
      // Join the classroom channel
      socket.emit("join-classroom", { classroomId });
    });

    socket.on("disconnect", () => {
      console.log("[ClassroomSocket] Disconnected");
      setConnected(false);
    });

    // Listen for student entered event
    socket.on("student-entered", (data: StudentEnteredEvent) => {
      console.log("[ClassroomSocket] Student entered:", data.playerName);
      invalidateForEvent(queryClient, "studentEntered", { classroomId });
    });

    // Listen for student left event
    socket.on("student-left", (data: StudentLeftEvent) => {
      console.log("[ClassroomSocket] Student left:", data.playerName);
      invalidateForEvent(queryClient, "studentLeft", { classroomId });
    });

    // Listen for enrollment request created event
    socket.on(
      "enrollment-request-created",
      (data: EnrollmentRequestCreatedEvent) => {
        console.log(
          "[ClassroomSocket] Enrollment request created for:",
          data.request.playerName,
        );
        invalidateForEvent(queryClient, "requestCreated", {
          classroomId,
          playerId: data.request.playerId,
        });
      },
    );

    // Listen for enrollment request approved event (one side approved)
    socket.on(
      "enrollment-request-approved",
      (data: EnrollmentRequestApprovedEvent) => {
        console.log(
          "[ClassroomSocket] Enrollment request approved by:",
          data.approvedBy,
        );
        invalidateForEvent(queryClient, "requestApproved", {
          classroomId,
          playerId: data.playerId,
        });
      },
    );

    // Listen for enrollment request denied event (parent denied teacher's request)
    socket.on(
      "enrollment-request-denied",
      (data: EnrollmentRequestDeniedEvent) => {
        console.log(
          "[ClassroomSocket] Enrollment request denied by:",
          data.deniedBy,
        );
        invalidateForEvent(queryClient, "requestDenied", {
          classroomId,
          playerId: data.playerId,
        });
      },
    );

    // Listen for enrollment approved event (student fully enrolled)
    socket.on("enrollment-approved", (data: EnrollmentApprovedEvent) => {
      console.log("[ClassroomSocket] Student enrolled:", data.playerName);
      invalidateForEvent(queryClient, "enrollmentCompleted", {
        classroomId,
        playerId: data.playerId,
      });
    });

    // Listen for student unenrolled event
    socket.on("student-unenrolled", (data: StudentUnenrolledEvent) => {
      console.log(
        "[ClassroomSocket] Student unenrolled:",
        data.playerName,
        "by:",
        data.unenrolledBy,
      );
      invalidateForEvent(queryClient, "studentUnenrolled", {
        classroomId,
        playerId: data.playerId,
      });
    });

    // Listen for session started event
    socket.on("session-started", (data: SessionStartedEvent) => {
      console.log(
        "[ClassroomSocket] Session started:",
        data.playerName,
        "session:",
        data.sessionId,
      );
      invalidateForEvent(queryClient, "sessionStarted", { classroomId });
    });

    // Listen for session ended event
    socket.on("session-ended", (data: SessionEndedEvent) => {
      console.log(
        "[ClassroomSocket] Session ended:",
        data.playerName,
        "reason:",
        data.reason,
        "session:",
        data.sessionId,
      );
      invalidateForEvent(queryClient, "sessionEnded", { classroomId });
    });

    // Cleanup on unmount
    return () => {
      socket.emit("leave-classroom", { classroomId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [classroomId, queryClient]);

  return { connected };
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/common/ToastContext";
import { useMyAbacus } from "@/contexts/MyAbacusContext";
import { PageWithNav } from "@/components/PageWithNav";
import {
  ActiveSession,
  type AttemptTimingData,
  type BroadcastState,
  PracticeErrorBoundary,
  PracticeSubNav,
  type SessionHudData,
} from "@/components/practice";
import type { Player } from "@/db/schema/players";
import type {
  SessionHealth,
  SessionPart,
  SessionPlan,
  SlotResult,
} from "@/db/schema/session-plans";
import {
  type ReceivedAbacusControl,
  type TeacherPauseRequest,
  useSessionBroadcast,
} from "@/hooks/useSessionBroadcast";
import {
  useActiveSessionPlan,
  useEndSessionEarly,
  useRecordSlotResult,
} from "@/hooks/useSessionPlan";
import { css } from "../../../../styled-system/css";

interface PracticeClientProps {
  studentId: string;
  player: Player;
  initialSession: SessionPlan;
}

/**
 * Practice Client Component
 *
 * This component ONLY shows the current problem.
 * It assumes the session is in_progress (server guards ensure this).
 *
 * When the session completes, it redirects to /summary.
 */
export function PracticeClient({
  studentId,
  player,
  initialSession,
}: PracticeClientProps) {
  const router = useRouter();
  const { showError } = useToast();
  const { setVisionFrameCallback } = useMyAbacus();

  // Track pause state for HUD display (ActiveSession owns the modal and actual pause logic)
  const [isPaused, setIsPaused] = useState(false);
  // Track timing data from ActiveSession for the sub-nav HUD
  const [timingData, setTimingData] = useState<AttemptTimingData | null>(null);
  // Track broadcast state for session observation (digit-by-digit updates from ActiveSession)
  const [broadcastState, setBroadcastState] = useState<BroadcastState | null>(
    null,
  );
  // Browse mode state - lifted here so PracticeSubNav can trigger it
  const [isBrowseMode, setIsBrowseMode] = useState(false);
  // Browse index - lifted for navigation from SessionProgressIndicator
  const [browseIndex, setBrowseIndex] = useState(0);
  // Teacher abacus control - receives commands from observing teacher
  const [teacherControl, setTeacherControl] =
    useState<ReceivedAbacusControl | null>(null);
  // Teacher-initiated pause/resume requests from observing teacher
  const [teacherPauseRequest, setTeacherPauseRequest] =
    useState<TeacherPauseRequest | null>(null);
  const [teacherResumeRequest, setTeacherResumeRequest] = useState(false);
  // Manual pause request from HUD
  const [manualPauseRequest, setManualPauseRequest] = useState(false);

  // Session plan mutations
  const recordResult = useRecordSlotResult();
  const endEarly = useEndSessionEarly();

  // Fetch active session plan from cache or API with server data as initial
  const { data: fetchedPlan } = useActiveSessionPlan(studentId, initialSession);

  // Current plan - mutations take priority, then fetched/cached data
  const currentPlan =
    endEarly.data ?? recordResult.data ?? fetchedPlan ?? initialSession;

  // Compute HUD data from current plan
  const currentPart = currentPlan.parts[currentPlan.currentPartIndex] as
    | SessionPart
    | undefined;
  const sessionHealth = currentPlan.sessionHealth as SessionHealth | null;

  // Calculate totals
  const { totalProblems, completedProblems } = useMemo(() => {
    const total = currentPlan.parts.reduce(
      (sum, part) => sum + part.slots.length,
      0,
    );
    let completed = 0;
    for (let i = 0; i < currentPlan.currentPartIndex; i++) {
      completed += currentPlan.parts[i].slots.length;
    }
    completed += currentPlan.currentSlotIndex;
    return { totalProblems: total, completedProblems: completed };
  }, [
    currentPlan.parts,
    currentPlan.currentPartIndex,
    currentPlan.currentSlotIndex,
  ]);

  // Pause handler - triggers manual pause in ActiveSession
  const handlePause = useCallback(() => {
    setManualPauseRequest(true);
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Handle recording an answer
  const handleAnswer = useCallback(
    async (
      result: Omit<SlotResult, "timestamp" | "partNumber">,
    ): Promise<void> => {
      try {
        const updatedPlan = await recordResult.mutateAsync({
          playerId: studentId,
          planId: currentPlan.id,
          result,
        });

        // If session just completed, redirect to summary with completed flag
        if (updatedPlan.completedAt) {
          router.push(`/practice/${studentId}/summary?completed=1`, {
            scroll: false,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.includes("Not authorized")) {
          showError(
            "Not authorized",
            "Only parents or teachers with the student present in their classroom can record answers.",
          );
        } else {
          showError("Failed to record answer", message);
        }
      }
    },
    [studentId, currentPlan.id, recordResult, router, showError],
  );

  // Handle ending session early
  const handleEndEarly = useCallback(
    async (reason?: string) => {
      try {
        await endEarly.mutateAsync({
          playerId: studentId,
          planId: currentPlan.id,
          reason,
        });
        // Redirect to summary after ending early with completed flag
        router.push(`/practice/${studentId}/summary?completed=1`, {
          scroll: false,
        });
      } catch (err) {
        // Check if it's an authorization error
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.includes("Not authorized")) {
          showError(
            "Not authorized",
            "Only parents or teachers with the student present in their classroom can end sessions.",
          );
        } else {
          showError("Failed to end session", message);
        }
      }
    },
    [studentId, currentPlan.id, endEarly, router, showError],
  );

  // Handle session completion (called by ActiveSession when all problems done)
  const handleSessionComplete = useCallback(() => {
    // Redirect to summary with completed flag
    router.push(`/practice/${studentId}/summary?completed=1`, {
      scroll: false,
    });
  }, [studentId, router]);

  // Broadcast session state if student is in a classroom
  // broadcastState is updated by ActiveSession via the onBroadcastStateChange callback
  // onAbacusControl receives control events from observing teacher
  // onTeacherPause/onTeacherResume receive pause/resume commands from teacher
  const { sendPartTransition, sendPartTransitionComplete, sendVisionFrame } =
    useSessionBroadcast(currentPlan.id, studentId, broadcastState, {
      onAbacusControl: setTeacherControl,
      onTeacherPause: setTeacherPauseRequest,
      onTeacherResume: () => setTeacherResumeRequest(true),
    });

  // Wire vision frame callback to broadcast vision frames to observers
  useEffect(() => {
    setVisionFrameCallback((frame) => {
      sendVisionFrame(frame.imageData, frame.detectedValue, frame.confidence);
    });

    return () => {
      setVisionFrameCallback(null);
    };
  }, [setVisionFrameCallback, sendVisionFrame]);

  // Build session HUD data for PracticeSubNav
  const sessionHud: SessionHudData | undefined = currentPart
    ? {
        isPaused,
        parts: currentPlan.parts,
        currentPartIndex: currentPlan.currentPartIndex,
        currentPart: {
          type: currentPart.type,
          partNumber: currentPart.partNumber,
          totalSlots: currentPart.slots.length,
        },
        currentSlotIndex: currentPlan.currentSlotIndex,
        results: currentPlan.results,
        completedProblems,
        totalProblems,
        sessionHealth: sessionHealth
          ? {
              overall: sessionHealth.overall,
              accuracy: sessionHealth.accuracy,
            }
          : undefined,
        // Pass timing data for the current problem
        timing: timingData
          ? {
              startTime: timingData.startTime,
              accumulatedPauseMs: timingData.accumulatedPauseMs,
              results: currentPlan.results,
              parts: currentPlan.parts,
            }
          : undefined,
        onPause: handlePause,
        onResume: handleResume,
        onEndEarly: () => handleEndEarly("Session ended"),
        isEndingSession: endEarly.isPending,
        isBrowseMode,
        onToggleBrowse: () => setIsBrowseMode((prev) => !prev),
        onBrowseNavigate: setBrowseIndex,
        plan: currentPlan,
      }
    : undefined;

  return (
    <PageWithNav>
      {/* Practice Sub-Navigation with Session HUD */}
      <PracticeSubNav
        student={player}
        pageContext="session"
        sessionHud={sessionHud}
      />

      <main
        data-component="practice-page"
        className={css({
          // Fixed positioning to precisely control bounds
          position: "fixed",
          // Top: main nav (80px) + sub-nav height (~52px mobile, ~60px desktop)
          top: { base: "132px", md: "140px" },
          left: 0,
          // Right: 0 by default, landscape mobile handled via media query below
          right: 0,
          // Bottom: keypad height on mobile portrait (48px), 0 on desktop
          // Landscape mobile handled via media query below
          bottom: { base: "48px", md: 0 },
          overflow: "hidden", // Prevent scrolling during practice
        })}
      >
        {/* Landscape mobile: keypad is on right (100px) instead of bottom */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media (orientation: landscape) and (max-height: 500px) {
                [data-component="practice-page"] {
                  bottom: 0 !important;
                  right: 100px !important;
                }
              }
            `,
          }}
        />
        <PracticeErrorBoundary studentName={player.name}>
          <ActiveSession
            plan={currentPlan}
            student={{
              name: player.name,
              emoji: player.emoji,
              color: player.color,
            }}
            onAnswer={handleAnswer}
            onEndEarly={handleEndEarly}
            onPause={() => setIsPaused(true)}
            onResume={handleResume}
            onComplete={handleSessionComplete}
            onTimingUpdate={setTimingData}
            onBroadcastStateChange={setBroadcastState}
            isBrowseMode={isBrowseMode}
            browseIndex={browseIndex}
            onBrowseIndexChange={setBrowseIndex}
            teacherControl={teacherControl}
            onTeacherControlHandled={() => setTeacherControl(null)}
            teacherPauseRequest={teacherPauseRequest}
            onTeacherPauseHandled={() => setTeacherPauseRequest(null)}
            teacherResumeRequest={teacherResumeRequest}
            onTeacherResumeHandled={() => setTeacherResumeRequest(false)}
            manualPauseRequest={manualPauseRequest}
            onManualPauseHandled={() => setManualPauseRequest(false)}
            onPartTransition={sendPartTransition}
            onPartTransitionComplete={sendPartTransitionComplete}
          />
        </PracticeErrorBoundary>
      </main>
    </PageWithNav>
  );
}

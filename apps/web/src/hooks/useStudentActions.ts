"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  useEnrolledClassrooms,
  useEnterClassroom,
  useLeaveClassroom,
  useMyClassroom,
  useStudentPresence,
} from "@/hooks/useClassroom";
import type { Classroom } from "@/db/schema";
import { useUpdatePlayer } from "@/hooks/useUserPlayers";
import {
  getAvailableActions,
  type AvailableActions,
  type StudentActionData,
} from "@/components/practice/studentActions";
import { api } from "@/lib/queryClient";

export type { StudentActionData, AvailableActions };

export interface StudentActionHandlers {
  startPractice: () => void;
  watchSession: () => void;
  enterClassroom: () => Promise<void>;
  enterSpecificClassroom: (classroomId: string) => Promise<void>;
  leaveClassroom: () => Promise<void>;
  promptToEnter: () => Promise<void>;
  toggleArchive: () => Promise<void>;
  openShareAccess: () => void;
  openEnrollModal: () => void;
}

export interface StudentActionModals {
  shareAccess: {
    isOpen: boolean;
    open: () => void;
    close: () => void;
  };
  enroll: {
    isOpen: boolean;
    open: () => void;
    close: () => void;
  };
}

export interface ClassroomData {
  /** All classrooms this student is enrolled in */
  enrolled: Classroom[];
  /** Current classroom presence (if any) */
  current: { classroomId: string; classroom: Classroom } | null;
  /** Whether classroom data is loading */
  isLoading: boolean;
}

export interface UseStudentActionsResult {
  /** Which actions are available based on student state and user context */
  actions: AvailableActions;
  /** Pre-built handlers for each action */
  handlers: StudentActionHandlers;
  /** Modal state for sub-modals (Share Access, Enroll) */
  modals: StudentActionModals;
  /** Whether any action is currently loading */
  isLoading: boolean;
  /** The student data being operated on */
  student: StudentActionData;
  /** Classroom enrollment and presence data */
  classrooms: ClassroomData;
}

/**
 * Hook that encapsulates all student action logic
 *
 * Provides:
 * - Available actions (computed from student state + user context)
 * - Pre-built handlers for all actions
 * - Modal state for sub-modals
 *
 * Used by both StudentActionMenu (on tiles) and NotesModal (in quicklook)
 * to ensure consistent behavior across the app.
 */
export function useStudentActions(
  student: StudentActionData,
  options?: {
    /** Optional callback when observe session is clicked (for external handling) */
    onObserveSession?: (sessionId: string) => void;
  },
): UseStudentActionsResult {
  const router = useRouter();
  const { onObserveSession } = options ?? {};

  // ========== Context hooks ==========
  const { data: classroom } = useMyClassroom();
  const isTeacher = !!classroom;

  // ========== Action hooks ==========
  const { data: enrolledClassrooms = [], isLoading: loadingEnrollments } =
    useEnrolledClassrooms(student.id);
  const { data: currentPresence, isLoading: loadingPresence } =
    useStudentPresence(student.id);
  const updatePlayer = useUpdatePlayer();
  const enterClassroom = useEnterClassroom();
  const leaveClassroom = useLeaveClassroom();

  // Entry prompt mutation (teacher action)
  const createEntryPrompt = useMutation({
    mutationFn: async ({
      classroomId,
      playerId,
    }: {
      classroomId: string;
      playerId: string;
    }) => {
      const response = await api(`classrooms/${classroomId}/entry-prompts`, {
        method: "POST",
        body: JSON.stringify({ playerIds: [playerId] }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send prompt");
      }
      return response.json();
    },
  });

  // ========== Modal state ==========
  const [showShareAccess, setShowShareAccess] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  // ========== Compute available actions ==========
  const actions = useMemo(() => {
    const context = { isTeacher, classroomId: classroom?.id };
    return getAvailableActions(student, context, {
      hasEnrolledClassrooms: enrolledClassrooms.length > 0,
    });
  }, [student, isTeacher, classroom?.id, enrolledClassrooms.length]);

  // ========== Action handlers ==========
  const handleStartPractice = useCallback(() => {
    router.push(`/practice/${student.id}/dashboard?startPractice=true`);
  }, [router, student.id]);

  const handleWatchSession = useCallback(() => {
    if (student.activity?.sessionId) {
      if (onObserveSession) {
        onObserveSession(student.activity.sessionId);
      } else {
        // TODO: Default navigation to session observer
        console.log("Watch session:", student.activity.sessionId);
      }
    }
  }, [student.activity?.sessionId, onObserveSession]);

  const handleEnterClassroom = useCallback(async () => {
    if (enrolledClassrooms.length > 0) {
      const classroomId = enrolledClassrooms[0].id;
      await enterClassroom.mutateAsync({ classroomId, playerId: student.id });
    }
  }, [enrolledClassrooms, enterClassroom, student.id]);

  const handleEnterSpecificClassroom = useCallback(
    async (classroomId: string) => {
      await enterClassroom.mutateAsync({ classroomId, playerId: student.id });
    },
    [enterClassroom, student.id],
  );

  const handleLeaveClassroom = useCallback(async () => {
    // Use currentPresence to get the actual classroom they're in
    if (currentPresence) {
      await leaveClassroom.mutateAsync({
        classroomId: currentPresence.classroomId,
        playerId: student.id,
      });
    }
  }, [currentPresence, leaveClassroom, student.id]);

  const handleToggleArchive = useCallback(async () => {
    await updatePlayer.mutateAsync({
      id: student.id,
      updates: { isArchived: !student.isArchived },
    });
  }, [student.id, student.isArchived, updatePlayer]);

  const handlePromptToEnter = useCallback(async () => {
    if (classroom?.id) {
      await createEntryPrompt.mutateAsync({
        classroomId: classroom.id,
        playerId: student.id,
      });
    }
  }, [classroom?.id, createEntryPrompt, student.id]);

  // ========== Memoized result ==========
  const handlers: StudentActionHandlers = useMemo(
    () => ({
      startPractice: handleStartPractice,
      watchSession: handleWatchSession,
      enterClassroom: handleEnterClassroom,
      enterSpecificClassroom: handleEnterSpecificClassroom,
      leaveClassroom: handleLeaveClassroom,
      promptToEnter: handlePromptToEnter,
      toggleArchive: handleToggleArchive,
      openShareAccess: () => setShowShareAccess(true),
      openEnrollModal: () => setShowEnrollModal(true),
    }),
    [
      handleStartPractice,
      handleWatchSession,
      handleEnterClassroom,
      handleEnterSpecificClassroom,
      handleLeaveClassroom,
      handlePromptToEnter,
      handleToggleArchive,
    ],
  );

  const modals: StudentActionModals = useMemo(
    () => ({
      shareAccess: {
        isOpen: showShareAccess,
        open: () => setShowShareAccess(true),
        close: () => setShowShareAccess(false),
      },
      enroll: {
        isOpen: showEnrollModal,
        open: () => setShowEnrollModal(true),
        close: () => setShowEnrollModal(false),
      },
    }),
    [showShareAccess, showEnrollModal],
  );

  const isLoading =
    updatePlayer.isPending ||
    enterClassroom.isPending ||
    leaveClassroom.isPending ||
    createEntryPrompt.isPending;

  // ========== Classroom data ==========
  const classrooms: ClassroomData = useMemo(
    () => ({
      enrolled: enrolledClassrooms,
      // Only set current if both presence and classroom are defined
      current: currentPresence?.classroom
        ? {
            classroomId: currentPresence.classroomId,
            classroom: currentPresence.classroom,
          }
        : null,
      isLoading: loadingEnrollments || loadingPresence,
    }),
    [enrolledClassrooms, currentPresence, loadingEnrollments, loadingPresence],
  );

  return {
    actions,
    handlers,
    modals,
    isLoading,
    student,
    classrooms,
  };
}

"use client";

import { useMemo } from "react";
import type { StudentRelationship, EnrollmentStatus } from "@/types/student";
import {
  useMyClassroom,
  useEnrolledStudents,
  useClassroomPresence,
} from "@/hooks/useClassroom";
import { usePlayersWithSkillData } from "@/hooks/useUserPlayers";

/**
 * Hook to compute the current user's relationship with a specific student/player.
 *
 * Determines:
 * - isMyChild: whether the player belongs to the current user (parent relationship)
 * - isEnrolled: whether the player is enrolled in the user's classroom (teacher relationship)
 * - isPresent: whether the player is currently present in the classroom
 * - enrollmentStatus: any pending enrollment request
 *
 * @param playerId - The player ID to check relationship for
 * @returns StudentRelationship object with all relationship indicators
 */
export function useStudentRelationship(playerId: string): {
  relationship: StudentRelationship;
  isLoading: boolean;
} {
  // Get current user's classroom (if they're a teacher)
  const { data: classroom, isLoading: isLoadingClassroom } = useMyClassroom();

  // Get current user's children (players linked to them)
  const { data: myChildren = [], isLoading: isLoadingChildren } =
    usePlayersWithSkillData();

  // Get enrolled students in the teacher's classroom
  const { data: enrolledStudents = [], isLoading: isLoadingEnrolled } =
    useEnrolledStudents(classroom?.id);

  // Get present students in the classroom
  const { data: presentStudents = [], isLoading: isLoadingPresence } =
    useClassroomPresence(classroom?.id);

  const relationship = useMemo<StudentRelationship>(() => {
    const isMyChild = myChildren.some((child) => child.id === playerId);
    const isEnrolled = enrolledStudents.some(
      (student) => student.id === playerId,
    );
    const isPresent = presentStudents.some(
      (student) => student.id === playerId,
    );

    // TODO: Look up pending enrollment requests for this player
    const enrollmentStatus: EnrollmentStatus = isEnrolled ? "enrolled" : null;

    return {
      isMyChild,
      isEnrolled,
      isPresent,
      enrollmentStatus,
    };
  }, [playerId, myChildren, enrolledStudents, presentStudents]);

  const isLoading =
    isLoadingClassroom ||
    isLoadingChildren ||
    isLoadingEnrolled ||
    isLoadingPresence;

  return {
    relationship,
    isLoading,
  };
}

/**
 * Unit tests for student action visibility rules
 *
 * Tests the getAvailableActions function which determines
 * which actions are available for a student based on context.
 */

import { describe, expect, it } from 'vitest'
import {
  getAvailableActions,
  type StudentActionContext,
  type StudentActionData,
} from '../studentActions'

describe('studentActions', () => {
  describe('getAvailableActions', () => {
    const teacherContext: StudentActionContext = {
      isTeacher: true,
      classroomId: 'classroom-1',
    }

    const parentContext: StudentActionContext = {
      isTeacher: false,
      classroomId: undefined,
    }

    describe('promptToEnter action', () => {
      it('teacher can prompt enrolled non-present student', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: false,
            isEnrolled: true,
            isPresent: false,
            enrollmentStatus: 'enrolled',
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.promptToEnter).toBe(true)
      })

      it('teacher cannot prompt student already present', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: false,
            isEnrolled: true,
            isPresent: true,
            enrollmentStatus: 'enrolled',
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.promptToEnter).toBe(false)
      })

      it('teacher cannot prompt non-enrolled student', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: true,
            isEnrolled: false,
            isPresent: false,
            enrollmentStatus: null,
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.promptToEnter).toBe(false)
      })

      it('parent cannot prompt to enter (only teachers)', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: true,
            isEnrolled: true,
            isPresent: false,
            enrollmentStatus: 'enrolled',
          },
        }

        const actions = getAvailableActions(student, parentContext)

        expect(actions.promptToEnter).toBe(false)
      })
    })

    describe('watchSession action', () => {
      it('shows watchSession when student is practicing with sessionId', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          activity: {
            status: 'practicing',
            sessionId: 'session-123',
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.watchSession).toBe(true)
      })

      it('hides watchSession when student is idle', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          activity: {
            status: 'idle',
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.watchSession).toBe(false)
      })

      it('hides watchSession when practicing but no sessionId', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          activity: {
            status: 'practicing',
            // no sessionId
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.watchSession).toBe(false)
      })

      it('hides watchSession when no activity data', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.watchSession).toBe(false)
      })

      it('watchSession available even when student not present (for entry prompt flow)', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: false,
            isEnrolled: true,
            isPresent: false,
            enrollmentStatus: 'enrolled',
          },
          activity: {
            status: 'practicing',
            sessionId: 'session-123',
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        // watchSession should be true - teacher sees student is practicing
        // When they click it, they'll get the entry prompt UI if student isn't present
        expect(actions.watchSession).toBe(true)
      })
    })

    describe('enterClassroom action', () => {
      it('parent can enter their enrolled child into classroom', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: true,
            isEnrolled: true,
            isPresent: false,
            enrollmentStatus: 'enrolled',
          },
        }

        const actions = getAvailableActions(student, parentContext, {
          hasEnrolledClassrooms: true,
        })

        expect(actions.enterClassroom).toBe(true)
      })

      it('parent cannot enter child already present', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: true,
            isEnrolled: true,
            isPresent: true,
            enrollmentStatus: 'enrolled',
          },
        }

        const actions = getAvailableActions(student, parentContext, {
          hasEnrolledClassrooms: true,
        })

        expect(actions.enterClassroom).toBe(false)
      })

      it('teacher-parent can still enter their own child', () => {
        const teacherParentContext: StudentActionContext = {
          isTeacher: true,
          classroomId: 'classroom-1',
        }

        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: true,
            isEnrolled: true,
            isPresent: false,
            enrollmentStatus: 'enrolled',
          },
        }

        const actions = getAvailableActions(student, teacherParentContext, {
          hasEnrolledClassrooms: true,
        })

        expect(actions.enterClassroom).toBe(true)
      })
    })

    describe('pending enrollment status', () => {
      it('disables all actions for pending enrollment', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: false,
            isEnrolled: false,
            isPresent: false,
            enrollmentStatus: 'pending_teacher',
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.promptToEnter).toBe(false)
        expect(actions.watchSession).toBe(false)
        expect(actions.enterClassroom).toBe(false)
        expect(actions.leaveClassroom).toBe(false)
        expect(actions.removeFromClassroom).toBe(false)
        expect(actions.enrollInClassroom).toBe(false)
        expect(actions.unenrollStudent).toBe(false)
      })
    })

    describe('combined scenarios', () => {
      it('enrolled practicing student shows both watchSession and cannot be prompted', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: false,
            isEnrolled: true,
            isPresent: true,
            enrollmentStatus: 'enrolled',
          },
          activity: {
            status: 'practicing',
            sessionId: 'session-123',
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.watchSession).toBe(true)
        expect(actions.promptToEnter).toBe(false) // already present
      })

      it('enrolled non-present practicing student can be watched and prompted', () => {
        const student: StudentActionData = {
          id: 'student-1',
          name: 'Test Student',
          relationship: {
            isMyChild: false,
            isEnrolled: true,
            isPresent: false,
            enrollmentStatus: 'enrolled',
          },
          activity: {
            status: 'practicing',
            sessionId: 'session-123',
          },
        }

        const actions = getAvailableActions(student, teacherContext)

        expect(actions.watchSession).toBe(true)
        expect(actions.promptToEnter).toBe(true)
      })
    })
  })
})

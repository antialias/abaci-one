import type { Classroom } from '@/db/schema/classrooms'
import type { Player } from '@/db/schema/players'
import type {
  StudentActiveSessionInfo,
  StudentIntervention,
  StudentPresenceInfo,
  StudentWithSkillData,
} from '@/utils/studentGrouping'
import type { SkillCategoryKey } from '@/constants/skillCategories'

export const PRACTICE_PICKER_API_VERSION = 1 as const

/**
 * Explicit public player fields used by the practice picker.
 *
 * Keep this independent from the database row type. New database columns must
 * never cross the server/client boundary without an intentional contract edit.
 */
export type PracticePickerPlayerFields = Pick<
  Player,
  'id' | 'name' | 'emoji' | 'color' | 'createdAt' | 'isArchived'
>

export interface PracticePickerClassroomV1 {
  id: string
  teacherId: string
  name: string
  code: string
  createdAt: string
  entryPromptExpiryMinutes: number | null
}

export interface PracticePickerPresenceV1 {
  playerId: string
  classroomId: string
  enteredAt: string
  enteredBy: string
  classroom?: PracticePickerClassroomV1
}

export interface PracticePickerActiveSessionV1 {
  sessionId: string
  status: string
  completedProblems: number
  totalProblems: number
}

export interface PracticePickerInterventionV1 {
  type: StudentIntervention['type']
  severity: StudentIntervention['severity']
  message: string
  icon: string
}

export interface PracticePickerStudentV1 {
  id: string
  name: string
  emoji: string
  color: string
  createdAt: string
  isArchived: boolean
  practicingSkills: string[]
  lastPracticedAt: string | null
  skillCategory: SkillCategoryKey | null
  intervention: PracticePickerInterventionV1 | null
  enrolledClassrooms: PracticePickerClassroomV1[]
  currentPresence: PracticePickerPresenceV1 | null
  activeSession: PracticePickerActiveSessionV1 | null
}

export interface PracticePickerCountsV1 {
  active: number
  archived: number
  total: number
}

export interface PracticePickerV1Response {
  version: typeof PRACTICE_PICKER_API_VERSION
  students: PracticePickerStudentV1[]
  counts: PracticePickerCountsV1
}

export interface PracticePickerNotesV1Response {
  version: typeof PRACTICE_PICKER_API_VERSION
  studentId: string
  notes: string | null
}

export interface PracticePickerV1Data {
  version: typeof PRACTICE_PICKER_API_VERSION
  students: StudentWithSkillData[]
  counts: PracticePickerCountsV1
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toClassroomV1(classroom: Classroom): PracticePickerClassroomV1 {
  return {
    id: classroom.id,
    teacherId: classroom.teacherId,
    name: classroom.name,
    code: classroom.code,
    createdAt: toIsoString(classroom.createdAt),
    entryPromptExpiryMinutes: classroom.entryPromptExpiryMinutes,
  }
}

function toPresenceV1(presence: StudentPresenceInfo): PracticePickerPresenceV1 {
  return {
    playerId: presence.playerId,
    classroomId: presence.classroomId,
    enteredAt: presence.enteredAt,
    enteredBy: presence.enteredBy,
    ...(presence.classroom ? { classroom: toClassroomV1(presence.classroom) } : {}),
  }
}

function toActiveSessionV1(activeSession: StudentActiveSessionInfo): PracticePickerActiveSessionV1 {
  return {
    sessionId: activeSession.sessionId,
    status: activeSession.status,
    completedProblems: activeSession.completedProblems,
    totalProblems: activeSession.totalProblems,
  }
}

function toInterventionV1(intervention: StudentIntervention): PracticePickerInterventionV1 {
  return {
    type: intervention.type,
    severity: intervention.severity,
    message: intervention.message,
    icon: intervention.icon,
  }
}

export function createPracticePickerV1Response(
  students: readonly StudentWithSkillData[]
): PracticePickerV1Response {
  let active = 0
  const pickerStudents = students.map((student): PracticePickerStudentV1 => {
    if (!student.isArchived) active += 1

    return {
      id: student.id,
      name: student.name,
      emoji: student.emoji,
      color: student.color,
      createdAt: toIsoString(student.createdAt),
      isArchived: student.isArchived,
      practicingSkills: [...student.practicingSkills],
      lastPracticedAt: student.lastPracticedAt ? toIsoString(student.lastPracticedAt) : null,
      skillCategory: student.skillCategory,
      intervention: student.intervention ? toInterventionV1(student.intervention) : null,
      enrolledClassrooms: (student.enrolledClassrooms ?? []).map(toClassroomV1),
      currentPresence: student.currentPresence ? toPresenceV1(student.currentPresence) : null,
      activeSession: student.activeSession ? toActiveSessionV1(student.activeSession) : null,
    }
  })

  return {
    version: PRACTICE_PICKER_API_VERSION,
    students: pickerStudents,
    counts: {
      active,
      archived: pickerStudents.length - active,
      total: pickerStudents.length,
    },
  }
}

function normalizeClassroom(classroom: PracticePickerClassroomV1): Classroom {
  return {
    ...classroom,
    createdAt: new Date(classroom.createdAt),
  }
}

function normalizePresence(presence: PracticePickerPresenceV1): StudentPresenceInfo {
  return {
    playerId: presence.playerId,
    classroomId: presence.classroomId,
    enteredAt: presence.enteredAt,
    enteredBy: presence.enteredBy,
    ...(presence.classroom ? { classroom: normalizeClassroom(presence.classroom) } : {}),
  }
}

export function normalizePracticePickerV1Response(
  response: PracticePickerV1Response
): PracticePickerV1Data {
  if (response.version !== PRACTICE_PICKER_API_VERSION) {
    throw new Error(`Unsupported practice picker API version: ${response.version}`)
  }

  return {
    version: response.version,
    counts: response.counts,
    students: response.students.map(
      (student): StudentWithSkillData => ({
        id: student.id,
        name: student.name,
        emoji: student.emoji,
        color: student.color,
        createdAt: new Date(student.createdAt),
        isArchived: student.isArchived,
        practicingSkills: [...student.practicingSkills],
        lastPracticedAt: student.lastPracticedAt ? new Date(student.lastPracticedAt) : null,
        skillCategory: student.skillCategory,
        intervention: student.intervention,
        enrolledClassrooms: student.enrolledClassrooms.map(normalizeClassroom),
        currentPresence: student.currentPresence
          ? normalizePresence(student.currentPresence)
          : null,
        activeSession: student.activeSession,
      })
    ),
  }
}

/**
 * Query key factories for React Query
 *
 * These are used for both server-side prefetching and client-side queries.
 * Kept in a separate file (not 'use client') so they can be imported by server components.
 */

// Player query keys
export const playerKeys = {
  all: ['players'] as const,
  lists: () => [...playerKeys.all, 'list'] as const,
  list: () => [...playerKeys.lists()] as const,
  listWithSkillData: () => [...playerKeys.all, 'listWithSkillData'] as const,
  detail: (id: string) => [...playerKeys.all, 'detail', id] as const,
  enrolledClassrooms: (playerId: string) =>
    [...playerKeys.all, playerId, 'enrolled-classrooms'] as const,
  presence: (playerId: string) => [...playerKeys.all, playerId, 'presence'] as const,
}

// Curriculum query keys
export const curriculumKeys = {
  all: ['curriculum'] as const,
  detail: (playerId: string) => [...curriculumKeys.all, playerId] as const,
}

// Session plan query keys
export const sessionPlanKeys = {
  all: ['sessionPlans'] as const,
  lists: () => [...sessionPlanKeys.all, 'list'] as const,
  list: (playerId: string) => [...sessionPlanKeys.lists(), playerId] as const,
  active: (playerId: string) => [...sessionPlanKeys.all, 'active', playerId] as const,
  detail: (planId: string) => [...sessionPlanKeys.all, 'detail', planId] as const,
}

// Session history query keys (for paginated history)
export const sessionHistoryKeys = {
  all: ['sessionHistory'] as const,
  list: (playerId: string) => [...sessionHistoryKeys.all, playerId] as const,
}

// Classroom query keys
export const classroomKeys = {
  all: ['classrooms'] as const,
  mine: () => [...classroomKeys.all, 'mine'] as const,
  byCode: (code: string) => [...classroomKeys.all, 'byCode', code] as const,
  detail: (id: string) => [...classroomKeys.all, 'detail', id] as const,
  enrollments: (id: string) => [...classroomKeys.all, 'enrollments', id] as const,
  presence: (id: string) => [...classroomKeys.all, 'presence', id] as const,
  activeSessions: (id: string) => [...classroomKeys.all, 'activeSessions', id] as const,
  pendingParentApprovals: () => [...classroomKeys.all, 'pendingParentApprovals'] as const,
  pendingRequests: (id: string) => [...classroomKeys.detail(id), 'pending-requests'] as const,
  awaitingParentApproval: (id: string) =>
    [...classroomKeys.detail(id), 'awaiting-parent-approval'] as const,
}

// Entry prompt query keys
export const entryPromptKeys = {
  all: ['entry-prompts'] as const,
  pending: () => [...entryPromptKeys.all, 'pending'] as const,
}

// Game results query keys (for scoreboard and history)
export const gameResultsKeys = {
  all: ['game-results'] as const,
  playerHistory: (playerId: string) => [...gameResultsKeys.all, 'player', playerId] as const,
  classroomLeaderboard: (classroomId: string, gameName?: string) =>
    [...gameResultsKeys.all, 'leaderboard', 'classroom', classroomId, gameName] as const,
}

// Skill metrics query keys (for scoreboard)
export const skillMetricsKeys = {
  all: ['skill-metrics'] as const,
  player: (playerId: string) => [...skillMetricsKeys.all, 'player', playerId] as const,
  classroomLeaderboard: (classroomId: string) =>
    [...skillMetricsKeys.all, 'leaderboard', 'classroom', classroomId] as const,
}

// Flowchart version history query keys (for workshop sessions)
export const versionHistoryKeys = {
  all: ['flowchart-version-history'] as const,
  session: (sessionId: string) => [...versionHistoryKeys.all, sessionId] as const,
}

// Attachment query keys (for practice photos and worksheet parsing)
export const attachmentKeys = {
  // All attachments for a player
  all: (playerId: string) => ['attachments', playerId] as const,

  // Attachments for a specific session
  session: (playerId: string, sessionId: string) =>
    [...attachmentKeys.all(playerId), 'session', sessionId] as const,

  // Single attachment detail (includes parsing data)
  detail: (playerId: string, attachmentId: string) =>
    [...attachmentKeys.all(playerId), attachmentId] as const,

  // Parsing-specific data for an attachment
  parsing: (playerId: string, attachmentId: string) =>
    [...attachmentKeys.detail(playerId, attachmentId), 'parsing'] as const,

  // Review progress for an attachment (resumable review state)
  reviewProgress: (playerId: string, attachmentId: string) =>
    [...attachmentKeys.detail(playerId, attachmentId), 'review-progress'] as const,
}

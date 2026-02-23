/**
 * Query key factories for React Query
 *
 * These are used for both server-side prefetching and client-side queries.
 * Kept in a separate file (not 'use client') so they can be imported by server components.
 */

// Player query keys
export const playerKeys = {
  all: ["players"] as const,
  lists: () => [...playerKeys.all, "list"] as const,
  list: () => [...playerKeys.lists()] as const,
  listWithSkillData: () => [...playerKeys.all, "listWithSkillData"] as const,
  detail: (id: string) => [...playerKeys.all, "detail", id] as const,
  enrolledClassrooms: (playerId: string) =>
    [...playerKeys.all, playerId, "enrolled-classrooms"] as const,
  presence: (playerId: string) =>
    [...playerKeys.all, playerId, "presence"] as const,
  observationStats: (playerId: string) =>
    [...playerKeys.all, playerId, "observation-stats"] as const,
};

// Curriculum query keys
export const curriculumKeys = {
  all: ["curriculum"] as const,
  detail: (playerId: string) => [...curriculumKeys.all, playerId] as const,
};

// Session plan query keys
export const sessionPlanKeys = {
  all: ["sessionPlans"] as const,
  lists: () => [...sessionPlanKeys.all, "list"] as const,
  list: (playerId: string) => [...sessionPlanKeys.lists(), playerId] as const,
  active: (playerId: string) =>
    [...sessionPlanKeys.all, "active", playerId] as const,
  detail: (planId: string) =>
    [...sessionPlanKeys.all, "detail", planId] as const,
};

// Session history query keys (for paginated history)
export const sessionHistoryKeys = {
  all: ["sessionHistory"] as const,
  list: (playerId: string) => [...sessionHistoryKeys.all, playerId] as const,
};

// Classroom query keys
export const classroomKeys = {
  all: ["classrooms"] as const,
  mine: () => [...classroomKeys.all, "mine"] as const,
  byCode: (code: string) => [...classroomKeys.all, "byCode", code] as const,
  detail: (id: string) => [...classroomKeys.all, "detail", id] as const,
  enrollments: (id: string) =>
    [...classroomKeys.all, "enrollments", id] as const,
  presence: (id: string) => [...classroomKeys.all, "presence", id] as const,
  activeSessions: (id: string) =>
    [...classroomKeys.all, "activeSessions", id] as const,
  pendingParentApprovals: () =>
    [...classroomKeys.all, "pendingParentApprovals"] as const,
  pendingRequests: (id: string) =>
    [...classroomKeys.detail(id), "pending-requests"] as const,
  awaitingParentApproval: (id: string) =>
    [...classroomKeys.detail(id), "awaiting-parent-approval"] as const,
};

// Entry prompt query keys
export const entryPromptKeys = {
  all: ["entry-prompts"] as const,
  pending: () => [...entryPromptKeys.all, "pending"] as const,
};

// Game results query keys (for scoreboard and history)
export const gameResultsKeys = {
  all: ["game-results"] as const,
  playerHistory: (playerId: string) =>
    [...gameResultsKeys.all, "player", playerId] as const,
  classroomLeaderboard: (classroomId: string, gameName?: string) =>
    [
      ...gameResultsKeys.all,
      "leaderboard",
      "classroom",
      classroomId,
      gameName,
    ] as const,
};

// Skill metrics query keys (for scoreboard)
export const skillMetricsKeys = {
  all: ["skill-metrics"] as const,
  player: (playerId: string) =>
    [...skillMetricsKeys.all, "player", playerId] as const,
  classroomLeaderboard: (classroomId: string) =>
    [...skillMetricsKeys.all, "leaderboard", "classroom", classroomId] as const,
};

// Workshop session query keys
export const workshopSessionKeys = {
  all: ["workshop-sessions"] as const,
  list: () => [...workshopSessionKeys.all, "list"] as const,
  detail: (sessionId: string) =>
    [...workshopSessionKeys.all, "detail", sessionId] as const,
};

// Flowchart version history query keys (for workshop sessions)
export const versionHistoryKeys = {
  all: ["flowchart-version-history"] as const,
  session: (sessionId: string) =>
    [...versionHistoryKeys.all, sessionId] as const,
};

// Session preferences query keys (per-student StartPracticeModal settings)
export const sessionPreferencesKeys = {
  all: ["session-preferences"] as const,
  detail: (playerId: string) =>
    [...sessionPreferencesKeys.all, playerId] as const,
};

// Collected clips query keys (admin audio TTS generation)
export const collectedClipKeys = {
  all: ["collected-clips"] as const,
  list: (voice?: string) =>
    [...collectedClipKeys.all, "list", voice ?? ""] as const,
};

// Practice config query keys (admin term count scaling)
export const practiceConfigKeys = {
  all: ["practice-config"] as const,
  config: () => [...practiceConfigKeys.all, "config"] as const,
};

// Euclid progress query keys (tech tree completion tracking)
export const euclidKeys = {
  all: ["euclid"] as const,
  progress: (playerId: string) =>
    [...euclidKeys.all, "progress", playerId] as const,
};

// Admin pricing query keys (Stripe price management)
export const pricingKeys = {
  all: ["admin-pricing"] as const,
  config: () => [...pricingKeys.all, "config"] as const,
};

// Household query keys (household membership + management)
export const householdKeys = {
  all: ["households"] as const,
  list: () => [...householdKeys.all, "list"] as const,
  detail: (id: string) => [...householdKeys.all, id] as const,
};

// Billing/tier query keys (subscription tier + limits)
export const billingKeys = {
  all: ["billing"] as const,
  tier: () => [...billingKeys.all, "tier"] as const,
  prices: () => [...billingKeys.all, "prices"] as const,
  effectiveTier: (playerId: string) =>
    [...billingKeys.all, "effective-tier", playerId] as const,
  coverage: () => [...billingKeys.all, "coverage"] as const,
};

// Admin subscription management query keys
export const adminSubscriptionKeys = {
  all: ["admin-subscriptions"] as const,
  search: (email: string) =>
    [...adminSubscriptionKeys.all, "search", email] as const,
};

// Debug / seed students query keys
export const debugKeys = {
  all: ["debug"] as const,
  seedProfiles: () => [...debugKeys.all, "seed-profiles"] as const,
  seedEmbeddingStatus: () =>
    [...debugKeys.all, "seed-embedding-status"] as const,
  seededStudents: () => [...debugKeys.all, "seeded-students"] as const,
  seedSearch: (query: string) =>
    [...debugKeys.all, "seed-search", query] as const,
  buildInfo: () => [...debugKeys.all, "build-info"] as const,
};

// Feature flag query keys (admin + client feature gating)
export const featureFlagKeys = {
  all: ["feature-flags"] as const,
  list: () => [...featureFlagKeys.all, "list"] as const,
  detail: (key: string) => [...featureFlagKeys.all, "detail", key] as const,
};

// Notification subscription query keys
export const notificationSubscriptionKeys = {
  all: ["notification-subscriptions"] as const,
  mine: () => [...notificationSubscriptionKeys.all, "mine"] as const,
  list: (playerId: string) =>
    [...notificationSubscriptionKeys.all, "list", playerId] as const,
  detail: (id: string) =>
    [...notificationSubscriptionKeys.all, "detail", id] as const,
};

// Session song query keys (AI-generated celebration songs)
export const sessionSongKeys = {
  all: ["sessionSongs"] as const,
  forPlan: (planId: string) =>
    [...sessionSongKeys.all, "plan", planId] as const,
};

// Attachment query keys (for practice photos and worksheet parsing)
export const attachmentKeys = {
  // All attachments for a player
  all: (playerId: string) => ["attachments", playerId] as const,

  // Attachments for a specific session
  session: (playerId: string, sessionId: string) =>
    [...attachmentKeys.all(playerId), "session", sessionId] as const,

  // Single attachment detail (includes parsing data)
  detail: (playerId: string, attachmentId: string) =>
    [...attachmentKeys.all(playerId), attachmentId] as const,

  // Parsing-specific data for an attachment
  parsing: (playerId: string, attachmentId: string) =>
    [...attachmentKeys.detail(playerId, attachmentId), "parsing"] as const,

  // Review progress for an attachment (resumable review state)
  reviewProgress: (playerId: string, attachmentId: string) =>
    [
      ...attachmentKeys.detail(playerId, attachmentId),
      "review-progress",
    ] as const,
};

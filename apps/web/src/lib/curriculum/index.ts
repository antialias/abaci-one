/**
 * Curriculum Module
 *
 * This module handles all curriculum-related logic for the daily practice system:
 * - Curriculum definitions (levels, phases, skills)
 * - Progress tracking (skill mastery, sessions)
 * - Session planning (coming soon)
 */

// Curriculum structure and skill mappings
export {
  // Data
  ALL_PHASES,
  CURRICULUM_LEVELS,
  // Types
  type CurriculumLevel,
  type CurriculumLevelId,
  type CurriculumPhase,
  getFirstPhase,
  // Functions
  getForbiddenSkillsAtPhase,
  getNextPhase,
  getPhase,
  getPhaseDisplayInfo,
  getPhaseSkillConstraints,
  getPhasesForLevel,
  getUnlockedSkillsAtPhase,
  type PhaseSkillConstraints,
  parsePhaseId,
} from './definitions'

// Progress management (CRUD operations)
export {
  // Curriculum position
  advanceToNextPhase,
  // Skill mastery
  calculateMasteryPercent,
  // Practice sessions
  getAllSkillMastery,
  getPlayerCurriculum,
  getPlayerProgressSummary,
  getRecentSessions,
  getSkillMastery,
  initializeStudent,
  recordSkillAttempt,
  recordSkillAttempts,
  upsertPlayerCurriculum,
} from './progress-manager'
// Session mode - unified session state computation
export {
  type BlockedPromotion,
  getSessionMode,
  getWeakSkillIds,
  isMaintenanceMode,
  isProgressionMode,
  isRemediationMode,
  type MaintenanceMode,
  type ProgressionMode,
  type RemediationMode,
  type SessionMode,
  type SkillInfo,
} from './session-mode'
// Session planning
export {
  ActiveSessionExistsError,
  abandonSessionPlan,
  acknowledgeGameBreakResults,
  applySessionFlowEvent,
  approveSessionPlan,
  completePartTransition,
  completeSessionPlanEarly,
  type EnabledParts,
  finishGameBreak,
  type GenerateSessionPlanOptions,
  generateSessionPlan,
  getActiveSessionPlan,
  getSessionPlan,
  NoEligiblePartsError,
  NoSkillsEnabledError,
  type RedoContext,
  recordRedoResult,
  recordSlotResult,
  SlotResultMismatchError,
  StaleFlowVersionError,
  startSessionPlan,
  updateSessionPlanRemoteCamera,
  updateSessionPlanResults,
} from './session-planner'
// Session review & repair (#158)
export {
  type ApplySlotResultReviewParams,
  applySlotResultReview,
  computeReviewedResult,
  restoreSessionPlan,
  SET_TIME_MAX_MS,
  SET_TIME_MIN_MS,
  SessionReviewError,
  type SlotResultReviewAction,
  type SlotResultReviewActionName,
  type SlotReviewScope,
  softDeleteSessionPlan,
} from './session-review'

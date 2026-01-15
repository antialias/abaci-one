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
} from "./definitions";

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
} from "./progress-manager";

// Session planning
export {
  ActiveSessionExistsError,
  NoSkillsEnabledError,
  abandonSessionPlan,
  approveSessionPlan,
  completeSessionPlanEarly,
  type EnabledParts,
  type GenerateSessionPlanOptions,
  generateSessionPlan,
  getActiveSessionPlan,
  getSessionPlan,
  type RedoContext,
  recordRedoResult,
  recordSlotResult,
  startSessionPlan,
  updateSessionPlanRemoteCamera,
  updateSessionPlanResults,
} from "./session-planner";

// Session mode - unified session state computation
export {
  getSessionMode,
  getWeakSkillIds,
  isMaintenanceMode,
  isProgressionMode,
  isRemediationMode,
  type BlockedPromotion,
  type MaintenanceMode,
  type ProgressionMode,
  type RemediationMode,
  type SessionMode,
  type SkillInfo,
} from "./session-mode";

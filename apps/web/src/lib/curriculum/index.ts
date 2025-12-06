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
  completePracticeSession,
  getAllSkillMastery,
  getPlayerCurriculum,
  getPlayerProgressSummary,
  getRecentSessions,
  getSessionsForPhase,
  getSkillMastery,
  getSkillsByMasteryLevel,
  initializeStudent,
  recordSkillAttempt,
  recordSkillAttempts,
  startPracticeSession,
  updatePracticeSession,
  upsertPlayerCurriculum,
} from './progress-manager'

// Session planning
export {
  abandonSessionPlan,
  approveSessionPlan,
  completeSessionPlanEarly,
  type GenerateSessionPlanOptions,
  generateSessionPlan,
  getActiveSessionPlan,
  getSessionPlan,
  recordSlotResult,
  startSessionPlan,
} from './session-planner'

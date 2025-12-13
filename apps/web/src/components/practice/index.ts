/**
 * Practice components for curriculum-based learning
 *
 * These components support the daily practice system:
 * - StudentSelector: Choose which student is practicing
 * - ProgressDashboard: Show current progress and actions
 * - ActiveSession: Solve problems during practice
 * - SessionSummary: Results after completing session
 */

export { ActiveSession } from './ActiveSession'
export type { ActiveSessionHandle, AttemptTimingData } from './ActiveSession'
export { ContinueSessionCard } from './ContinueSessionCard'
// Hooks
export { useHasPhysicalKeyboard, useIsTouchDevice } from './hooks/useDeviceDetection'
export { NumericKeypad } from './NumericKeypad'
export { PracticeErrorBoundary } from './PracticeErrorBoundary'
export type { SessionHudData } from './PracticeSubNav'
export { PracticeSubNav } from './PracticeSubNav'
export { PracticeTimingDisplay } from './PracticeTimingDisplay'
export type { ActiveSessionState, CurrentPhaseInfo, SkillProgress } from './ProgressDashboard'
export { ProgressDashboard } from './ProgressDashboard'
export type { AutoPauseStats, PauseInfo } from './SessionPausedModal'
export { SessionPausedModal } from './SessionPausedModal'
export { SessionSummary } from './SessionSummary'
export { SkillPerformanceReports } from './SkillPerformanceReports'
export type { SpeedMeterProps } from './SpeedMeter'
export { SpeedMeter } from './SpeedMeter'
export { StartPracticeModal } from './StartPracticeModal'
export type { StudentWithProgress } from './StudentSelector'
export { StudentSelector } from './StudentSelector'
export { VerticalProblem } from './VerticalProblem'

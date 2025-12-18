/**
 * Practice components for curriculum-based learning
 *
 * These components support the daily practice system:
 * - StudentSelector: Choose which student is practicing
 * - ProgressDashboard: Show current progress and actions
 * - ActiveSession: Solve problems during practice
 * - SessionSummary: Results after completing session
 */

export type { AttemptTimingData, StudentInfo } from './ActiveSession'
export { ActiveSession } from './ActiveSession'
export { ContinueSessionCard } from './ContinueSessionCard'
// Hooks
export { useHasPhysicalKeyboard, useIsTouchDevice } from './hooks/useDeviceDetection'
export { NotesModal } from './NotesModal'
export { NumericKeypad } from './NumericKeypad'
export { PracticeErrorBoundary } from './PracticeErrorBoundary'
export type { SessionHudData } from './PracticeSubNav'
export { PracticeSubNav } from './PracticeSubNav'
export { PracticeTimingDisplay } from './PracticeTimingDisplay'
export { ProjectingBanner } from './ProjectingBanner'
export { CompactBanner } from './CompactBanner'
export type { ActiveSessionState, CurrentPhaseInfo, SkillProgress } from './ProgressDashboard'
export { ProgressDashboard } from './ProgressDashboard'
// Re-export MasteryLevel type for display purposes
export type { MasteryLevel } from './styles/practiceTheme'
export type { SessionMoodIndicatorProps } from './SessionMoodIndicator'
export { SessionMoodIndicator } from './SessionMoodIndicator'
export { SessionModeBanner } from './SessionModeBanner'
export { SessionOverview } from './SessionOverview'
export type { AutoPauseStats, PauseInfo } from './SessionPausedModal'
export { SessionPausedModal } from './SessionPausedModal'
export type { SessionProgressIndicatorProps } from './SessionProgressIndicator'
export { SessionProgressIndicator } from './SessionProgressIndicator'
export { SessionSummary } from './SessionSummary'
export { SkillPerformanceReports } from './SkillPerformanceReports'
export { SkillUnlockBanner } from './SkillUnlockBanner'
export type { SpeedMeterProps } from './SpeedMeter'
export { SpeedMeter } from './SpeedMeter'
export { StartPracticeModal } from './StartPracticeModal'
export type { StudentWithProgress } from './StudentSelector'
export { StudentSelector } from './StudentSelector'
export { VerticalProblem } from './VerticalProblem'

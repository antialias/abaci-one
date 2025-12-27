/**
 * Practice components for curriculum-based learning
 *
 * These components support the daily practice system:
 * - StudentSelector: Choose which student is practicing
 * - ProgressDashboard: Show current progress and actions
 * - ActiveSession: Solve problems during practice
 * - SessionSummary: Results after completing session
 */

export type { AttemptTimingData, BroadcastState, StudentInfo } from './ActiveSession'
export { ActiveSession } from './ActiveSession'
export { ContinueSessionCard } from './ContinueSessionCard'
// Hooks
export {
  useHasPhysicalKeyboard,
  useIsTouchDevice,
} from './hooks/useDeviceDetection'
export { MiniStartPracticeBanner } from './MiniStartPracticeBanner'
export { NotesModal } from './NotesModal'
// StudentQuickLook is an alias for NotesModal (which was enhanced to serve as the QuickLook modal)
export { NotesModal as StudentQuickLook } from './NotesModal'
export { NumericKeypad } from './NumericKeypad'
export { PracticeErrorBoundary } from './PracticeErrorBoundary'
export { PracticeFeedback } from './PracticeFeedback'
export { PurposeBadge } from './PurposeBadge'
export type { SessionHudData } from './PracticeSubNav'
export { PracticeSubNav } from './PracticeSubNav'
export { PracticeTimingDisplay } from './PracticeTimingDisplay'
export {
  ContentBannerSlot,
  NavBannerSlot,
  ProjectingBanner,
} from './BannerSlots'
export { CompactBanner } from './CompactBanner'
export type { ActiveSessionState } from './ActiveSessionBanner'
export type { CurrentPhaseInfo, SkillHealthSummary } from './ProgressDashboard'
export { ProgressDashboard } from './ProgressDashboard'
// Re-export BktClassification type for display color mapping
export type { BktClassification } from './styles/practiceTheme'
export type { SessionMoodIndicatorProps } from './SessionMoodIndicator'
export { SessionMoodIndicator } from './SessionMoodIndicator'
export { SessionModeBanner } from './SessionModeBanner'
export type { AutoPauseStats, PauseInfo } from './SessionPausedModal'
export { SessionPausedModal } from './SessionPausedModal'
export type { SessionProgressIndicatorProps } from './SessionProgressIndicator'
export { SessionProgressIndicator } from './SessionProgressIndicator'
export { SessionSummary } from './SessionSummary'
export { SkillPerformanceReports } from './SkillPerformanceReports'
// Re-export shared types from BktContext for convenience
export type {
  ExtendedSkillClassification as SkillClassification,
  SkillDistribution,
} from '@/contexts/BktContext'
// Re-export classification function (uses shared getExtendedClassification internally)
export { getSkillClassification, SkillProgressChart } from './SkillProgressChart'
export type { SpeedMeterProps } from './SpeedMeter'
export { SpeedMeter } from './SpeedMeter'
export { StartPracticeModal } from './StartPracticeModal'
export type { StudentIntervention, StudentWithProgress } from './StudentSelector'
export { StudentSelector } from './StudentSelector'
export { StudentActionMenu } from './StudentActionMenu'
export { StudentFilterBar } from './StudentFilterBar'
export { VerticalProblem } from './VerticalProblem'
export type { StudentView } from './ViewSelector'
export { ViewSelector, VIEW_CONFIGS, getAvailableViews, getDefaultView } from './ViewSelector'
export { VirtualizedSessionList } from './VirtualizedSessionList'

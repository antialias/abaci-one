/**
 * Practice components for curriculum-based learning
 *
 * These components support the daily practice system:
 * - StudentSelector: Choose which student is practicing
 * - ProgressDashboard: Show current progress and actions
 * - ActiveSession: Solve problems during practice
 * - SessionSummary: Results after completing session
 */

export type {
  AttemptTimingData,
  BroadcastState,
  StudentInfo,
} from './ActiveSession'
export { ActiveSession } from './ActiveSession'
export { AllProblemsSection } from './AllProblemsSection'
export { ContinueSessionCard } from './ContinueSessionCard'
// Hooks
export {
  useHasPhysicalKeyboard,
  useIsTouchDevice,
} from './hooks/useDeviceDetection'
export { LiveResultsPanel } from './LiveResultsPanel'
export { MobileResultsSummary } from './MobileResultsSummary'
export {
  LiveSessionReportInline,
  LiveSessionReportModal,
} from './LiveSessionReportModal'
export { MiniStartPracticeBanner } from './MiniStartPracticeBanner'
export { NotesModal } from './NotesModal'
// StudentQuickLook is an alias for NotesModal (which was enhanced to serve as the QuickLook modal)
export { NotesModal as StudentQuickLook } from './NotesModal'
export { OfflineSessionModal } from './OfflineSessionModal'
export type {
  OfflineWorkSectionProps,
  OfflineAttachment,
} from './OfflineWorkSection'
export { OfflineWorkSection } from './OfflineWorkSection'
export type { PhotoLightboxPhoto } from './PhotoLightbox'
export { PhotoLightbox } from './PhotoLightbox'
export type { PhotoViewerEditorPhoto } from './PhotoViewerEditor'
export { PhotoViewerEditor } from './PhotoViewerEditor'
export { SessionPhotoGallery } from './SessionPhotoGallery'
export { NumericKeypad } from './NumericKeypad'
export { PracticeErrorBoundary } from './PracticeErrorBoundary'
export { PracticeFeedback } from './PracticeFeedback'
export type {
  RelationshipBadgeProps,
  RelationshipConfig,
} from './RelationshipBadge'
export {
  RelationshipBadge,
  RelationshipSummary,
  RELATIONSHIP_CONFIGS,
  getRelationType,
} from './RelationshipBadge'
export type { RelationshipCardProps } from './RelationshipCard'
export { RelationshipCard } from './RelationshipCard'
export { PurposeBadge } from './PurposeBadge'
export type { SessionHudData, GameBreakHudData } from './PracticeSubNav'
export { PracticeSubNav } from './PracticeSubNav'
export { PracticeTimingDisplay } from './PracticeTimingDisplay'
export {
  ContentBannerSlot,
  NavBannerSlot,
  ProjectingBanner,
} from './BannerSlots'
export { CompactBanner } from './CompactBanner'
export { EntryPromptBanner } from './EntryPromptBanner'
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
export type { ScrollspySection, ScrollspyNavProps } from './ScrollspyNav'
export { ScrollspyNav } from './ScrollspyNav'
export type { SessionHeroProps } from './SessionHero'
export { SessionHero } from './SessionHero'
export { SessionSummary } from './SessionSummary'
export type { SkillsPanelProps } from './SkillsPanel'
export { SkillsPanel } from './SkillsPanel'
export type { ProblemsToReviewPanelProps } from './ProblemsToReviewPanel'
export { ProblemsToReviewPanel } from './ProblemsToReviewPanel'
export type { TrendIndicatorProps } from './TrendIndicator'
export { TrendIndicator } from './TrendIndicator'
export { SkillPerformanceReports } from './SkillPerformanceReports'
// Re-export shared types from BktContext for convenience
export type {
  ExtendedSkillClassification as SkillClassification,
  SkillDistribution,
} from '@/contexts/BktContext'
// Re-export classification function (uses shared getExtendedClassification internally)
export {
  getSkillClassification,
  SkillProgressChart,
} from './SkillProgressChart'
export type { SpeedMeterProps } from './SpeedMeter'
export { SpeedMeter } from './SpeedMeter'
export { StartPracticeModal } from './StartPracticeModal'
export type {
  EnrollmentActions,
  StudentIntervention,
  StudentWithProgress,
} from './StudentSelector'
export { StudentSelector } from './StudentSelector'
export { StudentActionMenu } from './StudentActionMenu'
export { StudentFilterBar } from './StudentFilterBar'
export { VerticalProblem } from './VerticalProblem'
export type { StudentView, TeacherCompoundChipProps } from './ViewSelector'
export {
  ViewSelector,
  VIEW_CONFIGS,
  getAvailableViews,
  getDefaultView,
  TeacherCompoundChip,
} from './ViewSelector'
export { VirtualizedSessionList } from './VirtualizedSessionList'
// Part transition components
export type { PartTransitionScreenProps } from './PartTransitionScreen'
export {
  PartTransitionScreen,
  TRANSITION_COUNTDOWN_MS,
} from './PartTransitionScreen'
export type { ObserverTransitionViewProps } from './ObserverTransitionView'
export { ObserverTransitionView } from './ObserverTransitionView'
export {
  selectTransitionMessage,
  getTransitionType,
  requiresAbacusPutAway,
  requiresAbacusPickUp,
  type TransitionMessage,
  type TransitionType,
} from './partTransitionMessages'

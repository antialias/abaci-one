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
export { ContinueSessionCard } from './ContinueSessionCard'
// Hooks
export { useHasPhysicalKeyboard, useIsTouchDevice } from './hooks/useDeviceDetection'
export { NumericKeypad } from './NumericKeypad'
export { PracticeErrorBoundary } from './PracticeErrorBoundary'
export type { CurrentPhaseInfo, SkillProgress } from './ProgressDashboard'
export { ProgressDashboard } from './ProgressDashboard'
export { SessionSummary } from './SessionSummary'
export type { StudentWithProgress } from './StudentSelector'
export { StudentSelector } from './StudentSelector'
export { VerticalProblem } from './VerticalProblem'

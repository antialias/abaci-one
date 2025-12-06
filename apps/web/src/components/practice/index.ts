/**
 * Practice components for curriculum-based learning
 *
 * These components support the daily practice system:
 * - StudentSelector: Choose which student is practicing
 * - ProgressDashboard: Show current progress and actions
 * - PlanReview: Review and approve session plan
 * - ActiveSession: Solve problems during practice
 * - SessionSummary: Results after completing session
 */

export { ActiveSession } from './ActiveSession'
// Hooks
export { useHasPhysicalKeyboard, useIsTouchDevice } from './hooks/useDeviceDetection'
export { NumericKeypad } from './NumericKeypad'
export { PlanReview } from './PlanReview'
export type { CurrentPhaseInfo, SkillProgress } from './ProgressDashboard'
export { ProgressDashboard } from './ProgressDashboard'
export { SessionSummary } from './SessionSummary'
export type { StudentWithProgress } from './StudentSelector'
export { StudentSelector } from './StudentSelector'
export { VerticalProblem } from './VerticalProblem'

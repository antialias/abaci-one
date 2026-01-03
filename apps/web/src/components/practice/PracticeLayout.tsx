'use client'

import { useEffect, type ReactNode } from 'react'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from '@/contexts/SessionModeBannerContext'
import { useSessionMode } from '@/hooks/useSessionMode'
import { ProjectingBanner } from './ProjectingBanner'

// ============================================================================
// Types
// ============================================================================

interface PracticeLayoutProps {
  /** The student/player ID for fetching session mode */
  studentId: string
  /** Child content to render */
  children: ReactNode
  /** Callback when banner action is triggered (e.g., open StartPracticeModal) */
  onBannerAction?: () => void
}

// ============================================================================
// Inner Component (uses context)
// ============================================================================

interface PracticeLayoutInnerProps {
  children: ReactNode
  onBannerAction?: () => void
}

/**
 * Inner component that registers the action callback and renders the banner.
 * Needs to be inside the provider to access context.
 */
function PracticeLayoutInner({ children, onBannerAction }: PracticeLayoutInnerProps) {
  const { setOnAction } = useSessionModeBanner()

  // Register the action callback
  useEffect(() => {
    if (onBannerAction) {
      setOnAction(onBannerAction)
    }
  }, [onBannerAction, setOnAction])

  return (
    <>
      {/* The projecting banner renders via portal to body */}
      <ProjectingBanner />
      {children}
    </>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * PracticeLayout - Wrapper component for all practice pages
 *
 * Provides:
 * - SessionModeBannerProvider for banner state
 * - ProjectingBanner for animated banner
 * - Session mode data fetching
 *
 * Usage:
 * ```tsx
 * <PracticeLayout
 *   studentId={params.studentId}
 *   onBannerAction={() => setShowModal(true)}
 * >
 *   <DashboardContent />
 * </PracticeLayout>
 * ```
 */
export function PracticeLayout({ studentId, children, onBannerAction }: PracticeLayoutProps) {
  // Fetch session mode
  const { data: sessionMode, isLoading } = useSessionMode(studentId)

  return (
    <SessionModeBannerProvider sessionMode={sessionMode ?? null} isLoading={isLoading}>
      <PracticeLayoutInner onBannerAction={onBannerAction}>{children}</PracticeLayoutInner>
    </SessionModeBannerProvider>
  )
}

export default PracticeLayout

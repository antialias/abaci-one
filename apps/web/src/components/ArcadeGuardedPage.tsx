'use client'

import type { ReactNode } from 'react'
import { useArcadeGuard } from '@/hooks/useArcadeGuard'

export interface ArcadeGuardedPageProps {
  children: ReactNode
  /**
   * Loading component to show while checking for active session
   */
  loadingComponent?: ReactNode
}

/**
 * Wrapper component that applies the arcade session guard
 *
 * This component:
 * - Checks for active arcade sessions
 * - Redirects to active session if user navigates to a different game
 * - Shows loading state while checking
 *
 * @example
 * ```tsx
 * export default function MatchingPage() {
 *   return (
 *     <ArcadeGuardedPage>
 *       <MemoryPairsProvider>
 *         <MemoryPairsGame />
 *       </MemoryPairsProvider>
 *     </ArcadeGuardedPage>
 *   )
 * }
 * ```
 */
export function ArcadeGuardedPage({ children, loadingComponent }: ArcadeGuardedPageProps) {
  const { loading } = useArcadeGuard()

  if (loading && loadingComponent) {
    return <>{loadingComponent}</>
  }

  return <>{children}</>
}

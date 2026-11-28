'use client'

/**
 * The abacus notice after a game break (owner's decisions of 2026-11-28,
 * plan §8 A19): when practice resumes at a part after a break, and the part
 * needs the physical abacus where the one before did not (or the other way
 * round), the kid sees "Get your abacus ready" / "Put your abacus aside"
 * before the part's first item.
 *
 * The gate renders the notice in place of its children, so the session (and
 * its try clock, which starts when an item is shown) mounts only after the
 * notice: the first item's response time never includes it.
 *
 * Derived from the plan (`abacusNoticeAfterBreak`): no flow state, no write.
 * A tap or the countdown dismisses it for this tab; a reload before the
 * part's first try shows it again.
 */

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionPlan } from '@/db/schema/session-plans'
import { abacusNoticeAfterBreak } from '@/lib/curriculum/abacus-notice'
import {
  PartTransitionScreen,
  type PartTransitionView,
  partTransitionViewOf,
} from './PartTransitionScreen'

export interface AbacusNoticeGateProps {
  plan: SessionPlan
  student: { name: string; emoji: string; color: string }
  /** false = never show the notice (browse mode) */
  enabled?: boolean
  /** The notice came up: the parts it stands between, and its countdown's start (observers) */
  onShown?: (
    previous: PartTransitionView | null,
    next: PartTransitionView,
    countdownStartTime: number
  ) => void
  /** The notice went away: dismissed, or the plan left it (observers) */
  onEnded?: () => void
  children: ReactNode
}

export function AbacusNoticeGate({
  plan,
  student,
  enabled = true,
  onShown,
  onEnded,
  children,
}: AbacusNoticeGateProps) {
  const notice = useMemo(() => (enabled ? abacusNoticeAfterBreak(plan) : null), [enabled, plan])
  const partIndex = plan.currentPartIndex
  const key = notice ? `${plan.id}:${partIndex}` : null

  const [dismissed, setDismissed] = useState<string | null>(null)
  const [shown, setShown] = useState<{ key: string; countdownStartTime: number } | null>(null)
  const activeKey = key !== null && dismissed !== key ? key : null

  // Its countdown starts during render ("adjust state when a prop changes"),
  // so the notice is in the first frame of practice after the break
  if (activeKey && shown?.key !== activeKey) {
    setShown({ key: activeKey, countdownStartTime: Date.now() })
  }

  const previousPart = plan.parts[partIndex - 1]
  const nextPart = plan.parts[partIndex]
  const views = useMemo(
    () =>
      activeKey && nextPart
        ? {
            previous: previousPart ? partTransitionViewOf(previousPart) : null,
            next: partTransitionViewOf(nextPart),
          }
        : null,
    [activeKey, previousPart, nextPart]
  )

  // Observers are told once per notice, and when it goes
  const onShownRef = useRef(onShown)
  onShownRef.current = onShown
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const announcedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeKey || !views || shown?.key !== activeKey) return
    if (announcedRef.current === activeKey) return
    announcedRef.current = activeKey
    onShownRef.current?.(views.previous, views.next, shown.countdownStartTime)
  }, [activeKey, views, shown])
  useEffect(() => {
    if (!activeKey) return
    return () => {
      if (announcedRef.current === activeKey) onEndedRef.current?.()
    }
  }, [activeKey])

  const handleDone = useCallback(() => {
    if (activeKey) setDismissed(activeKey)
  }, [activeKey])

  if (activeKey && views && notice && shown?.key === activeKey) {
    return (
      <PartTransitionScreen
        key={activeKey}
        isVisible
        variant="abacus-notice"
        abacusNotice={notice}
        previous={views.previous}
        next={views.next}
        countdownStartTime={shown.countdownStartTime}
        student={student}
        onComplete={handleDone}
      />
    )
  }
  return <>{children}</>
}

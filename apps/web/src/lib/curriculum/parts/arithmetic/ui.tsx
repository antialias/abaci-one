'use client'

/**
 * The arithmetic part kind's UI (session architecture §1.2: "UI lives in a
 * client-only module: ItemView, Dots, Intro, RetryIntro").
 *
 * Phase 2 names the components that already render an arithmetic part; the
 * session screens keep importing them directly until Phase 5 (b)/(c) moves
 * structural readers onto the kind (§10 P2-6). There is no arithmetic-only
 * intro today: `PartTransitionScreen` is the structural transition screen
 * (§1.3), so `Intro` is absent.
 */

import { LinearProblem } from '@/components/practice/LinearProblem'
import { RetryTransitionScreen } from '@/components/practice/RetryTransitionScreen'
import { SessionProgressIndicator } from '@/components/practice/SessionProgressIndicator'
import { VerticalProblem } from '@/components/practice/VerticalProblem'
import type { SessionPart } from '@/db/schema/session-plans'

export const arithmeticUi = {
  /** The problem view for a part's display format */
  ItemView: (format: SessionPart['format']) =>
    format === 'linear' ? LinearProblem : VerticalProblem,
  /** Per-slot progress dots (with retry and do-over state) */
  Dots: SessionProgressIndicator,
  /** The screen between a part's original slots and a retry round */
  RetryIntro: RetryTransitionScreen,
} as const

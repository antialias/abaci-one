'use client'

/**
 * The life of one try on screen, for any kind (practice-kinds plan §4 K5a-1).
 *
 * The phases every kind shares (loading → inputting → submitting →
 * showingFeedback → transitioning, complete, and paused over any of them),
 * the try clock (its id, minted when the item is shown; its start; the pause
 * and hidden-tab time folded out of it) and the capture-time timing guard.
 * Kind-blind: an item, its attempt and the snapshot of an attempt animating
 * out are the kind's types, made by the kind's {@link TryItemKind}.
 *
 * A kind may add phases inside inputting ({@link EntryPhase}: arithmetic's
 * `awaitingDisambiguation` and `helpMode`). The lifecycle treats them as
 * inputting: they carry the attempt, accept input and may submit.
 *
 * The phase is one state ({@link useTryPhaseState}) that the lifecycle and a
 * kind's entry hook both drive. Call the entry hook before
 * {@link useTryLifecycle}, so its effects run before the lifecycle's, as a
 * child's effects run before its parent's: when an item change and an entry
 * timer land in the same render, the item change wins.
 *
 * Extracted from `useInteractionPhase.ts` behaviour-identical (K5a-1). The
 * session shell (`SessionShell`) holds it; a kind's item view calls its entry
 * hook as the shell's child (K5a-3b), which keeps that order.
 */

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { mintTryId } from '@/db/schema/session-plan-normalize'
import {
  applyResponseTimeGuard,
  type ResponseTimeGuardResult,
} from '@/lib/curriculum/timing/response-time-guard'

// =============================================================================
// The try clock
// =============================================================================

/** What the lifecycle keeps on every attempt: the try's id and its clock. */
export interface TryClock {
  /**
   * Id of the try this attempt becomes, minted when the problem is shown. Sent
   * with the answer; the server records a try id once, so a resend is a no-op.
   */
  tryId: string
  /** When the attempt started */
  startTime: number
  /** Accumulated time spent paused (ms) - subtract from elapsed time for actual response time */
  accumulatedPauseMs: number
  /**
   * Subset of `accumulatedPauseMs` that came from the tab being hidden /
   * backgrounded (visibility layer, #156). Audit-only — recorded on the result
   * as `hiddenTimeExcludedMs`; it is already included in `accumulatedPauseMs`.
   */
  accumulatedHiddenMs: number
}

/** A fresh try clock: a new try id, started now, nothing paused or hidden yet. */
export function startTryClock(): TryClock {
  return {
    tryId: mintTryId(),
    startTime: Date.now(),
    accumulatedPauseMs: 0,
    accumulatedHiddenMs: 0,
  }
}

/**
 * The response time of a try at `now`: elapsed time minus the pause and
 * hidden time folded into it, through the capture-time timing guard (#156),
 * which caps idle/backgrounded or clock-anomaly deltas at this child's
 * auto-pause threshold and flags the sample (raw preserved) so #157/#158 can
 * quarantine and review it.
 */
export function tryResponseTime(
  clock: Pick<TryClock, 'startTime' | 'accumulatedPauseMs'>,
  capMs: number,
  now: number = Date.now()
): ResponseTimeGuardResult {
  const rawResponseTimeMs = now - clock.startTime - clock.accumulatedPauseMs
  return applyResponseTimeGuard(rawResponseTimeMs, capMs, 'client')
}

// =============================================================================
// Phases
// =============================================================================

export type TryResult = 'correct' | 'incorrect'

/**
 * A phase a kind adds inside inputting. It carries the attempt, accepts input
 * and may submit; its name is none of the lifecycle's own.
 */
export interface EntryPhase<A> {
  phase: string
  attempt: A
}

/**
 * Non-paused phases (used for resumePhase type): the lifecycle's own, plus
 * the kind's entry phases `X`. `A` is the kind's attempt, `O` its snapshot of
 * an attempt animating out.
 */
export type LifecyclePhase<A, O, X extends EntryPhase<A> = never> =
  | { phase: 'loading' }
  | { phase: 'inputting'; attempt: A }
  | X
  | { phase: 'submitting'; attempt: A }
  | { phase: 'showingFeedback'; attempt: A; result: TryResult }
  | { phase: 'transitioning'; outgoing: O; incoming: A }
  | { phase: 'complete' }

/** Session paused - remembers what phase to return to */
export interface PausedPhase<P> {
  phase: 'paused'
  resumePhase: P
  /** When the pause started (used to calculate pause duration on resume) */
  pauseStartedAt: number
}

/**
 * Discriminated union representing all possible interaction phases.
 * Each phase carries exactly the data needed for that phase.
 */
export type TryPhase<P> = P | PausedPhase<P>

/** Any active phase whose attempt carries a try clock */
type AnyActivePhase = LifecyclePhase<TryClock, unknown, EntryPhase<TryClock>>

const OWN_PHASES = new Set([
  'loading',
  'inputting',
  'submitting',
  'showingFeedback',
  'transitioning',
  'complete',
])

/** The phase as one of the lifecycle's own, or null for a kind's entry phase. */
function ownPhaseOf<A, O>(active: { phase: string }): LifecyclePhase<A, O> | null {
  return OWN_PHASES.has(active.phase) ? (active as LifecyclePhase<A, O>) : null
}

function isPausedPhase<P>(phase: TryPhase<P>): phase is PausedPhase<P> {
  return (phase as { phase: string }).phase === 'paused'
}

/** inputting, or a kind's entry phase: the phases that accept input */
function acceptsInput(phase: { phase: string }): boolean {
  return phase.phase === 'inputting' || (!OWN_PHASES.has(phase.phase) && phase.phase !== 'paused')
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets the active (non-paused) phase, unwrapping if paused.
 */
export function getActivePhase<P>(phase: TryPhase<P>): P {
  return isPausedPhase(phase) ? phase.resumePhase : (phase as P)
}

/**
 * Applies a transformation to the active phase, preserving paused wrapper if present.
 * If the transform returns null, the phase is unchanged.
 */
export function transformActivePhase<P>(
  phase: TryPhase<P>,
  transform: (active: P) => P | null
): TryPhase<P> {
  if (isPausedPhase(phase)) {
    const newResumePhase = transform(phase.resumePhase)
    if (newResumePhase === null) return phase
    return {
      phase: 'paused',
      resumePhase: newResumePhase,
      pauseStartedAt: phase.pauseStartedAt,
    }
  }
  const newPhase = transform(phase as P)
  return newPhase === null ? phase : newPhase
}

/**
 * Returns the attempt an active phase is currently carrying, or null for phases
 * that carry none (`loading` / `complete`).
 */
export function getActivePhaseAttempt<A extends TryClock>(
  active: LifecyclePhase<A, unknown, EntryPhase<A>>
): A | null {
  const own = ownPhaseOf<A, unknown>(active)
  if (!own) return (active as EntryPhase<A>).attempt
  switch (own.phase) {
    case 'inputting':
    case 'submitting':
    case 'showingFeedback':
      return own.attempt
    case 'transitioning':
      return own.incoming
    case 'loading':
    case 'complete':
      return null
  }
}

/**
 * Adds `ms` to the active phase's current attempt `accumulatedPauseMs`, and —
 * when the span was hidden-tab time — its `accumulatedHiddenMs` audit counter.
 * No-ops for phases without an attempt or a non-positive span. Preserves the
 * paused wrapper is NOT this function's job: callers pass an already-unwrapped
 * active phase.
 *
 * Extracted from `resume()` so the visibility layer folds hidden time through
 * the identical accounting the pause clock uses.
 */
export function addPauseToActivePhase<P extends AnyActivePhase>(
  active: P,
  ms: number,
  opts: { hidden: boolean } = { hidden: false }
): P {
  if (ms <= 0) return active
  const bump = <A extends TryClock>(attempt: A): A => ({
    ...attempt,
    accumulatedPauseMs: attempt.accumulatedPauseMs + ms,
    accumulatedHiddenMs: opts.hidden
      ? attempt.accumulatedHiddenMs + ms
      : attempt.accumulatedHiddenMs,
  })
  const own = ownPhaseOf<TryClock, unknown>(active)
  if (!own) {
    // A kind's entry phase carries the attempt like inputting does
    return { ...active, attempt: bump((active as EntryPhase<TryClock>).attempt) }
  }
  switch (own.phase) {
    case 'inputting':
    case 'submitting':
    case 'showingFeedback':
      return { ...active, attempt: bump(own.attempt) }
    case 'transitioning':
      // Fold into the incoming attempt (mirrors resume()'s existing behavior).
      return { ...active, incoming: bump(own.incoming) }
    case 'loading':
    case 'complete':
      return active
  }
}

/**
 * Folds a hidden span `[hiddenAt, now]` into the active phase's current attempt
 * as excluded (hidden) time. The span is clamped to the attempt's own lifetime
 * (`max(hiddenAt, attempt.startTime)`) so a hidden interval that straddled a
 * problem transition can never drive the new attempt's response time negative.
 */
export function foldHiddenSpanIntoActivePhase<P extends AnyActivePhase>(
  active: P,
  hiddenAt: number,
  now: number
): P {
  const attempt = getActivePhaseAttempt(active)
  if (!attempt) return active
  const effectiveStart = Math.max(hiddenAt, attempt.startTime)
  return addPauseToActivePhase(active, now - effectiveStart, { hidden: true })
}

// =============================================================================
// Hook
// =============================================================================

/** How a kind makes the lifecycle's attempts. Pass a module constant. */
export interface TryItemKind<I, A extends TryClock, O> {
  /** A fresh attempt at an item, its try clock started ({@link startTryClock}) */
  attemptOf(item: I): A
  /** The snapshot of an attempt animating out after its feedback */
  outgoingOf(attempt: A, result: TryResult): O
}

/** The try's phase state, shared by the lifecycle and a kind's entry hook. */
export type TryPhaseState<P> = [TryPhase<P>, Dispatch<SetStateAction<TryPhase<P>>>]

/**
 * The try's phase, hydrated with an initial item if given (for SSR):
 * inputting it, else loading.
 */
export function useTryPhaseState<I, A extends TryClock, O, X extends EntryPhase<A> = never>(
  initialItem: I | undefined,
  kind: TryItemKind<I, A, O>
): TryPhaseState<LifecyclePhase<A, O, X>> {
  return useState<TryPhase<LifecyclePhase<A, O, X>>>(() => {
    if (initialItem) {
      return { phase: 'inputting', attempt: kind.attemptOf(initialItem) }
    }
    return { phase: 'loading' }
  })
}

export interface UseTryLifecycleOptions<I, A extends TryClock, O> {
  /**
   * The item on screen with a stable key - the single source of truth for
   * which item is being worked on. When the key changes, the lifecycle loads
   * the new item; the key lets it tell a real change from a new reference.
   */
  activeItem?: (I & { key: string }) | null
  kind: TryItemKind<I, A, O>
}

export interface UseTryLifecycleReturn<I, A, O, X extends EntryPhase<A>> {
  // Current phase
  phase: TryPhase<LifecyclePhase<A, O, X>>

  // Extracted state from phase (single source of truth)
  /** Current attempt being worked on (null in loading/complete phases) */
  attempt: A | null
  /** Outgoing attempt during transition animation (null otherwise) */
  outgoingAttempt: O | null

  // Derived predicates for UI
  /** Can we accept keyboard/keypad input? */
  canAcceptInput: boolean
  /** Should the item display show as completed? */
  showAsCompleted: boolean
  /** Should the input area (keypad/submit) be shown? */
  showInputArea: boolean
  /** Should the feedback message be shown? */
  showFeedback: boolean
  /** Is the input box focused? */
  inputIsFocused: boolean
  /** Are we currently in the transitioning phase? */
  isTransitioning: boolean
  /** Are we currently paused? */
  isPaused: boolean
  /** Are we currently submitting? */
  isSubmitting: boolean
  /** Is the session complete? */
  isComplete: boolean

  // Actions
  /** Load a new item (loading → inputting) */
  load: (item: I) => void
  /** Submit answer (inputting or an entry phase → submitting) */
  startSubmit: () => void
  /** Handle submit result (submitting → showingFeedback) */
  completeSubmit: (result: TryResult) => void
  /**
   * Start transition to the next item (showingFeedback → transitioning);
   * `next` names it from the attempt animating out.
   */
  startTransition: (next: (current: A) => I) => void
  /** Complete transition (transitioning → inputting) */
  completeTransition: () => void
  /** Clear to loading state */
  clearToLoading: () => void
  /** Mark session as complete */
  markComplete: () => void
  /** Pause session (* → paused) */
  pause: () => void
  /** Resume session (paused → resumePhase) */
  resume: () => void
}

export function useTryLifecycle<I, A extends TryClock, O, X extends EntryPhase<A> = never>(
  state: TryPhaseState<LifecyclePhase<A, O, X>>,
  options: UseTryLifecycleOptions<I, A, O>
): UseTryLifecycleReturn<I, A, O, X> {
  type Active = LifecyclePhase<A, O, X>
  const [phase, setPhase] = state
  const { activeItem, kind } = options

  // The kind's attempt makers, read by the memoized actions without
  // re-creating them. Set during render — safe.
  const kindRef = useRef(kind)
  kindRef.current = kind

  // Live mirror of `phase` for event handlers that must read the current phase
  // without re-subscribing (the visibility layer). Set during render — safe.
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Visibility layer (#156): when the tab is hidden/backgrounded we record the
  // instant here and fold the elapsed span into the current attempt on return,
  // the identical subtraction resume() performs. `null` = not currently hidden.
  // The pause clock and this hidden clock form a disjoint union (see pause/
  // resume + the visibility effect below) so time is never double-counted.
  const hiddenAtRef = useRef<number | null>(null)

  // ==========================================================================
  // Derived State
  // ==========================================================================

  // Extract attempt from phase if available (recursing into a paused phase)
  const attempt = useMemo((): A | null => getActivePhaseAttempt<A>(getActivePhase(phase)), [phase])

  // UI predicates
  const canAcceptInput = acceptsInput(phase)

  const showAsCompleted = phase.phase === 'showingFeedback'

  const showInputArea = acceptsInput(phase) || phase.phase === 'submitting'

  const own = isPausedPhase(phase) ? null : ownPhaseOf<A, O>(phase)

  const showFeedback = own?.phase === 'showingFeedback' && own.result === 'incorrect'

  const inputIsFocused = acceptsInput(phase)

  const isTransitioning = phase.phase === 'transitioning'

  const isPaused = phase.phase === 'paused'

  const isSubmitting = phase.phase === 'submitting'

  // Extract outgoingAttempt from phase (only during transitions)
  const outgoingAttempt = useMemo((): O | null => {
    const current = isPausedPhase(phase) ? null : ownPhaseOf<A, O>(phase)
    if (current?.phase === 'transitioning') {
      return current.outgoing
    }
    return null
  }, [phase])

  // ==========================================================================
  // Actions
  // ==========================================================================

  const load = useCallback(
    (item: I) => {
      const newAttempt = kindRef.current.attemptOf(item)
      setPhase({ phase: 'inputting', attempt: newAttempt })
    },
    [setPhase]
  )

  // ==========================================================================
  // React to activeItem changes (single source of truth)
  // ==========================================================================
  // This effect handles two cases:
  // 1. activeItem.key changes (redo mode, direct navigation, session plan advances)
  // 2. Phase becomes 'loading' (need to reload current problem after incorrect answer or part transition)
  const prevActiveItemKeyRef = useRef<string | null>(null)
  const hasMountedRef = useRef(false)

  useEffect(() => {
    // Skip on initial mount - let the initial item handle hydration
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      // Initialize the ref with current key
      prevActiveItemKeyRef.current = activeItem?.key ?? null
      return
    }

    // If no active item, nothing to do
    if (!activeItem) {
      prevActiveItemKeyRef.current = null
      return
    }

    const prevKey = prevActiveItemKeyRef.current
    const currentKey = activeItem.key
    const keyChanged = prevKey !== currentKey

    // Case 1: Phase is 'loading' - need to load the item
    // This happens after incorrect answers or when returning from part transitions
    if (phase.phase === 'loading') {
      const newAttempt = kindRef.current.attemptOf(activeItem)
      setPhase({ phase: 'inputting', attempt: newAttempt })
      prevActiveItemKeyRef.current = currentKey
      return
    }

    // Case 2: Key changed - handle redo mode or session advancement
    if (keyChanged) {
      // CRITICAL: Don't interrupt normal progression flow
      // If we're in showingFeedback, submitting, or transitioning, the normal flow
      // (startTransition → completeTransition) handles advancing to the next item.
      const isInProgressionFlow =
        phase.phase === 'showingFeedback' ||
        phase.phase === 'submitting' ||
        phase.phase === 'transitioning'

      if (isInProgressionFlow) {
        // Still update the ref so we track the change
        prevActiveItemKeyRef.current = currentKey
        return
      }

      // Key changed and we're not in progression flow - load the new item immediately
      const newAttempt = kindRef.current.attemptOf(activeItem)
      setPhase({ phase: 'inputting', attempt: newAttempt })
      prevActiveItemKeyRef.current = currentKey
    }
  }, [activeItem, phase.phase, setPhase])

  const startSubmit = useCallback(() => {
    setPhase((prev) => {
      // Allow submitting from inputting or a kind's entry phase
      if (!acceptsInput(prev)) {
        return prev
      }
      return { phase: 'submitting', attempt: (prev as EntryPhase<A>).attempt }
    })
  }, [setPhase])

  const completeSubmit = useCallback(
    (result: TryResult) => {
      setPhase((prev) =>
        transformActivePhase<Active>(prev, (active) => {
          if (active.phase !== 'submitting') return null
          return { phase: 'showingFeedback', attempt: (active as EntryPhase<A>).attempt, result }
        })
      )
    },
    [setPhase]
  )

  const startTransition = useCallback(
    (next: (current: A) => I) => {
      setPhase((prev) => {
        const current = isPausedPhase(prev) ? null : ownPhaseOf<A, O>(prev)
        if (current?.phase !== 'showingFeedback') return prev

        const outgoing = kindRef.current.outgoingOf(current.attempt, current.result)
        const incoming = kindRef.current.attemptOf(next(current.attempt))

        return { phase: 'transitioning', outgoing, incoming }
      })
    },
    [setPhase]
  )

  const completeTransition = useCallback(() => {
    setPhase((prev) =>
      transformActivePhase<Active>(prev, (active) => {
        const current = ownPhaseOf<A, O>(active)
        if (current?.phase !== 'transitioning') return null
        return { phase: 'inputting', attempt: current.incoming }
      })
    )
  }, [setPhase])

  const clearToLoading = useCallback(() => {
    setPhase({ phase: 'loading' })
  }, [setPhase])

  const markComplete = useCallback(() => {
    setPhase({ phase: 'complete' })
  }, [setPhase])

  const pause = useCallback(() => {
    // Capture the hidden clock BEFORE the (pure) updater so StrictMode's
    // double-invocation can't fold the same span twice.
    const now = Date.now()
    const hiddenAt = hiddenAtRef.current
    setPhase((prev) => {
      if (prev.phase === 'paused' || prev.phase === 'loading' || prev.phase === 'complete')
        return prev
      const active = prev as Active
      // Disjoint-union rule (b): a hidden span in flight is folded into the
      // attempt FIRST (clamped to its lifetime); from here the pause clock owns
      // elapsed time, so the two never double-count.
      const base = hiddenAt != null ? foldHiddenSpanIntoActivePhase(active, hiddenAt, now) : active
      return { phase: 'paused', resumePhase: base, pauseStartedAt: now }
    })
    // The hidden span (if any) has been handed off to the pause clock.
    hiddenAtRef.current = null
  }, [setPhase])

  const resume = useCallback(() => {
    const now = Date.now()
    // Disjoint-union rule (c): if the tab is STILL hidden (teacher remote-resume
    // while backgrounded), re-arm the hidden clock so the still-hidden span
    // keeps being excluded when the child actually returns.
    const stillHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    setPhase((prev) => {
      if (!isPausedPhase(prev)) return prev
      // Fold the pause span into the attempt via the shared accounting.
      return addPauseToActivePhase(prev.resumePhase, now - prev.pauseStartedAt, { hidden: false })
    })
    hiddenAtRef.current = stillHidden ? now : null
  }, [setPhase])

  // ==========================================================================
  // Visibility layer (#156): fold hidden-tab time out of the response time
  // ==========================================================================
  //
  // Mount-only. On hidden we arm `hiddenAtRef`; on return we fold the elapsed
  // span into the current attempt (silently — no phase change, so no pause
  // modal flashes). `visibilitychange` is primary; `pagehide` / persisted
  // `pageshow` are idempotent belt-and-suspenders for iOS Safari reliability.
  useEffect(() => {
    if (typeof document === 'undefined') return

    const arm = () => {
      // Rule (a): arm only when not already armed (idempotent under duplicate
      // pagehide + visibilitychange) and not paused (the pause clock owns it).
      if (hiddenAtRef.current != null) return
      if (phaseRef.current.phase === 'paused') return
      hiddenAtRef.current = Date.now()
    }

    const fold = () => {
      const hiddenAt = hiddenAtRef.current
      if (hiddenAt == null) return
      hiddenAtRef.current = null
      const now = Date.now()
      setPhase((prev) => {
        // Rule (d): visible while paused → no-op (pause clock owns the interval).
        if (isPausedPhase(prev)) return prev
        return foldHiddenSpanIntoActivePhase(prev as Active, hiddenAt, now)
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') arm()
      else fold()
    }
    const handlePageHide = () => arm()
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) fold()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [setPhase])

  // Is the session complete?
  const isComplete = phase.phase === 'complete'

  return {
    phase,
    attempt,
    outgoingAttempt,
    canAcceptInput,
    showAsCompleted,
    showInputArea,
    showFeedback,
    inputIsFocused,
    isTransitioning,
    isPaused,
    isSubmitting,
    isComplete,
    load,
    startSubmit,
    completeSubmit,
    startTransition,
    completeTransition,
    clearToLoading,
    markComplete,
    pause,
    resume,
  }
}

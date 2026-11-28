'use client'

/**
 * The session shell (practice-kinds plan §4 K5a-3b): the practice screen for
 * any kind, which it reads by the part on screen through
 * `parts/browser-registry.ts` and never names. Replaces `ActiveSession.tsx`
 * behaviour-identical: the same screens, timings, data attributes and wire.
 *
 * The shell owns the try lifecycle (`useTryLifecycle`), the submit path and
 * its feedback (decided here, once, and paced at 500 ms right / 1500 ms
 * wrong), where the screen goes after a try (from the plan the write returned,
 * K5a-3a), the do-over (`ActiveRedo`), browse, the broadcast skeleton, resync,
 * pause (the kid's, the teacher's, the kind's own) with its modal, and the
 * round interlude. The kind's item view (`ItemView`, the shell's child, so a
 * kind's entry hook runs its effects before the lifecycle's, A18(2)) draws the
 * item and takes the answer.
 */

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import type { ReceivedAbacusControl } from '@/hooks/useSessionBroadcast'
import { browserKindOf, cursorDotsIndexOf } from '@/lib/curriculum/parts/browser-registry'
import { partItemAfter, partItemOf } from '@/lib/curriculum/parts/registry'
import { css } from '../../../../styled-system/css'
import { BrowseModeView } from '../BrowseModeView'
import { SessionPausedModal } from '../SessionPausedModal'
import {
  chooseAdvanceTarget,
  chooseRedoReturnTarget,
  type RedoWriteOutcome,
  shownItemOf,
} from './advance'
import type {
  AnswerChannel,
  AnySessionKind,
  ItemViewHandle,
  ShownItem,
  SkipRequest,
  SubmitRequest,
  TryFeedback,
  TryRecord,
} from './sessionKind'
import type {
  ActiveRedo,
  AttemptTimingData,
  BroadcastItem,
  BroadcastState,
  PauseInfo,
  RecordRedoParams,
  StudentInfo,
} from './types'
import {
  type TryClock,
  tryResponseTime,
  useTryLifecycle,
  useTryPhaseState,
} from './useTryLifecycle'

export interface SessionShellProps {
  plan: SessionPlan
  /** Historical results from prior completed sessions for threshold calculation */
  historicalResults?: SlotResult[]
  /** Student info for display in pause modal */
  student: StudentInfo
  /**
   * Called when a problem is answered. Resolves to the plan the server
   * returned, or null when the write was dropped behind a failure or failed
   * (the page then resyncs the screen)
   */
  onAnswer: (result: TryRecord) => Promise<SessionPlan | null>
  /** Called when session is ended early */
  onEndEarly: (reason?: string) => void
  /** Called when session is paused (with info about why) - for external HUD updates */
  onPause?: (pauseInfo: PauseInfo) => void
  /** Called when session is resumed - for external HUD updates */
  onResume?: () => void
  /** Called with timing data when it changes (for external timing display) */
  onTimingUpdate?: (timing: AttemptTimingData | null) => void
  /** Called with broadcast state when it changes (for session observation) */
  onBroadcastStateChange?: (state: BroadcastState | null) => void
  /** Whether browse mode is active (controlled externally via toggle in PracticeSubNav) */
  isBrowseMode?: boolean
  /** Controlled browse index (linear problem index) */
  browseIndex?: number
  /** Called when browse index changes (for external navigation from progress indicator) */
  onBrowseIndexChange?: (index: number) => void
  /** Teacher abacus control received from observing teacher */
  teacherControl?: ReceivedAbacusControl | null
  /** Called after teacher control has been handled (to clear the state) */
  onTeacherControlHandled?: () => void
  /** Teacher-initiated pause request (from observing teacher) */
  teacherPauseRequest?: { message?: string } | null
  /** Called after teacher pause has been handled (to clear the state) */
  onTeacherPauseHandled?: () => void
  /** Teacher-initiated resume request (from observing teacher) */
  teacherResumeRequest?: boolean
  /** Called after teacher resume has been handled (to clear the state) */
  onTeacherResumeHandled?: () => void
  /** Manual pause request from parent (HUD pause button) */
  manualPauseRequest?: boolean
  /** Called after manual pause has been handled (to clear the state) */
  onManualPauseHandled?: () => void
  /** Redo state - when set, show a redo problem instead of current session problem */
  redoState?: ActiveRedo | null
  /** Called to record a redo result (separate from onAnswer since it doesn't advance position) */
  onRecordRedo?: (params: RecordRedoParams) => Promise<SessionPlan | null>
  /** Called when the redo is complete or cancelled */
  onRedoComplete?: () => void
  /** Called to cancel the redo without recording */
  onCancelRedo?: () => void
  /** Called when a result is edited in browse mode (to trigger refetch) */
  onResultEdited?: () => void
  /** When true, show the debug overlay with submit buttons */
  debug?: boolean
  /**
   * Bumped by the parent after a server write failed and the plan was
   * refetched: re-show the server's current problem even if its key is the
   * one already on screen.
   */
  resyncRequest?: number
}

/** The screen while there is no item to show (a load, or a part of a kind this image lacks). */
function SessionLoading() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <div
      data-component="active-session"
      data-status="loading"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
      })}
    >
      <div
        className={css({
          fontSize: '1.25rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        Loading next problem...
      </div>
    </div>
  )
}

/**
 * The practice screen. Its kind is the current part's (past the last part,
 * the last part's: the page leaves for the summary); a part of a kind this
 * image does not know shows loading.
 */
export function SessionShell(props: SessionShellProps) {
  const { plan } = props
  const kind = browserKindOf(plan.parts[plan.currentPartIndex] ?? plan.parts[plan.parts.length - 1])
  if (!kind) return <SessionLoading />
  return <KindSession key={kind.id} kind={kind} {...props} />
}

function KindSession({
  kind,
  plan,
  historicalResults,
  student,
  onAnswer,
  onEndEarly,
  onPause,
  onResume,
  onTimingUpdate,
  onBroadcastStateChange,
  isBrowseMode: isBrowseModeProp = false,
  browseIndex: browseIndexProp,
  onBrowseIndexChange,
  teacherControl,
  onTeacherControlHandled,
  teacherPauseRequest,
  onTeacherPauseHandled,
  teacherResumeRequest,
  onTeacherResumeHandled,
  manualPauseRequest,
  onManualPauseHandled,
  redoState,
  onRecordRedo,
  onRedoComplete,
  onCancelRedo,
  onResultEdited,
  debug = false,
  resyncRequest = 0,
}: SessionShellProps & { kind: AnySessionKind }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // The item the plan shows: the kind's expectedItem over the part's state,
  // through the registry (it accounts for retry rounds)
  const shown = useMemo(() => shownItemOf(plan), [plan])
  const shownTryItem = useMemo(
    () => (shown ? kind.tryItemOf(shown, { doOver: false }) : null),
    [shown, kind]
  )

  /** The try item of a target the advance chose; null hands off to the plan. */
  const tryItemOfTarget = useCallback(
    (target: ShownItem | null) => (target ? kind.tryItemOf(target, { doOver: false }) : null),
    [kind]
  )

  // ============================================================================
  // SINGLE SOURCE OF TRUTH: Which item should be displayed right now
  // ============================================================================
  // Derived from redoState + plan. The lifecycle reacts to changes in
  // activeItem.key to load new items, so redo state and the phase's attempt
  // never need syncing.
  const doOverTryItem = useMemo(() => {
    if (!redoState?.isActive) return null
    const part = plan.parts[redoState.partIndex]
    const item = part ? partItemOf(part, redoState.itemId) : null
    if (item === null) return null
    return kind.tryItemOf(
      { partIndex: redoState.partIndex, itemId: redoState.itemId, round: 0, item },
      { doOver: true }
    )
  }, [redoState, plan.parts, kind])

  const activeItem = useMemo(() => {
    // Redo mode takes priority - user clicked on an item to redo
    if (redoState?.isActive && doOverTryItem) {
      return { ...doOverTryItem, key: `redo-${redoState.partIndex}-${redoState.itemId}` }
    }
    // Normal mode: the item the plan shows (its round included)
    if (shown && shownTryItem) {
      return { ...shownTryItem, key: `normal-${shown.partIndex}-${shown.itemId}-${shown.round}` }
    }
    return null
  }, [redoState, doOverTryItem, shown, shownTryItem])

  // The try's phase, hydrated with the plan's item (for SSR), driven by the
  // lifecycle here and by the kind's entry hook in its view
  const state = useTryPhaseState(shownTryItem ?? undefined, kind.tryItems)
  const lifecycle = useTryLifecycle(state, { activeItem, kind: kind.tryItems })
  const {
    phase,
    attempt,
    outgoingAttempt,
    isPaused,
    load,
    startSubmit,
    completeSubmit,
    startTransition,
    clearToLoading,
    pause,
    resume,
  } = lifecycle

  // What the shell calls on the kind's view, and the slide it asks of it
  const viewHandle = useRef<ItemViewHandle | null>(null)
  const slidePending = useRef(false)

  // A server write failed and the plan was refetched (resyncRequest bumped):
  // drop whatever is on screen and load the server's current problem. Loading
  // re-reads activeItem even when its key has not changed.
  const handledResyncRef = useRef(resyncRequest)
  useEffect(() => {
    if (resyncRequest === handledResyncRef.current) return
    handledResyncRef.current = resyncRequest
    clearToLoading()
  }, [resyncRequest, clearToLoading])

  // Notify parent of timing data changes for external timing display
  useEffect(() => {
    if (onTimingUpdate) {
      if (attempt) {
        onTimingUpdate({
          startTime: attempt.startTime,
          accumulatedPauseMs: attempt.accumulatedPauseMs,
        })
      } else {
        onTimingUpdate(null)
      }
    }
  }, [onTimingUpdate, attempt?.startTime, attempt?.accumulatedPauseMs])

  // The item last broadcast as on screen: the item sliding off during a
  // transition is that item, with its own round and do-over flag (the redo
  // state may already be cleared by then)
  const lastBroadcastRef = useRef<{ item: BroadcastItem; attempt: TryClock } | null>(null)

  // Notify parent of broadcast state changes for session observation: the
  // shell decides the phase, the verdict and the item; the kind fills in
  // what is on screen
  useEffect(() => {
    if (!onBroadcastStateChange) return

    const doOver = redoState?.isActive ?? false

    // During transitioning, we show the outgoing (answered) item, not the incoming one
    if (phase.phase === 'transitioning' && outgoingAttempt) {
      onBroadcastStateChange(
        kind.outgoingBroadcastOf(plan.parts, outgoingAttempt, lastBroadcastRef.current, {
          doOver,
          startedAt: attempt?.startTime ?? Date.now(),
        })
      )
      return
    }

    if (!attempt) {
      onBroadcastStateChange(null)
      return
    }

    // The item on screen (its own part, item and round), not the plan's cursor
    const position = kind.positionOf(plan.parts, attempt)
    const item: BroadcastItem = {
      partIndex: position.partIndex,
      itemId: position.itemId,
      doOver,
      round: position.round,
    }
    lastBroadcastRef.current = { item, attempt }
    onBroadcastStateChange(
      kind.broadcastOf(plan.parts, attempt, {
        // The verdict is only known in the feedback phase (the phase's, not recomputed)
        phase:
          phase.phase === 'showingFeedback'
            ? 'feedback'
            : (kind.broadcastPhaseOf(phase.phase) ?? 'problem'),
        isCorrect: phase.phase === 'showingFeedback' ? phase.result === 'correct' : null,
        startedAt: attempt.startTime,
        item,
      })
    )
  }, [
    onBroadcastStateChange,
    attempt,
    phase,
    outgoingAttempt,
    plan.parts,
    redoState?.isActive,
    kind,
  ])

  // Track pause info for displaying in the modal (single source of truth)
  const [pauseInfo, setPauseInfo] = useState<PauseInfo | undefined>(undefined)

  // The kind's own pause (arithmetic's auto-pause)
  const pauseFor = useCallback(
    (info: PauseInfo) => {
      setPauseInfo(info)
      pause()
      onPause?.(info)
    },
    [pause, onPause]
  )

  // Handle teacher-initiated pause requests
  // Use a ref to track if we've handled this request to prevent duplicate handling
  const handledPauseRef = useRef(false)
  useEffect(() => {
    if (!teacherPauseRequest) {
      handledPauseRef.current = false
      return
    }
    if (handledPauseRef.current) return
    handledPauseRef.current = true

    // Pause the session with teacher reason
    const newPauseInfo: PauseInfo = {
      pausedAt: new Date(),
      reason: 'teacher',
      teacherMessage: teacherPauseRequest.message,
    }
    setPauseInfo(newPauseInfo)
    pause()
    onPause?.(newPauseInfo)

    // Clear the request after handling
    onTeacherPauseHandled?.()
  }, [teacherPauseRequest, pause, onPause, onTeacherPauseHandled])

  // Handle teacher-initiated resume requests
  // Use a ref to track if we've handled this request to prevent duplicate handling
  const handledResumeRef = useRef(false)
  useEffect(() => {
    if (!teacherResumeRequest) {
      handledResumeRef.current = false
      return
    }
    if (handledResumeRef.current) return
    handledResumeRef.current = true

    // Resume the session (the kind's view hears it first)
    setPauseInfo(undefined)
    viewHandle.current?.onResumed()
    resume()
    onResume?.()

    // Clear the request after handling
    onTeacherResumeHandled?.()
  }, [teacherResumeRequest, resume, onResume, onTeacherResumeHandled])

  // Handle manual pause requests from parent (HUD pause button)
  const handledManualPauseRef = useRef(false)
  useEffect(() => {
    if (!manualPauseRequest) {
      handledManualPauseRef.current = false
      return
    }
    if (handledManualPauseRef.current) return
    handledManualPauseRef.current = true

    // Pause the session with manual reason
    const newPauseInfo: PauseInfo = {
      pausedAt: new Date(),
      reason: 'manual',
    }
    setPauseInfo(newPauseInfo)
    pause()
    onPause?.(newPauseInfo)

    // Clear the request after handling
    onManualPauseHandled?.()
  }, [manualPauseRequest, pause, onPause, onManualPauseHandled])

  const handleResume = useCallback(() => {
    setPauseInfo(undefined)
    viewHandle.current?.onResumed()
    resume()
    onResume?.()
  }, [resume, onResume])

  // The last try's feedback, captured at submit so it is stable even if the
  // plan advances
  const [feedback, setFeedback] = useState<TryFeedback | null>(null)

  // ==========================================================================
  // A try's feedback is decided here and only here (practice-kinds K5a-3b; the
  // kind's view draws it, K5a-3c reconciles it to the server's verdict): the
  // verdict (the kind's optimistic check, A11) and whether the answer shows
  // with it. The answer shows with a right answer, a skip, and a wrong try with
  // no retry round left; never with a do-over's wrong try — the kid chose to
  // retry voluntarily and shouldn't get a free look at the answer (its round
  // is 0).
  // ==========================================================================
  const decideFeedback = useCallback(
    ({ isCorrect, round, skipped }: { isCorrect: boolean; round: number; skipped: boolean }) =>
      setFeedback({
        verdict: isCorrect ? 'correct' : 'incorrect',
        showAnswer: skipped || isCorrect || round >= kind.maxRounds,
      }),
    [kind]
  )

  // Round interlude state - the screen between retry rounds
  const [isInInterlude, setIsInInterlude] = useState(false)
  const [interlude, setInterlude] = useState<{ round: number; itemCount: number } | null>(null)
  // Track previous round to detect round changes
  const prevRoundRef = useRef<number>(0)

  // Browse mode state - isBrowseMode is controlled via props
  // browseIndex can be controlled (browseIndexProp + onBrowseIndexChange) or internal
  const [internalBrowseIndex, setInternalBrowseIndex] = useState(0)

  // Determine if browse index is controlled
  const isControlledBrowseIndex = browseIndexProp !== undefined
  const browseIndex = isControlledBrowseIndex ? browseIndexProp : internalBrowseIndex

  // Unified setter that handles both controlled and uncontrolled modes
  const setBrowseIndex = useCallback(
    (index: number | ((prev: number) => number)) => {
      const newIndex = typeof index === 'function' ? index(browseIndex) : index
      if (isControlledBrowseIndex) {
        onBrowseIndexChange?.(newIndex)
      } else {
        setInternalBrowseIndex(newIndex)
      }
    },
    [browseIndex, isControlledBrowseIndex, onBrowseIndexChange]
  )

  // Compute current practice position as a linear index
  // (the dots' coordinate, from the server's plan through the registry)
  const currentPracticeLinearIndex = useMemo(() => cursorDotsIndexOf(plan), [plan])

  // When entering browse mode, initialize browseIndex to current problem
  const prevBrowseModeProp = useRef(isBrowseModeProp)
  useEffect(() => {
    if (isBrowseModeProp && !prevBrowseModeProp.current) {
      // Just entered browse mode - set to current practice position
      setBrowseIndex(currentPracticeLinearIndex)
    }
    prevBrowseModeProp.current = isBrowseModeProp
  }, [isBrowseModeProp, currentPracticeLinearIndex, setBrowseIndex])

  // Redo mode: the item being redone, by its id
  const isInRedoMode = redoState?.isActive ?? false
  // Whether the original redo item was correct (for display)
  const redoOriginalWasCorrect = redoState?.originalResult?.isCorrect ?? false

  // Session completion is the page's: it leaves for the summary when the
  // server's plan has ended (Phase 5b removed this screen's own check of the
  // part index running past the last part)

  // Detect round transitions and show the kind's interlude
  const shownRound = shownTryItem && shown ? shown.round : 0
  useEffect(() => {
    const currentRound = shownRound
    const prevRound = prevRoundRef.current

    // If we just entered a new retry round (round increased from 0 to 1, or 1 to 2)
    if (currentRound > prevRound && currentRound > 0 && shownTryItem) {
      // Get the count of items in this round (the kind's view of the part)
      const itemCount = kind.roundSizeOf(plan, plan.currentPartIndex)

      if (itemCount > 0) {
        setInterlude({ round: currentRound, itemCount })
        setIsInInterlude(true)
      }
    }

    prevRoundRef.current = currentRound
  }, [shownRound, shownTryItem, plan, kind])

  // Handle interlude completion
  const handleInterludeComplete = useCallback(() => {
    setIsInInterlude(false)
    setInterlude(null)
  }, [])

  // Where a try goes after its feedback: slide to the next item, or, with
  // none, hand off to the session state (load whatever the plan shows)
  const enactAdvance = useCallback(
    (next: unknown | null) => {
      if (next) {
        slidePending.current = true
        startTransition(() => next)
        return
      }
      clearToLoading()
    },
    [startTransition, clearToLoading]
  )

  // The submit path: the verdict on screen, the write, and where the screen
  // goes after the feedback
  const submitTry = useCallback(
    async (attemptData: TryClock, request: SubmitRequest<unknown>) => {
      // Transition to submitting phase
      startSubmit()

      // Subtract accumulated pause time to get actual response time, then apply
      // the capture-time timing guard (#156) at the kind's cap
      const timing = tryResponseTime(attemptData, request.capMs)
      const isCorrect = kind.check(attemptData, request.answer)
      // The item and round on screen, not the plan's (which can lag)
      const answered = kind.positionOf(plan.parts, attemptData)
      const redoReturnTargetAtSubmit = shown

      decideFeedback({ isCorrect, round: answered.round, skipped: false })
      request.onVerdict(isCorrect)

      // Record the result
      const result = request.resultOf({
        isCorrect,
        timing,
        hiddenTimeExcludedMs: attemptData.accumulatedHiddenMs || undefined,
      })

      const isDoOver = isInRedoMode && !!redoState

      // Where the screen goes after the feedback, decided once the write that
      // decides it is in hand: from the plan at submit for a first-round try mid-
      // part, else from the plan the write returned, through the same pure call
      // the server made (the kind's expectedItem over the part's state). Never
      // from a ref, a render or a timer (practice-kinds §6.14, §7 Q1).
      let next: unknown | null
      if (isDoOver && redoState) {
        // Every do-over is recorded. The server stamps its round and weight; a
        // do-over of an item already answered correctly is practice-only
        // (weight 0, no effect on mastery, the score or the dot).
        let redoOutcome: RedoWriteOutcome = { recorded: false }
        const write = onRecordRedo
          ? kind.doOverWriteOf({
              playerId: student.id,
              planId: plan.id,
              plan,
              redo: redoState,
              result,
              originalWasCorrect: redoOriginalWasCorrect,
            })
          : null
        if (onRecordRedo && write) {
          // The do-over names its item (Phase 5b). It can move the session on
          // (a redeemed retry round), so the return target comes from its answer.
          redoOutcome = { recorded: true, plan: await onRecordRedo(write) }
        }
        next = tryItemOfTarget(chooseRedoReturnTarget(plan, redoOutcome, redoReturnTargetAtSubmit))
      } else {
        const submission = { ...result, partIndex: answered.partIndex }
        const part = plan.parts[answered.partIndex]
        const following = answered.round === 0 && part ? partItemAfter(part, answered.itemId) : null
        const optimistic = following
          ? kind.tryItemOf(
              {
                partIndex: answered.partIndex,
                itemId: following.itemId,
                round: 0,
                item: following.item,
              },
              { doOver: false }
            )
          : null
        if (optimistic) {
          // Optimistic submit: a first-round try mid-part advances at once to
          // the part's next item, without waiting for the server. The write
          // queue in PracticeClient serializes the actual server writes.
          void onAnswer(submission)
          next = optimistic
        } else {
          // A retry round's next item, or what follows a part's last one, is
          // the server's to decide: wait for its plan (null when the write was
          // dropped or failed: the page resyncs, and nothing is derived)
          next = tryItemOfTarget(chooseAdvanceTarget(answered, await onAnswer(submission)))
        }
      }

      // Complete submit with result
      completeSubmit(isCorrect ? 'correct' : 'incorrect')

      // Wait for feedback display (UI pacing), then advance
      setTimeout(
        () => {
          enactAdvance(next)
          if (isDoOver) {
            onRedoComplete?.()
          }
        },
        isCorrect ? 500 : 1500
      )
    },
    [
      kind,
      plan,
      shown,
      student.id,
      decideFeedback,
      onAnswer,
      onRecordRedo,
      startSubmit,
      completeSubmit,
      enactAdvance,
      tryItemOfTarget,
      isInRedoMode,
      redoState,
      redoOriginalWasCorrect,
      onRedoComplete,
    ]
  )

  // A skip: the answer shows, the try is recorded as skipped, and the screen
  // moves on 1500 ms after the plan the write returned names where to
  // (K5a-3b, A21(7): before, a timer stood in for that plan)
  const skipTry = useCallback(
    async (attemptData: TryClock, request: SkipRequest) => {
      // In redo mode, cancel the redo instead
      if (isInRedoMode && onCancelRedo) {
        onCancelRedo()
        return
      }

      // Same capture-time timing guard (#156) as a submit
      const timing = tryResponseTime(attemptData, request.capMs)
      const answered = kind.positionOf(plan.parts, attemptData)
      const result = request.resultOf({
        timing,
        hiddenTimeExcludedMs: attemptData.accumulatedHiddenMs || undefined,
      })

      // The try's feedback: wrong, with the answer shown
      decideFeedback({ isCorrect: false, round: answered.round, skipped: true })
      request.reveal()
      startSubmit()

      // The write enters the queue; the feedback shows at once
      const write = onAnswer(result)
      completeSubmit('incorrect')

      // The next item from the plan the write returned, shown in place (a
      // skip never slid); none hands off to the plan (the part ended, a new
      // round starts, or the write failed and the page resyncs)
      const next = tryItemOfTarget(chooseAdvanceTarget(answered, await write))

      // Advance after showing the answer
      setTimeout(() => {
        if (next) {
          load(next)
        } else {
          clearToLoading()
        }
      }, 1500)
    },
    [
      kind,
      plan.parts,
      decideFeedback,
      isInRedoMode,
      onCancelRedo,
      onAnswer,
      startSubmit,
      completeSubmit,
      tryItemOfTarget,
      load,
      clearToLoading,
    ]
  )

  // How the kind's view answers through the shell (the plan's AnswerChannel)
  const channel = useMemo<AnswerChannel<TryClock, unknown>>(
    () => ({ submit: submitTry, skip: skipTry, pause: pauseFor }),
    [submitTry, skipTry, pauseFor]
  )

  const currentPart = plan.parts[plan.currentPartIndex]
  const isLoading = !currentPart || !attempt

  // Redo mode banner
  const banner: ReactNode =
    isInRedoMode && redoState ? (
      <div
        data-element="redo-mode-banner"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '0.5rem 1rem',
          backgroundColor: isDark ? 'orange.900/80' : 'orange.100',
          borderRadius: '12px',
          border: '2px solid',
          borderColor: isDark ? 'orange.600' : 'orange.400',
          marginBottom: '0.5rem',
        })}
      >
        <span className={css({ fontSize: '1.25rem' })}>🔄</span>
        <span
          className={css({
            fontWeight: '600',
            fontSize: '0.875rem',
            color: isDark ? 'orange.100' : 'orange.800',
          })}
        >
          Redoing Problem #{redoState.linearIndex + 1}
          {redoOriginalWasCorrect && (
            <span
              className={css({
                marginLeft: '0.5rem',
                fontWeight: '400',
                fontSize: '0.75rem',
                color: isDark ? 'orange.300' : 'orange.600',
              })}
            >
              (Practice Only)
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onCancelRedo}
          className={css({
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            fontWeight: '500',
            color: isDark ? 'gray.300' : 'gray.600',
            backgroundColor: isDark ? 'gray.700' : 'gray.200',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            _hover: {
              backgroundColor: isDark ? 'gray.600' : 'gray.300',
            },
          })}
        >
          ← Back to #{currentPracticeLinearIndex + 1}
        </button>
      </div>
    ) : null

  const Interlude = kind.Interlude
  const overlays: ReactNode = (
    <>
      {/* Session Paused Modal - rendered here as single source of truth */}
      <SessionPausedModal
        isOpen={isPaused}
        student={student}
        session={plan}
        pauseInfo={pauseInfo}
        onResume={handleResume}
        onEndSession={() => onEndEarly('Session ended by user')}
      />

      {/* The kind's interlude - shown when a retry round starts */}
      {interlude && (
        <Interlude
          isVisible={isInInterlude}
          round={interlude.round}
          itemCount={interlude.itemCount}
          student={{ name: student.name, emoji: student.emoji }}
          onComplete={handleInterludeComplete}
        />
      )}
    </>
  )

  const ItemView = kind.ItemView
  return (
    <>
      {isLoading ? (
        <SessionLoading />
      ) : isBrowseModeProp ? (
        // Browse mode - show the browse view instead of the practice view
        <BrowseModeView
          plan={plan}
          browseIndex={browseIndex}
          currentPracticeIndex={currentPracticeLinearIndex}
          studentId={student.id}
          onResultEdited={onResultEdited}
        />
      ) : null}
      {/* Always mounted: the kind's hooks (its entry, its help thresholds) keep running */}
      <ItemView
        plan={plan}
        student={student}
        historicalResults={historicalResults}
        state={state}
        lifecycle={lifecycle}
        channel={channel}
        feedback={feedback}
        redo={redoState ?? null}
        itemKey={activeItem?.key}
        slidePending={slidePending}
        handle={viewHandle}
        hidden={isLoading || isBrowseModeProp}
        banner={banner}
        overlays={overlays}
        teacherControl={teacherControl}
        onTeacherControlHandled={onTeacherControlHandled}
        debug={debug}
      />
    </>
  )
}

export default SessionShell

import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import type {
  GameBreakEndReason,
  SessionFlowState,
  SessionPlan,
} from '@/db/schema/session-plans'

export type SessionFlowEvent =
  | { type: 'PART_TRANSITION_STARTED' }
  | { type: 'PART_TRANSITION_COMPLETED'; shouldRunBreak: boolean }
  | { type: 'BREAK_STARTED'; game?: string | null }
  | { type: 'BREAK_FINISHED'; reason: GameBreakEndReason; results?: GameResultsReport | null }
  | { type: 'BREAK_RESULTS_ACKED' }
  | { type: 'SESSION_COMPLETED' }
  | { type: 'SESSION_ABANDONED' }

export class InvalidFlowTransitionError extends Error {
  constructor(
    message: string,
    public readonly state: SessionFlowState,
    public readonly eventType: SessionFlowEvent['type']
  ) {
    super(message)
    this.name = 'InvalidFlowTransitionError'
  }
}

export interface AppliedFlowEvent {
  changed: boolean
  patch: {
    flowState?: SessionFlowState
    flowUpdatedAt?: Date
    flowVersion?: number
    breakStartedAt?: Date | null
    breakReason?: GameBreakEndReason | null
    breakSelectedGame?: string | null
    breakResults?: GameResultsReport | null
  }
}

function sameResults(
  a: GameResultsReport | null | undefined,
  b: GameResultsReport | null | undefined
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function noChange(): AppliedFlowEvent {
  return { changed: false, patch: {} }
}

export function applyFlowEvent(plan: SessionPlan, event: SessionFlowEvent): AppliedFlowEvent {
  const current = plan.flowState ?? 'practicing'
  const currentVersion = plan.flowVersion ?? 0
  const now = new Date()

  const commit = (patch: AppliedFlowEvent['patch']): AppliedFlowEvent => ({
    changed: true,
    patch: {
      ...patch,
      flowUpdatedAt: now,
      flowVersion: currentVersion + 1,
    },
  })

  switch (event.type) {
    case 'PART_TRANSITION_STARTED': {
      if (current === 'part_transition') return noChange()
      if (current !== 'practicing') {
        throw new InvalidFlowTransitionError(
          `PART_TRANSITION_STARTED not allowed from ${current}`,
          current,
          event.type
        )
      }
      return commit({
        flowState: 'part_transition',
        breakStartedAt: null,
        breakReason: null,
        breakSelectedGame: null,
        breakResults: null,
      })
    }

    case 'PART_TRANSITION_COMPLETED': {
      if (event.shouldRunBreak) {
        if (current === 'break_pending' || current === 'break_active') return noChange()
      } else if (current === 'practicing') {
        return noChange()
      }

      if (current !== 'part_transition') {
        throw new InvalidFlowTransitionError(
          `PART_TRANSITION_COMPLETED not allowed from ${current}`,
          current,
          event.type
        )
      }

      if (!event.shouldRunBreak) {
        return commit({
          flowState: 'practicing',
          breakStartedAt: null,
          breakReason: null,
          breakSelectedGame: null,
          breakResults: null,
        })
      }

      return commit({
        flowState: 'break_pending',
        breakStartedAt: plan.breakStartedAt ?? now,
        breakReason: null,
        breakSelectedGame: null,
        breakResults: null,
      })
    }

    case 'BREAK_STARTED': {
      const selectedGame = event.game ?? null

      if (current === 'break_active') {
        if ((plan.breakSelectedGame ?? null) === selectedGame || event.game === undefined) {
          return noChange()
        }
        return commit({
          breakSelectedGame: selectedGame,
        })
      }

      if (current !== 'break_pending') {
        throw new InvalidFlowTransitionError(
          `BREAK_STARTED not allowed from ${current}`,
          current,
          event.type
        )
      }

      return commit({
        flowState: 'break_active',
        breakStartedAt: plan.breakStartedAt ?? now,
        breakSelectedGame: selectedGame,
      })
    }

    case 'BREAK_FINISHED': {
      const targetState: SessionFlowState =
        event.reason === 'gameFinished' ? 'break_results' : 'practicing'
      const targetResults = event.reason === 'gameFinished' ? (event.results ?? null) : null

      const alreadyApplied =
        current === targetState &&
        (plan.breakReason ?? null) === event.reason &&
        sameResults(plan.breakResults, targetResults)
      if (alreadyApplied) return noChange()

      if (current !== 'break_active' && current !== 'break_pending') {
        throw new InvalidFlowTransitionError(
          `BREAK_FINISHED not allowed from ${current}`,
          current,
          event.type
        )
      }

      return commit({
        flowState: targetState,
        breakReason: event.reason,
        breakResults: targetResults,
      })
    }

    case 'BREAK_RESULTS_ACKED': {
      const alreadyApplied =
        current === 'practicing' &&
        plan.breakReason === null &&
        (plan.breakSelectedGame ?? null) === null &&
        plan.breakResults == null
      if (alreadyApplied) return noChange()

      if (current !== 'break_results') {
        throw new InvalidFlowTransitionError(
          `BREAK_RESULTS_ACKED not allowed from ${current}`,
          current,
          event.type
        )
      }

      return commit({
        flowState: 'practicing',
        breakReason: null,
        breakSelectedGame: null,
        breakResults: null,
      })
    }

    case 'SESSION_COMPLETED': {
      if (current === 'completed') return noChange()
      if (current === 'abandoned') {
        throw new InvalidFlowTransitionError(
          'SESSION_COMPLETED not allowed from abandoned',
          current,
          event.type
        )
      }
      return commit({
        flowState: 'completed',
      })
    }

    case 'SESSION_ABANDONED': {
      if (current === 'abandoned') return noChange()
      if (current === 'completed') {
        throw new InvalidFlowTransitionError(
          'SESSION_ABANDONED not allowed from completed',
          current,
          event.type
        )
      }
      return commit({
        flowState: 'abandoned',
      })
    }
  }
}

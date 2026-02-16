import type { SessionPlan, GameBreakSettings } from '@/db/schema/session-plans'
import {
  generateSessionPlan,
  type EnabledParts,
  type GenerateSessionPlanOptions,
} from '@/lib/curriculum'
import type { ProblemGenerationMode } from '@/lib/curriculum/config'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { createTask } from '../task-manager'
import type { SessionPlanEvent, PlanTimingBreakdown } from './events'

export interface SessionPlanInput {
  playerId: string
  durationMinutes: number
  enabledParts?: EnabledParts
  partTimeWeights?: { abacus: number; visualization: number; linear: number }
  purposeTimeWeights?: { focus: number; reinforce: number; review: number; challenge: number }
  shufflePurposes?: boolean
  problemGenerationMode?: ProblemGenerationMode
  confidenceThreshold?: number
  sessionMode?: SessionMode
  gameBreakSettings?: GameBreakSettings
  comfortAdjustment?: number
  config?: Record<string, unknown>
}

export interface SessionPlanOutput {
  plan: SessionPlan
}

/** Map session plan events to a 0-100 progress percentage */
function calculateProgressPercent(event: SessionPlanEvent): number {
  switch (event.type) {
    case 'plan_loading_data':
      return 5
    case 'plan_analyzing_skills':
      return 15
    case 'plan_structure_ready':
      return 20
    case 'plan_generating_problem': {
      // Scale from 20% to 85% during problem generation
      const ratio = event.total > 0 ? event.current / event.total : 0
      return Math.round(20 + ratio * 65)
    }
    case 'plan_part_complete':
      return 85
    case 'plan_saving':
      return 90
    case 'plan_complete':
      return 100
    default:
      return 0
  }
}

/** Get a human-readable progress message from a session plan event */
function getProgressMessage(event: SessionPlanEvent): string {
  switch (event.type) {
    case 'plan_loading_data':
      return event.message
    case 'plan_analyzing_skills':
      return event.message
    case 'plan_structure_ready':
      return event.message
    case 'plan_generating_problem':
      return `${event.partLabel} problems... ${event.current}/${event.total}`
    case 'plan_part_complete':
      return `${event.partType} complete`
    case 'plan_saving':
      return event.message
    case 'plan_complete':
      return 'Plan ready!'
    default:
      return 'Generating...'
  }
}

/**
 * Start a session plan generation background task.
 *
 * Creates a background task that generates an adaptive session plan
 * with real-time progress updates via Socket.IO.
 *
 * @returns The task ID (subscribe via useBackgroundTask to get progress)
 */
export async function startSessionPlanGeneration(
  input: SessionPlanInput,
  userId?: string
): Promise<string> {
  return createTask<SessionPlanInput, SessionPlanOutput, SessionPlanEvent>(
    'session-plan',
    input,
    async (handle) => {
      handle.setProgress(0, 'Loading student data...')

      const options: GenerateSessionPlanOptions = {
        playerId: input.playerId,
        durationMinutes: input.durationMinutes,
        enabledParts: input.enabledParts,
        shufflePurposes: input.shufflePurposes,
        problemGenerationMode: input.problemGenerationMode,
        confidenceThreshold: input.confidenceThreshold,
        sessionMode: input.sessionMode,
        gameBreakSettings: input.gameBreakSettings,
        comfortAdjustment: input.comfortAdjustment,
        config: input.config as GenerateSessionPlanOptions['config'],
        onProgress: (event) => {
          // Emit domain event for replay
          handle.emit(event as SessionPlanEvent)
          // Update progress bar
          const percent = calculateProgressPercent(event as SessionPlanEvent)
          const message = getProgressMessage(event as SessionPlanEvent)
          handle.setProgress(percent, message)
        },
      }

      const plan = await generateSessionPlan(options)
      handle.complete({ plan })
    },
    userId
  )
}

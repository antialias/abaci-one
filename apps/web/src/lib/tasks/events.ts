/**
 * Typed event definitions for the background task system.
 *
 * Events are split into two categories:
 * - **Lifecycle events**: Managed by task-manager.ts, same for all task types.
 *   These are emitted automatically (started, progress, completed, failed, cancelled).
 * - **Domain events**: Emitted by task handlers, specific to each task type.
 *   These carry task-specific data (parsed results, per-problem progress, etc.).
 *
 * All events use snake_case naming. Domain events are prefixed with the task type
 * to avoid collisions with lifecycle events (e.g., `parse_complete` not `complete`).
 */

// ============================================================================
// Base event interface
// ============================================================================

/**
 * All events must have a `type` field for discrimination.
 * The payload is the rest of the event object.
 */
export interface TaskEventBase {
  type: string
}

// ============================================================================
// Lifecycle events (emitted by task-manager, same for all tasks)
// ============================================================================

/**
 * Lifecycle events are emitted automatically by the task manager.
 * Handlers should NOT emit these — they are managed internally.
 */
export type LifecycleEventType = 'started' | 'progress' | 'completed' | 'failed' | 'cancelled'

// ============================================================================
// Worksheet Parse domain events
// ============================================================================

export type WorksheetParseEvent =
  | {
      type: 'parse_started'
      attachmentId: string
      modelConfigId: string
      useStreaming: boolean
    }
  | { type: 'parse_progress'; stage: string; message: string }
  | {
      type: 'parse_llm_started'
      responseId?: string
      model: string
      provider: string
    }
  | { type: 'reasoning'; text: string }
  | { type: 'output_delta'; text: string }
  | { type: 'reasoning_snapshot'; text: string }
  | { type: 'output_snapshot'; text: string }
  | {
      type: 'parse_complete'
      data: unknown
      stats: unknown
      status: string
    }
  | { type: 'parse_error'; error: string; reasoningText?: string }
  | { type: 'llm_progress'; stage: string; message: string }
  | { type: 'cancelled'; reason: string }

// ============================================================================
// Worksheet Reparse domain events
// ============================================================================

export type WorksheetReparseEvent =
  | {
      type: 'reparse_started'
      attachmentId: string
      problemCount: number
      problemIndices: number[]
    }
  | {
      type: 'problem_start'
      problemIndex: number
      problemNumber: number
      currentIndex: number
      totalProblems: number
    }
  | {
      type: 'reasoning'
      problemIndex: number
      text: string
      summaryIndex?: number
      isDelta?: boolean
    }
  | {
      type: 'output_delta'
      problemIndex: number
      text: string
      outputIndex?: number
    }
  | { type: 'reasoning_snapshot'; problemIndex: number; text: string }
  | { type: 'output_snapshot'; problemIndex: number; text: string }
  | {
      type: 'problem_complete'
      problemIndex: number
      problemNumber: number
      result: unknown
      currentIndex: number
      totalProblems: number
    }
  | {
      type: 'problem_error'
      problemIndex: number
      message: string
      code?: string
    }
  | {
      type: 'reparse_complete'
      reparsedCount: number
      reparsedIndices: number[]
      status: string
    }
  | { type: 'cancelled'; reason: string }

// ============================================================================
// Vision Training domain events (placeholder for Phase 4 migration)
// ============================================================================

export type VisionTrainingEvent =
  | {
      type: 'train_started'
      sessionId: string
      modelType: string
      config: Record<string, unknown>
    }
  | {
      type: 'epoch'
      epoch: number
      totalEpochs: number
      loss: number
      accuracy: number
      valLoss?: number
      valAccuracy?: number
    }
  | { type: 'train_complete'; data: Record<string, unknown> }
  | { type: 'dataset_info'; data: Record<string, unknown> }
  | { type: 'dataset_loaded'; data: Record<string, unknown> }
  | { type: 'log'; message: string; source?: string }
  | { type: 'cancelled'; reason: string }
  /** Catch-all for unrecognized Python subprocess events forwarded as-is */
  | {
      type: 'subprocess_event'
      eventType: string
      data: Record<string, unknown>
    }

// ============================================================================
// Flowchart Embedding domain events
// ============================================================================

export type FlowchartEmbedEvent =
  | {
      type: 'embed_started'
      totalFlowcharts: number
      skippedCount: number
    }
  | {
      type: 'embed_progress'
      currentIndex: number
      totalFlowcharts: number
      flowchartId: string
      flowchartTitle: string
    }
  | {
      type: 'embed_complete'
      embeddedCount: number
      skippedCount: number
      flowcharts: Array<{ id: string; title: string }>
    }
  | {
      type: 'embed_error'
      flowchartId: string
      flowchartTitle: string
      error: string
    }

// ============================================================================
// Flowchart Generate domain events
// ============================================================================

export type FlowchartGenerateEvent =
  | { type: 'generate_started'; sessionId: string; topicDescription: string }
  | { type: 'generate_progress'; stage: string; message: string }
  | { type: 'reasoning'; text: string; isDelta: boolean; summaryIndex?: number }
  | { type: 'output_delta'; text: string; outputIndex?: number }
  | { type: 'reasoning_snapshot'; text: string }
  | { type: 'output_snapshot'; text: string }
  | {
      type: 'generate_validation'
      passed: boolean
      failedCount: number
      totalCount: number
      coveragePercent: number
    }
  | {
      type: 'generate_complete'
      definition: unknown
      mermaidContent: string
      title: string
      description: string
      emoji: string
      difficulty: string
      notes: string[]
      usage?: {
        promptTokens: number
        completionTokens: number
        reasoningTokens?: number
      }
      validationPassed: boolean
      coveragePercent: number
    }
  | { type: 'generate_error'; message: string; code?: string }

// ============================================================================
// Flowchart Refine domain events
// ============================================================================

export type FlowchartRefineEvent =
  | { type: 'refine_started'; sessionId: string; refinementRequest: string }
  | { type: 'refine_progress'; stage: string; message: string }
  | { type: 'reasoning'; text: string; isDelta: boolean; summaryIndex?: number }
  | { type: 'output_delta'; text: string; outputIndex?: number }
  | { type: 'reasoning_snapshot'; text: string }
  | { type: 'output_snapshot'; text: string }
  | {
      type: 'refine_validation'
      passed: boolean
      failedCount: number
      totalCount: number
      coveragePercent: number
    }
  | {
      type: 'refine_complete'
      definition: unknown
      mermaidContent: string
      emoji: string
      changesSummary: string
      notes: string[]
      usage?: {
        promptTokens: number
        completionTokens: number
        reasoningTokens?: number
      }
      validationPassed: boolean
      coveragePercent: number
    }
  | { type: 'refine_error'; message: string; code?: string }

// ============================================================================
// Seed Students domain events
// ============================================================================

export type SeedStudentsEvent =
  | { type: 'seed_started'; profileCount: number; profileNames: string[] }
  | { type: 'student_started'; name: string; index: number; total: number }
  | {
      type: 'student_completed'
      name: string
      playerId: string
      classifications: { weak: number; developing: number; strong: number }
    }
  | { type: 'student_failed'; name: string; error: string }
  | {
      type: 'seed_complete'
      seededCount: number
      failedCount: number
      classroomCode: string
    }

// ============================================================================
// Audio Generate domain events
// ============================================================================

export type AudioGenerateEvent =
  | {
      type: 'audio_started'
      voice: string
      totalClips: number
      missingClips: number
      clipIds?: string[]
    }
  | { type: 'clip_done'; clipId: string }
  | { type: 'clip_error'; clipId: string; error: string }
  | {
      type: 'audio_complete'
      generated: number
      errors: number
      total: number
    }

// ============================================================================
// Collected Clip Generate domain events
// ============================================================================

export type CollectedClipGenerateEvent =
  | {
      type: 'cc_gen_started'
      voice: string
      totalClips: number
      missingClips: number
    }
  | { type: 'cc_clip_done'; clipId: string }
  | { type: 'cc_clip_error'; clipId: string; error: string }
  | {
      type: 'cc_gen_complete'
      generated: number
      errors: number
      total: number
    }

// ============================================================================
// Image Generate domain events
// ============================================================================

export type ImageGenerateEvent =
  | {
      type: 'image_started'
      constantId: string
      style: 'metaphor' | 'math'
      model: string
      provider: string
      theme?: 'light' | 'dark'
    }
  | {
      type: 'image_complete'
      constantId: string
      style: 'metaphor' | 'math'
      filePath: string
      sizeBytes: number
      theme?: 'light' | 'dark'
    }
  | {
      type: 'image_error'
      constantId: string
      style: 'metaphor' | 'math'
      error: string
      theme?: 'light' | 'dark'
    }
  | {
      type: 'batch_progress'
      completed: number
      total: number
      currentConstant: string
      currentStyle: 'metaphor' | 'math'
      theme?: 'light' | 'dark'
    }
  | {
      type: 'batch_complete'
      generated: number
      skipped: number
      failed: number
    }

// ============================================================================
// Phi Explore Generate domain events
// ============================================================================

export type PhiExploreGenerateEvent =
  | {
      type: 'image_started'
      subjectId: string
      model: string
      provider: string
      theme?: 'light' | 'dark'
    }
  | {
      type: 'image_complete'
      subjectId: string
      filePath: string
      sizeBytes: number
      theme?: 'light' | 'dark'
    }
  | {
      type: 'image_error'
      subjectId: string
      error: string
      theme?: 'light' | 'dark'
    }
  | {
      type: 'batch_progress'
      completed: number
      total: number
      currentSubject: string
      theme?: 'light' | 'dark'
    }
  | {
      type: 'batch_complete'
      generated: number
      skipped: number
      failed: number
    }

// ============================================================================
// Blog Image Generate domain events
// ============================================================================

export type BlogImageGenerateEvent =
  | {
      type: 'image_started'
      slug: string
      model: string
      provider: string
    }
  | {
      type: 'image_complete'
      slug: string
      filePath: string
      sizeBytes: number
      usedFallback?: boolean
    }
  | {
      type: 'image_error'
      slug: string
      error: string
    }
  | {
      type: 'image_fallback'
      slug: string
      primaryError: string
      fallbackProvider: string
      fallbackModel: string
    }
  | {
      type: 'batch_progress'
      completed: number
      total: number
      currentSlug: string
    }
  | {
      type: 'batch_complete'
      generated: number
      skipped: number
      failed: number
    }

// ============================================================================
// Demo task events
// ============================================================================

export type DemoTaskEvent = { type: 'log'; step: number; timestamp: string }

// ============================================================================
// Demo Refine task events (Claude Code in-browser refinement)
// ============================================================================

export type DemoRefineEvent =
  | { type: 'session_id'; sessionId: string }
  | { type: 'claude_output'; text: string }
  | { type: 'tool_use'; tool: string; file?: string }
  | { type: 'claude_result'; sessionId: string; success: boolean }
  | { type: 'stderr'; text: string }

// ============================================================================
// Session Plan domain events
// ============================================================================

export interface PlanTimingBreakdown {
  totalMs: number
  loadDataMs: number
  bktMs: number
  parts: Array<{ type: string; totalMs: number; problemCount: number; avgProblemMs: number }>
  saveMs: number
}

export type SessionPlanEvent =
  | { type: 'plan_loading_data'; message: string }
  | { type: 'plan_analyzing_skills'; message: string; skillCount: number }
  | {
      type: 'plan_structure_ready'
      message: string
      parts: Array<{ type: string; problemCount: number }>
    }
  | {
      type: 'plan_generating_problem'
      partType: string
      partLabel: string
      current: number
      total: number
    }
  | { type: 'plan_part_complete'; partType: string; problemCount: number; durationMs: number }
  | { type: 'plan_saving'; message: string }
  | { type: 'plan_complete'; planId: string; timing: PlanTimingBreakdown }

// ============================================================================
// Event type map — maps task type string to its domain event union
// ============================================================================

export interface TaskEventMap {
  'worksheet-parse': WorksheetParseEvent
  'worksheet-reparse': WorksheetReparseEvent
  'vision-training': VisionTrainingEvent
  'flowchart-embed': FlowchartEmbedEvent
  'flowchart-generate': FlowchartGenerateEvent
  'flowchart-refine': FlowchartRefineEvent
  'seed-students': SeedStudentsEvent
  'audio-generate': AudioGenerateEvent
  'collected-clip-generate': CollectedClipGenerateEvent
  'image-generate': ImageGenerateEvent
  'phi-explore-generate': PhiExploreGenerateEvent
  'blog-image-generate': BlogImageGenerateEvent
  demo: DemoTaskEvent
  'demo-refine': DemoRefineEvent
  'session-plan': SessionPlanEvent
}

/**
 * Get the domain event type for a given task type.
 * Falls back to TaskEventBase for unregistered types.
 */
export type DomainEventFor<T extends string> = T extends keyof TaskEventMap
  ? TaskEventMap[T]
  : TaskEventBase

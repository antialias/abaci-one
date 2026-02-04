import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import { db, schema } from '@/db'
import {
  getRefinementSystemPrompt,
  RefinementResultSchema,
  transformLLMDefinitionToInternal,
} from '@/lib/flowchart-workshop/llm-schemas'
import { validateTestCasesWithCoverage } from '@/lib/flowchart-workshop/test-case-validator'
import { llm, type StreamEvent } from '@/lib/llm'
import { createTask } from '../task-manager'
import type { FlowchartRefineEvent } from './events'

type RefinementResult = z.infer<typeof RefinementResultSchema>

/**
 * Input for the flowchart refine task
 */
export interface FlowchartRefineInput {
  sessionId: string
  refinementRequest: string
  userId: string
}

/**
 * Output from the flowchart refine task
 */
export interface FlowchartRefineOutput {
  definition: unknown
  mermaidContent: string
  emoji: string
  changesSummary: string
  notes: string[]
  usage?: { promptTokens: number; completionTokens: number; reasoningTokens?: number }
  validationPassed: boolean
  coveragePercent: number
  versionNumber: number
}

/**
 * Start a flowchart refinement background task.
 *
 * Extracts LLM refinement logic from the legacy SSE route. The task handler:
 * 1. Streams LLM reasoning and output via transient events
 * 2. Updates the workshop session draft
 * 3. Creates a version history entry
 * 4. Runs test-case validation
 */
export async function startFlowchartRefinement(
  input: FlowchartRefineInput
): Promise<string> {
  return createTask<FlowchartRefineInput, FlowchartRefineOutput, FlowchartRefineEvent>(
    'flowchart-refine',
    input,
    async (handle, config) => {
      const { sessionId, refinementRequest, userId } = config

      // Verify session exists and belongs to user
      const session = await db.query.workshopSessions.findFirst({
        where: eq(schema.workshopSessions.id, sessionId),
      })

      if (!session) {
        handle.fail('Session not found')
        return
      }

      if (session.userId !== userId) {
        handle.fail('Not authorized')
        return
      }

      // Check we have a draft to refine
      if (!session.draftDefinitionJson || !session.draftMermaidContent) {
        handle.fail('No draft to refine - generate first')
        return
      }

      // Parse refinement history
      let refinementHistory: string[] = []
      if (session.refinementHistory) {
        try {
          refinementHistory = JSON.parse(session.refinementHistory)
        } catch {
          // Ignore
        }
      }

      // Store task ID on session
      await db
        .update(schema.workshopSessions)
        .set({
          currentTaskId: handle.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.workshopSessions.id, sessionId))

      handle.emit({
        type: 'refine_started',
        sessionId,
        refinementRequest,
      })

      handle.emit({
        type: 'refine_progress',
        stage: 'preparing',
        message: 'Preparing refinement...',
      })

      // Build the prompt
      const systemPrompt = getRefinementSystemPrompt()

      const historyContext =
        refinementHistory.length > 0
          ? `\n\n## Previous Refinements\n${refinementHistory.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
          : ''

      const userPrompt = `Here is the current flowchart to refine:

## Current Definition (JSON)
\`\`\`json
${session.draftDefinitionJson}
\`\`\`

## Current Mermaid Content
\`\`\`mermaid
${session.draftMermaidContent}
\`\`\`

## Current Emoji
${session.draftEmoji || '📊'}

## Topic/Context
${session.topicDescription || 'Not specified'}

${historyContext}

## Refinement Request
${refinementRequest}

Please modify the flowchart according to this request. Return the complete updated definition and mermaid content. If the topic changed significantly and the current emoji no longer fits, provide an updated emoji; otherwise set updatedEmoji to null to keep the current one.`

      const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`

      let llmError: { message: string; code?: string } | null = null
      let finalResult: RefinementResult | null = null
      let usage: {
        promptTokens: number
        completionTokens: number
        reasoningTokens?: number
      } | null = null

      try {
        const llmStream = llm.stream({
          provider: 'openai',
          model: 'gpt-5.2',
          prompt: fullPrompt,
          schema: RefinementResultSchema,
          reasoning: {
            effort: 'medium',
            summary: 'auto',
          },
          timeoutMs: 300_000,
        })

        handle.setProgress(10, 'AI is thinking...')

        // Accumulate streaming text for periodic snapshots (enables page-reload recovery)
        let accumulatedReasoning = ''
        let accumulatedOutput = ''
        let lastSnapshotTime = Date.now()
        const SNAPSHOT_INTERVAL_MS = 3000

        for await (const event of llmStream as AsyncGenerator<
          StreamEvent<RefinementResult>,
          void,
          unknown
        >) {
          if (handle.isCancelled()) {
            console.log(`[flowchart-refine] Task cancelled, breaking LLM loop`)
            break
          }

          switch (event.type) {
            case 'started':
              handle.setProgress(15, 'AI is thinking...')
              break

            case 'reasoning': {
              handle.emitTransient({
                type: 'reasoning',
                text: event.text,
                isDelta: event.isDelta,
                summaryIndex: event.summaryIndex,
              })
              // Accumulate for snapshot
              if (event.isDelta) {
                accumulatedReasoning += event.text
              } else {
                accumulatedReasoning = event.text
              }
              // Periodic snapshot for page-reload recovery
              const now = Date.now()
              if (now - lastSnapshotTime >= SNAPSHOT_INTERVAL_MS) {
                lastSnapshotTime = now
                handle.emit({ type: 'reasoning_snapshot', text: accumulatedReasoning })
              }
              break
            }

            case 'output_delta': {
              handle.setProgress(50, 'Refining flowchart...')
              handle.emitTransient({
                type: 'output_delta',
                text: event.text,
                outputIndex: event.outputIndex,
              })
              // Accumulate for snapshot
              accumulatedOutput += event.text
              const nowOut = Date.now()
              if (nowOut - lastSnapshotTime >= SNAPSHOT_INTERVAL_MS) {
                lastSnapshotTime = nowOut
                handle.emit({ type: 'output_snapshot', text: accumulatedOutput })
              }
              break
            }

            case 'error':
              console.error('[flowchart-refine] LLM error:', event.message, event.code)
              llmError = { message: event.message, code: event.code }
              break

            case 'complete':
              finalResult = event.data
              usage = event.usage
              break
          }
        }
      } catch (error) {
        console.error('[flowchart-refine] Stream processing error:', error)
        llmError = {
          message: error instanceof Error ? error.message : 'Unknown error',
        }
      }

      // Handle cancelled task
      if (handle.isCancelled()) {
        await db
          .update(schema.workshopSessions)
          .set({
            currentTaskId: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, sessionId))
        return
      }

      if (llmError) {
        // Clear task ID but don't change state — keep previous draft
        await db
          .update(schema.workshopSessions)
          .set({
            currentTaskId: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, sessionId))

        handle.emit({
          type: 'refine_error',
          message: llmError.message,
          code: llmError.code,
        })
        handle.fail(llmError.message)
        return
      }

      if (!finalResult) {
        await db
          .update(schema.workshopSessions)
          .set({
            currentTaskId: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, sessionId))

        handle.fail('LLM returned no result')
        return
      }

      // LLM succeeded — validate and save
      handle.setProgress(80, 'Validating changes...')
      handle.emit({
        type: 'refine_progress',
        stage: 'validating',
        message: 'Validating changes...',
      })

      // Transform LLM output (array-based) to internal format (record-based)
      const internalDefinition = transformLLMDefinitionToInternal(finalResult.updatedDefinition)

      // Run test case validation with coverage analysis
      const validationReport = await validateTestCasesWithCoverage(
        internalDefinition,
        finalResult.updatedMermaidContent
      )

      handle.emit({
        type: 'refine_validation',
        passed: validationReport.passed,
        failedCount: validationReport.summary.failed + validationReport.summary.errors,
        totalCount: validationReport.summary.total,
        coveragePercent: validationReport.coverage.coveragePercent,
      })

      // Add to refinement history
      refinementHistory.push(refinementRequest)

      // Determine the emoji (use updated if provided, otherwise keep current)
      const newEmoji = finalResult.updatedEmoji || session.draftEmoji || '📊'

      // Increment version number and save to history
      const currentVersion = session.currentVersionNumber ?? 0
      const newVersion = currentVersion + 1

      await db.insert(schema.flowchartVersionHistory).values({
        sessionId,
        versionNumber: newVersion,
        definitionJson: JSON.stringify(internalDefinition),
        mermaidContent: finalResult.updatedMermaidContent,
        title: session.draftTitle,
        description: session.draftDescription,
        emoji: newEmoji,
        difficulty: session.draftDifficulty,
        notes: JSON.stringify(finalResult.notes),
        source: 'refine',
        sourceRequest: refinementRequest,
        validationPassed: validationReport.passed,
        coveragePercent: validationReport.coverage.coveragePercent,
      })

      // Update session with refined content
      await db
        .update(schema.workshopSessions)
        .set({
          state: 'refining',
          draftDefinitionJson: JSON.stringify(internalDefinition),
          draftMermaidContent: finalResult.updatedMermaidContent,
          draftEmoji: newEmoji,
          draftNotes: JSON.stringify(finalResult.notes),
          refinementHistory: JSON.stringify(refinementHistory),
          currentVersionNumber: newVersion,
          currentTaskId: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.workshopSessions.id, sessionId))

      const output: FlowchartRefineOutput = {
        definition: internalDefinition,
        mermaidContent: finalResult.updatedMermaidContent,
        emoji: newEmoji,
        changesSummary: finalResult.changesSummary,
        notes: finalResult.notes,
        usage: usage ?? undefined,
        validationPassed: validationReport.passed,
        coveragePercent: validationReport.coverage.coveragePercent,
        versionNumber: newVersion,
      }

      handle.emit({
        type: 'refine_complete',
        ...output,
      })

      handle.setProgress(100, 'Flowchart refined!')
      handle.complete(output)
    }
  )
}

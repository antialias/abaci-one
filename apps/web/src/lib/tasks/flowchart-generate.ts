import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import { db, schema } from '@/db'
import {
  GeneratedFlowchartSchema,
  getGenerationSystemPrompt,
  getSubtractionExample,
  transformLLMDefinitionToInternal,
} from '@/lib/flowchart-workshop/llm-schemas'
import { validateTestCasesWithCoverage } from '@/lib/flowchart-workshop/test-case-validator'
import { llm, type StreamEvent } from '@/lib/llm'
import { createTask } from '../task-manager'
import type { FlowchartGenerateEvent } from './events'

type GeneratedFlowchart = z.infer<typeof GeneratedFlowchartSchema>

/**
 * Input for the flowchart generate task
 */
export interface FlowchartGenerateInput {
  sessionId: string
  topicDescription: string
  userId: string
  debug?: boolean
}

/**
 * Output from the flowchart generate task
 */
export interface FlowchartGenerateOutput {
  definition: unknown
  mermaidContent: string
  title: string
  description: string
  emoji: string
  difficulty: string
  notes: string[]
  usage?: { promptTokens: number; completionTokens: number; reasoningTokens?: number }
  validationPassed: boolean
  coveragePercent: number
  versionNumber: number
}

/**
 * Start a flowchart generation background task.
 *
 * Extracts LLM generation logic from the legacy SSE route. The task handler:
 * 1. Streams LLM reasoning and output via transient events (no DB writes per token)
 * 2. Saves the result to the workshop session draft
 * 3. Creates a version history entry
 * 4. Runs test-case validation
 */
export async function startFlowchartGeneration(
  input: FlowchartGenerateInput
): Promise<string> {
  return createTask<FlowchartGenerateInput, FlowchartGenerateOutput, FlowchartGenerateEvent>(
    'flowchart-generate',
    input,
    async (handle, config) => {
      const { sessionId, topicDescription, userId, debug } = config

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

      // Update session state to generating and store task ID
      await db
        .update(schema.workshopSessions)
        .set({
          state: 'generating',
          topicDescription,
          currentTaskId: handle.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.workshopSessions.id, sessionId))

      handle.emit({
        type: 'generate_started',
        sessionId,
        topicDescription,
      })

      handle.emit({
        type: 'generate_progress',
        stage: 'preparing',
        message: 'Preparing flowchart generation...',
      })

      // Build the prompt
      const systemPrompt = getGenerationSystemPrompt()
      const examplePrompt = getSubtractionExample()

      const userPrompt = `Create an interactive math flowchart for teaching the following topic:

**Topic**: ${topicDescription}

Create a complete, working flowchart with:
1. A JSON definition with all nodes, variables, and validation
2. Mermaid content with visual formatting and phases
3. At least one example problem in the problemInput.examples array

The flowchart should be engaging for students, with clear phases, checkpoints for important calculations, and encouraging visual elements.

Return the result as a JSON object matching the GeneratedFlowchartSchema.`

      const fullPrompt = `${systemPrompt}\n\n${examplePrompt}\n\n---\n\n${userPrompt}`

      let llmError: { message: string; code?: string } | null = null
      let finalResult: GeneratedFlowchart | null = null
      let usage: {
        promptTokens: number
        completionTokens: number
        reasoningTokens?: number
      } | null = null

      try {
        if (debug) {
          console.log(`[flowchart-generate] Creating LLM stream`, {
            promptLength: fullPrompt.length,
          })
        }

        const llmStream = llm.stream({
          provider: 'openai',
          model: 'gpt-5.2',
          prompt: fullPrompt,
          schema: GeneratedFlowchartSchema,
          reasoning: {
            effort: 'medium',
            summary: 'auto',
          },
          timeoutMs: 300_000,
          debug: true,
        })

        handle.setProgress(10, 'AI is thinking...')

        for await (const event of llmStream as AsyncGenerator<
          StreamEvent<GeneratedFlowchart>,
          void,
          unknown
        >) {
          if (handle.isCancelled()) {
            console.log(`[flowchart-generate] Task cancelled, breaking LLM loop`)
            break
          }

          switch (event.type) {
            case 'started':
              handle.setProgress(15, 'AI is thinking...')
              break

            case 'reasoning':
              // Transient: no DB write per reasoning delta
              handle.emitTransient({
                type: 'reasoning',
                text: event.text,
                isDelta: event.isDelta,
                summaryIndex: event.summaryIndex,
              })
              break

            case 'output_delta':
              handle.setProgress(50, 'Generating flowchart...')
              // Transient: no DB write per output delta
              handle.emitTransient({
                type: 'output_delta',
                text: event.text,
                outputIndex: event.outputIndex,
              })
              break

            case 'error':
              console.error('[flowchart-generate] LLM error:', event.message, event.code)
              llmError = { message: event.message, code: event.code }
              break

            case 'complete':
              finalResult = event.data
              usage = event.usage
              break
          }
        }
      } catch (error) {
        console.error('[flowchart-generate] Stream processing error:', error)
        llmError = {
          message: error instanceof Error ? error.message : 'Unknown error',
        }
      }

      // Handle cancelled task
      if (handle.isCancelled()) {
        await db
          .update(schema.workshopSessions)
          .set({
            state: session.draftDefinitionJson ? 'refining' : 'initial',
            currentTaskId: null,
            currentReasoningText: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, sessionId))
        return
      }

      if (llmError) {
        // LLM failed — reset session to initial, clear reasoning
        await db
          .update(schema.workshopSessions)
          .set({
            state: 'initial',
            draftNotes: JSON.stringify([`Generation failed: ${llmError.message}`]),
            currentReasoningText: null,
            currentTaskId: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, sessionId))

        handle.emit({
          type: 'generate_error',
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
            state: 'initial',
            currentTaskId: null,
            currentReasoningText: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.workshopSessions.id, sessionId))

        handle.fail('LLM returned no result')
        return
      }

      // LLM succeeded — validate and save
      handle.setProgress(80, 'Validating result...')
      handle.emit({
        type: 'generate_progress',
        stage: 'validating',
        message: 'Validating result...',
      })

      // Transform LLM output (array-based) to internal format (record-based)
      const internalDefinition = transformLLMDefinitionToInternal(finalResult.definition)

      // Run test case validation with coverage analysis
      const validationReport = await validateTestCasesWithCoverage(
        internalDefinition,
        finalResult.mermaidContent
      )

      handle.emit({
        type: 'generate_validation',
        passed: validationReport.passed,
        failedCount: validationReport.summary.failed + validationReport.summary.errors,
        totalCount: validationReport.summary.total,
        coveragePercent: validationReport.coverage.coveragePercent,
      })

      // Increment version number and save to history
      const currentVersion = session.currentVersionNumber ?? 0
      const newVersion = currentVersion + 1

      await db.insert(schema.flowchartVersionHistory).values({
        sessionId,
        versionNumber: newVersion,
        definitionJson: JSON.stringify(internalDefinition),
        mermaidContent: finalResult.mermaidContent,
        title: finalResult.title,
        description: finalResult.description,
        emoji: finalResult.emoji,
        difficulty: finalResult.difficulty,
        notes: JSON.stringify(finalResult.notes),
        source: 'generate',
        sourceRequest: topicDescription,
        validationPassed: validationReport.passed,
        coveragePercent: validationReport.coverage.coveragePercent,
      })

      // Update session with generated content
      await db
        .update(schema.workshopSessions)
        .set({
          state: 'refining',
          draftDefinitionJson: JSON.stringify(internalDefinition),
          draftMermaidContent: finalResult.mermaidContent,
          draftTitle: finalResult.title,
          draftDescription: finalResult.description,
          draftDifficulty: finalResult.difficulty,
          draftEmoji: finalResult.emoji,
          draftNotes: JSON.stringify(finalResult.notes),
          currentReasoningText: null,
          currentTaskId: null,
          currentVersionNumber: newVersion,
          updatedAt: new Date(),
        })
        .where(eq(schema.workshopSessions.id, sessionId))

      const output: FlowchartGenerateOutput = {
        definition: internalDefinition,
        mermaidContent: finalResult.mermaidContent,
        title: finalResult.title,
        description: finalResult.description,
        emoji: finalResult.emoji,
        difficulty: finalResult.difficulty,
        notes: finalResult.notes,
        usage: usage ?? undefined,
        validationPassed: validationReport.passed,
        coveragePercent: validationReport.coverage.coveragePercent,
        versionNumber: newVersion,
      }

      handle.emit({
        type: 'generate_complete',
        ...output,
      })

      handle.setProgress(100, 'Flowchart generated!')
      handle.complete(output)
    }
  )
}

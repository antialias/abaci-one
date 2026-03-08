/**
 * Background task: Post-call LLM cull of marked moments.
 *
 * Reviews all moments from a completed voice session holistically,
 * re-scores them for long-term memorability relative to each other,
 * and generates a brief session summary from the number's perspective.
 */

import { z } from 'zod'
import { createTask, type TaskHandle } from '../task-manager'
import { createTaskLLM } from '../llm'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getTraitSummary } from '@/components/toys/number-line/talkToNumber/generateNumberPersonality'
import type { MomentCullEvent } from './events'

export interface MomentCullInput {
  sessionId: string
  playerId: string
  callerNumber: number
  /** User who triggered this cull — for usage tracking */
  _userId?: string
}

export interface MomentCullOutput {
  sessionId: string
  keptCount: number
  droppedCount: number
  sessionSummary: string
}

const cullSchema = z.object({
  moments: z.array(
    z.object({
      id: z.string(),
      longTermSignificance: z.number().min(1).max(10),
      keep: z.boolean(),
    })
  ),
  sessionSummary: z.string(),
})

type Handler = (
  handle: TaskHandle<MomentCullOutput, MomentCullEvent>,
  input: MomentCullInput
) => Promise<void>

const handler: Handler = async (handle, config) => {
  const { sessionId, playerId, callerNumber } = config

  // Load all moments for this session
  const moments = await db
    .select()
    .from(schema.numberLineMoments)
    .where(eq(schema.numberLineMoments.sessionId, sessionId))

  if (moments.length === 0) {
    // Nothing to cull — mark session as culled and finish
    await db
      .update(schema.numberLineSessions)
      .set({ isCulled: true })
      .where(eq(schema.numberLineSessions.id, sessionId))

    handle.complete({
      sessionId,
      keptCount: 0,
      droppedCount: 0,
      sessionSummary: '',
    })
    return
  }

  handle.emit({ type: 'cull_started', sessionId, momentCount: moments.length })
  handle.setProgress(10, `Reviewing ${moments.length} moments`)

  const personality = getTraitSummary(callerNumber)
  const displayNum = Number.isInteger(callerNumber)
    ? callerNumber.toString()
    : callerNumber.toPrecision(6)

  const momentsList = moments
    .map(
      (m, i) =>
        `${i + 1}. [id: "${m.id}"] "${m.caption}" (category: ${m.category}, agent score: ${m.rawSignificance})${m.transcriptExcerpt ? ` — transcript: "${m.transcriptExcerpt}"` : ''}`
    )
    .join('\n')

  const prompt = [
    `You are reviewing moments from a phone call between a child and the number ${displayNum} on the number line.`,
    ``,
    `The number's personality: ${personality}`,
    ``,
    `Here are ${moments.length} moments the number bookmarked during the call:`,
    momentsList,
    ``,
    `For each moment, assign:`,
    `- "longTermSignificance" (1-10): How worth remembering is this for future calls? Consider: Would this make a good callback in a future conversation? Is it unique or routine? Does it reveal something about the child's personality or interests?`,
    `- "keep" (boolean): Should this moment be stored in long-term memory? Drop routine moments (greetings, filler) and keep meaningful ones.`,
    ``,
    `Also write a "sessionSummary": a 1-2 sentence summary of this call from the number's perspective, as if telling a friend about a nice visit. E.g. "Lily called again and we played Nim — she's getting really good at the modular strategy. She also asked me about perfect numbers which was a fun tangent."`,
    ``,
    `Return the moments array with the same "id" values so we can match them back.`,
  ].join('\n')

  handle.setProgress(20, 'Analyzing moments with LLM...')

  const taskLLM = createTaskLLM(
    handle as TaskHandle<MomentCullOutput, MomentCullEvent>,
    config._userId
      ? { userId: config._userId, feature: 'moment:cull', backgroundTaskId: handle.id }
      : undefined
  )

  let result: z.infer<typeof cullSchema> | undefined

  for await (const event of taskLLM.stream({
    prompt,
    schema: cullSchema,
    provider: 'openai',
    model: 'gpt-4o-mini',
  })) {
    if (event.type === 'complete') {
      result = event.data
    } else if (event.type === 'error') {
      handle.fail(`Cull LLM error: ${event.message}`)
      return
    }
  }

  if (!result) {
    handle.fail('Cull produced no output')
    return
  }

  handle.setProgress(80, 'Applying cull results...')

  // Apply results to each moment
  let keptCount = 0
  let droppedCount = 0

  for (const momentResult of result.moments) {
    const keep = momentResult.keep
    if (keep) keptCount++
    else droppedCount++

    await db
      .update(schema.numberLineMoments)
      .set({
        longTermSignificance: momentResult.longTermSignificance,
        keep,
      })
      .where(eq(schema.numberLineMoments.id, momentResult.id))
  }

  // Mark session as culled with summary
  await db
    .update(schema.numberLineSessions)
    .set({
      isCulled: true,
      sessionSummary: result.sessionSummary,
    })
    .where(eq(schema.numberLineSessions.id, sessionId))

  handle.emit({
    type: 'cull_complete',
    sessionId,
    keptCount,
    droppedCount,
  })

  handle.complete({
    sessionId,
    keptCount,
    droppedCount,
    sessionSummary: result.sessionSummary,
  })
}

export async function startMomentCull(input: MomentCullInput, userId?: string): Promise<string> {
  return createTask<MomentCullInput, MomentCullOutput, MomentCullEvent>(
    'moment-cull',
    input,
    handler,
    userId
  )
}

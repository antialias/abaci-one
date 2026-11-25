/**
 * API route that summarizes the head of a conversation.
 *
 * POST /api/chat/summarize
 * Body: { messages: Array<{ role: string, content: string }>, previousSummary?: string }
 * Returns: { summary: string }
 *
 * Goes through the app's LLM client (default provider: claude_code).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AiFeature } from '@/lib/ai-usage/features'
import { trackedCall } from '@/lib/ai-usage/llm-middleware'
import { withAuth } from '@/lib/auth/withAuth'
import { llm } from '@/lib/llm'

const SummarySchema = z.object({
  summary: z.string().describe('The conversation summary, under 300 words'),
})

const SUMMARIZE_PROMPT = `You are summarizing a conversation between a student and a tutor character.
Produce a concise summary that preserves:
- Key facts established (what was constructed, what was proven, what problems were solved)
- Important questions the student asked and answers given
- Guidance or corrections provided by the tutor
- The student's current level of understanding and any struggles

Compress aggressively:
- Greetings, pleasantries, acknowledgments → omit
- Repeated construction events (tool changes, point movements) → condense to one sentence
- Back-and-forth that reached a conclusion → keep only the conclusion

Write in third person ("The student...", "The tutor..."). Keep the summary under 300 words.`

export const POST = withAuth(async (request, { userId }) => {
  try {
    const body = await request.json()
    const { messages, previousSummary } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
    }

    // Build the conversation text to summarize
    const conversationText = messages
      .map((m: { role: string; content: string }) => {
        const speaker = m.role === 'assistant' ? 'Tutor' : 'Student'
        return `${speaker}: ${m.content}`
      })
      .join('\n')

    let userPrompt: string
    if (previousSummary) {
      userPrompt = `Here is a summary of the earlier part of this conversation:\n---\n${previousSummary}\n---\n\nHere are the new messages to incorporate into an updated summary:\n\n${conversationText}\n\nProduce an updated summary that covers everything — both the earlier summary and the new messages.`
    } else {
      userPrompt = `Summarize the following conversation:\n\n${conversationText}`
    }

    const response = await trackedCall(
      llm,
      { system: SUMMARIZE_PROMPT, prompt: userPrompt, schema: SummarySchema },
      { userId, feature: AiFeature.CHAT_SUMMARIZE }
    )
    const summary = response.data.summary.trim()

    if (!summary) {
      return NextResponse.json({ error: 'No summary generated' }, { status: 502 })
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('[chat/summarize] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

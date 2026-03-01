/**
 * API route that summarizes the head of a conversation using GPT-5.
 *
 * POST /api/chat/summarize
 * Body: { messages: Array<{ role: string, content: string }>, previousSummary?: string }
 * Returns: { summary: string }
 *
 * Uses the OpenAI Responses API in auto mode (no reasoning effort specified).
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'

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

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { messages, previousSummary } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
    }

    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
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

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        input: [
          { role: 'developer', content: [{ type: 'input_text', text: SUMMARIZE_PROMPT }] },
          { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[chat/summarize] API error:', response.status, errText)
      return NextResponse.json(
        { error: 'Summarization failed' },
        { status: 502 }
      )
    }

    const data = await response.json()

    // Extract text from Responses API output
    let summary = ''
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === 'output_text' && part.text) {
              summary = part.text
              break
            }
          }
        }
      }
    }

    if (!summary) {
      return NextResponse.json({ error: 'No summary generated' }, { status: 502 })
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('[chat/summarize] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

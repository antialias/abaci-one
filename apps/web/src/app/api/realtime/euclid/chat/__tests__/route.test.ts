/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const streamText = vi.fn()
const stream = vi.fn()
const recordLlmClientStreamUsage = vi.fn()

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))

vi.mock('@/lib/llm', () => ({
  llm: {
    streamText: (...args: unknown[]) => streamText(...args),
    stream: (...args: unknown[]) => stream(...args),
    getDefaultProvider: () => 'claude_code',
    getDefaultModel: () => 'claude-abaci',
  },
}))

vi.mock('@/lib/ai-usage/helpers', () => ({
  recordLlmClientStreamUsage: (...args: unknown[]) => recordLlmClientStreamUsage(...args),
}))

vi.mock('@/components/toys/euclid/characters/registry', () => ({
  getTeacherConfig: () => ({
    definition: { id: 'euclid', displayName: 'Euclid' },
    chatAssistantPriming: 'I am ready.',
    buildChatSystemPrompt: () => 'SYSTEM',
  }),
}))

vi.mock('@/components/toys/euclid/agent/attitudes', () => ({
  getAttitude: () => undefined,
}))

import { POST } from '../route'

const complete = {
  type: 'complete',
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  rawResponse: '',
  provider: 'claude_code',
  model: 'claude-abaci',
}

function request(body: Record<string, unknown>) {
  return new Request('http://test/api/realtime/euclid/chat', {
    method: 'POST',
    body: JSON.stringify({ propositionId: 1, currentStep: 0, ...body }),
  })
}

async function sseEvents(res: Response): Promise<unknown[]> {
  const text = await res.text()
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => chunk.slice(6))
    .map((data) => (data === '[DONE]' ? data : JSON.parse(data)))
}

const call = (body: Record<string, unknown>) =>
  (POST as unknown as (req: Request, ctx: { userId: string }) => Promise<Response>)(request(body), {
    userId: 'user-1',
  })

describe('POST /api/realtime/euclid/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('streams the reply text as it arrives and records usage', async () => {
    streamText.mockImplementation(async function* () {
      yield { type: 'started', id: 's1' }
      yield { type: 'output_delta', text: 'Behold, ', outputIndex: 0 }
      yield { type: 'output_delta', text: 'the circle.', outputIndex: 0 }
      yield { ...complete, data: { text: 'Behold, the circle.' } }
    })

    const res = await call({
      messages: [{ role: 'user', content: 'What is a circle?' }],
      screenshot: 'data:image/png;base64,AAAA',
    })

    expect(await sseEvents(res)).toEqual([{ text: 'Behold, ' }, { text: 'the circle.' }, '[DONE]'])
    const req = streamText.mock.calls[0][0]
    expect(req.system).toBe('SYSTEM')
    expect(req.images).toEqual(['data:image/png;base64,AAAA'])
    expect(req.prompt).toContain('Euclid: I am ready.')
    expect(req.prompt).toContain('Student: What is a circle?')
    expect(stream).not.toHaveBeenCalled()
    expect(recordLlmClientStreamUsage).toHaveBeenCalledWith(
      complete.usage,
      'claude_code',
      'claude-abaci',
      expect.objectContaining({ userId: 'user-1' })
    )
  })

  it('with tools, sends the reply then each tool call', async () => {
    stream.mockImplementation(async function* () {
      yield { type: 'reasoning', text: 'thinking', summaryIndex: 0, isDelta: true }
      yield {
        ...complete,
        data: {
          reply: 'Let me draw it.',
          toolCalls: [{ name: 'postulate_1', arguments: { from: 'A', to: 'B' } }],
        },
      }
    })

    const res = await call({
      messages: [
        { role: 'user', content: 'Join A and B' },
        {
          role: 'assistant_tool_call',
          content: '',
          toolCallName: 'postulate_1',
          toolCallArgs: '{"from":"B","to":"C"}',
        },
        { role: 'tool', content: 'ok' },
      ],
      tools: [{ type: 'function', name: 'postulate_1', description: 'Join', parameters: {} }],
    })

    const events = await sseEvents(res)
    expect(events[0]).toEqual({ text: 'Let me draw it.' })
    expect(events[1]).toEqual({
      toolCall: {
        callId: expect.stringMatching(/^call_/),
        name: 'postulate_1',
        arguments: { from: 'A', to: 'B' },
      },
    })
    expect(events[2]).toBe('[DONE]')
    const req = stream.mock.calls[0][0]
    expect(req.system).toContain('postulate_1: Join')
    expect(req.prompt).toContain('[Euclid called the tool postulate_1 with {"from":"B","to":"C"}]')
    expect(req.prompt).toContain('[Tool result: ok]')
    expect(streamText).not.toHaveBeenCalled()
  })

  it('reports a failure as an error event', async () => {
    // biome-ignore lint/correctness/useYield: the stream fails before it yields
    streamText.mockImplementation(async function* () {
      throw new Error('claude -p exited with code 1')
    })

    const res = await call({ messages: [{ role: 'user', content: 'Hello' }] })

    expect(await sseEvents(res)).toEqual([
      { error: 'Something went wrong. Try again later.' },
      '[DONE]',
    ])
  })
})

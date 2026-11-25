import { beforeEach, describe, expect, it, vi } from 'vitest'

const { selectRows, retryMock } = vi.hoisted(() => ({
  selectRows: { current: [] as unknown[] },
  retryMock: vi.fn(),
}))

vi.mock('@/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db')>()
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => selectRows.current,
  }
  return { ...actual, db: { select: () => chain } }
})

vi.mock('@/lib/tasks/session-song', () => ({
  retrySessionSongGeneration: retryMock,
}))

import { retryRefusal, retrySessionSong, SONG_TOOLS, summarizeSong } from '../song-tools'

describe('retryRefusal', () => {
  it('allows a failed song that belongs to the student', () => {
    expect(retryRefusal({ playerId: 'p1', status: 'failed' }, 'p1')).toBeNull()
  })

  it("refuses another student's song as not found", () => {
    expect(retryRefusal({ playerId: 'p2', status: 'failed' }, 'p1')).toBe(
      'Song not found for this student'
    )
    expect(retryRefusal(undefined, 'p1')).toBe('Song not found for this student')
  })

  it('refuses songs that are not failed', () => {
    expect(retryRefusal({ playerId: 'p1', status: 'completed' }, 'p1')).toMatch(/completed/)
    expect(retryRefusal({ playerId: 'p1', status: 'generating' }, 'p1')).toMatch(/generating/)
  })
})

describe('retrySessionSong', () => {
  beforeEach(() => {
    retryMock.mockReset()
  })

  it('retries a failed song as the key owner', async () => {
    selectRows.current = [{ playerId: 'p1', status: 'failed' }]
    retryMock.mockResolvedValue({ songId: 's1', taskId: 't1', mode: 'regenerate_prompt' })

    const result = await retrySessionSong('p1', 's1', 'u1')

    expect(retryMock).toHaveBeenCalledWith('s1', { userId: 'u1', reason: 'Retried via MCP' })
    expect(result).toMatchObject({ song_id: 's1', task_id: 't1', mode: 'regenerate_prompt' })
  })

  it("never starts a retry for another student's song", async () => {
    selectRows.current = [{ playerId: 'p2', status: 'failed' }]
    await expect(retrySessionSong('p1', 's1', 'u1')).rejects.toThrow(/not found/)
    expect(retryMock).not.toHaveBeenCalled()
  })

  it('never regenerates a completed song', async () => {
    selectRows.current = [{ playerId: 'p1', status: 'completed' }]
    await expect(retrySessionSong('p1', 's1', 'u1')).rejects.toThrow(/Only failed songs/)
    expect(retryMock).not.toHaveBeenCalled()
  })
})

describe('summarizeSong', () => {
  it('shows the title from the saved lyrics and trims long errors', () => {
    const summary = summarizeSong({
      id: 's1',
      sessionPlanId: 'plan1',
      status: 'failed',
      llmOutput: { title: 'Nine Plus Six', plan: {} },
      failureKind: 'rate_limited',
      errorMessage: 'x'.repeat(1000),
      createdAt: new Date('2026-11-25T00:12:32Z'),
      completedAt: null,
      regenerationCount: 0,
    } as never)

    expect(summary).toMatchObject({
      song_id: 's1',
      session_plan_id: 'plan1',
      title: 'Nine Plus Six',
      failure_kind: 'rate_limited',
      created_at: '2026-11-25T00:12:32.000Z',
      completed_at: null,
    })
    expect(summary.error).toHaveLength(300)
  })
})

describe('SONG_TOOLS', () => {
  it('declares both tools with player_id required', () => {
    expect(SONG_TOOLS.map((t) => t.name)).toEqual(['list_session_songs', 'retry_session_song'])
    for (const tool of SONG_TOOLS) {
      expect(tool.inputSchema.required).toContain('player_id')
    }
  })
})

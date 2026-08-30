// @vitest-environment node

import { readFile } from 'fs/promises'
import { describe, expect, it } from 'vitest'

describe('session song completion doorbells', () => {
  it('rings after the committed completion and ready event in both generation paths', async () => {
    const source = await readFile(new URL('./session-song.ts', import.meta.url), 'utf8')
    const completionPattern = /await setSongStatus\([\s\S]*?'completed',[\s\S]*?await emitSongReady\([^)]*\)\s*void ringKidSongsDoorbell\(\)\s*handle\.complete/g

    expect(source.match(completionPattern)).toHaveLength(2)
  })

  it('detaches both deliveries so they cannot delay or fail task completion', async () => {
    const source = await readFile(new URL('./session-song.ts', import.meta.url), 'utf8')

    expect(source.match(/void ringKidSongsDoorbell\(\)/g)).toHaveLength(2)
    expect(source).not.toMatch(/await ringKidSongsDoorbell\(\)/)
  })
})

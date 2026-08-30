// @vitest-environment node
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { atomicWriteSong } from '../atomicWriteSong'

const dirs: string[] = []
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'atomic-song-'))
  dirs.push(dir)
  return dir
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('atomicWriteSong', () => {
  it('atomically replaces the destination and cleans its temp file', async () => {
    const dir = await tempDir()
    const path = join(dir, 'song.mp3')
    await writeFile(path, 'old')
    await atomicWriteSong(path, Buffer.from('new'))
    expect(await readFile(path, 'utf8')).toBe('new')
    expect(await readdir(dir)).toEqual(['song.mp3'])
  })

  it('leaves old destination bytes and removes temp after a pre-rename write failure', async () => {
    const dir = await tempDir()
    const path = join(dir, 'song.mp3')
    await writeFile(path, 'old')
    const fs = await import('node:fs/promises')
    await expect(
      atomicWriteSong(path, Buffer.from('new'), {
        ...fs,
        open: async (...args) => {
          const handle = await fs.open(...args)
          handle.writeFile = async () => {
            throw new Error('write failed')
          }
          return handle
        },
      })
    ).rejects.toThrow('write failed')
    expect(await readFile(path, 'utf8')).toBe('old')
    expect(await readdir(dir)).toEqual(['song.mp3'])
  })
})

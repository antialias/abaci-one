import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isValidId } from './eligibility'

export const SONGS_DIR = join(process.cwd(), 'data', 'audio', 'songs')

export interface HashedSong {
  bytes: Buffer
  sha256: string
}

export async function readAndHashSong(songId: string): Promise<HashedSong> {
  if (!isValidId(songId)) throw new Error('Invalid song ID')
  // The ID guard is the path-traversal boundary for this ID-derived path.
  const bytes = await readFile(join(SONGS_DIR, `${songId}.mp3`))
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') }
}

/**
 * Builds the small iMessage-playable preview MP4 for a shared song.
 *
 * Produces an H.264 / yuv420p video track from a still cover PNG and an AAC
 * audio track from the song's MP3, joined into a faststart MP4 container —
 * the only format Apple's LinkPresentation will play inline (per TN3156). The
 * resulting file lives at `data/audio/songs/{songId}.mp4`, alongside the MP3
 * and the alignment JSON, and is served public-but-share-code-gated by the
 * `/api/song-share/[code]/preview.mp4` route.
 *
 * Lazy: callers invoke this on a cache miss. The function:
 * - returns immediately if the file already exists (the disk file IS the cache)
 * - serializes concurrent calls for the same songId via an in-process map so
 *   two simultaneous crawler requests don't race to ffmpeg the same file
 * - writes through a tmp path + atomic rename so a torn write (process kill,
 *   ffmpeg crash) never leaves a partial MP4 visible to readers
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { tmpdir } from 'os'
import ffmpeg from 'fluent-ffmpeg'

const SONGS_DIR = join(process.cwd(), 'data', 'audio', 'songs')

export interface BuildPreviewVideoOptions {
  songId: string
  /** PNG bytes for the still cover frame. */
  coverPng: Buffer
}

export interface BuildPreviewVideoResult {
  outputPath: string
  fileSize: number
  /** True if the file was already on disk; false if ffmpeg ran. */
  cached: boolean
}

const inFlight = new Map<string, Promise<BuildPreviewVideoResult>>()

export function previewVideoPath(songId: string): string {
  return join(SONGS_DIR, `${songId}.mp4`)
}

export async function buildPreviewVideo(
  opts: BuildPreviewVideoOptions
): Promise<BuildPreviewVideoResult> {
  const existing = inFlight.get(opts.songId)
  if (existing) return existing
  const promise = doBuild(opts)
  inFlight.set(opts.songId, promise)
  try {
    return await promise
  } finally {
    inFlight.delete(opts.songId)
  }
}

async function doBuild({
  songId,
  coverPng,
}: BuildPreviewVideoOptions): Promise<BuildPreviewVideoResult> {
  const outputPath = previewVideoPath(songId)

  try {
    const stats = await fs.stat(outputPath)
    return { outputPath, fileSize: stats.size, cached: true }
  } catch {
    // missing — fall through to generation
  }

  const mp3Path = join(SONGS_DIR, `${songId}.mp3`)
  await fs.access(mp3Path) // throws ENOENT if the source audio isn't there

  await fs.mkdir(SONGS_DIR, { recursive: true })

  const tmpId = randomBytes(8).toString('hex')
  const coverTmp = join(tmpdir(), `song-preview-cover-${songId}-${tmpId}.png`)
  const outputTmp = join(SONGS_DIR, `.${songId}.${tmpId}.mp4`)

  await fs.writeFile(coverTmp, coverPng)

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(coverTmp)
        .inputOptions(['-loop 1', '-framerate 2'])
        .input(mp3Path)
        .outputOptions([
          '-c:v libx264',
          '-tune stillimage',
          '-preset veryfast',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 128k',
          '-shortest',
          '-movflags +faststart',
        ])
        .output(outputTmp)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    await fs.rename(outputTmp, outputPath)
    const stats = await fs.stat(outputPath)
    return { outputPath, fileSize: stats.size, cached: false }
  } finally {
    await Promise.allSettled([
      fs.unlink(coverTmp),
      // outputTmp is gone after rename — this is the kill-mid-ffmpeg cleanup.
      fs.unlink(outputTmp).catch(() => {}),
    ])
  }
}

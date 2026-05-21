/**
 * End-to-end test for `buildPreviewVideo`.
 *
 * Confirms that the ffmpeg pipeline emits a real H.264 + AAC MP4 — the only
 * shape iMessage's LinkPresentation will play inline. The fixture audio is
 * synthesized at runtime via ffmpeg (`sine=` filter) so the repo doesn't
 * carry a binary MP3; the cover frame is a known-minimal 1×1 PNG.
 *
 * Skipped automatically when ffmpeg/ffprobe aren't on PATH (e.g. lean CI
 * images without ffmpeg), matching `VideoEncoder.isAvailable()`.
 *
 * Note on cwd: `buildPreviewVideo` writes under `process.cwd()/data/audio/songs/`,
 * matching the project convention for the other audio routes. Vitest workers
 * don't allow `process.chdir`, so this test creates its fixture and output
 * inside that real directory under a uuid-suffixed songId, then cleans up.
 */

import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildPreviewVideo, previewVideoPath } from '../buildPreviewVideo'

// Hand-rolled instead of `promisify(execFile)` — vitest's worker pool
// silently returns `undefined` for stdout from promisified execFile in some
// configurations; the callback form works reliably.
function exec(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err)
      else resolve({ stdout: stdout.toString(), stderr: stderr.toString() })
    })
  })
}

async function whichBinary(name: string): Promise<boolean> {
  try {
    await exec('which', [name])
    return true
  } catch {
    return false
  }
}

// h264 + yuv420p needs even dimensions; 1×1 hangs libx264 silently. The
// production cover is 1200×630 (always even) so we don't need a scaler in
// the SUT — the test fixture just needs valid even dimensions to encode.
async function makeCoverPng(path: string): Promise<void> {
  await exec('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=red:size=16x16',
    '-frames:v',
    '1',
    path,
  ])
}

interface FfprobeStream {
  codec_type: 'video' | 'audio'
  codec_name: string
  pix_fmt?: string
}

interface FfprobeOutput {
  streams: FfprobeStream[]
  format: { size: string; duration: string }
}

async function ffprobe(path: string): Promise<FfprobeOutput> {
  const { stdout } = await exec('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_streams',
    '-show_format',
    path,
  ])
  return JSON.parse(stdout) as FfprobeOutput
}

const HAS_FFMPEG_PROMISE = (async () =>
  (await whichBinary('ffmpeg')) && (await whichBinary('ffprobe')))()

describe('buildPreviewVideo', () => {
  let hasFfmpeg = false
  const songId = `test-preview-${randomBytes(6).toString('hex')}`
  const songsDir = join(process.cwd(), 'data', 'audio', 'songs')
  const mp3Path = join(songsDir, `${songId}.mp3`)
  const mp4Path = previewVideoPath(songId)
  let coverPng: Buffer = Buffer.alloc(0)

  beforeAll(async () => {
    hasFfmpeg = await HAS_FFMPEG_PROMISE
    if (!hasFfmpeg) return
    await fs.mkdir(songsDir, { recursive: true })
    await exec('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '64k',
      mp3Path,
    ])
    const coverPath = join(songsDir, `${songId}.cover.png`)
    await makeCoverPng(coverPath)
    coverPng = await fs.readFile(coverPath)
    await fs.unlink(coverPath)
  }, 20_000)

  afterAll(async () => {
    if (!hasFfmpeg) return
    await Promise.allSettled([fs.unlink(mp3Path), fs.unlink(mp4Path)])
  })

  it('produces an H.264 + AAC MP4 alongside the source MP3', async () => {
    if (!hasFfmpeg) {
      console.warn('[buildPreviewVideo.test] ffmpeg/ffprobe not on PATH — skipping')
      return
    }

    const result = await buildPreviewVideo({ songId, coverPng })

    expect(result.cached).toBe(false)
    expect(result.fileSize).toBeGreaterThan(0)
    expect(result.outputPath).toBe(mp4Path)

    const probe = await ffprobe(result.outputPath)
    const video = probe.streams.find((s) => s.codec_type === 'video')
    const audio = probe.streams.find((s) => s.codec_type === 'audio')
    expect(video?.codec_name).toBe('h264')
    expect(video?.pix_fmt).toBe('yuv420p')
    expect(audio?.codec_name).toBe('aac')
  }, 30_000)

  it('returns cached=true on second call without re-running ffmpeg', async () => {
    if (!hasFfmpeg) return
    const second = await buildPreviewVideo({ songId, coverPng })
    expect(second.cached).toBe(true)
  })
})

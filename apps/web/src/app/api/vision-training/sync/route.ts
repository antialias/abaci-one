import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

// Configuration - should match the sync script
const REMOTE_HOST = 'nas.home.network'
const REMOTE_USER = 'antialias'
const REMOTE_PATH = '/volume1/homes/antialias/projects/abaci.one/data/vision-training/collected/'
const LOCAL_PATH = path.join(process.cwd(), 'data/vision-training/collected/')

/**
 * POST /api/vision-training/sync
 * Sync training data from production to local using rsync
 * Returns SSE stream with progress updates
 */
export async function POST() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Ensure local directory exists
        await fs.promises.mkdir(LOCAL_PATH, { recursive: true })

        send('status', { message: 'Connecting to production server...', phase: 'connecting' })

        // Run rsync with progress
        const rsync = spawn('rsync', [
          '-avz',
          '--progress',
          '--stats',
          `${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}`,
          LOCAL_PATH,
        ])

        let currentFile = ''
        let filesTransferred = 0
        let totalBytes = 0

        rsync.stdout.on('data', (data: Buffer) => {
          const output = data.toString()
          const lines = output.split('\n')

          for (const line of lines) {
            // File being transferred (lines that end with file size info)
            const fileMatch = line.match(/^(\d+\/\d+\.png)/)
            if (fileMatch) {
              currentFile = fileMatch[1]
            }

            // Progress line: "  1,234,567 100%   12.34MB/s    0:00:01"
            const progressMatch = line.match(/^\s*([\d,]+)\s+(\d+)%/)
            if (progressMatch) {
              const bytes = parseInt(progressMatch[1].replace(/,/g, ''), 10)
              const percent = parseInt(progressMatch[2], 10)
              totalBytes += bytes

              if (percent === 100) {
                filesTransferred++
              }

              send('progress', {
                currentFile,
                filesTransferred,
                bytesTransferred: totalBytes,
                message: `Syncing: ${currentFile || 'files'}...`,
              })
            }

            // Stats at the end
            const statsMatch = line.match(/Number of regular files transferred:\s*(\d+)/)
            if (statsMatch) {
              filesTransferred = parseInt(statsMatch[1], 10)
            }
          }
        })

        rsync.stderr.on('data', (data: Buffer) => {
          const output = data.toString()
          // Ignore SSH banner/warnings, only report actual errors
          if (output.includes('error') || output.includes('failed')) {
            send('error', { message: output.trim() })
          }
        })

        await new Promise<void>((resolve, reject) => {
          rsync.on('close', (code) => {
            if (code === 0) {
              resolve()
            } else {
              reject(new Error(`rsync exited with code ${code}`))
            }
          })
          rsync.on('error', reject)
        })

        // Count final stats
        const stats = await countLocalImages()

        send('complete', {
          filesTransferred,
          ...stats,
        })
      } catch (error) {
        send('error', {
          message: error instanceof Error ? error.message : 'Sync failed',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

/**
 * GET /api/vision-training/sync
 * Check if sync is available (SSH connectivity)
 */
export async function GET() {
  try {
    // Quick check if we can reach the remote host
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)

    // Test SSH connection with timeout
    await execAsync(
      `ssh -o ConnectTimeout=3 -o BatchMode=yes ${REMOTE_USER}@${REMOTE_HOST} "echo ok"`,
      {
        timeout: 5000,
      }
    )

    // Get remote stats
    const { stdout } = await execAsync(
      `ssh ${REMOTE_USER}@${REMOTE_HOST} "find '${REMOTE_PATH}' -name '*.png' 2>/dev/null | wc -l"`,
      { timeout: 10000 }
    )
    const remoteCount = parseInt(stdout.trim(), 10) || 0

    // Get local stats
    const localStats = await countLocalImages()

    return Response.json({
      available: true,
      remote: {
        host: REMOTE_HOST,
        totalImages: remoteCount,
      },
      local: localStats,
      needsSync: remoteCount > localStats.totalImages,
    })
  } catch {
    return Response.json({
      available: false,
      error: 'Cannot connect to production server',
      local: await countLocalImages(),
    })
  }
}

async function countLocalImages(): Promise<{
  totalImages: number
  digitCounts: Record<number, number>
}> {
  const digitCounts: Record<number, number> = {}
  let totalImages = 0

  for (let digit = 0; digit <= 9; digit++) {
    const digitPath = path.join(LOCAL_PATH, String(digit))
    try {
      const files = await fs.promises.readdir(digitPath)
      const pngCount = files.filter((f) => f.endsWith('.png')).length
      digitCounts[digit] = pngCount
      totalImages += pngCount
    } catch {
      digitCounts[digit] = 0
    }
  }

  return { totalImages, digitCounts }
}

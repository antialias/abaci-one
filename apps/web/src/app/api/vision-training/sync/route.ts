import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

// Force dynamic rendering - this route reads from disk and runs rsync
export const dynamic = 'force-dynamic'

// Configuration - should match the sync script
const REMOTE_HOST = 'nas.home.network'
const REMOTE_USER = 'antialias'
const REMOTE_PATH = '/volume1/homes/antialias/projects/abaci.one/data/vision-training/collected/'
const LOCAL_PATH = path.join(process.cwd(), 'data/vision-training/collected/')

/**
 * File that tracks intentionally deleted images (to prevent re-syncing)
 */
const DELETED_FILE = path.join(LOCAL_PATH, '.deleted')

/**
 * Read the list of intentionally deleted files
 */
async function readDeletedFiles(): Promise<Set<string>> {
  try {
    const content = await fs.promises.readFile(DELETED_FILE, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())
    return new Set(lines)
  } catch {
    // File doesn't exist yet - no deletions recorded
    return new Set()
  }
}

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

        // Read deleted files to exclude from sync
        const deletedFiles = await readDeletedFiles()
        const excludeArgs: string[] = []

        // Add each deleted file as an exclude pattern
        for (const file of deletedFiles) {
          excludeArgs.push('--exclude', file)
        }

        if (deletedFiles.size > 0) {
          send('status', {
            message: `Excluding ${deletedFiles.size} previously deleted files...`,
            phase: 'connecting',
          })
        }

        // Run rsync with progress
        const rsync = spawn('rsync', [
          '-avz',
          '--progress',
          '--stats',
          ...excludeArgs,
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
 * Check if sync is available (SSH connectivity) and what files would be synced
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

    // Get list of remote files (just filenames, not full paths)
    const { stdout: remoteFilesOutput } = await execAsync(
      `ssh ${REMOTE_USER}@${REMOTE_HOST} "find '${REMOTE_PATH}' -name '*.png' -printf '%P\\n' 2>/dev/null"`,
      { timeout: 15000 }
    )
    const remoteFiles = new Set(remoteFilesOutput.trim().split('\n').filter(Boolean))
    const remoteCount = remoteFiles.size

    // Get local files and deleted files
    const localStats = await countLocalImages()
    const localFiles = await listLocalFiles()
    const deletedFiles = await readDeletedFiles()

    // Find files that exist on remote but not locally (excluding intentionally deleted)
    const newOnRemote: string[] = []
    const excludedByDeletion: string[] = []
    for (const file of remoteFiles) {
      if (!localFiles.has(file)) {
        if (deletedFiles.has(file)) {
          excludedByDeletion.push(file)
        } else {
          newOnRemote.push(file)
        }
      }
    }

    // Find files that exist locally but not on remote
    const newOnLocal: string[] = []
    for (const file of localFiles) {
      if (!remoteFiles.has(file)) {
        newOnLocal.push(file)
      }
    }

    return Response.json({
      available: true,
      remote: {
        host: REMOTE_HOST,
        totalImages: remoteCount,
      },
      local: localStats,
      // Smart sync detection: there are files on remote that we don't have locally
      needsSync: newOnRemote.length > 0,
      newOnRemote: newOnRemote.length,
      newOnLocal: newOnLocal.length,
      // Files that would sync but are in our deleted list
      excludedByDeletion: excludedByDeletion.length,
    })
  } catch (error) {
    console.error('[vision-training/sync] Error:', error)
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

async function listLocalFiles(): Promise<Set<string>> {
  const files = new Set<string>()

  for (let digit = 0; digit <= 9; digit++) {
    const digitPath = path.join(LOCAL_PATH, String(digit))
    try {
      const dirFiles = await fs.promises.readdir(digitPath)
      for (const file of dirFiles) {
        if (file.endsWith('.png')) {
          // Use relative path format: digit/filename.png
          files.add(`${digit}/${file}`)
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return files
}

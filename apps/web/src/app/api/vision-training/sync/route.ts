import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { NextRequest } from 'next/server'

// Force dynamic rendering - this route reads from disk and runs rsync
export const dynamic = 'force-dynamic'

// Configuration
const REMOTE_HOST = 'nas.home.network'
const REMOTE_USER = 'antialias'

// Paths for each model type
type ModelType = 'column-classifier' | 'boundary-detector'

const MODEL_PATHS: Record<ModelType, { remote: string; local: string }> = {
  'column-classifier': {
    remote: '/volume1/homes/antialias/projects/abaci.one/data/vision-training/collected/',
    local: path.join(process.cwd(), 'data/vision-training/collected/'),
  },
  'boundary-detector': {
    remote: '/volume1/homes/antialias/projects/abaci.one/data/vision-training/boundary-frames/',
    local: path.join(process.cwd(), 'data/vision-training/boundary-frames/'),
  },
}

/**
 * Get the model type from request query params (defaults to column-classifier for backwards compatibility)
 */
function getModelType(request: NextRequest): ModelType {
  const modelType = request.nextUrl.searchParams.get('modelType')
  if (modelType === 'boundary-detector') return 'boundary-detector'
  return 'column-classifier'
}

/**
 * Get the deleted files path for a model type
 */
function getDeletedFilePath(modelType: ModelType): string {
  return path.join(MODEL_PATHS[modelType].local, '.deleted')
}

/**
 * Read the list of intentionally deleted files for a model type
 */
async function readDeletedFiles(modelType: ModelType): Promise<Set<string>> {
  try {
    const deletedFile = getDeletedFilePath(modelType)
    const content = await fs.promises.readFile(deletedFile, 'utf-8')
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
 *
 * Query params:
 * - modelType: 'column-classifier' | 'boundary-detector' (default: column-classifier)
 */
export async function POST(request: NextRequest) {
  const modelType = getModelType(request)
  const paths = MODEL_PATHS[modelType]
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Ensure local directory exists
        await fs.promises.mkdir(paths.local, { recursive: true })

        send('status', {
          message: 'Connecting to production server...',
          phase: 'connecting',
        })

        // Read deleted files to exclude from sync
        const deletedFiles = await readDeletedFiles(modelType)
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
          `${REMOTE_USER}@${REMOTE_HOST}:${paths.remote}`,
          paths.local,
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
        const stats = await countLocalData(modelType)

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
 *
 * Query params:
 * - modelType: 'column-classifier' | 'boundary-detector' (default: column-classifier)
 */
export async function GET(request: NextRequest) {
  const modelType = getModelType(request)
  const paths = MODEL_PATHS[modelType]

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
    // For both model types, we only count PNG files (boundary detector has PNG+JSON pairs)
    const { stdout: remoteFilesOutput } = await execAsync(
      `ssh ${REMOTE_USER}@${REMOTE_HOST} "find '${paths.remote}' -name '*.png' -printf '%P\\n' 2>/dev/null"`,
      { timeout: 15000 }
    )
    const remoteFiles = new Set(remoteFilesOutput.trim().split('\n').filter(Boolean))
    const remoteCount = remoteFiles.size

    // Get local files and deleted files
    const localStats = await countLocalData(modelType)
    const localFiles = await listLocalFiles(modelType)
    const deletedFiles = await readDeletedFiles(modelType)

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

    // Use appropriate terminology based on model type
    const itemName = modelType === 'boundary-detector' ? 'frames' : 'images'

    return Response.json({
      available: true,
      modelType,
      remote: {
        host: REMOTE_HOST,
        totalImages: remoteCount, // Keep as totalImages for backwards compatibility
        totalFrames: modelType === 'boundary-detector' ? remoteCount : undefined,
      },
      local: localStats,
      // Smart sync detection: there are files on remote that we don't have locally
      needsSync: newOnRemote.length > 0,
      newOnRemote: newOnRemote.length,
      newOnLocal: newOnLocal.length,
      // Files that would sync but are in our deleted list
      excludedByDeletion: excludedByDeletion.length,
      itemName, // 'frames' or 'images'
    })
  } catch (error) {
    console.error('[vision-training/sync] Error:', error)
    return Response.json({
      available: false,
      modelType,
      error: 'Cannot connect to production server',
      local: await countLocalData(modelType),
    })
  }
}

/**
 * Count local data for a model type
 * - Column classifier: counts images per digit subdirectory
 * - Boundary detector: counts PNG files (frames) in device subdirectories
 */
async function countLocalData(modelType: ModelType): Promise<{
  totalImages: number
  totalFrames?: number
  digitCounts?: Record<number, number>
  deviceCount?: number
}> {
  const localPath = MODEL_PATHS[modelType].local

  if (modelType === 'column-classifier') {
    // Count images per digit (0-9)
    const digitCounts: Record<number, number> = {}
    let totalImages = 0

    for (let digit = 0; digit <= 9; digit++) {
      const digitPath = path.join(localPath, String(digit))
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
  } else {
    // Boundary detector: count PNG files in device subdirectories
    let totalFrames = 0
    let deviceCount = 0

    try {
      const entries = await fs.promises.readdir(localPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          deviceCount++
          const devicePath = path.join(localPath, entry.name)
          const files = await fs.promises.readdir(devicePath)
          const pngCount = files.filter((f) => f.endsWith('.png')).length
          totalFrames += pngCount
        }
      }
    } catch {
      // Directory doesn't exist yet
    }

    return { totalImages: totalFrames, totalFrames, deviceCount }
  }
}

/**
 * List local PNG files for a model type (relative paths)
 * - Column classifier: digit/filename.png format
 * - Boundary detector: deviceId/filename.png format
 */
async function listLocalFiles(modelType: ModelType): Promise<Set<string>> {
  const files = new Set<string>()
  const localPath = MODEL_PATHS[modelType].local

  if (modelType === 'column-classifier') {
    // Column classifier: iterate through digit subdirectories (0-9)
    for (let digit = 0; digit <= 9; digit++) {
      const digitPath = path.join(localPath, String(digit))
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
  } else {
    // Boundary detector: iterate through device subdirectories
    try {
      const entries = await fs.promises.readdir(localPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const devicePath = path.join(localPath, entry.name)
          const dirFiles = await fs.promises.readdir(devicePath)
          for (const file of dirFiles) {
            if (file.endsWith('.png')) {
              // Use relative path format: deviceId/filename.png
              files.add(`${entry.name}/${file}`)
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return files
}

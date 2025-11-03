import { exec } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Job {
  id: string
  status: JobStatus
  params: AbacusParams
  error?: string
  outputPath?: string
  createdAt: Date
  completedAt?: Date
  progress?: string
}

export interface AbacusParams {
  columns: number // Number of columns (1-13)
  scaleFactor: number // Overall size multiplier
  widthMm?: number // Optional: desired width in mm (overrides scaleFactor)
  format: 'stl' | '3mf' | 'scad'
  // 3MF color options
  frameColor?: string
  heavenBeadColor?: string
  earthBeadColor?: string
  decorationColor?: string
}

// In-memory job storage (can be upgraded to Redis later)
const jobs = new Map<string, Job>()

// Temporary directory for generated files
const TEMP_DIR = join(process.cwd(), 'tmp', '3d-jobs')

export class JobManager {
  static generateJobId(): string {
    return randomBytes(16).toString('hex')
  }

  static async createJob(params: AbacusParams): Promise<string> {
    const jobId = JobManager.generateJobId()
    const job: Job = {
      id: jobId,
      status: 'pending',
      params,
      createdAt: new Date(),
    }

    jobs.set(jobId, job)

    // Start processing in background
    JobManager.processJob(jobId).catch((error) => {
      console.error(`Job ${jobId} failed:`, error)
      const job = jobs.get(jobId)
      if (job) {
        job.status = 'failed'
        job.error = error.message
        job.completedAt = new Date()
      }
    })

    return jobId
  }

  static getJob(jobId: string): Job | undefined {
    return jobs.get(jobId)
  }

  static async processJob(jobId: string): Promise<void> {
    const job = jobs.get(jobId)
    if (!job) throw new Error('Job not found')

    job.status = 'processing'
    job.progress = 'Preparing workspace...'

    // Create temp directory
    await mkdir(TEMP_DIR, { recursive: true })

    const outputFileName = `abacus-${jobId}.${job.params.format}`
    const outputPath = join(TEMP_DIR, outputFileName)

    try {
      // Build OpenSCAD command
      const scadPath = join(process.cwd(), 'public', '3d-models', 'abacus.scad')
      const stlPath = join(process.cwd(), 'public', '3d-models', 'simplified.abacus.stl')

      // If format is 'scad', just copy the file with custom parameters
      if (job.params.format === 'scad') {
        job.progress = 'Generating OpenSCAD file...'
        const scadContent = await readFile(scadPath, 'utf-8')
        const customizedScad = scadContent
          .replace(/columns = \d+\.?\d*/, `columns = ${job.params.columns}`)
          .replace(/scale_factor = \d+\.?\d*/, `scale_factor = ${job.params.scaleFactor}`)

        await writeFile(outputPath, customizedScad)
        job.outputPath = outputPath
        job.status = 'completed'
        job.completedAt = new Date()
        job.progress = 'Complete!'
        return
      }

      job.progress = 'Rendering 3D model...'

      // Build command with parameters
      const cmd = [
        'openscad',
        '-o',
        outputPath,
        '-D',
        `'columns=${job.params.columns}'`,
        '-D',
        `'scale_factor=${job.params.scaleFactor}'`,
        scadPath,
      ].join(' ')

      console.log(`Executing: ${cmd}`)

      // Execute OpenSCAD (with 60s timeout)
      // Note: OpenSCAD may exit with non-zero status due to CGAL warnings
      // but still produce valid output. We'll check file existence afterward.
      try {
        await execAsync(cmd, {
          timeout: 60000,
          cwd: join(process.cwd(), 'public', '3d-models'),
        })
      } catch (execError) {
        // Log the error but don't throw yet - check if output was created
        console.warn(`OpenSCAD reported errors, but checking if output was created:`, execError)

        // Check if output file exists despite the error
        try {
          await readFile(outputPath)
          console.log(`Output file created despite OpenSCAD warnings - proceeding`)
        } catch (readError) {
          // File doesn't exist, this is a real failure
          console.error(`OpenSCAD execution failed and no output file created:`, execError)
          if (execError instanceof Error) {
            throw new Error(`OpenSCAD error: ${execError.message}`)
          }
          throw execError
        }
      }

      job.progress = 'Finalizing...'

      // Verify output exists and check file size
      const fileBuffer = await readFile(outputPath)
      const fileSizeMB = fileBuffer.length / (1024 * 1024)

      // Maximum file size: 100MB (to prevent memory issues)
      const MAX_FILE_SIZE_MB = 100
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        throw new Error(
          `Generated file is too large (${fileSizeMB.toFixed(1)}MB). Maximum allowed is ${MAX_FILE_SIZE_MB}MB. Try reducing scale parameters.`
        )
      }

      console.log(`Generated STL file size: ${fileSizeMB.toFixed(2)}MB`)

      job.outputPath = outputPath
      job.status = 'completed'
      job.completedAt = new Date()
      job.progress = 'Complete!'

      console.log(`Job ${jobId} completed successfully`)
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error)
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error occurred'
      job.completedAt = new Date()
      throw error
    }
  }

  static async getJobOutput(jobId: string): Promise<Buffer> {
    const job = jobs.get(jobId)
    if (!job) throw new Error('Job not found')
    if (job.status !== 'completed') throw new Error(`Job is ${job.status}, not completed`)
    if (!job.outputPath) throw new Error('Output path not set')

    return await readFile(job.outputPath)
  }

  static async cleanupJob(jobId: string): Promise<void> {
    const job = jobs.get(jobId)
    if (!job) return

    if (job.outputPath) {
      try {
        await rm(job.outputPath)
      } catch (error) {
        console.error(`Failed to cleanup job ${jobId}:`, error)
      }
    }

    jobs.delete(jobId)
  }

  // Cleanup old jobs (should be called periodically)
  static async cleanupOldJobs(maxAgeMs = 3600000): Promise<void> {
    const now = Date.now()
    for (const [jobId, job] of jobs.entries()) {
      const age = now - job.createdAt.getTime()
      if (age > maxAgeMs) {
        await JobManager.cleanupJob(jobId)
      }
    }
  }
}

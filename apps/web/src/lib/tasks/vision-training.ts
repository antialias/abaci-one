import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promises as fsPromises } from 'fs'
import { createId } from '@paralleldrive/cuid2'
import { db } from '@/db'
import { visionTrainingSessions } from '@/db/schema/vision-training-sessions'
import { eq, and } from 'drizzle-orm'
import { createTask, type TaskHandle } from '../task-manager'
import type { VisionTrainingEvent } from './events'
import {
  ensureVenvReady,
  isPlatformSupported,
  PYTHON_ENV,
  TRAINING_PYTHON,
} from '@/app/api/vision-training/config'

/**
 * Training configuration options
 */
export interface VisionTrainingInput {
  modelType: 'column-classifier' | 'boundary-detector'
  epochs?: number
  batchSize?: number
  validationSplit?: number
  noAugmentation?: boolean
  colorAugmentation?: boolean
  manifestId?: string
}

/**
 * Training output
 */
export interface VisionTrainingOutput {
  sessionId: string
  modelType: string
  modelPath: string
  metrics: {
    finalAccuracy?: number
    finalValAccuracy?: number
    finalLoss?: number
    finalValLoss?: number
  }
  trainingDurationSeconds: number | null
  epochCount: number
}

/**
 * Model-specific configuration
 */
const MODEL_CONFIG = {
  'column-classifier': {
    script: 'scripts/train-column-classifier/train_model.py',
    dataDir: './data/vision-training/collected',
    modelsDir: './data/vision-training/models/column-classifier',
  },
  'boundary-detector': {
    script: 'scripts/train-boundary-detector/train_model.py',
    dataDir: './data/vision-training/boundary-frames',
    modelsDir: './data/vision-training/models/boundary-detector',
  },
} as const

const MANIFESTS_DIR = path.join(process.cwd(), 'data/vision-training/manifests')

const MODEL_TYPE_TO_PUBLIC_DIR: Record<string, string> = {
  'column-classifier': 'abacus-column-classifier',
  'boundary-detector': 'abacus-boundary-detector',
}

// Track active training processes by task ID (for cancellation)
const activeProcesses = new Map<string, { process: ChildProcess; stopFilePath: string }>()

/**
 * Copy model files to public/models/
 */
async function copyModelToPublic(
  modelPath: string,
  modelType: 'column-classifier' | 'boundary-detector'
): Promise<void> {
  const sourceDir = path.join(process.cwd(), 'data/vision-training/models', modelPath)
  const targetDir = path.join(process.cwd(), 'public/models', MODEL_TYPE_TO_PUBLIC_DIR[modelType])

  await fsPromises.mkdir(targetDir, { recursive: true })

  const files = await fsPromises.readdir(sourceDir)
  for (const file of files) {
    const sourceFilePath = path.join(sourceDir, file)
    const targetPath = path.join(targetDir, file)
    const stat = await fsPromises.stat(sourceFilePath)
    if (stat.isFile()) {
      await fsPromises.copyFile(sourceFilePath, targetPath)
      console.log(`[VisionTraining] Copied ${file} to ${targetDir}`)
    }
  }
}

/**
 * Save training session to database
 */
async function saveTrainingSession(
  sessionId: string,
  modelType: 'column-classifier' | 'boundary-detector',
  config: Record<string, unknown>,
  datasetInfo: Record<string, unknown>,
  epochHistory: Array<Record<string, unknown>>,
  completeData: Record<string, unknown>
): Promise<void> {
  const modelPath = `${modelType}/${sessionId}`
  const displayName = `${modelType === 'column-classifier' ? 'Column Classifier' : 'Boundary Detector'} - ${new Date().toLocaleDateString()}`

  // Deactivate any existing active model for this type
  await db
    .update(visionTrainingSessions)
    .set({ isActive: false })
    .where(
      and(
        eq(visionTrainingSessions.modelType, modelType),
        eq(visionTrainingSessions.isActive, true)
      )
    )

  // Copy model files to public directory
  await copyModelToPublic(modelPath, modelType)

  // Create the new session
  await db.insert(visionTrainingSessions).values({
    modelType,
    displayName,
    config: config as any,
    datasetInfo: datasetInfo as any,
    result: completeData as any,
    epochHistory: epochHistory as any,
    modelPath,
    isActive: true,
    notes: null,
    tags: [],
    trainedAt: new Date(),
  })

  console.log('[VisionTraining] Session saved to database:', sessionId)
}

/**
 * Start a vision training task
 *
 * @returns Task ID that can be used to track progress
 */
export async function startVisionTraining(input: VisionTrainingInput): Promise<string> {
  // Check platform support
  const platformCheck = isPlatformSupported()
  if (!platformCheck.supported) {
    throw new Error(`Platform not supported: ${platformCheck.reason}`)
  }

  // Ensure venv is ready
  const setup = await ensureVenvReady()
  if (!setup.success) {
    throw new Error(`Python environment setup failed: ${setup.error}`)
  }

  const modelType = input.modelType || 'column-classifier'
  const modelConfig = MODEL_CONFIG[modelType]

  // Check if script exists for boundary detector
  if (modelType === 'boundary-detector') {
    const scriptPath = path.join(process.cwd(), modelConfig.script)
    if (!fs.existsSync(scriptPath)) {
      throw new Error('Boundary detector training not yet implemented')
    }
  }

  // Check manifest if provided
  if (input.manifestId) {
    const manifestPath = path.join(MANIFESTS_DIR, `${input.manifestId}.json`)
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest ${input.manifestId} not found`)
    }
  }

  return createTask<VisionTrainingInput, VisionTrainingOutput, VisionTrainingEvent>(
    'vision-training',
    input,
    async (handle, config) => {
      const sessionId = createId()
      const sessionOutputDir = path.join(modelConfig.modelsDir, sessionId)
      const cwd = path.resolve(process.cwd())
      const stopFilePath = path.join(cwd, 'data', 'vision-training', `.stop-${sessionId}`)

      // Build command arguments
      const args = [
        modelConfig.script,
        '--json-progress',
        '--data-dir',
        modelConfig.dataDir,
        '--output-dir',
        sessionOutputDir,
        '--session-id',
        sessionId,
        '--stop-file',
        stopFilePath,
      ]

      if (config.epochs) args.push('--epochs', String(config.epochs))
      if (config.batchSize) args.push('--batch-size', String(config.batchSize))
      if (config.validationSplit) args.push('--validation-split', String(config.validationSplit))
      if (config.noAugmentation) args.push('--no-augmentation')
      if (config.colorAugmentation) args.push('--color-augmentation')
      if (config.manifestId) {
        args.push('--manifest-file', path.join(MANIFESTS_DIR, `${config.manifestId}.json`))
      }

      // Emit initial event
      handle.emit({
        type: 'train_started',
        sessionId,
        modelType,
        config: {
          epochs: config.epochs ?? 50,
          batchSize: config.batchSize ?? 32,
          validationSplit: config.validationSplit ?? 0.2,
          augmentation: !config.noAugmentation,
          colorAugmentation: config.colorAugmentation ?? false,
        },
      })

      // Track session data
      let datasetInfo: Record<string, unknown> | null = null
      const epochHistory: Array<Record<string, unknown>> = []
      let completeData: Record<string, unknown> | null = null
      let hardware: Record<string, unknown> | null = null
      let environment: Record<string, unknown> | null = null

      return new Promise<void>((resolve, reject) => {
        // Spawn Python process
        const proc = spawn(TRAINING_PYTHON, args, { cwd, env: PYTHON_ENV })

        // Track for cancellation
        activeProcesses.set(handle.id, { process: proc, stopFilePath })

        // Handle stdout (JSON progress events)
        proc.stdout?.on('data', (data: Buffer) => {
          // Check for cancellation
          if (handle.isCancelled()) {
            proc.kill('SIGTERM')
            return
          }

          const lines = data.toString().split('\n').filter(Boolean)
          for (const line of lines) {
            try {
              const event = JSON.parse(line)
              const eventType = event.event || 'progress'

              // Emit typed events for known Python event types,
              // use subprocess_event catch-all for unknown ones
              switch (eventType) {
                case 'training_started':
                  hardware = event.hardware || null
                  environment = event.environment || null
                  // Already emitted train_started above; skip duplicate
                  break
                case 'dataset_loaded':
                  datasetInfo = { type: modelType, ...event }
                  handle.emit({ type: 'dataset_loaded', data: event })
                  break
                case 'dataset_info':
                  datasetInfo = { type: modelType, ...event }
                  handle.emit({ type: 'dataset_info', data: event })
                  break
                case 'epoch': {
                  epochHistory.push(event)
                  const totalEpochs = config.epochs ?? 50
                  const currentEpoch = event.epoch || epochHistory.length
                  const progress = Math.round((currentEpoch / totalEpochs) * 100)
                  handle.setProgress(progress, `Epoch ${currentEpoch}/${totalEpochs}`)
                  handle.emit({
                    type: 'epoch',
                    epoch: currentEpoch,
                    totalEpochs,
                    loss: event.loss ?? 0,
                    accuracy: event.accuracy ?? 0,
                    valLoss: event.val_loss,
                    valAccuracy: event.val_accuracy,
                  })
                  break
                }
                case 'complete':
                  completeData = { type: modelType, ...event }
                  if (event.epoch_history && Array.isArray(event.epoch_history)) {
                    epochHistory.length = 0
                    epochHistory.push(...event.epoch_history)
                  }
                  if (!hardware && event.hardware) hardware = event.hardware
                  if (!environment && event.environment) environment = event.environment
                  handle.emit({ type: 'train_complete', data: event })
                  break
                default:
                  // Forward unknown Python events via catch-all
                  handle.emit({ type: 'subprocess_event', eventType, data: event })
                  break
              }
            } catch {
              // Non-JSON output, emit as log
              handle.emit({ type: 'log', message: line })
            }
          }
        })

        // Handle stderr
        proc.stderr?.on('data', (data: Buffer) => {
          const message = data.toString().trim()
          if (
            message &&
            !message.includes('successful NUMA node') &&
            !message.includes('StreamExecutor')
          ) {
            handle.emit({ type: 'log', message, source: 'stderr' })
          }
        })

        // Handle process exit
        proc.on('close', async (code) => {
          activeProcesses.delete(handle.id)

          // Clean up stop file
          try {
            if (fs.existsSync(stopFilePath)) {
              fs.unlinkSync(stopFilePath)
            }
          } catch {
            // Ignore cleanup errors
          }

          if (code === 0 && completeData && datasetInfo) {
            try {
              // Save to database
              await saveTrainingSession(
                sessionId,
                modelType,
                {
                  epochs: config.epochs ?? 50,
                  batchSize: config.batchSize ?? 32,
                  validationSplit: config.validationSplit ?? 0.2,
                  colorAugmentation: config.colorAugmentation ?? false,
                  hardware,
                  environment,
                },
                datasetInfo,
                epochHistory,
                completeData
              )

              // Complete the task with output
              const lastEpoch = epochHistory[epochHistory.length - 1] as
                | Record<string, number>
                | undefined
              handle.complete({
                sessionId,
                modelType,
                modelPath: `${modelType}/${sessionId}`,
                metrics: {
                  finalAccuracy: lastEpoch?.accuracy,
                  finalValAccuracy: lastEpoch?.val_accuracy,
                  finalLoss: lastEpoch?.loss,
                  finalValLoss: lastEpoch?.val_loss,
                },
                trainingDurationSeconds: (completeData as any).training_duration_seconds ?? null,
                epochCount: epochHistory.length,
              })
              resolve()
            } catch (err) {
              reject(err)
            }
          } else if (handle.isCancelled()) {
            // Task was cancelled, don't fail
            resolve()
          } else {
            reject(new Error(`Training failed with exit code ${code}`))
          }
        })

        proc.on('error', (error) => {
          activeProcesses.delete(handle.id)
          reject(error)
        })
      })
    }
  )
}

/**
 * Request early stop for a training task (saves model gracefully)
 */
export function requestEarlyStop(taskId: string): boolean {
  const active = activeProcesses.get(taskId)
  if (!active) return false

  try {
    fs.writeFileSync(active.stopFilePath, 'stop', { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

/**
 * Check if a training task is running on this pod
 */
export function isTrainingRunningLocally(taskId: string): boolean {
  const active = activeProcesses.get(taskId)
  return active !== undefined && !active.process.killed
}

/**
 * Get count of locally running training tasks
 */
export function getLocalTrainingCount(): number {
  return activeProcesses.size
}

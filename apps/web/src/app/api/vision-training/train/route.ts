import { spawn, type ChildProcess } from 'child_process'
import path from 'path'

/**
 * Training configuration options
 */
interface TrainingConfig {
  epochs?: number
  batchSize?: number
  validationSplit?: number
  noAugmentation?: boolean
}

/**
 * Active training process (only one allowed at a time)
 */
let activeProcess: ChildProcess | null = null
let activeAbortController: AbortController | null = null

/**
 * POST /api/vision-training/train
 *
 * Starts the Python training script and streams progress via SSE.
 * Only one training session can run at a time.
 */
export async function POST(request: Request): Promise<Response> {
  // Check if training is already running
  if (activeProcess && !activeProcess.killed) {
    return new Response(
      JSON.stringify({
        error: 'Training already in progress',
        hint: 'Wait for current training to complete or cancel it first',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Parse config from request body
  let config: TrainingConfig = {}
  try {
    const body = await request.text()
    if (body) {
      config = JSON.parse(body)
    }
  } catch {
    // Use defaults if body parsing fails
  }

  // Build command arguments
  const args = [
    'scripts/train-column-classifier/train_model.py',
    '--json-progress',
    '--data-dir',
    './data/vision-training/collected',
    '--output-dir',
    './public/models/abacus-column-classifier',
  ]

  if (config.epochs) {
    args.push('--epochs', String(config.epochs))
  }
  if (config.batchSize) {
    args.push('--batch-size', String(config.batchSize))
  }
  if (config.validationSplit) {
    args.push('--validation-split', String(config.validationSplit))
  }
  if (config.noAugmentation) {
    args.push('--no-augmentation')
  }

  // Create abort controller for cancellation
  activeAbortController = new AbortController()
  const { signal } = activeAbortController

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Helper to send SSE event
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      // Send initial event
      sendEvent('started', {
        message: 'Training started',
        config: {
          epochs: config.epochs ?? 50,
          batchSize: config.batchSize ?? 32,
          validationSplit: config.validationSplit ?? 0.2,
          augmentation: !config.noAugmentation,
        },
      })

      // Spawn Python process
      const cwd = path.resolve(process.cwd())
      activeProcess = spawn('python3', args, {
        cwd,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      })

      // Handle stdout (JSON progress events)
      activeProcess.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const event = JSON.parse(line)
            sendEvent(event.event || 'progress', event)
          } catch {
            // Non-JSON output, send as log
            sendEvent('log', { message: line })
          }
        }
      })

      // Handle stderr
      activeProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim()
        if (message) {
          // Filter out TensorFlow info messages
          if (!message.includes('successful NUMA node') && !message.includes('StreamExecutor')) {
            sendEvent('log', { message, type: 'stderr' })
          }
        }
      })

      // Handle process exit
      activeProcess.on('close', (code) => {
        if (code === 0) {
          sendEvent('finished', { message: 'Training completed successfully', code })
        } else {
          sendEvent('error', { message: `Training failed with code ${code}`, code })
        }
        activeProcess = null
        activeAbortController = null
        controller.close()
      })

      // Handle process error
      activeProcess.on('error', (error) => {
        sendEvent('error', { message: error.message })
        activeProcess = null
        activeAbortController = null
        controller.close()
      })

      // Handle cancellation
      signal.addEventListener('abort', () => {
        if (activeProcess && !activeProcess.killed) {
          activeProcess.kill('SIGTERM')
          sendEvent('cancelled', { message: 'Training cancelled by user' })
        }
      })
    },

    cancel() {
      // Kill process if stream is cancelled
      if (activeProcess && !activeProcess.killed) {
        activeProcess.kill('SIGTERM')
      }
      activeProcess = null
      activeAbortController = null
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
 * DELETE /api/vision-training/train
 *
 * Cancels any running training process.
 */
export async function DELETE(): Promise<Response> {
  if (!activeProcess || activeProcess.killed) {
    return new Response(JSON.stringify({ message: 'No training in progress' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Signal abort to cancel the process
  activeAbortController?.abort()

  return new Response(JSON.stringify({ message: 'Training cancellation requested' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * GET /api/vision-training/train
 *
 * Check if training is currently running.
 */
export async function GET(): Promise<Response> {
  const isRunning = activeProcess !== null && !activeProcess.killed

  return new Response(
    JSON.stringify({
      isRunning,
      message: isRunning ? 'Training in progress' : 'No training in progress',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

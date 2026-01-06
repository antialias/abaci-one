import { spawn } from 'child_process'
import path from 'path'
import { ensureVenvReady, PYTHON_ENV, TRAINING_PYTHON, TRAINING_SCRIPTS_DIR } from '../config'

/**
 * Hardware detection result from Python/TensorFlow
 */
interface HardwareInfo {
  available: boolean
  device: string
  deviceName: string
  deviceType: string
  details: Record<string, unknown>
  error: string | null
}

/**
 * Cache the hardware info since it doesn't change
 */
let cachedHardwareInfo: HardwareInfo | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * GET /api/vision-training/hardware
 *
 * Detects and returns the hardware that will be used for training.
 * Runs a Python script that queries TensorFlow for available devices.
 */
export async function GET(): Promise<Response> {
  // Return cached result if valid
  const now = Date.now()
  if (cachedHardwareInfo && now - cacheTimestamp < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cachedHardwareInfo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Ensure venv is set up (lazy, cached)
    const setup = await ensureVenvReady()
    if (!setup.success) {
      return new Response(
        JSON.stringify({
          available: false,
          device: 'unknown',
          deviceName: 'Setup Failed',
          deviceType: 'unknown',
          details: {},
          error: setup.error || 'Failed to set up Python environment',
          hint: 'Check server logs for details',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const cwd = path.resolve(process.cwd())
    const scriptPath = path.join(TRAINING_SCRIPTS_DIR, 'detect_hardware.py')

    const result = await new Promise<HardwareInfo>((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      let hasError = false

      // Use shared Python config - same as training uses
      const childProcess = spawn(TRAINING_PYTHON, [scriptPath], {
        cwd,
        env: PYTHON_ENV,
      })

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      childProcess.on('error', (error) => {
        hasError = true
        reject(new Error(`Failed to spawn python3: ${error.message}`))
      })

      childProcess.on('close', (code) => {
        if (hasError) return // Already rejected

        if (code === 0) {
          try {
            const parsed = JSON.parse(stdout.trim())
            resolve(parsed)
          } catch {
            reject(new Error(`Failed to parse hardware info: ${stdout}`))
          }
        } else {
          const errorInfo = stderr || stdout || 'No output'
          reject(new Error(`Hardware detection failed (code ${code}): ${errorInfo}`))
        }
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!hasError) {
          childProcess.kill()
          reject(new Error('Hardware detection timed out after 30 seconds'))
        }
      }, 30000)
    })

    // Cache successful result
    cachedHardwareInfo = result
    cacheTimestamp = now

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check for common issues
    let hint = ''
    if (errorMessage.includes('ENOENT') || errorMessage.includes('python3')) {
      hint = 'Python 3 is not installed or not in PATH'
    } else if (errorMessage.includes('TensorFlow not installed')) {
      hint = 'Install TensorFlow: pip install tensorflow'
    }

    return new Response(
      JSON.stringify({
        available: false,
        device: 'unknown',
        deviceName: 'Detection Failed',
        deviceType: 'unknown',
        details: {},
        error: errorMessage,
        hint,
      }),
      {
        status: 200, // Return 200 even on detection failure so UI can show the error
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

import { spawn } from 'child_process'
import path from 'path'

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
    const cwd = path.resolve(process.cwd())
    const scriptPath = 'scripts/train-column-classifier/detect_hardware.py'

    const result = await new Promise<HardwareInfo>((resolve, reject) => {
      const process = spawn('python3', [scriptPath], {
        cwd,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        timeout: 30000, // 30 second timeout
      })

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(stdout.trim())
            resolve(parsed)
          } catch {
            reject(new Error(`Failed to parse hardware info: ${stdout}`))
          }
        } else {
          reject(new Error(`Hardware detection failed (code ${code}): ${stderr || stdout}`))
        }
      })

      process.on('error', (error) => {
        reject(error)
      })
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

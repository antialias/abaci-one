import { exec, execSync, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Shared configuration for vision training.
 *
 * CRITICAL: Both hardware detection and training MUST use the same Python
 * environment so that hardware detection accurately reflects what training
 * will actually use.
 */

const cwd = process.cwd()

/**
 * Check if the current platform supports TensorFlow training.
 * TensorFlow doesn't have wheels for all platforms (e.g., ARM-based NAS devices).
 */
export function isPlatformSupported(): { supported: boolean; reason?: string } {
  const platform = process.platform
  const arch = process.arch

  // TensorFlow supports:
  // - macOS on x86_64 and arm64 (Apple Silicon with tensorflow-macos)
  // - Linux on x86_64 (and some arm64 builds)
  // - Windows on x86_64

  if (platform === 'darwin') {
    // macOS - both Intel and Apple Silicon are supported
    return { supported: true }
  }

  if (platform === 'linux') {
    if (arch === 'x64') {
      return { supported: true }
    }
    // ARM Linux (like Synology NAS) typically doesn't have TensorFlow wheels
    return {
      supported: false,
      reason: `TensorFlow is not available for Linux ${arch}. Training should be done on a machine with x86_64 or Apple Silicon.`,
    }
  }

  if (platform === 'win32' && arch === 'x64') {
    return { supported: true }
  }

  return {
    supported: false,
    reason: `TensorFlow is not available for ${platform} ${arch}. Training should be done on macOS, Linux x86_64, or Windows x86_64.`,
  }
}

/**
 * Path to the training scripts directory
 */
export const TRAINING_SCRIPTS_DIR = path.join(cwd, 'scripts/train-column-classifier')

/**
 * Path to the venv directory
 */
const VENV_DIR = path.join(TRAINING_SCRIPTS_DIR, '.venv')

/**
 * Path to the Python executable in the venv
 */
export const TRAINING_PYTHON = path.join(VENV_DIR, 'bin/python')

/**
 * Common environment variables for Python subprocesses
 */
export const PYTHON_ENV = {
  ...process.env,
  PYTHONUNBUFFERED: '1',
  PYTHONWARNINGS: 'ignore::FutureWarning', // Suppress keras warning
}

/**
 * Setup state - cached to avoid repeated setup attempts
 */
let setupPromise: Promise<SetupResult> | null = null

interface SetupResult {
  success: boolean
  python: string
  error?: string
  isAppleSilicon: boolean
  hasGpu: boolean
}

/**
 * Find the best Python to use for the venv.
 * On Apple Silicon, prefer Homebrew ARM Python for Metal GPU support.
 */
function findBestPython(): string {
  const isAppleSilicon = process.platform === 'darwin' && process.arch === 'arm64'

  if (isAppleSilicon) {
    // Try Homebrew Python versions (ARM native)
    const homebrewPythons = [
      '/opt/homebrew/opt/python@3.11/bin/python3.11',
      '/opt/homebrew/opt/python@3.12/bin/python3.12',
      '/opt/homebrew/bin/python3',
    ]

    for (const python of homebrewPythons) {
      if (fs.existsSync(python)) {
        // Verify it's actually ARM
        try {
          const result = execSync(`file "${python}"`, { encoding: 'utf-8' })
          if (result.includes('arm64')) {
            return python
          }
        } catch {
          // Continue to next option
        }
      }
    }
  }

  // Fall back to system python3
  return 'python3'
}

/**
 * Check if the venv is already set up with tensorflow
 */
async function isVenvReady(): Promise<boolean> {
  if (!fs.existsSync(TRAINING_PYTHON)) {
    return false
  }

  try {
    // Check if tensorflow is installed
    await execAsync(`"${TRAINING_PYTHON}" -c "import tensorflow"`, {
      timeout: 30000,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Create the venv and install dependencies
 */
async function createVenv(): Promise<SetupResult> {
  const isAppleSilicon = process.platform === 'darwin' && process.arch === 'arm64'

  const basePython = findBestPython()
  console.log(`[vision-training] Creating venv with ${basePython}...`)

  try {
    // Create venv (--clear removes existing incomplete venv)
    await execAsync(`"${basePython}" -m venv --clear "${VENV_DIR}"`, { timeout: 60000 })

    // Upgrade pip
    await execAsync(`"${TRAINING_PYTHON}" -m pip install --upgrade pip`, {
      timeout: 120000,
    })

    // Install tensorflow (with Metal on Apple Silicon)
    if (isAppleSilicon) {
      console.log('[vision-training] Installing tensorflow with Metal support...')
      // tensorflow-metal requires specific tensorflow versions
      await execAsync(
        `"${TRAINING_PYTHON}" -m pip install "tensorflow-macos>=2.16,<2.17" "tensorflow-metal>=1.1,<1.2"`,
        { timeout: 600000 } // 10 minutes - tensorflow is large
      )
    } else {
      console.log('[vision-training] Installing tensorflow...')
      await execAsync(`"${TRAINING_PYTHON}" -m pip install tensorflow`, {
        timeout: 600000,
      })
    }

    // Verify installation
    const { stdout } = await execAsync(
      `"${TRAINING_PYTHON}" -c "import tensorflow as tf; print(len(tf.config.list_physical_devices('GPU')))"`,
      { timeout: 60000 }
    )
    const gpuCount = parseInt(stdout.trim(), 10) || 0

    console.log(`[vision-training] Setup complete. GPUs detected: ${gpuCount}`)

    return {
      success: true,
      python: TRAINING_PYTHON,
      isAppleSilicon,
      hasGpu: gpuCount > 0,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[vision-training] Setup failed: ${message}`)

    return {
      success: false,
      python: TRAINING_PYTHON,
      error: message,
      isAppleSilicon,
      hasGpu: false,
    }
  }
}

/**
 * Ensure the Python venv is set up with tensorflow.
 * Call this before spawning any Python processes.
 *
 * This is lazy and cached - first call does setup, subsequent calls return immediately.
 */
export async function ensureVenvReady(): Promise<SetupResult> {
  // Return cached promise if setup already in progress or complete
  if (setupPromise) {
    return setupPromise
  }

  // Check if already set up
  if (await isVenvReady()) {
    const isAppleSilicon = process.platform === 'darwin' && process.arch === 'arm64'

    // Quick GPU check
    let hasGpu = false
    try {
      const { stdout } = await execAsync(
        `"${TRAINING_PYTHON}" -c "import tensorflow as tf; print(len(tf.config.list_physical_devices('GPU')))"`,
        { timeout: 30000 }
      )
      hasGpu = parseInt(stdout.trim(), 10) > 0
    } catch {
      // Ignore
    }

    setupPromise = Promise.resolve({
      success: true,
      python: TRAINING_PYTHON,
      isAppleSilicon,
      hasGpu,
    })
    return setupPromise
  }

  // Need to set up - do it once
  console.log('[vision-training] Venv not found, setting up...')
  setupPromise = createVenv().then((result) => {
    // If setup failed, clear cache so we can retry next time
    if (!result.success) {
      setupPromise = null
    }
    return result
  })
  return setupPromise
}

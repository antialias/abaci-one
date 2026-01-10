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
 * TensorFlow has wheels for:
 * - macOS x86_64 and arm64 (Apple Silicon with tensorflow-macos)
 * - Linux x86_64 and aarch64
 * - Windows x86_64
 */
export function isPlatformSupported(): { supported: boolean; reason?: string } {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'darwin') {
    // macOS - both Intel and Apple Silicon are supported
    return { supported: true }
  }

  if (platform === 'linux') {
    if (arch === 'x64' || arch === 'arm64') {
      return { supported: true }
    }
    return {
      supported: false,
      reason: `TensorFlow is not available for Linux ${arch}. Training requires x86_64 or ARM64.`,
    }
  }

  if (platform === 'win32' && arch === 'x64') {
    return { supported: true }
  }

  return {
    supported: false,
    reason: `TensorFlow is not available for ${platform} ${arch}. Training should be done on macOS, Linux (x86_64/ARM64), or Windows x86_64.`,
  }
}

/**
 * Path to the training scripts directory
 */
export const TRAINING_SCRIPTS_DIR = path.join(cwd, 'scripts/train-column-classifier')

/**
 * Path to the venv directory
 * We use data/vision-training/.venv because:
 * 1. The data/ directory is mounted as a volume in Docker (persists across restarts)
 * 2. It's writable by the container
 * 3. Scripts directory may not exist in production Docker images
 */
const VENV_DIR = path.join(cwd, 'data/vision-training/.venv')

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
 * Required Python modules for training
 */
const REQUIRED_MODULES = [
  { name: 'tensorflow', importName: 'tensorflow', pipName: 'tensorflow' },
  { name: 'tensorflowjs', importName: 'tensorflowjs', pipName: 'tensorflowjs' },
  { name: 'PIL (Pillow)', importName: 'PIL', pipName: 'Pillow' },
  {
    name: 'sklearn (scikit-learn)',
    importName: 'sklearn',
    pipName: 'scikit-learn',
  },
  { name: 'numpy', importName: 'numpy', pipName: 'numpy' },
  { name: 'OpenCV', importName: 'cv2', pipName: 'opencv-python-headless' },
]

export interface DependencyCheckResult {
  allInstalled: boolean
  missing: { name: string; pipName: string }[]
  installed: { name: string; pipName: string }[]
  error?: string
}

/**
 * Check if all required Python dependencies are installed
 */
export async function checkDependencies(): Promise<DependencyCheckResult> {
  if (!fs.existsSync(TRAINING_PYTHON)) {
    return {
      allInstalled: false,
      missing: REQUIRED_MODULES.map((m) => ({
        name: m.name,
        pipName: m.pipName,
      })),
      installed: [],
      error: 'Python virtual environment not found',
    }
  }

  const missing: { name: string; pipName: string }[] = []
  const installed: { name: string; pipName: string }[] = []

  for (const mod of REQUIRED_MODULES) {
    try {
      await execAsync(`"${TRAINING_PYTHON}" -c "import ${mod.importName}"`, {
        timeout: 10000,
      })
      installed.push({ name: mod.name, pipName: mod.pipName })
    } catch {
      missing.push({ name: mod.name, pipName: mod.pipName })
    }
  }

  return {
    allInstalled: missing.length === 0,
    missing,
    installed,
  }
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
 * Path to the requirements.txt file
 */
const REQUIREMENTS_FILE = path.join(TRAINING_SCRIPTS_DIR, 'requirements.txt')

/**
 * Create the venv and install dependencies
 */
async function createVenv(): Promise<SetupResult> {
  const isAppleSilicon = process.platform === 'darwin' && process.arch === 'arm64'

  const basePython = findBestPython()
  console.log(`[vision-training] Creating venv with ${basePython}...`)

  try {
    // Create venv (--clear removes existing incomplete venv)
    await execAsync(`"${basePython}" -m venv --clear "${VENV_DIR}"`, {
      timeout: 60000,
    })

    // Upgrade pip
    await execAsync(`"${TRAINING_PYTHON}" -m pip install --upgrade pip`, {
      timeout: 120000,
    })

    // Install tensorflow and tensorflowjs together to get compatible versions
    // Note: We skip tensorflow-metal because tensorflowjs requires a newer tensorflow
    // version that's incompatible with the current Metal plugin. CPU training is
    // fast enough for our small dataset (~500 images).
    console.log('[vision-training] Installing tensorflow and tensorflowjs...')
    await execAsync(
      `"${TRAINING_PYTHON}" -m pip install tensorflow tensorflowjs`,
      { timeout: 600000 } // 10 minutes - tensorflow is large
    )

    // Install all other requirements from requirements.txt
    if (fs.existsSync(REQUIREMENTS_FILE)) {
      console.log('[vision-training] Installing additional requirements from requirements.txt...')
      await execAsync(`"${TRAINING_PYTHON}" -m pip install -r "${REQUIREMENTS_FILE}"`, {
        timeout: 600000,
      })
    } else {
      // Fallback: install known required packages individually
      // Note: tensorflow and tensorflowjs are already installed above
      console.log(
        '[vision-training] requirements.txt not found, installing packages individually...'
      )
      const packages = ['Pillow', 'scikit-learn', 'numpy', 'opencv-python-headless']
      for (const pkg of packages) {
        try {
          await execAsync(`"${TRAINING_PYTHON}" -m pip install "${pkg}"`, {
            timeout: 300000,
          })
        } catch (e) {
          console.warn(`[vision-training] Failed to install ${pkg}: ${e}`)
        }
      }
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

    // Check for and install any missing dependencies
    const depCheck = await checkDependencies()
    if (!depCheck.allInstalled && depCheck.missing.length > 0) {
      console.log(
        `[vision-training] Installing missing dependencies: ${depCheck.missing.map((m) => m.pipName).join(', ')}`
      )
      for (const dep of depCheck.missing) {
        try {
          await execAsync(`"${TRAINING_PYTHON}" -m pip install "${dep.pipName}"`, {
            timeout: 300000,
          })
          console.log(`[vision-training] Installed ${dep.pipName}`)
        } catch (e) {
          console.warn(`[vision-training] Failed to install ${dep.pipName}: ${e}`)
        }
      }
    }

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

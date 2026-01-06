import path from 'path'

/**
 * Shared configuration for vision training.
 *
 * CRITICAL: Both hardware detection and training MUST use the same Python
 * environment so that hardware detection accurately reflects what training
 * will actually use.
 */

const cwd = process.cwd()

/**
 * Path to the Python executable used for ALL vision training operations.
 * This venv has tensorflow-metal installed for Apple Silicon GPU support.
 */
export const TRAINING_PYTHON = path.join(
  cwd,
  'scripts/train-column-classifier/.venv/bin/python'
)

/**
 * Path to the training scripts directory
 */
export const TRAINING_SCRIPTS_DIR = path.join(cwd, 'scripts/train-column-classifier')

/**
 * Common environment variables for Python subprocesses
 */
export const PYTHON_ENV = {
  ...process.env,
  PYTHONUNBUFFERED: '1',
  PYTHONWARNINGS: 'ignore::FutureWarning', // Suppress keras warning
}

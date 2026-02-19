import { NextResponse } from 'next/server'
import { checkDependencies, ensureVenvReady, isPlatformSupported, TRAINING_PYTHON } from '../config'
import { requireAdmin } from '@/lib/auth/requireRole'

// Force dynamic rendering - this route checks system dependencies at runtime
export const dynamic = 'force-dynamic'

export interface PreflightResult {
  ready: boolean
  platform: {
    supported: boolean
    reason?: string
  }
  venv: {
    exists: boolean
    python: string
    isAppleSilicon: boolean
    hasGpu: boolean
    error?: string
  }
  dependencies: {
    allInstalled: boolean
    installed: { name: string; pipName: string }[]
    missing: { name: string; pipName: string }[]
    error?: string
  }
}

/**
 * GET /api/vision-training/preflight
 *
 * Performs a complete preflight check for training readiness:
 * 1. Platform support (TensorFlow availability)
 * 2. Venv existence and setup
 * 3. All required Python dependencies installed
 *
 * Returns a structured result indicating if training can proceed.
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  // Check platform support first
  const platformCheck = isPlatformSupported()
  if (!platformCheck.supported) {
    return NextResponse.json({
      ready: false,
      platform: platformCheck,
      venv: {
        exists: false,
        python: TRAINING_PYTHON,
        isAppleSilicon: false,
        hasGpu: false,
      },
      dependencies: {
        allInstalled: false,
        installed: [],
        missing: [],
        error: 'Platform not supported',
      },
    })
  }

  // Check/setup venv
  const venvResult = await ensureVenvReady()

  if (!venvResult.success) {
    return NextResponse.json({
      ready: false,
      platform: { supported: true },
      venv: {
        exists: false,
        python: venvResult.python,
        isAppleSilicon: venvResult.isAppleSilicon,
        hasGpu: venvResult.hasGpu,
        error: venvResult.error,
      },
      dependencies: {
        allInstalled: false,
        installed: [],
        missing: [],
        error: 'Venv setup failed',
      },
    })
  }

  // Check all dependencies
  const depResult = await checkDependencies()

  const ready = depResult.allInstalled

  return NextResponse.json({
    ready,
    platform: { supported: true },
    venv: {
      exists: true,
      python: venvResult.python,
      isAppleSilicon: venvResult.isAppleSilicon,
      hasGpu: venvResult.hasGpu,
    },
    dependencies: depResult,
  })
}

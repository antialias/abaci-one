import { type NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { TRAINING_PYTHON, PYTHON_ENV, ensureVenvReady } from '../config'

interface PipelineStepVariant {
  image_base64: string
  label: string
  description: string
}

interface PipelineStep {
  step: number
  name: string
  title: string
  description: string
  image_base64?: string
  variants?: PipelineStepVariant[]
  error?: string
  note?: string
  original_size?: string
  target_size?: string
}

interface PipelinePreviewResult {
  steps: PipelineStep[]
}

/**
 * Preview the preprocessing pipeline using the EXACT SAME Python code as training.
 *
 * Shows the image at each step:
 * 1. Raw image (loaded)
 * 2. Marker masking (ArUco markers obscured)
 * 3. Color augmentation (brightness/contrast/saturation variations)
 * 4. Resize (to 224x224)
 * 5. Normalize (to [0, 1] range)
 *
 * This ensures the preview matches exactly what goes through the training pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageData, corners, applyMasking = true, applyAugmentation = true } = body

    if (!imageData) {
      return NextResponse.json({ error: 'Missing imageData' }, { status: 400 })
    }

    if (!corners) {
      return NextResponse.json({ error: 'Missing corners' }, { status: 400 })
    }

    // Validate corners format
    if (!corners.topLeft || !corners.topRight || !corners.bottomLeft || !corners.bottomRight) {
      return NextResponse.json(
        { error: 'Invalid corners format - need topLeft, topRight, bottomLeft, bottomRight' },
        { status: 400 }
      )
    }

    // Ensure venv is ready
    const venvResult = await ensureVenvReady()
    if (!venvResult.success) {
      return NextResponse.json(
        { error: `Python environment not ready: ${venvResult.error}` },
        { status: 500 }
      )
    }

    // Prepare input for Python script
    const pythonInput = JSON.stringify({
      image_base64: imageData,
      corners: [corners.topLeft, corners.topRight, corners.bottomLeft, corners.bottomRight],
      apply_masking: applyMasking,
      apply_augmentation: applyAugmentation,
    })

    // Path to the pipeline preview script
    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'train-boundary-detector',
      'pipeline_preview.py'
    )

    // Run Python script using the training venv
    const result = await new Promise<PipelinePreviewResult>((resolve, reject) => {
      const pythonProcess = spawn(TRAINING_PYTHON, [scriptPath], {
        cwd: path.join(process.cwd(), 'scripts', 'train-boundary-detector'),
        env: PYTHON_ENV,
      })

      // Send input via stdin
      pythonProcess.stdin.write(pythonInput)
      pythonProcess.stdin.end()

      let stdout = ''
      let stderr = ''

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${stderr}`))
          return
        }

        try {
          const output = JSON.parse(stdout)
          resolve(output)
        } catch {
          reject(new Error(`Failed to parse Python output: ${stdout}`))
        }
      })

      pythonProcess.on('error', (err) => {
        reject(err)
      })
    })

    return NextResponse.json({
      success: true,
      pipeline: result,
    })
  } catch (error) {
    console.error('[preview-augmentation] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

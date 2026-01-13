import { type NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { TRAINING_PYTHON, PYTHON_ENV, ensureVenvReady } from '../config'

/**
 * Preview marker masking using the EXACT SAME Python code as training.
 *
 * This ensures the preview matches what the model will see during training.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageData, corners, method = 'noise' } = body

    if (!imageData || !corners) {
      return NextResponse.json({ error: 'Missing imageData or corners' }, { status: 400 })
    }

    // Validate corners format
    if (!corners.topLeft || !corners.topRight || !corners.bottomLeft || !corners.bottomRight) {
      return NextResponse.json(
        {
          error: 'Invalid corners format - need topLeft, topRight, bottomLeft, bottomRight',
        },
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
      method,
    })

    // Path to the marker masking script
    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'train-boundary-detector',
      'marker_masking.py'
    )

    // Run Python script using the training venv
    // Pass input via stdin instead of command line to avoid E2BIG for large images
    const result = await new Promise<{
      masked_image_base64: string
      mask_regions: Array<{ x1: number; y1: number; x2: number; y2: number }>
    }>((resolve, reject) => {
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
      maskedImageData: result.masked_image_base64,
      maskRegions: result.mask_regions,
    })
  } catch (error) {
    console.error('[preview-masked] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

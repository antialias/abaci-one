import { JobManager } from '@/lib/3d-printing/jobManager'
import type { AbacusParams } from '@/lib/3d-printing/jobManager'
import { NextResponse } from 'next/server'

// Allow up to 90 seconds for OpenSCAD rendering
export const maxDuration = 90

// Cache for preview STLs to avoid regenerating on every request
const previewCache = new Map<string, { buffer: Buffer; timestamp: number }>()
const CACHE_TTL = 300000 // 5 minutes

function getCacheKey(params: AbacusParams): string {
  return `${params.columns}-${params.scaleFactor}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate parameters
    const columns = Number.parseInt(body.columns, 10)
    const scaleFactor = Number.parseFloat(body.scaleFactor)

    // Validation
    if (Number.isNaN(columns) || columns < 1 || columns > 13) {
      return NextResponse.json({ error: 'columns must be between 1 and 13' }, { status: 400 })
    }

    if (Number.isNaN(scaleFactor) || scaleFactor < 0.5 || scaleFactor > 3) {
      return NextResponse.json({ error: 'scaleFactor must be between 0.5 and 3' }, { status: 400 })
    }

    const params: AbacusParams = {
      columns,
      scaleFactor,
      format: 'stl', // Always STL for preview
    }

    // Check cache first
    const cacheKey = getCacheKey(params)
    const cached = previewCache.get(cacheKey)
    const now = Date.now()

    if (cached && now - cached.timestamp < CACHE_TTL) {
      // Return cached preview
      const uint8Array = new Uint8Array(cached.buffer)
      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'model/stl',
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
      })
    }

    // Generate new preview
    const jobId = await JobManager.createJob(params)

    // Wait for job to complete (with timeout)
    const startTime = Date.now()
    const timeout = 90000 // 90 seconds max wait (OpenSCAD can take 40-60s)

    while (Date.now() - startTime < timeout) {
      const job = JobManager.getJob(jobId)
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      if (job.status === 'completed') {
        const buffer = await JobManager.getJobOutput(jobId)

        // Cache the result
        previewCache.set(cacheKey, { buffer, timestamp: now })

        // Clean up old cache entries
        for (const [key, value] of previewCache.entries()) {
          if (now - value.timestamp > CACHE_TTL) {
            previewCache.delete(key)
          }
        }

        // Clean up the job
        await JobManager.cleanupJob(jobId)

        const uint8Array = new Uint8Array(buffer)
        return new NextResponse(uint8Array, {
          headers: {
            'Content-Type': 'model/stl',
            'Cache-Control': 'public, max-age=300',
          },
        })
      }

      if (job.status === 'failed') {
        return NextResponse.json(
          { error: job.error || 'Preview generation failed' },
          { status: 500 }
        )
      }

      // Wait 500ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return NextResponse.json({ error: 'Preview generation timeout' }, { status: 408 })
  } catch (error) {
    console.error('Error generating preview:', error)
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
  }
}

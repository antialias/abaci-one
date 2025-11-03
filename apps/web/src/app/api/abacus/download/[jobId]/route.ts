import { JobManager } from '@/lib/3d-printing/jobManager'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params
    const job = JobManager.getJob(jobId)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        { error: `Job is ${job.status}, not ready for download` },
        { status: 400 }
      )
    }

    const fileBuffer = await JobManager.getJobOutput(jobId)

    // Determine content type and filename
    const contentTypes = {
      stl: 'model/stl',
      '3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
      scad: 'text/plain',
    }

    const contentType = contentTypes[job.params.format]
    const filename = `abacus.${job.params.format}`

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(fileBuffer)

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error downloading job:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}

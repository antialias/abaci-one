import { JobManager } from '@/lib/3d-printing/jobManager'
import type { AbacusParams } from '@/lib/3d-printing/jobManager'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate parameters
    const columns = Number.parseInt(body.columns, 10)
    const scaleFactor = Number.parseFloat(body.scaleFactor)
    const widthMm = body.widthMm ? Number.parseFloat(body.widthMm) : undefined
    const format = body.format

    // Validation
    if (Number.isNaN(columns) || columns < 1 || columns > 13) {
      return NextResponse.json({ error: 'columns must be between 1 and 13' }, { status: 400 })
    }

    if (Number.isNaN(scaleFactor) || scaleFactor < 0.5 || scaleFactor > 3) {
      return NextResponse.json({ error: 'scaleFactor must be between 0.5 and 3' }, { status: 400 })
    }

    if (widthMm !== undefined && (Number.isNaN(widthMm) || widthMm < 50 || widthMm > 500)) {
      return NextResponse.json({ error: 'widthMm must be between 50 and 500' }, { status: 400 })
    }

    if (!['stl', '3mf', 'scad'].includes(format)) {
      return NextResponse.json({ error: 'format must be stl, 3mf, or scad' }, { status: 400 })
    }

    const params: AbacusParams = {
      columns,
      scaleFactor,
      widthMm,
      format,
      // 3MF colors (optional)
      frameColor: body.frameColor,
      heavenBeadColor: body.heavenBeadColor,
      earthBeadColor: body.earthBeadColor,
      decorationColor: body.decorationColor,
    }

    const jobId = await JobManager.createJob(params)

    return NextResponse.json(
      {
        jobId,
        message: 'Job created successfully',
      },
      { status: 202 }
    )
  } catch (error) {
    console.error('Error creating job:', error)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}

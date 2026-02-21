/**
 * API route for streaming per-problem vision recording video
 *
 * GET /api/curriculum/[playerId]/sessions/[sessionId]/problems/[problemNumber]/video
 *
 * Streams the MP4 video file for a specific problem with Range header support for seeking.
 * Supports lazy encoding: if frames exist but video doesn't, triggers encoding on-demand.
 */

export const dynamic = 'force-dynamic'

import { createReadStream, statSync, existsSync, readdirSync } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { sessionPlans, visionProblemVideos } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'
import { getPlayerAccess, generateAuthorizationError } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'
import { VideoEncoder } from '@/lib/vision/recording/VideoEncoder'

/**
 * Encode video lazily in the background.
 * Updates database status on success/failure.
 */
async function encodeLazily(videoId: string, framesDir: string, outputPath: string): Promise<void> {
  try {
    const result = await VideoEncoder.encode({
      framesDir,
      outputPath,
      fps: 5, // Match VisionRecorder default
      quality: 23,
      preset: 'fast',
    })

    if (result.success) {
      await db
        .update(visionProblemVideos)
        .set({
          status: 'ready',
          fileSize: result.fileSize,
        })
        .where(eq(visionProblemVideos.id, videoId))

      console.log(
        `[problem-video] Lazy encoding complete: ${outputPath} (${(result.fileSize! / 1024).toFixed(1)} KB)`
      )

      // Clean up frames after successful encoding
      await VideoEncoder.cleanupFrames(framesDir)
    } else {
      throw new Error(result.error || 'Encoding failed')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[problem-video] Lazy encoding failed: ${errorMessage}`)

    await db
      .update(visionProblemVideos)
      .set({
        status: 'failed',
        processingError: `Lazy encoding failed: ${errorMessage}`,
      })
      .where(eq(visionProblemVideos.id, videoId))
  }
}

/**
 * GET - Stream problem video with Range support
 *
 * Query params:
 * - epoch: Epoch number (0 = initial pass, 1-2 = retry epochs). Defaults to 0.
 * - attempt: Attempt number within the epoch (1-indexed). Defaults to 1.
 */
export const GET = withAuth(async (request, { params }) => {
  try {
    const {
      playerId,
      sessionId,
      problemNumber: problemNumberStr,
    } = (await params) as { playerId: string; sessionId: string; problemNumber: string }
    const { searchParams } = new URL(request.url)

    if (!playerId || !sessionId || !problemNumberStr) {
      return NextResponse.json(
        { error: 'Player ID, Session ID, and Problem Number required' },
        { status: 400 }
      )
    }

    const problemNumber = parseInt(problemNumberStr, 10)
    if (isNaN(problemNumber) || problemNumber < 1) {
      return NextResponse.json({ error: 'Invalid problem number' }, { status: 400 })
    }

    // Parse epoch and attempt from query params
    const epochNumber = parseInt(searchParams.get('epoch') ?? '0', 10)
    const attemptNumber = parseInt(searchParams.get('attempt') ?? '1', 10)

    // Authorization check
    const userId = await getUserId()
    const access = await getPlayerAccess(userId, playerId)
    if (access.accessLevel === 'none') {
      const authError = generateAuthorizationError(access, 'view', {
        actionDescription: 'view recordings for this student',
      })
      return NextResponse.json(authError, { status: 403 })
    }

    // Verify session exists and belongs to player
    const session = await db.query.sessionPlans.findFirst({
      where: and(eq(sessionPlans.id, sessionId), eq(sessionPlans.playerId, playerId)),
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get problem video with epoch/attempt filtering
    const video = await db.query.visionProblemVideos.findFirst({
      where: and(
        eq(visionProblemVideos.sessionId, sessionId),
        eq(visionProblemVideos.problemNumber, problemNumber),
        eq(visionProblemVideos.epochNumber, epochNumber),
        eq(visionProblemVideos.attemptNumber, attemptNumber)
      ),
    })

    if (!video) {
      return NextResponse.json({ error: 'Problem video not found' }, { status: 404 })
    }

    // Handle different video statuses
    if (video.status === 'processing') {
      return NextResponse.json(
        {
          error: 'Video is being encoded',
          status: 'processing',
          retryAfterMs: 5000,
        },
        { status: 202 }
      )
    }

    if (video.status === 'recording') {
      return NextResponse.json({ error: 'Video is still being recorded' }, { status: 400 })
    }

    if (video.status === 'no_video') {
      return NextResponse.json(
        {
          error: 'No video was recorded for this problem (camera may have been off)',
        },
        { status: 404 }
      )
    }

    // For 'ready' or 'failed' status, proceed to check if file exists
    // If file doesn't exist but frames do, lazy encoding will be triggered

    // Build video file path
    const videoPath = path.join(
      process.cwd(),
      'data',
      'uploads',
      'vision-recordings',
      playerId,
      sessionId,
      video.filename
    )

    // Check if video file exists
    if (!existsSync(videoPath)) {
      // Lazy encoding: check if frames exist and we can encode on-demand
      const baseName = video.filename.replace('.mp4', '')
      const framesDir = path.join(
        process.cwd(),
        'data',
        'uploads',
        'vision-recordings',
        playerId,
        sessionId,
        `${baseName}.frames`
      )

      if (existsSync(framesDir)) {
        // Check if frames directory has actual frame files
        try {
          const files = readdirSync(framesDir)
          const frameFiles = files.filter((f) => f.startsWith('frame_') && f.endsWith('.jpg'))

          if (frameFiles.length > 0) {
            // Check if ffmpeg is available
            const ffmpegAvailable = await VideoEncoder.isAvailable()

            if (ffmpegAvailable) {
              // Frames exist and ffmpeg available - trigger lazy encoding
              console.log(
                `[problem-video] Triggering lazy encoding for ${video.filename} (${frameFiles.length} frames)`
              )

              // Update status to processing
              await db
                .update(visionProblemVideos)
                .set({ status: 'processing' })
                .where(eq(visionProblemVideos.id, video.id))

              // Trigger encoding asynchronously (don't await - let client poll)
              encodeLazily(video.id, framesDir, videoPath)

              return NextResponse.json(
                {
                  error: 'Video is being encoded',
                  status: 'processing',
                  frameCount: frameFiles.length,
                  retryAfterMs: 5000,
                },
                { status: 202 }
              )
            } else {
              console.error(`[problem-video] Frames exist but ffmpeg not available: ${framesDir}`)
              return NextResponse.json(
                { error: 'Video encoding not available on server' },
                { status: 503 }
              )
            }
          }
        } catch (err) {
          console.error(`[problem-video] Error checking frames directory: ${err}`)
        }
      }

      console.error(`[problem-video] Video file not found: ${videoPath}`)
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 })
    }

    // Get file stats
    const stat = statSync(videoPath)
    const fileSize = stat.size

    // Parse Range header for seeking
    const range = request.headers.get('range')

    if (range) {
      // Handle Range request (partial content)
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        })
      }

      const chunkSize = end - start + 1
      const stream = createReadStream(videoPath, { start, end })

      // Convert Node.js stream to Web stream
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk) => {
            controller.enqueue(chunk)
          })
          stream.on('end', () => {
            controller.close()
          })
          stream.on('error', (err) => {
            controller.error(err)
          })
        },
      })

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'video/mp4',
        },
      })
    }

    // Full file request (no Range header)
    const stream = createReadStream(videoPath)

    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(chunk)
        })
        stream.on('end', () => {
          controller.close()
        })
        stream.on('error', (err) => {
          controller.error(err)
        })
      },
    })

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(fileSize),
        'Content-Type': 'video/mp4',
      },
    })
  } catch (error) {
    console.error('Error streaming problem video:', error)
    return NextResponse.json({ error: 'Failed to stream video' }, { status: 500 })
  }
})

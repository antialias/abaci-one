import { eq, and } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { mkdir, writeFile, rm } from 'fs/promises'
import path from 'path'
import { db } from '@/db'
import {
  visionProblemVideos,
  type VisionProblemVideoStatus,
  type NewVisionProblemVideo,
} from '@/db/schema/vision-problem-videos'
import { VideoEncoder } from './VideoEncoder'

/**
 * Frame data received from vision-frame socket events
 */
export interface VisionFrame {
  sessionId: string
  imageData: string // base64 JPEG
  detectedValue: number | null
  confidence: number
  timestamp: number // Unix timestamp in ms
}

/**
 * Problem marker data (without offsetMs, which is calculated)
 */
export interface ProblemMarkerInput {
  problemNumber: number
  partIndex: number
  eventType: 'problem-shown' | 'answer-submitted' | 'feedback-shown'
  isCorrect?: boolean
}

/**
 * Recording state for a single problem within a session
 */
interface ProblemRecording {
  videoId: string
  problemNumber: number
  partIndex: number
  framesDir: string
  frameCount: number
  startedAt: Date
  lastFrameAt: Date
  isCorrect?: boolean
}

/**
 * Recording session state - tracks active session and current problem
 */
interface RecordingSession {
  sessionId: string
  playerId: string
  sessionStartedAt: Date
  currentProblem: ProblemRecording | null
}

/**
 * Configuration for the VisionRecorder
 */
export interface VisionRecorderConfig {
  /** Base directory for storing recordings (default: data/uploads/vision-recordings) */
  uploadDir: string
  /** Target frames per second (default: 5) */
  targetFps: number
  /** Maximum frame age in ms before dropping (default: 200) */
  maxFrameAgeMs: number
  /** Recording retention period in days (default: 7) */
  retentionDays: number
  /** Size of the ring buffer for live DVR in seconds (default: 60) */
  dvrBufferSeconds: number
}

const DEFAULT_CONFIG: VisionRecorderConfig = {
  uploadDir: 'data/uploads/vision-recordings',
  targetFps: 5,
  maxFrameAgeMs: 200,
  retentionDays: 7,
  dvrBufferSeconds: 60,
}

/**
 * Current problem info for DVR scrubbing
 */
interface CurrentProblemInfo {
  problemNumber: number
  startMs: number // Offset from session start
}

/**
 * Callback for when a problem video is ready
 */
export type VideoReadyCallback = (data: {
  sessionId: string
  problemNumber: number
  durationMs: number
  videoUrl: string
}) => void

/**
 * Callback for when a problem video encoding fails
 */
export type VideoFailedCallback = (data: {
  sessionId: string
  problemNumber: number
  error: string
}) => void

/**
 * VisionRecorder - Server-side service for recording vision frames during practice sessions.
 *
 * Records frames per-problem (not per-session), allowing:
 * - Incremental encoding as each problem completes
 * - Direct access to individual problem videos
 * - Click on any problem in observer nav to see that problem's video
 *
 * Usage:
 *   const recorder = VisionRecorder.getInstance()
 *   recorder.startSession(sessionId, playerId)
 *   recorder.addFrame(frameData)
 *   recorder.onProblemMarker(sessionId, marker) // Triggers encoding on problem transitions
 *   await recorder.stopSession(sessionId)
 */
export class VisionRecorder {
  private static instance: VisionRecorder | null = null

  private config: VisionRecorderConfig
  private activeSessions: Map<string, RecordingSession> = new Map()
  private frameTimestamps: Map<string, number[]> = new Map() // For FPS tracking
  private dvrBuffers: Map<string, VisionFrame[]> = new Map() // Ring buffer for DVR
  private currentProblemInfo: Map<string, CurrentProblemInfo> = new Map() // For per-problem DVR scrubbing

  // Callbacks for notifying observers when videos are ready
  private onVideoReady: VideoReadyCallback | null = null
  private onVideoFailed: VideoFailedCallback | null = null

  private constructor(config: Partial<VisionRecorderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get the singleton instance
   */
  static getInstance(config?: Partial<VisionRecorderConfig>): VisionRecorder {
    if (!VisionRecorder.instance) {
      VisionRecorder.instance = new VisionRecorder(config)
    }
    return VisionRecorder.instance
  }

  /**
   * Reset the singleton (for testing)
   */
  static resetInstance(): void {
    VisionRecorder.instance = null
  }

  /**
   * Set callback for when a problem video is ready
   */
  setVideoReadyCallback(callback: VideoReadyCallback): void {
    this.onVideoReady = callback
  }

  /**
   * Set callback for when a problem video encoding fails
   */
  setVideoFailedCallback(callback: VideoFailedCallback): void {
    this.onVideoFailed = callback
  }

  /**
   * Start recording session for a practice session.
   * Does NOT create any directories yet - those are created per-problem.
   */
  startSession(sessionId: string, playerId: string): void {
    // Check if already recording
    if (this.activeSessions.has(sessionId)) {
      console.log(`[VisionRecorder] Already recording session ${sessionId}`)
      return
    }

    const now = new Date()

    // Initialize session state (no current problem yet)
    const session: RecordingSession = {
      sessionId,
      playerId,
      sessionStartedAt: now,
      currentProblem: null,
    }

    this.activeSessions.set(sessionId, session)
    this.frameTimestamps.set(sessionId, [])
    this.dvrBuffers.set(sessionId, [])

    console.log(`[VisionRecorder] Started session for ${sessionId}`)
  }

  /**
   * Handle problem marker - this is the key method for per-problem recording.
   *
   * When 'problem-shown' is received:
   * - Finalize and encode the previous problem (if any)
   * - Start recording for the new problem
   *
   * When 'answer-submitted' is received:
   * - Store the correctness for the current problem
   */
  async onProblemMarker(sessionId: string, marker: ProblemMarkerInput): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      console.warn(`[VisionRecorder] Cannot add marker - no session for ${sessionId}`)
      return
    }

    const offsetMs = Date.now() - session.sessionStartedAt.getTime()

    // Track current problem for DVR scrubbing
    if (marker.eventType === 'problem-shown') {
      this.currentProblemInfo.set(sessionId, {
        problemNumber: marker.problemNumber,
        startMs: offsetMs,
      })

      // If there was a previous problem being recorded, finalize and encode it
      if (session.currentProblem) {
        console.log(
          `[VisionRecorder] Problem ${session.currentProblem.problemNumber} ended, starting encoding`
        )
        await this.finalizeProblem(session)
      }

      // Start recording for the new problem
      await this.startProblemRecording(session, marker.problemNumber, marker.partIndex)

      console.log(
        `[VisionRecorder] Problem ${marker.problemNumber} started at offset ${offsetMs}ms for session ${sessionId}`
      )
    } else if (marker.eventType === 'answer-submitted') {
      // Store correctness on the current problem
      if (session.currentProblem) {
        session.currentProblem.isCorrect = marker.isCorrect
        console.log(
          `[VisionRecorder] Problem ${marker.problemNumber} answered: ${marker.isCorrect ? 'correct' : 'incorrect'}`
        )
      }
    }
  }

  /**
   * Start recording for a specific problem
   */
  private async startProblemRecording(
    session: RecordingSession,
    problemNumber: number,
    partIndex: number
  ): Promise<void> {
    const videoId = createId()
    const filename = `problem_${problemNumber.toString().padStart(3, '0')}.mp4`
    const framesDir = path.join(
      this.config.uploadDir,
      session.playerId,
      session.sessionId,
      `problem_${problemNumber.toString().padStart(3, '0')}.frames`
    )
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.config.retentionDays * 24 * 60 * 60 * 1000)

    // Create frames directory
    await mkdir(framesDir, { recursive: true })

    // Create database record
    const newVideo: NewVisionProblemVideo = {
      id: videoId,
      sessionId: session.sessionId,
      playerId: session.playerId,
      problemNumber,
      partIndex,
      filename,
      startedAt: now,
      expiresAt,
      status: 'recording',
    }

    await db.insert(visionProblemVideos).values(newVideo)

    // Update session's current problem
    session.currentProblem = {
      videoId,
      problemNumber,
      partIndex,
      framesDir,
      frameCount: 0,
      startedAt: now,
      lastFrameAt: now,
    }

    console.log(
      `[VisionRecorder] Started problem ${problemNumber} recording: ${videoId} -> ${framesDir}`
    )
  }

  /**
   * Finalize the current problem and trigger encoding
   */
  private async finalizeProblem(session: RecordingSession): Promise<void> {
    const problem = session.currentProblem
    if (!problem) return

    const endedAt = new Date()
    const durationMs = endedAt.getTime() - problem.startedAt.getTime()
    const avgFps = problem.frameCount > 0 ? (problem.frameCount / durationMs) * 1000 : 0

    // Update database record
    await db
      .update(visionProblemVideos)
      .set({
        status: 'processing',
        endedAt,
        durationMs,
        frameCount: problem.frameCount,
        avgFps,
        isCorrect: problem.isCorrect,
      })
      .where(eq(visionProblemVideos.id, problem.videoId))

    console.log(
      `[VisionRecorder] Finalized problem ${problem.problemNumber}: ${problem.frameCount} frames, ${(durationMs / 1000).toFixed(1)}s, ${avgFps.toFixed(1)} fps`
    )

    // Clear current problem
    session.currentProblem = null

    // Trigger encoding (async - don't await)
    this.encodeProblemVideo(problem.videoId, session.sessionId, problem.problemNumber).catch(
      (error) => {
        console.error(
          `[VisionRecorder] Encoding failed for problem ${problem.problemNumber}:`,
          error
        )
      }
    )
  }

  /**
   * Add a frame to the current problem's recording.
   * Handles frame rate limiting and DVR buffer management.
   */
  async addFrame(frame: VisionFrame): Promise<boolean> {
    const session = this.activeSessions.get(frame.sessionId)
    if (!session) {
      return false
    }

    const now = Date.now()
    const frameAge = now - frame.timestamp

    // Drop stale frames
    if (frameAge > this.config.maxFrameAgeMs) {
      console.log(`[VisionRecorder] Dropping stale frame (${frameAge}ms old)`)
      return false
    }

    // Check frame rate
    const timestamps = this.frameTimestamps.get(frame.sessionId) || []
    const recentTimestamps = timestamps.filter((t) => now - t < 1000)

    if (recentTimestamps.length >= this.config.targetFps) {
      // At target FPS, drop frame
      return false
    }

    // Add to DVR buffer (ring buffer) - always, regardless of problem recording
    const dvrBuffer = this.dvrBuffers.get(frame.sessionId) || []
    dvrBuffer.push(frame)

    // Calculate max DVR buffer size based on FPS
    const maxDvrFrames = this.config.dvrBufferSeconds * this.config.targetFps
    while (dvrBuffer.length > maxDvrFrames) {
      dvrBuffer.shift()
    }
    this.dvrBuffers.set(frame.sessionId, dvrBuffer)

    // Save frame to disk (only if we have a current problem)
    const problem = session.currentProblem
    if (!problem) {
      // No current problem - frame goes to DVR buffer only, not saved to disk
      recentTimestamps.push(now)
      this.frameTimestamps.set(frame.sessionId, recentTimestamps)
      return true
    }

    // Save frame to problem's frames directory
    const frameNumber = problem.frameCount.toString().padStart(6, '0')
    const framePath = path.join(problem.framesDir, `frame_${frameNumber}.jpg`)

    try {
      // Remove data URL prefix if present
      const base64Data = frame.imageData.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      await writeFile(framePath, buffer)

      problem.frameCount++
      problem.lastFrameAt = new Date(frame.timestamp)

      // Update FPS tracking
      recentTimestamps.push(now)
      this.frameTimestamps.set(frame.sessionId, recentTimestamps)

      return true
    } catch (error) {
      console.error(`[VisionRecorder] Error saving frame:`, error)
      return false
    }
  }

  /**
   * Stop recording session.
   * Finalizes and encodes the current problem (if any).
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      console.log(`[VisionRecorder] No active session for ${sessionId}`)
      return
    }

    // Finalize the current problem (the last one)
    if (session.currentProblem) {
      console.log(
        `[VisionRecorder] Session ending, finalizing problem ${session.currentProblem.problemNumber}`
      )
      await this.finalizeProblem(session)
    }

    // Clean up in-memory state
    this.activeSessions.delete(sessionId)
    this.frameTimestamps.delete(sessionId)
    this.dvrBuffers.delete(sessionId)
    this.currentProblemInfo.delete(sessionId)

    console.log(`[VisionRecorder] Stopped session ${sessionId}`)
  }

  /**
   * Encode a problem's frames into MP4 video.
   */
  private async encodeProblemVideo(
    videoId: string,
    sessionId: string,
    problemNumber: number
  ): Promise<void> {
    // Get video record from database
    const video = await db.query.visionProblemVideos.findFirst({
      where: eq(visionProblemVideos.id, videoId),
    })

    if (!video) {
      console.error(`[VisionRecorder] Video ${videoId} not found`)
      return
    }

    const framesDir = path.join(
      this.config.uploadDir,
      video.playerId,
      video.sessionId,
      `problem_${video.problemNumber.toString().padStart(3, '0')}.frames`
    )
    const outputPath = path.join(
      this.config.uploadDir,
      video.playerId,
      video.sessionId,
      video.filename
    )

    try {
      // Check if ffmpeg is available
      const ffmpegAvailable = await VideoEncoder.isAvailable()
      if (!ffmpegAvailable) {
        console.warn('[VisionRecorder] ffmpeg not available, keeping frames for later encoding')
        // Mark as ready without encoding - frames are preserved for manual encoding
        await db
          .update(visionProblemVideos)
          .set({ status: 'ready' })
          .where(eq(visionProblemVideos.id, videoId))
        return
      }

      // Encode frames to MP4
      const result = await VideoEncoder.encode({
        framesDir,
        outputPath,
        fps: this.config.targetFps,
        quality: 23, // Good balance of quality and size
        preset: 'fast', // Faster encoding, slightly larger file
      })

      if (!result.success) {
        throw new Error(result.error || 'Encoding failed')
      }

      // Update database with encoding results
      await db
        .update(visionProblemVideos)
        .set({
          status: 'ready',
          fileSize: result.fileSize,
        })
        .where(eq(visionProblemVideos.id, videoId))

      console.log(
        `[VisionRecorder] Encoded problem ${problemNumber}: ${(result.fileSize! / 1024).toFixed(1)} KB`
      )

      // Notify observers that video is ready
      if (this.onVideoReady) {
        this.onVideoReady({
          sessionId,
          problemNumber,
          durationMs: video.durationMs || 0,
          videoUrl: `/api/curriculum/${video.playerId}/sessions/${video.sessionId}/problems/${problemNumber}/video`,
        })
      }

      // Clean up frame files after successful encoding
      await VideoEncoder.cleanupFrames(framesDir)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[VisionRecorder] Encoding failed for problem ${problemNumber}:`, errorMessage)

      await db
        .update(visionProblemVideos)
        .set({
          status: 'failed',
          processingError: errorMessage,
        })
        .where(eq(visionProblemVideos.id, videoId))

      // Notify observers of failure
      if (this.onVideoFailed) {
        this.onVideoFailed({
          sessionId,
          problemNumber,
          error: errorMessage,
        })
      }
    }
  }

  /**
   * Get a frame from the DVR buffer for scrub-back.
   * @param sessionId The session to get the frame from
   * @param offsetMs Offset from session start
   */
  getDvrFrame(sessionId: string, offsetMs: number): VisionFrame | null {
    const dvrBuffer = this.dvrBuffers.get(sessionId)
    const session = this.activeSessions.get(sessionId)

    if (!dvrBuffer || !session || dvrBuffer.length === 0) {
      return null
    }

    // Calculate target timestamp
    const targetTimestamp = session.sessionStartedAt.getTime() + offsetMs

    // Find closest frame
    let closestFrame = dvrBuffer[0]
    let closestDiff = Math.abs(closestFrame.timestamp - targetTimestamp)

    for (const frame of dvrBuffer) {
      const diff = Math.abs(frame.timestamp - targetTimestamp)
      if (diff < closestDiff) {
        closestFrame = frame
        closestDiff = diff
      }
    }

    return closestFrame
  }

  /**
   * Get DVR buffer info for a session, including current problem boundaries
   */
  getDvrBufferInfo(sessionId: string): {
    availableFromMs: number
    availableToMs: number
    currentProblemStartMs: number | null
    currentProblemNumber: number | null
  } | null {
    const dvrBuffer = this.dvrBuffers.get(sessionId)
    const session = this.activeSessions.get(sessionId)

    if (!dvrBuffer || !session || dvrBuffer.length === 0) {
      return null
    }

    const startOffset = dvrBuffer[0].timestamp - session.sessionStartedAt.getTime()
    const endOffset = dvrBuffer[dvrBuffer.length - 1].timestamp - session.sessionStartedAt.getTime()
    const problemInfo = this.currentProblemInfo.get(sessionId)

    return {
      availableFromMs: startOffset,
      availableToMs: endOffset,
      currentProblemStartMs: problemInfo?.startMs ?? null,
      currentProblemNumber: problemInfo?.problemNumber ?? null,
    }
  }

  /**
   * Check if a session is currently being recorded
   */
  isRecording(sessionId: string): boolean {
    return this.activeSessions.has(sessionId)
  }

  /**
   * Get list of available problem videos for a session
   */
  async getSessionVideos(
    sessionId: string
  ): Promise<Array<{ problemNumber: number; status: string; durationMs: number | null }>> {
    const videos = await db.query.visionProblemVideos.findMany({
      where: eq(visionProblemVideos.sessionId, sessionId),
      orderBy: (table, { asc }) => [asc(table.problemNumber)],
    })

    return videos.map((v) => ({
      problemNumber: v.problemNumber,
      status: v.status,
      durationMs: v.durationMs,
    }))
  }

  /**
   * Clean up expired recordings.
   * Should be called periodically (e.g., by a cron job).
   */
  async cleanupExpiredRecordings(): Promise<number> {
    const now = new Date()

    // Find expired videos
    const expired = await db.query.visionProblemVideos.findMany({
      where: (table, { lt }) => lt(table.expiresAt, now),
    })

    let deletedCount = 0

    // Group by session to clean up directories efficiently
    const sessionGroups = new Map<string, typeof expired>()
    for (const video of expired) {
      const key = `${video.playerId}/${video.sessionId}`
      if (!sessionGroups.has(key)) {
        sessionGroups.set(key, [])
      }
      sessionGroups.get(key)!.push(video)
    }

    for (const [, videos] of sessionGroups) {
      for (const video of videos) {
        try {
          // Delete video file and frames directory
          const videoPath = path.join(
            this.config.uploadDir,
            video.playerId,
            video.sessionId,
            video.filename
          )
          const framesDir = path.join(
            this.config.uploadDir,
            video.playerId,
            video.sessionId,
            `problem_${video.problemNumber.toString().padStart(3, '0')}.frames`
          )

          await rm(videoPath, { force: true })
          await rm(framesDir, { recursive: true, force: true })

          // Delete database record
          await db.delete(visionProblemVideos).where(eq(visionProblemVideos.id, video.id))

          deletedCount++
          console.log(
            `[VisionRecorder] Deleted expired video ${video.id} (problem ${video.problemNumber})`
          )
        } catch (error) {
          console.error(`[VisionRecorder] Failed to delete video ${video.id}:`, error)
        }
      }

      // Try to clean up session directory if empty
      try {
        const sessionDir = path.join(this.config.uploadDir, videos[0].playerId, videos[0].sessionId)
        await rm(sessionDir, { recursive: true, force: true })
      } catch {
        // Directory might not be empty or might not exist, that's ok
      }
    }

    if (deletedCount > 0) {
      console.log(`[VisionRecorder] Cleaned up ${deletedCount} expired video recordings`)
    }

    return deletedCount
  }
}

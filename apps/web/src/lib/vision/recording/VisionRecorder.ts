import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { db } from "@/db";
import {
  visionProblemVideos,
  type VisionProblemVideoStatus,
  type NewVisionProblemVideo,
} from "@/db/schema/vision-problem-videos";
import { VideoEncoder } from "./VideoEncoder";

/**
 * Frame data received from vision-frame socket events
 */
export interface VisionFrame {
  sessionId: string;
  imageData: string; // base64 JPEG
  detectedValue: number | null;
  confidence: number;
  timestamp: number; // Unix timestamp in ms
}

/**
 * Problem marker data (without offsetMs, which is calculated)
 */
export interface ProblemMarkerInput {
  problemNumber: number;
  partIndex: number;
  eventType: "problem-shown" | "answer-submitted" | "feedback-shown";
  isCorrect?: boolean;
  /** Epoch number: 0 = initial pass, 1-2 = retry epochs */
  epochNumber: number;
  /** Attempt number within the epoch (1-indexed) */
  attemptNumber: number;
  /** Whether this is a retry (epoch > 0) */
  isRetry: boolean;
  /** Whether this is a manual redo (student clicked on completed problem) */
  isManualRedo: boolean;
}

/**
 * Practice state data for metadata capture
 */
export interface PracticeStateInput {
  currentProblem: { terms: number[]; answer: number };
  phase: "problem" | "feedback" | "tutorial";
  studentAnswer: string;
  isCorrect: boolean | null;
  currentProblemNumber: number;
}

/**
 * Snapshot of practice state for metadata capture
 */
interface PracticeStateSnapshot {
  problem: { terms: number[]; answer: number } | null;
  studentAnswer: string;
  phase: "problem" | "feedback";
  isCorrect: boolean | null;
}

/**
 * Metadata entry for a single frame
 */
export interface ProblemMetadataEntry {
  /** Timestamp in ms from video start */
  t: number;
  /** Detected abacus value from vision */
  detectedValue: number | null;
  /** Detection confidence 0-1 */
  confidence: number;
  /** Student's typed answer */
  studentAnswer: string;
  /** Current phase */
  phase: "problem" | "feedback";
  /** Whether answer is correct (only in feedback phase) */
  isCorrect?: boolean;
}

/**
 * Full metadata for a problem video
 */
export interface ProblemMetadata {
  /** Problem details */
  problem: { terms: number[]; answer: number };
  /** Time-coded entries */
  entries: ProblemMetadataEntry[];
  /** Duration in ms */
  durationMs: number;
  /** Total frames */
  frameCount: number;
  /** Final result */
  isCorrect: boolean | null;
}

/**
 * Recording state for a single problem within a session
 */
interface ProblemRecording {
  videoId: string;
  problemNumber: number;
  partIndex: number;
  /** Epoch number: 0 = initial pass, 1-2 = retry epochs */
  epochNumber: number;
  /** Attempt number within the epoch (1-indexed) */
  attemptNumber: number;
  /** Whether this is a retry (epoch > 0) */
  isRetry: boolean;
  /** Whether this is a manual redo (student clicked on completed problem) */
  isManualRedo: boolean;
  framesDir: string;
  frameCount: number;
  startedAt: Date;
  lastFrameAt: Date;
  isCorrect?: boolean;
  /** Problem details captured from practice state */
  problem: { terms: number[]; answer: number } | null;
  /** Metadata entries for this problem */
  metadata: ProblemMetadataEntry[];
}

/**
 * Recording session state - tracks active session and current problem
 */
interface RecordingSession {
  sessionId: string;
  playerId: string;
  sessionStartedAt: Date;
  currentProblem: ProblemRecording | null;
  /** Latest practice state for metadata capture */
  latestPracticeState: PracticeStateSnapshot;
}

/**
 * Configuration for the VisionRecorder
 */
export interface VisionRecorderConfig {
  /** Base directory for storing recordings (default: data/uploads/vision-recordings) */
  uploadDir: string;
  /** Target frames per second (default: 5) */
  targetFps: number;
  /** Maximum frame age in ms before dropping (default: 200) */
  maxFrameAgeMs: number;
  /** Recording retention period in days (default: 7) */
  retentionDays: number;
  /** Size of the ring buffer for live DVR in seconds (default: 60) */
  dvrBufferSeconds: number;
}

const DEFAULT_CONFIG: VisionRecorderConfig = {
  uploadDir: "data/uploads/vision-recordings",
  targetFps: 5,
  maxFrameAgeMs: 200,
  retentionDays: 7,
  dvrBufferSeconds: 60,
};

/**
 * Current problem info for DVR scrubbing
 */
interface CurrentProblemInfo {
  problemNumber: number;
  startMs: number; // Offset from session start
}

/**
 * Callback for when a problem video is ready
 */
export type VideoReadyCallback = (data: {
  sessionId: string;
  problemNumber: number;
  durationMs: number;
  videoUrl: string;
}) => void;

/**
 * Callback for when a problem video encoding fails
 */
export type VideoFailedCallback = (data: {
  sessionId: string;
  problemNumber: number;
  error: string;
}) => void;

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
  private static instance: VisionRecorder | null = null;

  private config: VisionRecorderConfig;
  private activeSessions: Map<string, RecordingSession> = new Map();
  private frameTimestamps: Map<string, number[]> = new Map(); // For FPS tracking
  private dvrBuffers: Map<string, VisionFrame[]> = new Map(); // Ring buffer for DVR
  private currentProblemInfo: Map<string, CurrentProblemInfo> = new Map(); // For per-problem DVR scrubbing

  // Callbacks for notifying observers when videos are ready
  private onVideoReady: VideoReadyCallback | null = null;
  private onVideoFailed: VideoFailedCallback | null = null;

  private constructor(config: Partial<VisionRecorderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the singleton instance
   */
  static getInstance(config?: Partial<VisionRecorderConfig>): VisionRecorder {
    if (!VisionRecorder.instance) {
      VisionRecorder.instance = new VisionRecorder(config);
    }
    return VisionRecorder.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static resetInstance(): void {
    VisionRecorder.instance = null;
  }

  /**
   * Set callback for when a problem video is ready
   */
  setVideoReadyCallback(callback: VideoReadyCallback): void {
    this.onVideoReady = callback;
  }

  /**
   * Set callback for when a problem video encoding fails
   */
  setVideoFailedCallback(callback: VideoFailedCallback): void {
    this.onVideoFailed = callback;
  }

  /**
   * Start recording session for a practice session.
   * Does NOT create any directories yet - those are created per-problem.
   */
  startSession(sessionId: string, playerId: string): void {
    // Check if already recording
    if (this.activeSessions.has(sessionId)) {
      console.log(`[VisionRecorder] Already recording session ${sessionId}`);
      return;
    }

    const now = new Date();

    // Initialize session state (no current problem yet)
    const session: RecordingSession = {
      sessionId,
      playerId,
      sessionStartedAt: now,
      currentProblem: null,
      latestPracticeState: {
        problem: null,
        studentAnswer: "",
        phase: "problem",
        isCorrect: null,
      },
    };

    this.activeSessions.set(sessionId, session);
    this.frameTimestamps.set(sessionId, []);
    this.dvrBuffers.set(sessionId, []);

    console.log(`[VisionRecorder] Started session for ${sessionId}`);
  }

  /**
   * Update practice state for metadata capture.
   * Called when practice-state socket event is received.
   *
   * IMPORTANT: This captures metadata even when no video frames are being recorded.
   * This ensures we have a record of student answers for all problems.
   */
  onPracticeState(sessionId: string, state: PracticeStateInput): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    const prevState = session.latestPracticeState;

    // Update latest practice state snapshot
    session.latestPracticeState = {
      problem: state.currentProblem,
      studentAnswer: state.studentAnswer,
      phase: state.phase === "tutorial" ? "problem" : state.phase,
      isCorrect: state.isCorrect,
    };

    // If we have a current problem recording and no problem details yet, capture them
    if (
      session.currentProblem &&
      !session.currentProblem.problem &&
      state.currentProblem
    ) {
      session.currentProblem.problem = state.currentProblem;
    }

    // Add metadata entry when state changes (even without video frames)
    // This ensures we capture student input regardless of camera status
    const problem = session.currentProblem;
    if (problem) {
      const stateChanged =
        prevState.studentAnswer !== state.studentAnswer ||
        prevState.phase !==
          (state.phase === "tutorial" ? "problem" : state.phase) ||
        prevState.isCorrect !== state.isCorrect;

      if (stateChanged) {
        const now = Date.now();
        const tFromProblemStart = now - problem.startedAt.getTime();
        const phase = state.phase === "tutorial" ? "problem" : state.phase;

        const metadataEntry: ProblemMetadataEntry = {
          t: tFromProblemStart,
          detectedValue: null, // No frame data
          confidence: 0,
          studentAnswer: state.studentAnswer,
          phase,
          ...(phase === "feedback" && state.isCorrect !== null
            ? { isCorrect: state.isCorrect }
            : {}),
        };
        problem.metadata.push(metadataEntry);
      }
    }
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
  async onProblemMarker(
    sessionId: string,
    marker: ProblemMarkerInput,
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(
        `[VisionRecorder] Cannot add marker - no session for ${sessionId}`,
      );
      return;
    }

    const offsetMs = Date.now() - session.sessionStartedAt.getTime();

    // Track current problem for DVR scrubbing
    if (marker.eventType === "problem-shown") {
      this.currentProblemInfo.set(sessionId, {
        problemNumber: marker.problemNumber,
        startMs: offsetMs,
      });

      // If there was a previous problem being recorded, finalize and encode it
      if (session.currentProblem) {
        console.log(
          `[VisionRecorder] Problem ${session.currentProblem.problemNumber} ended, starting encoding`,
        );
        await this.finalizeProblem(session);
      }

      // Start recording for the new problem
      await this.startProblemRecording(
        session,
        marker.problemNumber,
        marker.partIndex,
        marker.epochNumber,
        marker.attemptNumber,
        marker.isRetry,
        marker.isManualRedo,
      );

      console.log(
        `[VisionRecorder] Problem ${marker.problemNumber} started at offset ${offsetMs}ms for session ${sessionId}`,
      );
    } else if (marker.eventType === "answer-submitted") {
      // Store correctness on the current problem
      if (session.currentProblem) {
        session.currentProblem.isCorrect = marker.isCorrect;
        console.log(
          `[VisionRecorder] Problem ${marker.problemNumber} answered: ${marker.isCorrect ? "correct" : "incorrect"}`,
        );
      }
    }
  }

  /**
   * Start recording for a specific problem
   */
  private async startProblemRecording(
    session: RecordingSession,
    problemNumber: number,
    partIndex: number,
    epochNumber: number,
    attemptNumber: number,
    isRetry: boolean,
    isManualRedo: boolean,
  ): Promise<void> {
    const videoId = createId();
    // New filename pattern: problem_NNN_eX_aY.mp4
    const baseName = `problem_${problemNumber.toString().padStart(3, "0")}_e${epochNumber}_a${attemptNumber}`;
    const filename = `${baseName}.mp4`;
    const framesDir = path.join(
      this.config.uploadDir,
      session.playerId,
      session.sessionId,
      `${baseName}.frames`,
    );
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.retentionDays * 24 * 60 * 60 * 1000,
    );

    // Create frames directory
    await mkdir(framesDir, { recursive: true });

    // Create database record
    const newVideo: NewVisionProblemVideo = {
      id: videoId,
      sessionId: session.sessionId,
      playerId: session.playerId,
      problemNumber,
      partIndex,
      epochNumber,
      attemptNumber,
      isRetry,
      isManualRedo,
      filename,
      startedAt: now,
      expiresAt,
      status: "recording",
    };

    await db.insert(visionProblemVideos).values(newVideo);

    // Update session's current problem
    session.currentProblem = {
      videoId,
      problemNumber,
      partIndex,
      epochNumber,
      attemptNumber,
      isRetry,
      isManualRedo,
      framesDir,
      frameCount: 0,
      startedAt: now,
      lastFrameAt: now,
      problem: session.latestPracticeState.problem, // Capture problem details
      metadata: [],
    };

    console.log(
      `[VisionRecorder] Started problem ${problemNumber} (e${epochNumber}/a${attemptNumber}) recording: ${videoId} -> ${framesDir}`,
    );
  }

  /**
   * Finalize the current problem and trigger encoding
   *
   * IMPORTANT: Metadata is always written, even if there are no video frames.
   * This ensures we have a record of student answers for all problems.
   */
  private async finalizeProblem(session: RecordingSession): Promise<void> {
    const problem = session.currentProblem;
    if (!problem) return;

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - problem.startedAt.getTime();
    const avgFps =
      problem.frameCount > 0 ? (problem.frameCount / durationMs) * 1000 : 0;
    const hasVideo = problem.frameCount > 0;

    // Determine initial status based on whether we have video frames
    const initialStatus: VisionProblemVideoStatus = hasVideo
      ? "processing"
      : "no_video";

    // Update database record
    await db
      .update(visionProblemVideos)
      .set({
        status: initialStatus,
        endedAt,
        durationMs,
        frameCount: problem.frameCount,
        avgFps,
        isCorrect: problem.isCorrect,
      })
      .where(eq(visionProblemVideos.id, problem.videoId));

    // Write metadata JSON - ALWAYS, even without video frames
    // This ensures we capture student answers for playback/review
    if (problem.problem || problem.metadata.length > 0) {
      const metadata: ProblemMetadata = {
        problem: problem.problem ?? { terms: [], answer: 0 }, // Fallback if problem details weren't captured
        entries: problem.metadata,
        durationMs,
        frameCount: problem.frameCount,
        isCorrect: problem.isCorrect ?? null,
      };

      // Match the new filename pattern: problem_NNN_eX_aY.meta.json
      const baseName = `problem_${problem.problemNumber.toString().padStart(3, "0")}_e${problem.epochNumber}_a${problem.attemptNumber}`;
      const metadataPath = path.join(
        this.config.uploadDir,
        session.playerId,
        session.sessionId,
        `${baseName}.meta.json`,
      );

      try {
        // Ensure directory exists (may not exist if no frames were captured)
        const dir = path.dirname(metadataPath);
        await mkdir(dir, { recursive: true });

        await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        console.log(
          `[VisionRecorder] Wrote metadata for problem ${problem.problemNumber}: ${problem.metadata.length} entries (${hasVideo ? "with video" : "no video"})`,
        );
      } catch (error) {
        console.error(
          `[VisionRecorder] Failed to write metadata for problem ${problem.problemNumber}:`,
          error,
        );
      }
    }

    console.log(
      `[VisionRecorder] Finalized problem ${problem.problemNumber}: ${problem.frameCount} frames, ${(durationMs / 1000).toFixed(1)}s, ${avgFps.toFixed(1)} fps`,
    );

    // Clear current problem
    session.currentProblem = null;

    // Only trigger encoding if we have frames
    if (hasVideo) {
      this.encodeProblemVideo(
        problem.videoId,
        session.sessionId,
        problem.problemNumber,
      ).catch((error) => {
        console.error(
          `[VisionRecorder] Encoding failed for problem ${problem.problemNumber}:`,
          error,
        );
      });
    } else {
      // Clean up the empty frames directory if it exists
      try {
        await rm(problem.framesDir, { recursive: true, force: true });
      } catch {
        // Ignore if directory doesn't exist
      }
    }
  }

  /**
   * Add a frame to the current problem's recording.
   * Handles frame rate limiting and DVR buffer management.
   */
  async addFrame(frame: VisionFrame): Promise<boolean> {
    const session = this.activeSessions.get(frame.sessionId);
    if (!session) {
      return false;
    }

    const now = Date.now();
    const frameAge = now - frame.timestamp;

    // Drop stale frames
    if (frameAge > this.config.maxFrameAgeMs) {
      console.log(`[VisionRecorder] Dropping stale frame (${frameAge}ms old)`);
      return false;
    }

    // Check frame rate
    const timestamps = this.frameTimestamps.get(frame.sessionId) || [];
    const recentTimestamps = timestamps.filter((t) => now - t < 1000);

    if (recentTimestamps.length >= this.config.targetFps) {
      // At target FPS, drop frame
      return false;
    }

    // Add to DVR buffer (ring buffer) - always, regardless of problem recording
    const dvrBuffer = this.dvrBuffers.get(frame.sessionId) || [];
    dvrBuffer.push(frame);

    // Calculate max DVR buffer size based on FPS
    const maxDvrFrames = this.config.dvrBufferSeconds * this.config.targetFps;
    while (dvrBuffer.length > maxDvrFrames) {
      dvrBuffer.shift();
    }
    this.dvrBuffers.set(frame.sessionId, dvrBuffer);

    // Save frame to disk (only if we have a current problem)
    const problem = session.currentProblem;
    if (!problem) {
      // No current problem - frame goes to DVR buffer only, not saved to disk
      recentTimestamps.push(now);
      this.frameTimestamps.set(frame.sessionId, recentTimestamps);
      return true;
    }

    // Save frame to problem's frames directory
    const frameNumber = problem.frameCount.toString().padStart(6, "0");
    const framePath = path.join(problem.framesDir, `frame_${frameNumber}.jpg`);

    try {
      // Remove data URL prefix if present
      const base64Data = frame.imageData.replace(
        /^data:image\/\w+;base64,/,
        "",
      );
      const buffer = Buffer.from(base64Data, "base64");
      await writeFile(framePath, buffer);

      // Calculate timestamp relative to problem start (for metadata)
      const tFromProblemStart = frame.timestamp - problem.startedAt.getTime();

      // Create metadata entry combining frame data with latest practice state
      const metadataEntry: ProblemMetadataEntry = {
        t: tFromProblemStart,
        detectedValue: frame.detectedValue,
        confidence: frame.confidence,
        studentAnswer: session.latestPracticeState.studentAnswer,
        phase: session.latestPracticeState.phase,
        ...(session.latestPracticeState.phase === "feedback" &&
        session.latestPracticeState.isCorrect !== null
          ? { isCorrect: session.latestPracticeState.isCorrect }
          : {}),
      };
      problem.metadata.push(metadataEntry);

      problem.frameCount++;
      problem.lastFrameAt = new Date(frame.timestamp);

      // Update FPS tracking
      recentTimestamps.push(now);
      this.frameTimestamps.set(frame.sessionId, recentTimestamps);

      return true;
    } catch (error) {
      console.error(`[VisionRecorder] Error saving frame:`, error);
      return false;
    }
  }

  /**
   * Stop recording session.
   * Finalizes and encodes the current problem (if any).
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.log(`[VisionRecorder] No active session for ${sessionId}`);
      return;
    }

    // Finalize the current problem (the last one)
    if (session.currentProblem) {
      console.log(
        `[VisionRecorder] Session ending, finalizing problem ${session.currentProblem.problemNumber}`,
      );
      await this.finalizeProblem(session);
    }

    // Clean up in-memory state
    this.activeSessions.delete(sessionId);
    this.frameTimestamps.delete(sessionId);
    this.dvrBuffers.delete(sessionId);
    this.currentProblemInfo.delete(sessionId);

    console.log(`[VisionRecorder] Stopped session ${sessionId}`);
  }

  /**
   * Encode a problem's frames into MP4 video.
   */
  private async encodeProblemVideo(
    videoId: string,
    sessionId: string,
    problemNumber: number,
  ): Promise<void> {
    // Get video record from database
    const video = await db.query.visionProblemVideos.findFirst({
      where: eq(visionProblemVideos.id, videoId),
    });

    if (!video) {
      console.error(`[VisionRecorder] Video ${videoId} not found`);
      return;
    }

    // Derive framesDir from filename (e.g., problem_001_e0_a1.mp4 -> problem_001_e0_a1.frames)
    const baseName = video.filename.replace(".mp4", "");
    const framesDir = path.join(
      this.config.uploadDir,
      video.playerId,
      video.sessionId,
      `${baseName}.frames`,
    );
    const outputPath = path.join(
      this.config.uploadDir,
      video.playerId,
      video.sessionId,
      video.filename,
    );

    try {
      // Check if ffmpeg is available
      const ffmpegAvailable = await VideoEncoder.isAvailable();
      if (!ffmpegAvailable) {
        console.error(
          "[VisionRecorder] ffmpeg not available, cannot encode video",
        );
        // Mark as failed - ffmpeg is required for video encoding
        await db
          .update(visionProblemVideos)
          .set({
            status: "failed",
            processingError: "ffmpeg not available on server",
          })
          .where(eq(visionProblemVideos.id, videoId));

        // Notify observers of failure
        if (this.onVideoFailed) {
          this.onVideoFailed({
            sessionId,
            problemNumber,
            error: "ffmpeg not available on server",
          });
        }
        return;
      }

      // Encode frames to MP4
      const result = await VideoEncoder.encode({
        framesDir,
        outputPath,
        fps: this.config.targetFps,
        quality: 23, // Good balance of quality and size
        preset: "fast", // Faster encoding, slightly larger file
      });

      if (!result.success) {
        throw new Error(result.error || "Encoding failed");
      }

      // Update database with encoding results
      await db
        .update(visionProblemVideos)
        .set({
          status: "ready",
          fileSize: result.fileSize,
        })
        .where(eq(visionProblemVideos.id, videoId));

      console.log(
        `[VisionRecorder] Encoded problem ${problemNumber}: ${(result.fileSize! / 1024).toFixed(1)} KB`,
      );

      // Notify observers that video is ready
      if (this.onVideoReady) {
        this.onVideoReady({
          sessionId,
          problemNumber,
          durationMs: video.durationMs || 0,
          videoUrl: `/api/curriculum/${video.playerId}/sessions/${video.sessionId}/problems/${problemNumber}/video`,
        });
      }

      // Clean up frame files after successful encoding
      await VideoEncoder.cleanupFrames(framesDir);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[VisionRecorder] Encoding failed for problem ${problemNumber}:`,
        errorMessage,
      );

      await db
        .update(visionProblemVideos)
        .set({
          status: "failed",
          processingError: errorMessage,
        })
        .where(eq(visionProblemVideos.id, videoId));

      // Notify observers of failure
      if (this.onVideoFailed) {
        this.onVideoFailed({
          sessionId,
          problemNumber,
          error: errorMessage,
        });
      }
    }
  }

  /**
   * Get a frame from the DVR buffer for scrub-back.
   * @param sessionId The session to get the frame from
   * @param offsetMs Offset from session start
   */
  getDvrFrame(sessionId: string, offsetMs: number): VisionFrame | null {
    const dvrBuffer = this.dvrBuffers.get(sessionId);
    const session = this.activeSessions.get(sessionId);

    if (!dvrBuffer || !session || dvrBuffer.length === 0) {
      return null;
    }

    // Calculate target timestamp
    const targetTimestamp = session.sessionStartedAt.getTime() + offsetMs;

    // Find closest frame
    let closestFrame = dvrBuffer[0];
    let closestDiff = Math.abs(closestFrame.timestamp - targetTimestamp);

    for (const frame of dvrBuffer) {
      const diff = Math.abs(frame.timestamp - targetTimestamp);
      if (diff < closestDiff) {
        closestFrame = frame;
        closestDiff = diff;
      }
    }

    return closestFrame;
  }

  /**
   * Get DVR buffer info for a session, including current problem boundaries
   */
  getDvrBufferInfo(sessionId: string): {
    availableFromMs: number;
    availableToMs: number;
    currentProblemStartMs: number | null;
    currentProblemNumber: number | null;
  } | null {
    const dvrBuffer = this.dvrBuffers.get(sessionId);
    const session = this.activeSessions.get(sessionId);

    if (!dvrBuffer || !session || dvrBuffer.length === 0) {
      return null;
    }

    const startOffset =
      dvrBuffer[0].timestamp - session.sessionStartedAt.getTime();
    const endOffset =
      dvrBuffer[dvrBuffer.length - 1].timestamp -
      session.sessionStartedAt.getTime();
    const problemInfo = this.currentProblemInfo.get(sessionId);

    return {
      availableFromMs: startOffset,
      availableToMs: endOffset,
      currentProblemStartMs: problemInfo?.startMs ?? null,
      currentProblemNumber: problemInfo?.problemNumber ?? null,
    };
  }

  /**
   * Check if a session is currently being recorded
   */
  isRecording(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get list of available problem videos for a session
   */
  async getSessionVideos(
    sessionId: string,
  ): Promise<
    Array<{ problemNumber: number; status: string; durationMs: number | null }>
  > {
    const videos = await db.query.visionProblemVideos.findMany({
      where: eq(visionProblemVideos.sessionId, sessionId),
      orderBy: (table, { asc }) => [asc(table.problemNumber)],
    });

    return videos.map((v) => ({
      problemNumber: v.problemNumber,
      status: v.status,
      durationMs: v.durationMs,
    }));
  }

  /**
   * Clean up expired recordings.
   * Should be called periodically (e.g., by a cron job).
   */
  async cleanupExpiredRecordings(): Promise<number> {
    const now = new Date();

    // Find expired videos
    const expired = await db.query.visionProblemVideos.findMany({
      where: (table, { lt }) => lt(table.expiresAt, now),
    });

    let deletedCount = 0;

    // Group by session to clean up directories efficiently
    const sessionGroups = new Map<string, typeof expired>();
    for (const video of expired) {
      const key = `${video.playerId}/${video.sessionId}`;
      if (!sessionGroups.has(key)) {
        sessionGroups.set(key, []);
      }
      sessionGroups.get(key)!.push(video);
    }

    for (const [, videos] of sessionGroups) {
      for (const video of videos) {
        try {
          // Delete video file, frames directory, and metadata file
          const videoPath = path.join(
            this.config.uploadDir,
            video.playerId,
            video.sessionId,
            video.filename,
          );
          // Derive framesDir and metadataPath from filename
          const baseName = video.filename.replace(".mp4", "");
          const framesDir = path.join(
            this.config.uploadDir,
            video.playerId,
            video.sessionId,
            `${baseName}.frames`,
          );
          const metadataPath = path.join(
            this.config.uploadDir,
            video.playerId,
            video.sessionId,
            `${baseName}.meta.json`,
          );

          await rm(videoPath, { force: true });
          await rm(framesDir, { recursive: true, force: true });
          await rm(metadataPath, { force: true });

          // Delete database record
          await db
            .delete(visionProblemVideos)
            .where(eq(visionProblemVideos.id, video.id));

          deletedCount++;
          console.log(
            `[VisionRecorder] Deleted expired video ${video.id} (problem ${video.problemNumber})`,
          );
        } catch (error) {
          console.error(
            `[VisionRecorder] Failed to delete video ${video.id}:`,
            error,
          );
        }
      }

      // Try to clean up session directory if empty
      try {
        const sessionDir = path.join(
          this.config.uploadDir,
          videos[0].playerId,
          videos[0].sessionId,
        );
        await rm(sessionDir, { recursive: true, force: true });
      } catch {
        // Directory might not be empty or might not exist, that's ok
      }
    }

    if (deletedCount > 0) {
      console.log(
        `[VisionRecorder] Cleaned up ${deletedCount} expired video recordings`,
      );
    }

    return deletedCount;
  }
}

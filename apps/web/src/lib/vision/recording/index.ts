/**
 * Vision Recording Module
 *
 * Server-side recording of abacus vision frames during practice sessions.
 *
 * Features:
 * - Frame accumulation and storage
 * - Ring buffer for live DVR (scrub-back during observation)
 * - Video encoding (MP4 with H.264)
 * - Problem marker synchronization for playback
 * - Automatic cleanup of expired recordings
 *
 * @module lib/vision/recording
 */

export {
  VisionRecorder,
  type VisionFrame,
  type VisionRecorderConfig,
  type ProblemMarkerInput,
  type VideoReadyCallback,
  type VideoFailedCallback,
} from './VisionRecorder'
export {
  VideoEncoder,
  type VideoEncoderOptions,
  type EncodingResult,
} from './VideoEncoder'

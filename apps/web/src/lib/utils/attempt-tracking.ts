/**
 * Utility functions for tracking and displaying multiple video recording attempts
 * per problem (epoch retries and manual redos).
 */

/**
 * Video info from the API response
 */
export interface VideoAttemptInfo {
  problemNumber: number
  partIndex: number
  epochNumber: number
  attemptNumber: number
  isRetry: boolean
  isManualRedo: boolean
  status: string
  durationMs: number | null
  fileSize: number | null
  isCorrect: boolean | null
  startedAt: Date | string | null
  endedAt: Date | string | null
  processingError: string | null
}

/**
 * Get all attempts for a specific problem from a video list
 */
export function getVideoAttemptsForProblem(
  videos: VideoAttemptInfo[],
  problemNumber: number
): VideoAttemptInfo[] {
  return videos
    .filter((v) => v.problemNumber === problemNumber)
    .sort((a, b) => {
      // Sort by epoch, then attempt number
      if (a.epochNumber !== b.epochNumber) return a.epochNumber - b.epochNumber
      return a.attemptNumber - b.attemptNumber
    })
}

/**
 * Get a human-readable label for an attempt
 */
export function getAttemptLabel(video: VideoAttemptInfo): string {
  if (video.isManualRedo) {
    return `Redo #${video.attemptNumber}`
  }
  if (video.isRetry && video.epochNumber > 0) {
    return `Retry (Round ${video.epochNumber})`
  }
  if (video.attemptNumber > 1) {
    return `Attempt ${video.attemptNumber}`
  }
  return 'Initial attempt'
}

/**
 * Get a short label for dropdown display
 */
export function getAttemptShortLabel(video: VideoAttemptInfo): string {
  if (video.isManualRedo) {
    return `Redo ${video.attemptNumber}`
  }
  if (video.isRetry && video.epochNumber > 0) {
    return `Retry ${video.epochNumber}`
  }
  if (video.attemptNumber > 1) {
    return `Attempt ${video.attemptNumber}`
  }
  return 'Initial'
}

/**
 * Get the total number of unique problems that have recordings
 */
export function getUniqueProblemsWithRecordings(videos: VideoAttemptInfo[]): number[] {
  const problemNumbers = new Set(videos.map((v) => v.problemNumber))
  return Array.from(problemNumbers).sort((a, b) => a - b)
}

/**
 * Group videos by problem number
 */
export function groupVideosByProblem(videos: VideoAttemptInfo[]): Map<number, VideoAttemptInfo[]> {
  const grouped = new Map<number, VideoAttemptInfo[]>()

  for (const video of videos) {
    const existing = grouped.get(video.problemNumber) ?? []
    existing.push(video)
    grouped.set(video.problemNumber, existing)
  }

  // Sort each group
  for (const [problemNumber, attempts] of grouped) {
    grouped.set(
      problemNumber,
      attempts.sort((a, b) => {
        if (a.epochNumber !== b.epochNumber) return a.epochNumber - b.epochNumber
        return a.attemptNumber - b.attemptNumber
      })
    )
  }

  return grouped
}

/**
 * Check if a problem has multiple recording attempts
 */
export function hasMultipleAttempts(videos: VideoAttemptInfo[], problemNumber: number): boolean {
  return getVideoAttemptsForProblem(videos, problemNumber).length > 1
}

/**
 * Get the latest (most recent) attempt for a problem
 */
export function getLatestAttempt(
  videos: VideoAttemptInfo[],
  problemNumber: number
): VideoAttemptInfo | null {
  const attempts = getVideoAttemptsForProblem(videos, problemNumber)
  return attempts.length > 0 ? attempts[attempts.length - 1] : null
}

/**
 * Build the API URL for a video with epoch/attempt params
 */
export function buildVideoUrl(
  playerId: string,
  sessionId: string,
  problemNumber: number,
  epochNumber: number,
  attemptNumber: number
): string {
  return `/api/curriculum/${playerId}/sessions/${sessionId}/problems/${problemNumber}/video?epoch=${epochNumber}&attempt=${attemptNumber}`
}

/**
 * Build the API URL for metadata with epoch/attempt params
 */
export function buildMetadataUrl(
  playerId: string,
  sessionId: string,
  problemNumber: number,
  epochNumber: number,
  attemptNumber: number
): string {
  return `/api/curriculum/${playerId}/sessions/${sessionId}/problems/${problemNumber}/metadata?epoch=${epochNumber}&attempt=${attemptNumber}`
}

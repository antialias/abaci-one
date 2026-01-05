/**
 * Types for session attachments (photos) and their parsing state
 *
 * These types are used across:
 * - API responses from /api/curriculum/[playerId]/sessions/[sessionId]/attachments
 * - SummaryClient component
 * - PhotoViewerEditor component
 * - OfflineWorkSection component
 */

/**
 * LLM metadata captured during worksheet parsing
 */
export interface AttachmentLLMMetadata {
  provider: string | null
  model: string | null
  promptUsed: string | null
  rawResponse: string | null
  jsonSchema: string | null
  imageSource: string | null
  attempts: number | null
  usage: {
    promptTokens: number | null
    completionTokens: number | null
    totalTokens: number | null
  }
}

/**
 * Corner coordinates for perspective crop
 */
export interface Corner {
  x: number
  y: number
}

/**
 * Valid rotation values (degrees clockwise)
 */
export type Rotation = 0 | 90 | 180 | 270

/**
 * Session attachment response from the API
 *
 * Used by: SummaryClient, useQuery for attachments
 */
export interface SessionAttachmentResponse {
  id: string
  url: string
  originalUrl: string | null
  corners: Corner[] | null
  rotation: Rotation
  // Parsing workflow state
  parsingStatus: string | null
  parsedAt: string | null
  parsingError: string | null
  rawParsingResult: object | null
  approvedResult: object | null
  confidenceScore: number | null
  needsReview: boolean
  sessionCreated: boolean
  createdSessionId: string | null
  // Review progress (for resumable reviews)
  reviewProgress: object | null
  // LLM metadata
  llm: AttachmentLLMMetadata | null
}

/**
 * State for document adjustment modal during file upload
 */
export interface DocumentAdjustmentState {
  originalFile: File
  sourceCanvas: HTMLCanvasElement
  corners: Corner[]
}

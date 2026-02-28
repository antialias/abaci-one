/**
 * Shared voice call framework — re-exports.
 *
 * Provides a generic WebRTC-based voice call infrastructure on top of
 * the OpenAI Realtime API. Consumers provide domain-specific modes,
 * tool handlers, and UI via VoiceSessionConfig<TContext>.
 */

export { useVoiceCall } from './useVoiceCall'
export { PhoneCallOverlay, MiniWaveform, RingAnimation } from './PhoneCallOverlay'
export { playRingTone } from './ringTone'
export { createRealtimeSession } from './createRealtimeSession'
export {
  sendToolResponse,
  sendSystemMessage,
  sendImageContext,
} from './toolCallHelpers'

export type {
  RealtimeTool,
  VoiceMode,
  ToolCallResult,
  VoiceSessionConfig,
  CallState,
  TimerConfig,
  UseVoiceCallReturn,
  ModeTransition,
  ModeDebugInfo,
} from './types'

export type {
  CreateRealtimeSessionOptions,
  RealtimeSessionResult,
  RealtimeSessionError,
} from './createRealtimeSession'

export type { PhoneCallOverlayProps } from './PhoneCallOverlay'

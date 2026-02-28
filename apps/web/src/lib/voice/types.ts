/**
 * Shared types for the voice call framework.
 *
 * Generic types extracted from the number-line's voice system to support
 * multiple consumers (number-line, Euclid, future toys).
 */

/** Tool definition for the OpenAI Realtime API (JSON Schema format). */
export interface RealtimeTool {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/** A generic voice session mode — controls instructions + tools for a phase of the call. */
export interface VoiceMode<TContext> {
  id: string
  getInstructions: (ctx: TContext) => string
  getTools: (ctx: TContext) => RealtimeTool[]
}

/** What a tool call handler returns to the framework. */
export interface ToolCallResult {
  /** JSON-serializable output sent as function_call_output */
  output: unknown
  /** Whether to prompt a model response after the tool output (default: true) */
  promptResponse?: boolean
  /** Enter this mode after sending the tool result */
  enterMode?: string
  /** Exit back to previous mode after sending the tool result */
  exitMode?: boolean
  /**
   * Async follow-up: the framework sends `output` immediately, then awaits
   * this promise. When it resolves, the result is sent as a follow-up
   * conversation.item.create + response.create.
   */
  asyncResult?: Promise<{ text: string; exitMode?: boolean }>
  /** If true, the framework handles hang_up logic (ending state + cleanup) */
  isHangUp?: boolean
  /** If true, the framework handles transfer logic */
  isTransfer?: boolean
  /** Target number for transfers */
  transferTarget?: number
}

/** Call lifecycle state. Consumers can extend with domain-specific states. */
export type CallState = 'idle' | 'ringing' | 'active' | 'ending' | 'error'

/** Timer configuration for call duration limits. */
export interface TimerConfig {
  /** Base call duration in ms (default: 2 min) */
  baseDurationMs: number
  /** Extension duration in ms (default: 2 min) */
  extensionMs: number
  /** Warn this many ms before the call ends (default: 15s) */
  warningBeforeEndMs: number
  /** Show "Goodbye!" for this long before cleanup (default: 2s) */
  hangUpDelayMs: number
}

/** Consumer-provided configuration for a voice call session. */
export interface VoiceSessionConfig<TContext> {
  /** API route path for session token creation */
  sessionEndpoint: string
  /** Build the current context object from refs/state */
  buildContext: () => TContext
  /** Initial mode ID when a call starts */
  initialModeId: string
  /** Map of mode ID → VoiceMode definition */
  modes: Record<string, VoiceMode<TContext>>
  /**
   * Handle a tool call. Return a ToolCallResult to respond, or null to
   * indicate the framework should ignore this tool (unhandled).
   */
  onToolCall: (name: string, args: Record<string, unknown>, ctx: TContext) => ToolCallResult | null
  /**
   * Called on response.done — return a mode ID to transition to, or null
   * to stay in the current mode.
   */
  onResponseDone?: (ctx: TContext, currentModeId: string) => string | null
  /** Called when a child speech transcript is received */
  onChildSpeech?: (transcript: string) => void
  /** Called when a model speech transcript is received */
  onModelSpeech?: (transcript: string) => void
  /** POST body for session creation (merged with framework defaults) */
  getSessionBody: () => Record<string, unknown>
  /** Process the session creation response (store scenario, profile, etc.) */
  onSessionCreated?: (data: Record<string, unknown>) => void
  /** Timer configuration (optional — defaults apply) */
  timer?: Partial<TimerConfig>
  /** OpenAI voice ID */
  voice?: string
  /**
   * Called when time is running low — lets consumer inject a winding-down
   * mode transition or system message.
   */
  onTimeWarning?: (dc: RTCDataChannel, timeRemainingMs: number) => void
  /**
   * Called when time has expired — lets consumer trigger hang-up mode.
   */
  onTimeExpired?: (dc: RTCDataChannel) => void
  /**
   * Optional hook called on session.created — e.g. inject history context.
   * Called before the initial response.create.
   */
  onSessionEstablished?: (dc: RTCDataChannel) => void
  /**
   * Harmless error codes to suppress (e.g. 'response_cancel_not_active').
   * Framework has sensible defaults; consumer can add more.
   */
  suppressErrorCodes?: string[]
  /**
   * Raw response.done handler — receives the full message payload.
   * Called BEFORE the mode-transition logic from onResponseDone.
   * Use for deferred actions that depend on agent audio finishing (e.g. exploration start).
   */
  onResponseDoneRaw?: (dc: RTCDataChannel, msg: Record<string, unknown>, currentModeId: string) => void
  /**
   * Called when response.created fires — lets consumer cancel VAD-triggered
   * responses during narration playback.
   */
  onResponseCreated?: (dc: RTCDataChannel) => void
  /**
   * Called when the framework processes a transfer tool result.
   * Receives the target and a cleanup callback.
   */
  onTransfer?: (target: number, cleanup: () => void, redial: () => void) => void
}

/** Debug info for mode transitions. */
export interface ModeTransition {
  from: string
  to: string
  action: string
  timestamp: number
  tools: string[]
}

export interface ModeDebugInfo {
  current: string
  previous: string | null
  transitions: ModeTransition[]
}

/** Return type of the useVoiceCall hook. */
export interface UseVoiceCallReturn {
  state: CallState
  error: string | null
  errorCode: string | null
  dial: () => void
  hangUp: () => void
  timeRemaining: number | null
  isSpeaking: boolean
  /** Send a system-level message to the voice agent */
  sendSystemMessage: (text: string, promptResponse?: boolean) => void
  /** Send an image to the conversation */
  sendImageContext: (base64DataUrl: string) => void
  /** Send a combined text+image context update (silent, no response prompt) */
  sendContextUpdate: (text: string, base64DataUrl?: string | null) => void
  /** The current system instructions (for debug panel) */
  currentInstructions: string | null
  /** Debug info for mode state machine */
  modeDebug: ModeDebugInfo
  /** Raw data channel ref — for advanced consumer use */
  dcRef: React.RefObject<RTCDataChannel | null>
  /** Whether the agent's audio is currently playing */
  agentAudioPlayingRef: React.RefObject<boolean>
  /** Enter a new mode */
  enterMode: (modeId: string, action?: string) => void
  /** Exit back to previous mode */
  exitMode: (action?: string) => void
  /** Refresh the current mode's instructions/tools */
  updateSession: (action?: string) => void
  /** Extend the call timer by the configured extensionMs */
  extendTimer: () => boolean
  /** Audio element ref — for consumers that need volume control (e.g. narration muting) */
  audioElRef: React.RefObject<HTMLAudioElement | null>
}

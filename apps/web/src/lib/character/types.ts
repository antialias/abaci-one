/** Attitude-specific personality block for a character. */
export interface CharacterAttitudePersonality {
  /** How they behave in this attitude (was `teachingStyle` for teacher) */
  style: string
  /** What they must NOT do in this attitude */
  dontDo: string
  /** Hidden vulnerability triggered by specific topics */
  hiddenDepth?: string
}

/** Static character identity — personality, visual identity, chat config. */
export interface CharacterDefinition {
  id: string
  displayName: string
  /** Native-script name (e.g., "Εὐκλείδης") — shown in chat header */
  nativeDisplayName?: string
  profileImage: string
  /** Personality blocks — core identity + attitude-keyed behaviors */
  personality: {
    /** Core identity — WHO they are (shared across all attitudes) */
    character: string
    /** Domain constraints — axiomatic framework, tools of geometry, etc.
     *  Used in author mode instead of the full character personality. */
    domainConstraints?: string
    /** Domain-specific point/label naming conventions (shared) */
    pointLabeling?: string
    /** Attitude-specific personality blocks */
    attitudes: {
      teacher: CharacterAttitudePersonality
      heckler?: CharacterAttitudePersonality
      author?: CharacterAttitudePersonality
    }
  }
  /** Chat-specific UI strings */
  chat: {
    placeholder: string
    emptyPrompt: string
    streamingLabel: string
  }
}

/** A single chat message. */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /** How this message was created — absent for normal typed SSE chat. */
  via?: 'voice' | 'typed-during-call'
  /** True when this message is a system error, not a character response. */
  isError?: boolean
  /** True when this message is a construction event notice, not user/character speech. */
  isEvent?: boolean
  /** Data URL of a screenshot sent alongside this event (e.g. what the voice model sees). */
  imageDataUrl?: string
  /** True when this message represents a tool action (compact display, not conversation). */
  isToolAction?: boolean
}

/**
 * Pluggable entity marker system for a domain.
 *
 * Allows characters to define domain-specific inline markers
 * (e.g., geometric entities like {seg:AB}) that render as hoverable
 * highlighted spans in chat messages.
 */
/** Voice call state projected into the chat panel. */
export interface ChatCallState {
  state: 'idle' | 'ringing' | 'preconnected' | 'active' | 'ending' | 'error'
  timeRemaining: number | null
  isSpeaking: boolean
  isThinking: boolean
  /** Label shown during think_hard (e.g. "Consulting scrolls") */
  thinkingLabel?: string
  error: string | null
  errorCode: string | null
  onHangUp: () => void
  onRetry: () => void
}

export interface EntityMarkerConfig<TEntityRef> {
  /** Regex with capture groups. Must use the `g` flag. */
  pattern: RegExp
  /** Parse captured groups into entity + display text. Return null to skip. */
  parseMatch: (groups: string[]) => { entity: TEntityRef; displayText: string } | null
}

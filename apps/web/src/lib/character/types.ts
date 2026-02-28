/** Static character identity — personality, visual identity, chat config. */
export interface CharacterDefinition {
  id: string
  displayName: string
  /** Native-script name (e.g., "Εὐκλείδης") — shown in chat header */
  nativeDisplayName?: string
  profileImage: string
  /** Personality blocks — concatenated into system prompts */
  personality: {
    character: string
    teachingStyle: string
    dontDo: string
    /** Triggered only by specific topics */
    hiddenDepth?: string
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
}

/**
 * Pluggable entity marker system for a domain.
 *
 * Allows characters to define domain-specific inline markers
 * (e.g., geometric entities like {seg:AB}) that render as hoverable
 * highlighted spans in chat messages.
 */
export interface EntityMarkerConfig<TEntityRef> {
  /** Regex with capture groups. Must use the `g` flag. */
  pattern: RegExp
  /** Parse captured groups into entity + display text. Return null to skip. */
  parseMatch: (groups: string[]) => { entity: TEntityRef; displayText: string } | null
}

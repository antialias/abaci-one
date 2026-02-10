export type AudioTone =
  | 'math-dictation'
  | 'celebration'
  | 'corrective'
  | 'encouragement'
  | 'tutorial-instruction'
  | 'tutorial-celebration'

interface ClipMeta {
  text: string
  tone: AudioTone
}

const registry = new Map<string, ClipMeta>()

/**
 * Declare and register an audio clip.
 *
 * Call at module scope — the clip is added to a global registry
 * the first time the module is evaluated.
 *
 * @returns The clip ID (pass-through for convenience).
 */
export function audioClip(id: string, text: string, tone: AudioTone): string {
  const existing = registry.get(id)
  if (existing && (existing.text !== text || existing.tone !== tone)) {
    throw new Error(`audioClip: duplicate ID "${id}" registered with different text/tone`)
  }
  registry.set(id, { text, tone })
  return id
}

export function getClipMeta(id: string): ClipMeta | undefined {
  return registry.get(id)
}

export function getAllRegisteredClips(): Array<ClipMeta & { id: string }> {
  return Array.from(registry.entries()).map(([id, meta]) => ({ id, ...meta }))
}

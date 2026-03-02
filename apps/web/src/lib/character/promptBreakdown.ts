/**
 * Prompt layer breakdown — types and utilities for decomposing assembled
 * prompts into annotated sections for admin display.
 *
 * Generic enough to handle layered/composed prompts (base number + prime
 * layer + mode layer, etc.), not just Euclid's two-tier split.
 */

/** A section of a composed prompt, tagged by its source layer. */
export interface PromptSection {
  /** Human label for this section (e.g. "CHARACTER", "PRONUNCIATION") */
  label: string
  /** Machine ID for the layer (e.g. "core-personality", "voice-conversing") */
  layerId: string
  /** Human label for the layer (e.g. "Core Personality", "Voice: Conversing") */
  layerLabel: string
  /** Relative source file path (for admin reference) */
  sourceFile: string
  /** Named export, or null for inline text */
  sourceExport: string | null
  /** The prompt text */
  text: string
  /** Rough token estimate (chars / 4) */
  tokenEstimate: number
}

/** The full prompt breakdown for a mode/medium. */
export interface PromptBreakdown {
  sections: PromptSection[]
  totalTokens: number
  /** Aggregated token count per layer (layerId → total tokens) */
  tokensByLayer: Record<string, number>
}

/** Definition of a known prompt block for matching within assembled prompts. */
export interface KnownBlock {
  /** The exact text to search for within the assembled prompt */
  text: string
  /** Label for display */
  label: string
  /** Which layer this block belongs to */
  layerId: string
  layerLabel: string
  /** Source file (relative) */
  sourceFile: string
  /** Named export or null */
  sourceExport: string | null
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Split a fully assembled prompt into annotated sections by matching
 * known block strings.
 *
 * For each known block found in the prompt, it creates a PromptSection.
 * Text between known blocks is captured as "inline" sections attributed
 * to the specified default layer.
 */
export function splitPromptByKnownBlocks(
  fullPrompt: string,
  knownBlocks: KnownBlock[],
  defaultLayer: { layerId: string; layerLabel: string; sourceFile: string }
): PromptBreakdown {
  const sections: PromptSection[] = []

  // Find all known blocks and their positions
  const found: Array<{ block: KnownBlock; start: number; end: number }> = []
  for (const block of knownBlocks) {
    const idx = fullPrompt.indexOf(block.text)
    if (idx !== -1) {
      found.push({ block, start: idx, end: idx + block.text.length })
    }
  }

  // Sort by position
  found.sort((a, b) => a.start - b.start)

  // Walk through the prompt, capturing gaps and blocks
  let cursor = 0
  let inlineCounter = 0

  for (const { block, start, end } of found) {
    // Capture text between cursor and this block
    if (start > cursor) {
      const gap = fullPrompt.slice(cursor, start).trim()
      if (gap) {
        inlineCounter++
        sections.push({
          label: extractSectionLabel(gap) || `Inline #${inlineCounter}`,
          layerId: defaultLayer.layerId,
          layerLabel: defaultLayer.layerLabel,
          sourceFile: defaultLayer.sourceFile,
          sourceExport: null,
          text: gap,
          tokenEstimate: estimateTokens(gap),
        })
      }
    }

    sections.push({
      label: block.label,
      layerId: block.layerId,
      layerLabel: block.layerLabel,
      sourceFile: block.sourceFile,
      sourceExport: block.sourceExport,
      text: block.text,
      tokenEstimate: estimateTokens(block.text),
    })

    cursor = end
  }

  // Capture trailing text
  if (cursor < fullPrompt.length) {
    const tail = fullPrompt.slice(cursor).trim()
    if (tail) {
      inlineCounter++
      sections.push({
        label: extractSectionLabel(tail) || `Inline #${inlineCounter}`,
        layerId: defaultLayer.layerId,
        layerLabel: defaultLayer.layerLabel,
        sourceFile: defaultLayer.sourceFile,
        sourceExport: null,
        text: tail,
        tokenEstimate: estimateTokens(tail),
      })
    }
  }

  // Compute totals
  const totalTokens = sections.reduce((sum, s) => sum + s.tokenEstimate, 0)
  const tokensByLayer: Record<string, number> = {}
  for (const s of sections) {
    tokensByLayer[s.layerId] = (tokensByLayer[s.layerId] ?? 0) + s.tokenEstimate
  }

  return { sections, totalTokens, tokensByLayer }
}

/**
 * Try to extract a section label from inline text by looking for
 * `=== SECTION NAME ===` headers.
 */
function extractSectionLabel(text: string): string | null {
  const match = text.match(/^=== (.+?) ===/)
  if (match) return match[1]
  // Also try at the start after leading whitespace
  const trimMatch = text.trim().match(/^=== (.+?) ===/)
  return trimMatch ? trimMatch[1] : null
}

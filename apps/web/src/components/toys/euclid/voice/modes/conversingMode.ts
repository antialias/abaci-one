/**
 * Conversing mode — main voice conversation with the geometry character.
 *
 * Uses character personality + attitude framing to produce the system prompt.
 * The teacher guides through steps; the heckler delivers commentary.
 */

import type { CharacterDefinition } from '@/lib/character/types'
import type { VoiceMode } from '@/lib/voice/types'
import type { GeometryModeContext } from '../types'
import type { AttitudeDefinition } from '../attitudes/types'
import { getAttitudePersonality } from '../attitudes/types'
import { teacherAttitude } from '../attitudes/teacher'
import { PROPOSITION_SUMMARIES, buildReferenceContext } from '../euclidReferenceContext'
import { serializeFullProofState } from '../serializeProofState'
import { EUCLID_CHARACTER_DEF } from '../../euclidCharacterDef'
import { buildCompletionContext as buildEuclidCompletionContext } from '../../euclidCharacter'

export interface CreateConversingModeOptions {
  character: CharacterDefinition
  /** Build the post-completion context block for a given proposition */
  buildCompletionContext: (propId: number) => string
  attitude?: AttitudeDefinition
}

/** Create a conversing mode for a given character and attitude. */
export function createConversingMode(
  opts: CreateConversingModeOptions
): VoiceMode<GeometryModeContext> {
  const { character, buildCompletionContext, attitude = teacherAttitude } = opts
  const conv = attitude.conversing

  return {
    id: 'conversing',

    getInstructions(ctx) {
      const propSummary = PROPOSITION_SUMMARIES[ctx.propositionId]
      const propDesc = propSummary
        ? `Proposition I.${ctx.propositionId}: "${propSummary.statement}" (${propSummary.type})`
        : `Proposition I.${ctx.propositionId}`

      // Build step guidance (or skip for attitudes that don't guide)
      const stepInfo = conv.buildStepGuidance
        ? conv.buildStepGuidance(ctx, buildCompletionContext)
        : ctx.isComplete
          ? 'The construction is complete.'
          : `The student is on step ${ctx.currentStep + 1} of ${ctx.totalSteps}. You are NOT guiding them.`

      const proofState = serializeFullProofState(ctx.construction, ctx.proofFacts)
      const referenceContext = buildReferenceContext(ctx.propositionId)
      const attitudePersonality = getAttitudePersonality(character, attitude.id)

      return `You are ${character.displayName}${character.nativeDisplayName ? ` (${character.nativeDisplayName})` : ''}. ${conv.roleIntro}

=== CURRENT PROPOSITION ===
${propDesc}
${stepInfo}

=== CONSTRUCTION & PROOF STATE ===
${proofState}

=== REFERENCE MATERIAL ===
${referenceContext}

${character.personality.character}

${attitudePersonality.style}

${attitudePersonality.dontDo}

${character.personality.pointLabeling ?? ''}

${conv.highlightInstructions}

${conv.thinkHardInstructions}

${conv.liveUpdateInstructions}

=== PRONUNCIATION ===
Points are labeled with single capital letters (A, B, C, D, E, F, G, etc.).
When speaking point names aloud, pronounce them as the letter name — "A" (ay), "B" (bee), "C" (see), "D" (dee), "E" (ee), "F" (eff), "G" (jee).
For segments like "AB", say "A B" (two separate letters). For "AF", say "A F" (ay eff). Never run letters together into a word.

${attitudePersonality.hiddenDepth ?? ''}

${conv.responseGuidelines}
`
    },

    getTools() {
      return [attitude.tools.highlight, attitude.tools.thinkHard, attitude.tools.hangUp]
    },
  }
}

/** Default Euclid conversing mode (backward compat). */
export const conversingMode = createConversingMode({
  character: EUCLID_CHARACTER_DEF,
  buildCompletionContext: buildEuclidCompletionContext,
})

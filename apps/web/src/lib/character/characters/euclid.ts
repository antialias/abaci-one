/**
 * Euclid character data provider for the admin panel.
 *
 * Assembles all character data — identity, personality blocks, voice mode
 * prompts, text chat prompt, tools, mode transitions — into a single
 * introspectable structure.
 */

import {
  EUCLID_CHARACTER,
  EUCLID_TEACHING_STYLE,
  EUCLID_WHAT_NOT_TO_DO,
  EUCLID_POINT_LABELING,
  EUCLID_DIAGRAM_QUESTION,
} from '@/components/toys/euclid/euclidCharacter'
import { EUCLID_CHARACTER_DEF } from '@/components/toys/euclid/euclidCharacterDef'
import { PROP_REGISTRY } from '@/components/toys/euclid/propositions/registry'
import { PROPOSITION_SUMMARIES } from '@/components/toys/euclid/voice/euclidReferenceContext'
import { conversingMode } from '@/components/toys/euclid/voice/modes/conversingMode'
import { greetingMode } from '@/components/toys/euclid/voice/modes/greetingMode'
import { thinkingMode } from '@/components/toys/euclid/voice/modes/thinkingMode'
import { TOOL_HANG_UP, TOOL_HIGHLIGHT, TOOL_THINK_HARD } from '@/components/toys/euclid/voice/tools'
import { buildEuclidChatSystemPrompt } from '@/components/toys/euclid/chat/buildChatSystemPrompt'
import type { EuclidModeContext } from '@/components/toys/euclid/voice/types'
import {
  splitPromptByKnownBlocks,
  type KnownBlock,
  type PromptBreakdown,
} from '../promptBreakdown'
import { getVariantSuffix, type ProfileSize, type ProfileTheme, type ProfileState } from '../../profile-variants'
import type { CharacterSummary, CharacterData, CharacterDataProvider, ProfileVariantPath } from './index'

/** Personality block metadata for the admin panel. */
const PERSONALITY_BLOCKS = [
  {
    key: 'character',
    label: 'CHARACTER',
    text: EUCLID_CHARACTER,
    sourceFile: 'src/components/toys/euclid/euclidCharacter.ts',
    sourceExport: 'EUCLID_CHARACTER',
  },
  {
    key: 'teachingStyle',
    label: 'TEACHING STYLE',
    text: EUCLID_TEACHING_STYLE,
    sourceFile: 'src/components/toys/euclid/euclidCharacter.ts',
    sourceExport: 'EUCLID_TEACHING_STYLE',
  },
  {
    key: 'dontDo',
    label: 'WHAT NOT TO DO',
    text: EUCLID_WHAT_NOT_TO_DO,
    sourceFile: 'src/components/toys/euclid/euclidCharacter.ts',
    sourceExport: 'EUCLID_WHAT_NOT_TO_DO',
  },
  {
    key: 'pointLabeling',
    label: 'POINT LABELING',
    text: EUCLID_POINT_LABELING,
    sourceFile: 'src/components/toys/euclid/euclidCharacter.ts',
    sourceExport: 'EUCLID_POINT_LABELING',
  },
  {
    key: 'hiddenDepth',
    label: 'THE DIAGRAM QUESTION',
    text: EUCLID_DIAGRAM_QUESTION,
    sourceFile: 'src/components/toys/euclid/euclidCharacter.ts',
    sourceExport: 'EUCLID_DIAGRAM_QUESTION',
  },
] as const

/** Known blocks used for prompt breakdown. */
const KNOWN_BLOCKS: KnownBlock[] = PERSONALITY_BLOCKS.map((b) => ({
  text: b.text,
  label: b.label,
  layerId: 'core-personality',
  layerLabel: 'Core Personality',
  sourceFile: b.sourceFile,
  sourceExport: b.sourceExport,
}))

/** Build a sample EuclidModeContext for prompt generation. */
function buildSampleContext(propositionId: number, step: number): EuclidModeContext {
  const prop = PROP_REGISTRY[propositionId]
  const propSummary = PROPOSITION_SUMMARIES[propositionId]
  const steps = prop?.steps ?? []
  const totalSteps = steps.length
  const currentStep = Math.min(step, totalSteps - 1)

  return {
    propositionId,
    propositionTitle: propSummary?.statement ?? prop?.title ?? `Proposition I.${propositionId}`,
    propositionKind: (propSummary?.type?.toLowerCase() as 'construction' | 'theorem') ?? 'construction',
    currentStep: Math.max(0, currentStep),
    totalSteps,
    isComplete: false,
    construction: { elements: [], nextLabelIndex: 0, nextColorIndex: 0 },
    proofFacts: [],
    screenshotDataUrl: null,
    playgroundMode: false,
    steps,
  }
}

/** Build the prompt breakdown for a voice mode. */
function buildVoiceModeBreakdown(
  modeId: string,
  prompt: string,
  sourceFile: string
): PromptBreakdown {
  return splitPromptByKnownBlocks(prompt, KNOWN_BLOCKS, {
    layerId: `voice-${modeId}`,
    layerLabel: `Voice: ${modeId.charAt(0).toUpperCase() + modeId.slice(1)}`,
    sourceFile,
  })
}

/** Build the prompt breakdown for text chat. */
function buildChatBreakdown(prompt: string): PromptBreakdown {
  return splitPromptByKnownBlocks(prompt, KNOWN_BLOCKS, {
    layerId: 'text-chat',
    layerLabel: 'Text Chat',
    sourceFile: 'src/app/api/realtime/euclid/chat/route.ts',
  })
}

/** Available propositions for context selector. */
function getAvailablePropositions(): Array<{ id: number; title: string; type: string }> {
  return Object.entries(PROPOSITION_SUMMARIES).map(([id, p]) => ({
    id: Number(id),
    title: p.statement,
    type: p.type,
  }))
}

export const euclidProvider: CharacterDataProvider = {
  id: 'euclid',

  getSummary(): CharacterSummary {
    return {
      id: 'euclid',
      displayName: EUCLID_CHARACTER_DEF.displayName,
      nativeDisplayName: EUCLID_CHARACTER_DEF.nativeDisplayName,
      profileImage: EUCLID_CHARACTER_DEF.profileImage,
      type: 'historical-figure',
    }
  },

  getFullData(opts): CharacterData {
    const propositionId = opts?.propositionId ?? 1
    const step = opts?.step ?? 0
    const sampleCtx = buildSampleContext(propositionId, step)

    // Generate prompts from actual mode functions
    const greetingPrompt = greetingMode.getInstructions(sampleCtx)
    const conversingPrompt = conversingMode.getInstructions(sampleCtx)
    const thinkingPrompt = thinkingMode.getInstructions(sampleCtx)
    const chatPrompt = buildEuclidChatSystemPrompt({
      propositionId,
      currentStep: step,
      isComplete: false,
      playgroundMode: false,
      constructionGraph: 'Points: A(0,0), B(1,0)\nSegments: AB',
      toolState: 'No tool selected',
      proofFacts: 'No facts proven yet.',
      stepList: sampleCtx.steps
        .map((s, i) => `${i === step ? '→' : i < step ? '✓' : ' '} Step ${i + 1}: ${s.instruction}`)
        .join('\n'),
      isMobile: false,
    })

    // Build all 18 variant paths from the base profile image (3 sizes × 3 themes × 2 states)
    const baseImage = EUCLID_CHARACTER_DEF.profileImage
    const sizes: ProfileSize[] = ['default', 'sm', 'lg']
    const themes: ProfileTheme[] = ['default', 'light', 'dark']
    const states: ProfileState[] = ['idle', 'speaking']
    const profileVariants: ProfileVariantPath[] = sizes.flatMap((size) =>
      themes.flatMap((theme) =>
        states.map((state) => ({
          size,
          theme,
          state,
          path: baseImage.replace('.png', `${getVariantSuffix(size, theme, state)}.png`),
        }))
      )
    )

    return {
      identity: {
        id: 'euclid',
        displayName: EUCLID_CHARACTER_DEF.displayName,
        nativeDisplayName: EUCLID_CHARACTER_DEF.nativeDisplayName,
        profileImage: EUCLID_CHARACTER_DEF.profileImage,
        type: 'historical-figure',
        profilePrompt: [
          "Portrait of Euclid (Εὐκλείδης) of Alexandria, depicted as an iPhone contact profile picture.",
          "Circular crop-friendly composition centered on the face/bust.",
          "Ancient Greek man, dignified, wise, warm expression, short curly grey-white beard, draped in a simple cream chiton.",
          "Background: warm parchment with faint geometric compass arcs and construction lines in the style of Oliver Byrne's illustrated Euclid — bold flat primary colors (red, blue, gold) for the geometric accents.",
          "Art style: clean illustration, slightly stylized (not photorealistic), warm tones, approachable and friendly — this is a teacher children will talk to.",
          "No text, no labels, no letters. Square 1:1 composition.",
        ].join(' '),
        profileVariants,
      },

      personalityBlocks: PERSONALITY_BLOCKS.map((b) => ({
        key: b.key,
        label: b.label,
        text: b.text,
        tokenEstimate: Math.ceil(b.text.length / 4),
        sourceFile: b.sourceFile,
        sourceExport: b.sourceExport,
      })),

      chatConfig: {
        placeholder: EUCLID_CHARACTER_DEF.chat.placeholder,
        emptyPrompt: EUCLID_CHARACTER_DEF.chat.emptyPrompt,
        streamingLabel: EUCLID_CHARACTER_DEF.chat.streamingLabel,
        sourceFile: 'src/components/toys/euclid/euclidCharacterDef.ts',
      },

      modes: {
        greeting: {
          id: 'greeting',
          label: 'Greeting',
          trigger: 'Call established',
          exit: 'Student speaks → onResponseDone → transition to conversing',
          tools: ['hang_up'],
          prompt: greetingPrompt,
          promptBreakdown: buildVoiceModeBreakdown(
            'greeting',
            greetingPrompt,
            'src/components/toys/euclid/voice/modes/greetingMode.ts'
          ),
          sourceFile: 'src/components/toys/euclid/voice/modes/greetingMode.ts',
        },
        conversing: {
          id: 'conversing',
          label: 'Conversing',
          trigger: 'Greeting complete + student spoke',
          exit: 'None (temporarily enters thinking via think_hard tool)',
          tools: ['highlight', 'think_hard', 'hang_up'],
          prompt: conversingPrompt,
          promptBreakdown: buildVoiceModeBreakdown(
            'conversing',
            conversingPrompt,
            'src/components/toys/euclid/voice/modes/conversingMode.ts'
          ),
          sourceFile: 'src/components/toys/euclid/voice/modes/conversingMode.ts',
        },
        thinking: {
          id: 'thinking',
          label: 'Thinking',
          trigger: 'think_hard tool called',
          exit: 'Async result → system message + auto-exit to conversing',
          tools: ['hang_up'],
          prompt: thinkingPrompt,
          promptBreakdown: buildVoiceModeBreakdown(
            'thinking',
            thinkingPrompt,
            'src/components/toys/euclid/voice/modes/thinkingMode.ts'
          ),
          sourceFile: 'src/components/toys/euclid/voice/modes/thinkingMode.ts',
        },
        chat: {
          id: 'chat',
          label: 'Text Chat',
          trigger: 'User opens chat panel',
          exit: 'N/A — always available',
          tools: [],
          prompt: chatPrompt,
          promptBreakdown: buildChatBreakdown(chatPrompt),
          sourceFile: 'src/app/api/realtime/euclid/chat/route.ts',
          api: 'gpt-5.2 Responses API',
        },
      },

      modeTransitions: [
        { from: 'greeting', to: 'conversing', trigger: 'Student speaks' },
        { from: 'conversing', to: 'thinking', trigger: 'think_hard tool called' },
        { from: 'thinking', to: 'conversing', trigger: 'Async result arrives' },
      ],

      tools: [
        {
          name: TOOL_HIGHLIGHT.name,
          description: TOOL_HIGHLIGHT.description,
          parameters: TOOL_HIGHLIGHT.parameters,
          modes: ['conversing'],
          behavior: 'Golden glow on canvas entity, 4s auto-clear',
          promptResponse: false,
        },
        {
          name: TOOL_THINK_HARD.name,
          description: TOOL_THINK_HARD.description,
          parameters: TOOL_THINK_HARD.parameters,
          modes: ['conversing'],
          behavior: 'Async: screenshot + proof state → POST → enterMode: thinking → asyncResult → auto-exit',
          promptResponse: true,
        },
        {
          name: TOOL_HANG_UP.name,
          description: TOOL_HANG_UP.description,
          parameters: TOOL_HANG_UP.parameters,
          modes: ['greeting', 'conversing', 'thinking'],
          behavior: 'isHangUp: true → wait for audio → cleanup',
          promptResponse: true,
        },
      ],

      availablePropositions: getAvailablePropositions(),
      currentPropositionId: propositionId,
      currentStep: step,
    }
  },
}

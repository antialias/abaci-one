/**
 * Pappus character data provider for the admin panel.
 *
 * Derives all prompts from the canonical GeometryTeacherConfig to ensure
 * admin panel shows exactly the same prompts as runtime.
 */

import {
  PAPPUS_CHARACTER,
  PAPPUS_TEACHING_STYLE,
  PAPPUS_WHAT_NOT_TO_DO,
  PAPPUS_POINT_LABELING,
  PAPPUS_HIDDEN_DEPTH,
} from '@/components/toys/euclid/pappusCharacter'
import { PROP_REGISTRY } from '@/components/toys/euclid/propositions/registry'
import { PROPOSITION_SUMMARIES } from '@/components/toys/euclid/voice/euclidReferenceContext'
import { TOOL_HANG_UP, TOOL_HIGHLIGHT, TOOL_THINK_HARD } from '@/components/toys/euclid/voice/tools'
import { pappusConfig } from '@/components/toys/euclid/characters/pappusConfig'
import type { GeometryModeContext } from '@/components/toys/euclid/voice/types'
import { splitPromptByKnownBlocks, type KnownBlock, type PromptBreakdown } from '../promptBreakdown'
import {
  getVariantSuffix,
  type ProfileSize,
  type ProfileTheme,
  type ProfileState,
} from '../../profile-variants'
import type {
  CharacterSummary,
  CharacterData,
  CharacterDataProvider,
  ProfileVariantPath,
} from './index'

/** Personality block metadata for the admin panel. */
const PERSONALITY_BLOCKS = [
  {
    key: 'character',
    label: 'CHARACTER',
    text: PAPPUS_CHARACTER,
    sourceFile: 'src/components/toys/euclid/pappusCharacter.ts',
    sourceExport: 'PAPPUS_CHARACTER',
  },
  {
    key: 'teachingStyle',
    label: 'TEACHING STYLE',
    text: PAPPUS_TEACHING_STYLE,
    sourceFile: 'src/components/toys/euclid/pappusCharacter.ts',
    sourceExport: 'PAPPUS_TEACHING_STYLE',
  },
  {
    key: 'dontDo',
    label: 'WHAT NOT TO DO',
    text: PAPPUS_WHAT_NOT_TO_DO,
    sourceFile: 'src/components/toys/euclid/pappusCharacter.ts',
    sourceExport: 'PAPPUS_WHAT_NOT_TO_DO',
  },
  {
    key: 'pointLabeling',
    label: 'POINT LABELING',
    text: PAPPUS_POINT_LABELING,
    sourceFile: 'src/components/toys/euclid/pappusCharacter.ts',
    sourceExport: 'PAPPUS_POINT_LABELING',
  },
  {
    key: 'hiddenDepth',
    label: 'THE COMPLETENESS QUESTION',
    text: PAPPUS_HIDDEN_DEPTH,
    sourceFile: 'src/components/toys/euclid/pappusCharacter.ts',
    sourceExport: 'PAPPUS_HIDDEN_DEPTH',
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

/** Build a sample GeometryModeContext for prompt generation. */
function buildSampleContext(propositionId: number, step: number): GeometryModeContext {
  const prop = PROP_REGISTRY[propositionId]
  const propSummary = PROPOSITION_SUMMARIES[propositionId]
  const steps = prop?.steps ?? []
  const totalSteps = steps.length
  const currentStep = Math.min(step, totalSteps - 1)

  return {
    propositionId,
    propositionTitle: propSummary?.statement ?? prop?.title ?? `Proposition I.${propositionId}`,
    propositionKind:
      (propSummary?.type?.toLowerCase() as 'construction' | 'theorem') ?? 'construction',
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

const def = pappusConfig.definition

export const pappusProvider: CharacterDataProvider = {
  id: 'pappus',

  getSummary(): CharacterSummary {
    return {
      id: 'pappus',
      displayName: def.displayName,
      nativeDisplayName: def.nativeDisplayName,
      profileImage: def.profileImage,
      type: 'historical-figure',
    }
  },

  getFullData(opts): CharacterData {
    const propositionId = opts?.propositionId ?? 5
    const step = opts?.step ?? 0
    const sampleCtx = buildSampleContext(propositionId, step)

    // Generate prompts from the canonical GeometryTeacherConfig modes
    const greetingPrompt = pappusConfig.modes.greeting.getInstructions(sampleCtx)
    const conversingPrompt = pappusConfig.modes.conversing.getInstructions(sampleCtx)
    const thinkingPrompt = pappusConfig.modes.thinking.getInstructions(sampleCtx)
    const chatPrompt = pappusConfig.buildChatSystemPrompt({
      propositionId,
      currentStep: step,
      isComplete: false,
      playgroundMode: false,
      constructionGraph: 'Points: A(0,2), B(-2,-1), C(2,-1)\nSegments: AB, AC, BC',
      toolState: 'No tool selected',
      proofFacts: 'No facts proven yet.',
      stepList: sampleCtx.steps
        .map(
          (s, i) =>
            `${i === step ? '\u2192' : i < step ? '\u2713' : ' '} Step ${i + 1}: ${s.instruction}`
        )
        .join('\n'),
      isMobile: false,
    })

    // Build all 18 variant paths from the base profile image (3 sizes × 3 themes × 2 states)
    const baseImage = def.profileImage
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
        id: 'pappus',
        displayName: def.displayName,
        nativeDisplayName: def.nativeDisplayName,
        profileImage: def.profileImage,
        type: 'historical-figure',
        profilePrompt: [
          'Portrait of Pappus (\u03A0\u03AC\u03C0\u03C0\u03BF\u03C2) of Alexandria, depicted as an iPhone contact profile picture.',
          'Circular crop-friendly composition centered on the face/bust.',
          'Late Roman-era Greek man, scholarly, warm but serious expression, neatly trimmed grey beard, draped in a simple linen himation.',
          "Background: warm parchment with faint geometric diagrams — circles, triangles, and construction lines in muted tones, subtly referencing the style of Byrne's illustrated Euclid.",
          'Art style: clean illustration, slightly stylized (not photorealistic), warm tones, approachable and scholarly — this is a teacher children will talk to.',
          'No text, no labels, no letters. Square 1:1 composition.',
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
        placeholder: def.chat.placeholder,
        emptyPrompt: def.chat.emptyPrompt,
        streamingLabel: def.chat.streamingLabel,
        sourceFile: 'src/components/toys/euclid/pappusCharacterDef.ts',
      },

      modes: {
        greeting: {
          id: 'greeting',
          label: 'Greeting',
          trigger: 'Call established',
          exit: 'Student speaks \u2192 onResponseDone \u2192 transition to conversing',
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
          exit: 'Async result \u2192 system message + auto-exit to conversing',
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
          exit: 'N/A \u2014 always available',
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
          behavior:
            'Async: screenshot + proof state \u2192 POST \u2192 enterMode: thinking \u2192 asyncResult \u2192 auto-exit',
          promptResponse: true,
        },
        {
          name: TOOL_HANG_UP.name,
          description: TOOL_HANG_UP.description,
          parameters: TOOL_HANG_UP.parameters,
          modes: ['greeting', 'conversing', 'thinking'],
          behavior: 'isHangUp: true \u2192 wait for audio \u2192 cleanup',
          promptResponse: true,
        },
      ],

      availablePropositions: getAvailablePropositions(),
      currentPropositionId: propositionId,
      currentStep: step,
    }
  },
}

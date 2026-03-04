import {
  PAPPUS_CHARACTER,
  PAPPUS_TEACHING_STYLE,
  PAPPUS_WHAT_NOT_TO_DO,
  PAPPUS_HIDDEN_DEPTH,
  PAPPUS_POINT_LABELING,
} from './pappusCharacter'
import type { CharacterDefinition } from '@/lib/character/types'

export const PAPPUS_CHARACTER_DEF: CharacterDefinition = {
  id: 'pappus',
  displayName: 'Pappus',
  nativeDisplayName: '\u03A0\u03AC\u03C0\u03C0\u03BF\u03C2',
  profileImage: '/images/pappus-profile.png',
  personality: {
    character: PAPPUS_CHARACTER,
    pointLabeling: PAPPUS_POINT_LABELING,
    attitudes: {
      teacher: {
        style: PAPPUS_TEACHING_STYLE,
        dontDo: PAPPUS_WHAT_NOT_TO_DO,
        hiddenDepth: PAPPUS_HIDDEN_DEPTH,
      },
    },
  },
  chat: {
    placeholder: 'Ask Pappus...',
    emptyPrompt: 'Ask Pappus about the proof, the reasoning, or what to consider next.',
    streamingLabel: 'Pappus is writing...',
  },
}

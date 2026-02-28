import {
  EUCLID_CHARACTER,
  EUCLID_TEACHING_STYLE,
  EUCLID_WHAT_NOT_TO_DO,
  EUCLID_DIAGRAM_QUESTION,
} from './euclidCharacter'
import type { CharacterDefinition } from '@/lib/character/types'

export const EUCLID_CHARACTER_DEF: CharacterDefinition = {
  id: 'euclid',
  displayName: 'Euclid',
  nativeDisplayName: '\u0395\u1F50\u03BA\u03BB\u03B5\u03AF\u03B4\u03B7\u03C2',
  profileImage: '/images/euclid-profile.png',
  personality: {
    character: EUCLID_CHARACTER,
    teachingStyle: EUCLID_TEACHING_STYLE,
    dontDo: EUCLID_WHAT_NOT_TO_DO,
    hiddenDepth: EUCLID_DIAGRAM_QUESTION,
  },
  chat: {
    placeholder: 'Ask Euclid...',
    emptyPrompt: 'Ask Euclid about the construction, proof, or what to do next.',
    streamingLabel: 'Euclid is writing...',
  },
}

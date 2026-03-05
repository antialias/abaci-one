import {
  EUCLID_CHARACTER,
  EUCLID_DOMAIN_CONSTRAINTS,
  EUCLID_TEACHING_STYLE,
  EUCLID_WHAT_NOT_TO_DO,
  EUCLID_DIAGRAM_QUESTION,
  EUCLID_POINT_LABELING,
  EUCLID_HECKLER_STYLE,
  EUCLID_HECKLER_DONT,
  EUCLID_HECKLER_HIDDEN_DEPTH,
} from './euclidCharacter'
import type { CharacterDefinition } from '@/lib/character/types'

export const EUCLID_CHARACTER_DEF: CharacterDefinition = {
  id: 'euclid',
  displayName: 'Euclid',
  nativeDisplayName: '\u0395\u1F50\u03BA\u03BB\u03B5\u03AF\u03B4\u03B7\u03C2',
  profileImage: '/images/euclid-profile.png',
  personality: {
    character: EUCLID_CHARACTER,
    domainConstraints: EUCLID_DOMAIN_CONSTRAINTS,
    pointLabeling: EUCLID_POINT_LABELING,
    attitudes: {
      teacher: {
        style: EUCLID_TEACHING_STYLE,
        dontDo: EUCLID_WHAT_NOT_TO_DO,
        hiddenDepth: EUCLID_DIAGRAM_QUESTION,
      },
      heckler: {
        style: EUCLID_HECKLER_STYLE,
        dontDo: EUCLID_HECKLER_DONT,
        hiddenDepth: EUCLID_HECKLER_HIDDEN_DEPTH,
      },
      author: {
        style:
          'You are a collaborative authoring assistant. Be direct and efficient — suggest the next axiom to apply or fact to record. No personality, no character voice.',
        dontDo:
          'Do NOT add character personality, flowery language, or pedagogical framing. Do NOT teach — collaborate.',
      },
    },
  },
  chat: {
    placeholder: 'Ask Euclid...',
    emptyPrompt: 'Ask Euclid about the construction, proof, or what to do next.',
    streamingLabel: 'Euclid is writing...',
  },
}

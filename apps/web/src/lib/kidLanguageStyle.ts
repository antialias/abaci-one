import type { KidLanguageStyle } from '@/db/schema/player-session-preferences'

export const KID_LANGUAGE_STYLES: Array<{
  id: KidLanguageStyle
  label: string
  description: string
}> = [
  {
    id: 'simple',
    label: 'Simple',
    description: 'Short sentences and concrete wording for younger readers.',
  },
  {
    id: 'standard',
    label: 'Clear',
    description: 'Clear terms with brief explanations.',
  },
  {
    id: 'classical',
    label: 'Formal',
    description: 'Closest to traditional translations and formal phrasing.',
  },
]

export function getRecommendedKidLanguageStyle(age?: number | null): KidLanguageStyle {
  if (age == null) return 'standard'
  if (age <= 10) return 'simple'
  if (age <= 13) return 'standard'
  return 'classical'
}

export function resolveKidLanguageStyle(
  preferred: KidLanguageStyle | null | undefined,
  age?: number | null
): KidLanguageStyle {
  return preferred ?? getRecommendedKidLanguageStyle(age)
}

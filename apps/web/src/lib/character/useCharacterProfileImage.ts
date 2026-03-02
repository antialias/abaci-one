'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { getVariantSuffix, type ProfileSize, type ProfileTheme, type ProfileState } from '@/lib/profile-variants'

type SizeHint = ProfileSize

/**
 * Returns the correct theme-, size-, and state-aware profile image URL.
 *
 * Reads the current resolved theme (light/dark) from ThemeContext and
 * combines it with a size hint and optional speaking flag to select the right variant.
 */
export function useCharacterProfileImage(
  baseProfileImage: string,
  size: SizeHint = 'default',
  speaking: boolean = false,
): string {
  const { resolvedTheme } = useTheme()
  const theme: ProfileTheme = resolvedTheme // 'light' | 'dark' — both valid ProfileTheme values
  const state: ProfileState = speaking ? 'speaking' : 'idle'
  const suffix = getVariantSuffix(size, theme, state)
  return baseProfileImage.replace('.png', `${suffix}.png`)
}

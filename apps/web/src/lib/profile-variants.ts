/**
 * Shared types and utilities for profile image size×theme variants.
 *
 * Lives outside both `character/` and `tasks/` to avoid circular dependencies
 * (the task handler imports from character, and character needs these types).
 */

export type ProfileSize = 'default' | 'sm' | 'lg'
export type ProfileTheme = 'default' | 'light' | 'dark'
export type ProfileState = 'idle' | 'speaking'

/**
 * Build the filename suffix for a size+theme+state combination.
 * Order: {size}-{state}-{theme}
 * Examples: '' (base idle), '-sm', '-light', '-sm-light', '-speaking', '-sm-speaking-light', '-lg-speaking-dark'
 * The 'idle' state produces no suffix addition, preserving all existing paths.
 */
export function getVariantSuffix(
  size: ProfileSize,
  theme: ProfileTheme,
  state: ProfileState = 'idle'
): string {
  const parts: string[] = []
  if (size !== 'default') parts.push(size)
  if (state !== 'idle') parts.push(state)
  if (theme !== 'default') parts.push(theme)
  return parts.length > 0 ? `-${parts.join('-')}` : ''
}

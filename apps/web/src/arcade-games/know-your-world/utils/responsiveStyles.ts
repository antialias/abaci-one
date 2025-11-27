/**
 * Responsive style utilities for consistent breakpoint handling.
 * Centralizes responsive patterns used across Know Your World components.
 */

/**
 * Breakpoint keys matching Panda CSS convention.
 * - base: 0px+ (mobile)
 * - sm: 640px+ (small tablets)
 * - md: 768px+ (tablets/small desktop)
 * - lg: 1024px+ (desktop)
 * - xl: 1280px+ (large desktop)
 */
export const BREAKPOINTS = {
  mobile: 'base',
  tablet: 'sm',
  desktop: 'md',
  wide: 'lg',
} as const

/**
 * Creates responsive display styles for showing/hiding elements.
 *
 * @example
 * // Show only on desktop
 * className={css(responsiveDisplay({ showOn: 'desktop' }))}
 *
 * // Show only on mobile
 * className={css(responsiveDisplay({ hideOn: 'desktop' }))}
 */
export function responsiveDisplay(options: {
  showOn?: 'mobile' | 'desktop'
  hideOn?: 'mobile' | 'desktop'
}): { display: Record<string, string> } {
  if (options.showOn === 'desktop') {
    return { display: { base: 'none', md: 'flex' } }
  }
  if (options.showOn === 'mobile') {
    return { display: { base: 'flex', md: 'none' } }
  }
  if (options.hideOn === 'desktop') {
    return { display: { base: 'flex', md: 'none' } }
  }
  if (options.hideOn === 'mobile') {
    return { display: { base: 'none', md: 'flex' } }
  }
  return { display: { base: 'flex' } }
}

/**
 * Creates responsive transform scale styles.
 * Commonly used for shrinking controls on mobile.
 *
 * @example
 * // 75% on mobile, 100% on tablet+
 * className={css(responsiveScale(0.75, 1))}
 */
export function responsiveScale(
  mobileScale: number,
  desktopScale: number = 1,
  origin: string = 'top right'
): {
  transform: Record<string, string>
  transformOrigin: string
} {
  return {
    transform: {
      base: `scale(${mobileScale})`,
      sm: `scale(${desktopScale})`,
    },
    transformOrigin: origin,
  }
}

/**
 * Creates responsive spacing/gap styles.
 *
 * @example
 * className={css(responsiveGap(1, 2))}
 */
export function responsiveGap(
  mobileGap: number | string,
  desktopGap: number | string
): { gap: Record<string, number | string> } {
  return {
    gap: {
      base: mobileGap,
      sm: desktopGap,
    },
  }
}

/**
 * Creates responsive flex direction styles.
 * Useful for stacking elements vertically on mobile.
 *
 * @example
 * // Stack on mobile, row on desktop
 * className={css(responsiveFlexDirection('column', 'row'))}
 */
export function responsiveFlexDirection(
  mobileDirection: 'row' | 'column',
  desktopDirection: 'row' | 'column'
): { flexDirection: Record<string, 'row' | 'column'> } {
  return {
    flexDirection: {
      base: mobileDirection,
      sm: desktopDirection,
    },
  }
}

/**
 * Creates responsive font size styles.
 *
 * @example
 * className={css(responsiveFontSize('sm', 'md'))}
 */
export function responsiveFontSize(
  mobileSize: string,
  desktopSize: string
): { fontSize: Record<string, string> } {
  return {
    fontSize: {
      base: mobileSize,
      sm: desktopSize,
    },
  }
}

/**
 * CSS trick to prevent a flex child from expanding its parent.
 * Sets width to 0 but min-width to 100% so it fills available space
 * without contributing to parent's width calculation.
 */
export const preventFlexExpansion = {
  width: 0,
  minWidth: '100%',
} as const

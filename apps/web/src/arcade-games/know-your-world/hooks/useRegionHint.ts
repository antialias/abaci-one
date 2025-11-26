import { useMemo, useRef } from 'react'
import { useLocale } from 'next-intl'
import { getHints, hasHints, type HintMap } from '../messages'
import type { Locale } from '@/i18n/messages'

/**
 * Hook to get a randomly selected hint for a region in the current locale.
 * The hint is selected once when the region changes and stays consistent
 * for that region prompt. Different hints may appear on subsequent attempts
 * at the same region.
 *
 * Returns null if no hints exist for the region.
 */
export function useRegionHint(map: HintMap, regionId: string | null): string | null {
  const locale = useLocale() as Locale
  // Track which region we last selected a hint for
  const lastRegionRef = useRef<string | null>(null)
  const selectedHintRef = useRef<string | null>(null)

  // When region changes, select a new random hint
  const hint = useMemo(() => {
    if (!regionId) {
      lastRegionRef.current = null
      selectedHintRef.current = null
      return null
    }

    const hints = getHints(locale, map, regionId)
    if (!hints || hints.length === 0) {
      lastRegionRef.current = regionId
      selectedHintRef.current = null
      return null
    }

    // If same region, return previously selected hint
    if (regionId === lastRegionRef.current && selectedHintRef.current !== null) {
      return selectedHintRef.current
    }

    // New region - select a random hint
    const randomIndex = Math.floor(Math.random() * hints.length)
    const selected = hints[randomIndex]

    lastRegionRef.current = regionId
    selectedHintRef.current = selected

    return selected
  }, [locale, map, regionId])

  return hint
}

/**
 * Hook to check if hints exist for a region in the current locale
 */
export function useHasRegionHint(map: HintMap, regionId: string | null): boolean {
  const locale = useLocale() as Locale

  if (!regionId) {
    return false
  }

  return hasHints(locale, map, regionId)
}

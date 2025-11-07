'use client'

import { useState, useEffect, useRef } from 'react'
import type { WorksheetFormState } from '../types'
import { defaultAdditionConfig } from '../../config-schemas'

interface UseWorksheetStateReturn {
  formState: WorksheetFormState
  debouncedFormState: WorksheetFormState
  updateFormState: (updates: Partial<WorksheetFormState>) => void
}

/**
 * Manage worksheet state with debouncing and seed regeneration
 *
 * Features:
 * - Immediate form state updates for controls
 * - Debounced state updates for preview (500ms)
 * - Automatic seed regeneration when problem settings change
 * - StrictMode-safe (handles double renders)
 */
export function useWorksheetState(
  initialSettings: Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
): UseWorksheetStateReturn {
  // Calculate derived state from initial settings
  const problemsPerPage = initialSettings.problemsPerPage ?? 20
  const pages = initialSettings.pages ?? 1
  const cols = initialSettings.cols ?? 5
  const rows = Math.ceil((problemsPerPage * pages) / cols)
  const total = problemsPerPage * pages

  // Immediate form state (for controls - updates instantly)
  const [formState, setFormState] = useState<WorksheetFormState>(() => {
    const initial = {
      ...initialSettings,
      rows,
      total,
      date: '', // Will be set at generation time
      // Ensure displayRules is always defined (critical for difficulty adjustment)
      displayRules: initialSettings.displayRules ?? defaultAdditionConfig.displayRules,
      pAnyStart: initialSettings.pAnyStart ?? defaultAdditionConfig.pAnyStart,
      pAllStart: initialSettings.pAllStart ?? defaultAdditionConfig.pAllStart,
    }
    console.log('[useWorksheetState] Initial formState:', {
      seed: initial.seed,
      displayRules: initial.displayRules,
    })
    return initial
  })

  // Debounced form state (for preview - updates after delay)
  const [debouncedFormState, setDebouncedFormState] = useState<WorksheetFormState>(() => {
    console.log('[useWorksheetState] Initial debouncedFormState (same as formState)')
    return formState
  })

  // Store the previous formState to detect real changes
  const prevFormStateRef = useRef(formState)

  // Log whenever debouncedFormState changes (this triggers preview re-fetch)
  useEffect(() => {
    console.log('[useWorksheetState] debouncedFormState changed - preview will re-fetch:', {
      seed: debouncedFormState.seed,
      problemsPerPage: debouncedFormState.problemsPerPage,
    })
  }, [debouncedFormState])

  // Debounce preview updates (500ms delay) - only when formState actually changes
  useEffect(() => {
    console.log('[useWorksheetState Debounce] Triggered')
    console.log('[useWorksheetState Debounce] Current formState seed:', formState.seed)
    console.log(
      '[useWorksheetState Debounce] Previous formState seed:',
      prevFormStateRef.current.seed
    )

    // Skip if formState hasn't actually changed (handles StrictMode double-render)
    if (formState === prevFormStateRef.current) {
      console.log('[useWorksheetState Debounce] Skipping - formState reference unchanged')
      return
    }

    prevFormStateRef.current = formState

    console.log('[useWorksheetState Debounce] Setting timer to update debouncedFormState in 500ms')
    const timer = setTimeout(() => {
      console.log('[useWorksheetState Debounce] Timer fired - updating debouncedFormState')
      setDebouncedFormState(formState)
    }, 500)

    return () => {
      console.log('[useWorksheetState Debounce] Cleanup - clearing timer')
      clearTimeout(timer)
    }
  }, [formState])

  const updateFormState = (updates: Partial<WorksheetFormState>) => {
    setFormState((prev) => {
      const newState = { ...prev, ...updates }

      // Generate new seed when problem settings change
      const affectsProblems =
        updates.problemsPerPage !== undefined ||
        updates.cols !== undefined ||
        updates.pages !== undefined ||
        updates.orientation !== undefined ||
        updates.pAnyStart !== undefined ||
        updates.pAllStart !== undefined ||
        updates.interpolate !== undefined

      if (affectsProblems) {
        newState.seed = Date.now() % 2147483647
      }

      return newState
    })
  }

  return {
    formState,
    debouncedFormState,
    updateFormState,
  }
}

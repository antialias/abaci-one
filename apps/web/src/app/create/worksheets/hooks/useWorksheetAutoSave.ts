'use client'

import { useState, useEffect, useRef } from 'react'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { extractConfigFields } from '../utils/extractConfigFields'

interface UseWorksheetAutoSaveReturn {
  isSaving: boolean
  lastSaved: Date | null
}

/**
 * Auto-save worksheet settings to server
 *
 * Features:
 * - Debounced auto-save (1000ms delay)
 * - Persists settings including seed and prngAlgorithm for problem reproducibility
 * - Excludes transient state (date, rows, total)
 * - Persists V4 fields: mode, digitRange, displayRules, difficultyProfile, manualPreset
 * - Silent error handling (auto-save is not critical)
 * - StrictMode-safe (handles double renders)
 */
export function useWorksheetAutoSave(
  formState: WorksheetFormState,
  worksheetType: 'addition'
): UseWorksheetAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Store the previous formState for auto-save to detect real changes
  const prevAutoSaveFormStateRef = useRef(formState)

  // Auto-save settings when they change (debounced) - skip on initial mount
  useEffect(() => {
    // Skip auto-save if formState hasn't actually changed (handles StrictMode double-render)
    if (formState === prevAutoSaveFormStateRef.current) {
      console.log('[useWorksheetAutoSave] Skipping auto-save - formState reference unchanged')
      return
    }

    prevAutoSaveFormStateRef.current = formState

    console.log('[useWorksheetAutoSave] Settings changed, will save in 1s...')

    const timer = setTimeout(async () => {
      console.log('[useWorksheetAutoSave] Attempting to save settings...')
      setIsSaving(true)
      try {
        // Extract persisted config fields (includes seed/prngAlgorithm, excludes date and derived state)
        const config = extractConfigFields(formState)

        const response = await fetch('/api/worksheets/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: worksheetType,
            config,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[useWorksheetAutoSave] Save response:', data)
          if (data.success) {
            console.log('[useWorksheetAutoSave] ✓ Settings saved successfully')
            setLastSaved(new Date())
          } else {
            console.log('[useWorksheetAutoSave] Save skipped')
          }
        } else {
          console.error('[useWorksheetAutoSave] Save failed with status:', response.status)
        }
      } catch (error) {
        // Silently fail - settings persistence is not critical
        console.error('[useWorksheetAutoSave] Settings save error:', error)
      } finally {
        setIsSaving(false)
      }
    }, 1000) // 1 second debounce for auto-save

    return () => clearTimeout(timer)
  }, [formState, worksheetType])

  return {
    isSaving,
    lastSaved,
  }
}

'use client'

import { useState } from 'react'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { validateWorksheetConfig } from '../validation'

type GenerationStatus = 'idle' | 'generating' | 'error'

interface UseWorksheetGenerationReturn {
  status: GenerationStatus
  error: string | null
  generate: (config: WorksheetFormState) => Promise<void>
  reset: () => void
}

/**
 * Handle PDF generation workflow
 *
 * Features:
 * - Status tracking ('idle', 'generating', 'error')
 * - Validation before generation
 * - API call to generate PDF
 * - Automatic download of generated PDF
 * - Error handling with detailed messages
 */
export function useWorksheetGeneration(): UseWorksheetGenerationReturn {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const generate = async (config: WorksheetFormState) => {
    setStatus('generating')
    setError(null)

    try {
      // Validate configuration
      const validation = validateWorksheetConfig(config)
      if (!validation.isValid || !validation.config) {
        throw new Error(validation.errors?.join(', ') || 'Invalid configuration')
      }

      const response = await fetch('/api/create/worksheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        const errorResult = await response.json()
        const errorMsg = errorResult.details
          ? `${errorResult.error}\n\n${errorResult.details}`
          : errorResult.error || 'Generation failed'
        throw new Error(errorMsg)
      }

      // Success - response is binary PDF data, trigger download
      const blob = await response.blob()
      const filename = `addition-worksheet-${config.name || 'student'}-${Date.now()}.pdf`

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setStatus('idle')
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setStatus('error')
    }
  }

  const reset = () => {
    setStatus('idle')
    setError(null)
  }

  return {
    status,
    error,
    generate,
    reset,
  }
}

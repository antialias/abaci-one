'use client'

import { css } from '@styled/css'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { useWorksheetAutoSave } from '../hooks/useWorksheetAutoSave'
import { useWorksheetGeneration } from '../hooks/useWorksheetGeneration'
import { useWorksheetState } from '../hooks/useWorksheetState'
import { getDefaultDate } from '../utils/dateFormatting'
import { ConfigSidebar } from './ConfigSidebar'
import { GenerationErrorDisplay } from './GenerationErrorDisplay'
import { PreviewCenter } from './PreviewCenter'
import { ResponsivePanelLayout } from './ResponsivePanelLayout'
import { WorksheetConfigProvider } from './WorksheetConfigContext'

interface AdditionWorksheetClientProps {
  initialSettings: Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
  /** Optional initial preview - if not provided, will be fetched via API */
  initialPreview?: string[]
}

export function AdditionWorksheetClient({
  initialSettings,
  initialPreview,
}: AdditionWorksheetClientProps) {
  const searchParams = useSearchParams()
  const isFromShare = searchParams.get('from') === 'share'

  // Check for shared config in sessionStorage
  const [effectiveSettings, setEffectiveSettings] = useState(initialSettings)

  useEffect(() => {
    if (isFromShare && typeof window !== 'undefined') {
      const sharedConfigStr = sessionStorage.getItem('sharedWorksheetConfig')
      if (sharedConfigStr) {
        try {
          const sharedConfig = JSON.parse(sharedConfigStr)
          console.log('[Worksheet Client] Loading shared config:', sharedConfig)
          setEffectiveSettings(sharedConfig)
          // Clear from sessionStorage after loading
          sessionStorage.removeItem('sharedWorksheetConfig')
        } catch (err) {
          console.error('Failed to parse shared config:', err)
        }
      }
    }
  }, [isFromShare])

  console.log('[Worksheet Client] Component render, effectiveSettings:', {
    problemsPerPage: effectiveSettings.problemsPerPage,
    cols: effectiveSettings.cols,
    pages: effectiveSettings.pages,
    seed: effectiveSettings.seed,
  })

  const t = useTranslations('create.worksheets.addition')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // State management (formState, debouncedFormState, updateFormState)
  const { formState, debouncedFormState, updateFormState } = useWorksheetState(effectiveSettings)

  // Generation workflow (status, error, generate, reset)
  const { status, error, generate, reset } = useWorksheetGeneration()

  // Auto-save (isSaving, lastSaved)
  const { isSaving, lastSaved } = useWorksheetAutoSave(formState, 'addition')

  // Generate handler with date injection
  const handleGenerate = async () => {
    await generate({
      ...formState,
      date: getDefaultDate(),
    })
  }

  return (
    <PageWithNav navTitle={t('navTitle')} navEmoji="📝">
      <WorksheetConfigProvider formState={formState} updateFormState={updateFormState}>
        <div
          data-component="addition-worksheet-page"
          className={css({
            height: 'calc(100vh - var(--app-nav-height))',
            bg: isDark ? 'gray.900' : 'gray.50',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          })}
        >
          {/* Responsive Panel Layout (desktop) or Drawer (mobile) */}
          <ResponsivePanelLayout
            config={formState}
            sidebarContent={<ConfigSidebar isSaving={isSaving} lastSaved={lastSaved} />}
            previewContent={
              <PreviewCenter
                formState={debouncedFormState}
                initialPreview={initialPreview}
                onGenerate={handleGenerate}
                status={status}
              />
            }
          />

          {/* Error Display */}
          <GenerationErrorDisplay error={error} visible={status === 'error'} onRetry={reset} />
        </div>
      </WorksheetConfigProvider>
    </PageWithNav>
  )
}

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import { UploadWorksheetModal } from '@/components/worksheets/UploadWorksheetModal'
import { css } from '../../../../../../styled-system/css'
import { container, grid, stack } from '../../../../../../styled-system/patterns'
import { ConfigPanel } from './ConfigPanel'
import { WorksheetPreview } from './WorksheetPreview'
import { OrientationPanel } from './OrientationPanel'
import { GenerateButton } from './GenerateButton'
import { GenerationErrorDisplay } from './GenerationErrorDisplay'
import { useWorksheetState } from '../hooks/useWorksheetState'
import { useWorksheetGeneration } from '../hooks/useWorksheetGeneration'
import { useWorksheetAutoSave } from '../hooks/useWorksheetAutoSave'
import { getDefaultDate } from '../utils/dateFormatting'
import { calculateDerivedState } from '../utils/layoutCalculations'
import type { WorksheetFormState } from '../types'

interface AdditionWorksheetClientProps {
  initialSettings: Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
  initialPreview?: string[]
}

export function AdditionWorksheetClient({
  initialSettings,
  initialPreview,
}: AdditionWorksheetClientProps) {
  console.log('[Worksheet Client] Component render, initialSettings:', {
    problemsPerPage: initialSettings.problemsPerPage,
    cols: initialSettings.cols,
    pages: initialSettings.pages,
    seed: initialSettings.seed,
  })

  const t = useTranslations('create.worksheets.addition')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const router = useRouter()

  // State management (formState, debouncedFormState, updateFormState)
  const { formState, debouncedFormState, updateFormState } = useWorksheetState(initialSettings)

  // Generation workflow (status, error, generate, reset)
  const { status, error, generate, reset } = useWorksheetGeneration()

  // Auto-save (isSaving, lastSaved)
  const { isSaving, lastSaved } = useWorksheetAutoSave(formState, 'addition')

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  // Generate handler with date injection
  const handleGenerate = async () => {
    await generate({
      ...formState,
      date: getDefaultDate(),
    })
  }

  // Orientation change handler with automatic problemsPerPage/cols updates
  const handleOrientationChange = (
    orientation: 'portrait' | 'landscape',
    problemsPerPage: number,
    cols: number
  ) => {
    const pages = formState.pages || 1
    const { rows, total } = calculateDerivedState(problemsPerPage, pages, cols)
    updateFormState({
      orientation,
      problemsPerPage,
      cols,
      pages,
      rows,
      total,
    })
  }

  // Problems per page change handler with automatic cols update
  const handleProblemsPerPageChange = (problemsPerPage: number, cols: number) => {
    const pages = formState.pages || 1
    const { rows, total } = calculateDerivedState(problemsPerPage, pages, cols)
    updateFormState({
      problemsPerPage,
      cols,
      pages,
      rows,
      total,
    })
  }

  // Pages change handler with derived state calculation
  const handlePagesChange = (pages: number) => {
    const problemsPerPage = formState.problemsPerPage || 15
    const cols = formState.cols || 3
    const { rows, total } = calculateDerivedState(problemsPerPage, pages, cols)
    updateFormState({
      pages,
      rows,
      total,
    })
  }

  // Upload complete handler - navigate to results page
  const handleUploadComplete = (attemptId: string) => {
    router.push(`/worksheets/attempts/${attemptId}`)
  }

  return (
    <PageWithNav navTitle={t('navTitle')} navEmoji="📝">
      <div
        data-component="addition-worksheet-page"
        className={css({
          minHeight: '100vh',
          bg: isDark ? 'gray.900' : 'gray.50',
        })}
      >
        {/* Main Content */}
        <div className={container({ maxW: '7xl', px: '4', py: '8' })}>
          <div className={stack({ gap: '6', mb: '8' })}>
            <div className={stack({ gap: '2', textAlign: 'center' })}>
              <h1
                className={css({
                  fontSize: '3xl',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.100' : 'gray.900',
                })}
              >
                {t('pageTitle')}
              </h1>
              <p
                className={css({
                  fontSize: 'lg',
                  color: isDark ? 'gray.300' : 'gray.600',
                })}
              >
                {t('pageSubtitle')}
              </p>
            </div>
          </div>

          {/* Configuration Interface */}
          <div
            className={grid({
              columns: { base: 1, lg: 2 },
              gap: '8',
              alignItems: 'start',
            })}
          >
            {/* Left Column: Configuration Panel */}
            <div className={stack({ gap: '3' })}>
              <div
                data-section="config-panel"
                className={css({
                  bg: isDark ? 'gray.800' : 'white',
                  rounded: '2xl',
                  shadow: 'card',
                  p: '8',
                })}
              >
                <ConfigPanel formState={formState} onChange={updateFormState} isDark={isDark} />
              </div>

              {/* Settings saved indicator */}
              <div
                data-element="settings-status"
                className={css({
                  fontSize: 'sm',
                  color: isDark ? 'gray.300' : 'gray.600',
                  textAlign: 'center',
                  py: '2',
                })}
              >
                {isSaving ? (
                  <span className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>
                    Saving settings...
                  </span>
                ) : lastSaved ? (
                  <span
                    className={css({
                      color: isDark ? 'green.400' : 'green.600',
                    })}
                  >
                    ✓ Settings saved at {lastSaved.toLocaleTimeString()}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Right Column: Orientation, Generate, Preview */}
            <div className={stack({ gap: '8' })}>
              <OrientationPanel
                orientation={formState.orientation || 'portrait'}
                problemsPerPage={formState.problemsPerPage || 15}
                pages={formState.pages || 1}
                cols={formState.cols || 3}
                onOrientationChange={handleOrientationChange}
                onProblemsPerPageChange={handleProblemsPerPageChange}
                onPagesChange={handlePagesChange}
                isDark={isDark}
              />

              <GenerateButton status={status} onGenerate={handleGenerate} isDark={isDark} />

              {/* Upload Worksheet Button */}
              <button
                data-action="upload-worksheet"
                onClick={() => setIsUploadModalOpen(true)}
                className={css({
                  w: '100%',
                  py: 4,
                  px: 6,
                  bg: isDark ? 'purple.600' : 'purple.500',
                  color: 'white',
                  borderRadius: 'xl',
                  fontSize: 'lg',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  _hover: {
                    bg: isDark ? 'purple.700' : 'purple.600',
                    transform: 'translateY(-1px)',
                    shadow: 'lg',
                  },
                  _active: {
                    transform: 'translateY(0)',
                  },
                })}
              >
                <span>📤</span>
                <span>Upload Completed Worksheet</span>
              </button>

              <div
                data-section="preview-panel"
                className={css({
                  bg: isDark ? 'gray.800' : 'white',
                  rounded: '2xl',
                  shadow: 'card',
                  p: '6',
                })}
              >
                <WorksheetPreview
                  formState={debouncedFormState}
                  initialData={initialPreview}
                  isDark={isDark}
                />
              </div>
            </div>
          </div>

          {/* Error Display */}
          <GenerationErrorDisplay error={error} visible={status === 'error'} onRetry={reset} />
        </div>
      </div>

      {/* Upload Worksheet Modal */}
      <UploadWorksheetModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
      />
    </PageWithNav>
  )
}

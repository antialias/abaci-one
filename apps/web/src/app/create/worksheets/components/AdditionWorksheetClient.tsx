'use client'

import { css } from '@styled/css'
import { useTranslations } from 'next-intl'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
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
import { WorksheetConfigProvider } from './WorksheetConfigContext'

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

  // State management (formState, debouncedFormState, updateFormState)
  const { formState, debouncedFormState, updateFormState } = useWorksheetState(initialSettings)

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

  // Resize handle styles
  const resizeHandleStyles = css({
    width: '8px',
    bg: isDark ? 'gray.700' : 'gray.200',
    position: 'relative',
    cursor: 'col-resize',
    transition: 'background 0.2s',
    _hover: {
      bg: isDark ? 'brand.600' : 'brand.400',
    },
    _active: {
      bg: 'brand.500',
    },
    _before: {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '3px',
      height: '20px',
      bg: isDark ? 'gray.500' : 'gray.400',
      borderRadius: 'full',
      boxShadow: isDark
        ? '0 -8px 0 0 rgb(107, 114, 128), 0 8px 0 0 rgb(107, 114, 128)'
        : '0 -8px 0 0 rgb(156, 163, 175), 0 8px 0 0 rgb(156, 163, 175)',
    },
  })

  return (
    <PageWithNav navTitle={t('navTitle')} navEmoji="📝">
      <WorksheetConfigProvider formState={formState} onChange={updateFormState}>
        <div
          data-component="addition-worksheet-page"
          className={css({
            height: '100vh',
            bg: isDark ? 'gray.900' : 'gray.50',
            paddingTop: 'var(--app-nav-height)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          })}
        >
          {/* Resizable Panel Layout */}
          <PanelGroup
            direction="horizontal"
            autoSaveId="worksheet-generator-layout"
            className={css({ flex: '1', minHeight: '0' })}
          >
            {/* Left Panel: Config Sidebar */}
            <Panel defaultSize={25} minSize={20} maxSize={40} collapsible>
              <ConfigSidebar isSaving={isSaving} lastSaved={lastSaved} />
            </Panel>

            <PanelResizeHandle className={resizeHandleStyles} />

            {/* Center Panel: Preview */}
            <Panel defaultSize={75} minSize={60}>
              <PreviewCenter
                formState={debouncedFormState}
                initialPreview={initialPreview}
                onGenerate={handleGenerate}
                status={status}
              />
            </Panel>
          </PanelGroup>

          {/* Error Display */}
          <GenerationErrorDisplay error={error} visible={status === 'error'} onRetry={reset} />
        </div>
      </WorksheetConfigProvider>
    </PageWithNav>
  )
}

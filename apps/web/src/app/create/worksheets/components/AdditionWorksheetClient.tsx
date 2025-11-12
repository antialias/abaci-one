'use client'

import { css } from '@styled/css'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
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

  // Resize handle - wide enough to contain tab, but clipped to show only divider + tab
  const resizeHandleStyles = css({
    width: '36px',
    height: '100%',
    marginRight: '-28px', // Overlap the preview pane
    position: 'relative',
    cursor: 'col-resize',
    zIndex: 10,
    overflow: 'visible',
  })

  // Visual container - creates the thin divider + tab shape
  const handleVisualStyles = css({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    // Thin divider on the left
    _before: {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      width: '8px',
      height: '100%',
      background: isDark ? 'gray.700' : 'gray.200',
      transition: 'background 0.2s',
    },
    // Grip dots on divider
    _after: {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '4px',
      transform: 'translateY(-50%)',
      width: '3px',
      height: '20px',
      bg: isDark ? 'gray.400' : 'gray.500',
      borderRadius: 'full',
      boxShadow: isDark
        ? '0 -8px 0 0 rgb(156, 163, 175), 0 8px 0 0 rgb(156, 163, 175)'
        : '0 -8px 0 0 rgb(107, 114, 128), 0 8px 0 0 rgb(107, 114, 128)',
      zIndex: 2,
    },
  })

  // Grab tab with rounded corners
  const grabTabStyles = css({
    position: 'absolute',
    top: 'calc(50% - 32px)',
    left: '8px',
    width: '28px',
    height: '64px',
    background: isDark ? 'rgb(75, 85, 99)' : 'rgb(209, 213, 219)',
    borderRadius: '0 8px 8px 0',
    boxShadow: isDark ? '2px 2px 8px rgba(0, 0, 0, 0.3)' : '2px 2px 8px rgba(0, 0, 0, 0.15)',
    pointerEvents: 'none',
    transition: 'background 0.2s',
    // Knurled texture
    backgroundImage: isDark
      ? `repeating-linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.1) 0px,
          rgba(255, 255, 255, 0.1) 1px,
          transparent 1px,
          transparent 3px
        )`
      : `repeating-linear-gradient(
          90deg,
          rgba(0, 0, 0, 0.08) 0px,
          rgba(0, 0, 0, 0.08) 1px,
          transparent 1px,
          transparent 3px
        )`,
  })

  return (
    <PageWithNav navTitle={t('navTitle')} navEmoji="📝">
      <WorksheetConfigProvider formState={formState} updateFormState={updateFormState}>
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

            <PanelResizeHandle className={resizeHandleStyles}>
              <div className={handleVisualStyles}>
                <div className={grabTabStyles} data-element="grab-tab" />
              </div>
            </PanelResizeHandle>

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

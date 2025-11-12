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

  // Resize handle - 36px wide but overlaps preview by 28px
  const resizeHandleStyles = css({
    width: '36px',
    marginRight: '-28px',
    height: '100%',
    position: 'relative',
    cursor: 'col-resize',
    zIndex: 10,
  })

  // Visual appearance: thin divider + grab tab
  const handleVisualStyles = css({
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
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
                {/* Thin divider (8px, full height) */}
                <div
                  className={css({
                    width: '8px',
                    height: '100%',
                    bg: isDark ? 'gray.700' : 'gray.300',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                    _groupHover: {
                      bg: isDark ? 'blue.600' : 'blue.300',
                    },
                  })}
                >
                  {/* Grip dots on divider */}
                  <div
                    className={css({
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    })}
                  >
                    <div
                      className={css({
                        width: '3px',
                        height: '3px',
                        borderRadius: 'full',
                        bg: isDark ? 'gray.500' : 'gray.500',
                      })}
                    />
                    <div
                      className={css({
                        width: '3px',
                        height: '3px',
                        borderRadius: 'full',
                        bg: isDark ? 'gray.500' : 'gray.500',
                      })}
                    />
                    <div
                      className={css({
                        width: '3px',
                        height: '3px',
                        borderRadius: 'full',
                        bg: isDark ? 'gray.500' : 'gray.500',
                      })}
                    />
                  </div>
                </div>

                {/* Grab tab (28px wide, 64px tall, centered vertically) */}
                <div
                  className={css({
                    width: '28px',
                    height: '64px',
                    bg: isDark ? 'gray.600' : 'gray.400',
                    borderTopRightRadius: '8px',
                    borderBottomRightRadius: '8px',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                    overflow: 'hidden',
                    _groupHover: {
                      bg: isDark ? 'blue.500' : 'blue.400',
                    },
                  })}
                >
                  {/* Knurled texture (vertical ridges) - multiple visible lines */}
                  {[0, 4, 8, 12, 16, 20, 24].map((offset) => (
                    <div
                      key={offset}
                      className={css({
                        position: 'absolute',
                        left: `${offset}px`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        bg: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
                        boxShadow: isDark
                          ? '1px 0 0 rgba(0, 0, 0, 0.3)'
                          : '1px 0 0 rgba(255, 255, 255, 0.3)',
                      })}
                    />
                  ))}
                </div>
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

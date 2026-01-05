'use client'

import { css } from '@styled/css'
import { useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useTheme } from '@/contexts/ThemeContext'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { WorksheetFormState } from '../types'
import { MobileDrawer } from './MobileDrawer'
import { MobileSettingsButton } from './MobileSettingsButton'

interface ResponsivePanelLayoutProps {
  config: Partial<WorksheetFormState>
  sidebarContent: React.ReactNode
  previewContent: React.ReactNode
}

export function ResponsivePanelLayout({
  config,
  sidebarContent,
  previewContent,
}: ResponsivePanelLayoutProps) {
  const isMobile = useIsMobile()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Mobile layout: Drawer + floating button
  // eslint-disable-next-line react-hooks/rules-of-hooks -- All hooks are called before this conditional return
  if (isMobile) {
    return (
      <>
        {/* Full-screen preview */}
        <div
          data-component="mobile-preview-container"
          className={css({
            width: '100%',
            height: '100%',
            overflow: 'auto',
          })}
        >
          {previewContent}
        </div>

        {/* Floating settings button */}
        <MobileSettingsButton config={config} onClick={() => setIsDrawerOpen(true)} />

        {/* Settings drawer */}
        <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
          {sidebarContent}
        </MobileDrawer>
      </>
    )
  }

  // Desktop layout: Resizable panels
  const resizeHandleStyles = css({
    width: '36px',
    marginRight: '-28px',
    height: '100%',
    position: 'relative',
    cursor: 'col-resize',
    zIndex: 10,
  })

  const handleVisualStyles = css({
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  })

  return (
    <PanelGroup
      direction="horizontal"
      autoSaveId="worksheet-generator-layout"
      className={css({ flex: '1', minHeight: '0' })}
    >
      {/* Left Panel: Config Sidebar */}
      <Panel defaultSize={25} minSize={20} maxSize={40} collapsible>
        <div
          data-component="desktop-sidebar-container"
          className={css({
            h: 'full',
            overflow: 'auto',
          })}
        >
          {sidebarContent}
        </div>
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
        <div
          data-component="desktop-preview-container"
          className={css({
            h: 'full',
            overflow: 'auto',
          })}
        >
          {previewContent}
        </div>
      </Panel>
    </PanelGroup>
  )
}

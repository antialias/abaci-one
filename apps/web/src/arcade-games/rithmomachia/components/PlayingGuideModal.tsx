'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { css } from '../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import { OverviewSection } from './guide-sections/OverviewSection'
import { PiecesSection } from './guide-sections/PiecesSection'
import { CaptureSection } from './guide-sections/CaptureSection'
import { StrategySection } from './guide-sections/StrategySection'
import { HarmonySection } from './guide-sections/HarmonySection'
import { VictorySection } from './guide-sections/VictorySection'

interface PlayingGuideModalProps {
  isOpen: boolean
  onClose: () => void
  standalone?: boolean // True when opened in popup window
  docked?: boolean // True when docked to side
  onDock?: (side: 'left' | 'right') => void
  onUndock?: () => void
}

type Section = 'overview' | 'pieces' | 'capture' | 'strategy' | 'harmony' | 'victory'

export function PlayingGuideModal({
  isOpen,
  onClose,
  standalone = false,
  docked = false,
  onDock,
  onUndock,
}: PlayingGuideModalProps) {
  const t = useTranslations('rithmomachia.guide')
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false

  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 800
  )
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string>('')
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Debug logging for props
  useEffect(() => {
    console.log('[PlayingGuideModal] Component rendered/props changed', {
      isOpen,
      standalone,
      docked,
      hasOnDock: !!onDock,
      hasOnUndock: !!onUndock,
    })
  }, [isOpen, standalone, docked, onDock, onUndock])

  // Track window width for responsive behavior
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Center modal on mount (not in standalone mode)
  useEffect(() => {
    if (isOpen && modalRef.current && !standalone) {
      const rect = modalRef.current.getBoundingClientRect()
      setPosition({
        x: (window.innerWidth - rect.width) / 2,
        y: Math.max(50, (window.innerHeight - rect.height) / 2),
      })
    }
  }, [isOpen, standalone])

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('[PlayingGuideModal] handleMouseDown called', {
      windowWidth: window.innerWidth,
      standalone,
      docked,
      hasOnDock: !!onDock,
    })
    if (window.innerWidth < 768 || standalone) return // No dragging on mobile or standalone
    console.log('[PlayingGuideModal] Starting drag')
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    if (window.innerWidth < 768 || standalone) return
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setDragStart({ x: e.clientX, y: e.clientY })
    // Save initial dimensions and position for resize calculation
    setResizeStart({ width: size.width, height: size.height, x: position.x, y: position.y })
  }

  // Bust-out button handler
  const handleBustOut = () => {
    const url = `${window.location.origin}/arcade/rithmomachia/guide`
    const features = 'width=600,height=800,menubar=no,toolbar=no,location=no,status=no'
    window.open(url, 'RithmomachiaGuide', features)
  }

  // Mouse move effect for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      } else if (isResizing) {
        // Calculate delta from initial resize start position
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y

        let newWidth = resizeStart.width
        let newHeight = resizeStart.height
        let newX = resizeStart.x
        let newY = resizeStart.y

        // Handle different resize directions - calculate from initial state
        // Ultra-flexible minimum width for narrow layouts
        const minWidth = 150
        const minHeight = 300

        if (resizeDirection.includes('e')) {
          newWidth = Math.max(
            minWidth,
            Math.min(window.innerWidth * 0.9, resizeStart.width + deltaX)
          )
        }
        if (resizeDirection.includes('w')) {
          const desiredWidth = resizeStart.width - deltaX
          newWidth = Math.max(minWidth, Math.min(window.innerWidth * 0.9, desiredWidth))
          // Move left edge by the amount we actually changed width
          newX = resizeStart.x + (resizeStart.width - newWidth)
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(
            minHeight,
            Math.min(window.innerHeight * 0.9, resizeStart.height + deltaY)
          )
        }
        if (resizeDirection.includes('n')) {
          const desiredHeight = resizeStart.height - deltaY
          newHeight = Math.max(minHeight, Math.min(window.innerHeight * 0.9, desiredHeight))
          // Move top edge by the amount we actually changed height
          newY = resizeStart.y + (resizeStart.height - newHeight)
        }

        setSize({ width: newWidth, height: newHeight })
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      console.log('[PlayingGuideModal] handleMouseUp called', {
        isDragging,
        hasOnDock: !!onDock,
        docked,
        clientX: e.clientX,
        windowWidth: window.innerWidth,
      })

      // Check for docking when releasing drag
      if (isDragging && onDock && !docked) {
        const DOCK_THRESHOLD = 100 // pixels from edge to trigger docking
        const distanceFromLeft = e.clientX
        const distanceFromRight = window.innerWidth - e.clientX

        console.log('[PlayingGuideModal] Checking for dock', {
          distanceFromLeft,
          distanceFromRight,
          DOCK_THRESHOLD,
          shouldDockLeft: distanceFromLeft < DOCK_THRESHOLD,
          shouldDockRight: distanceFromRight < DOCK_THRESHOLD,
        })

        if (e.clientX < DOCK_THRESHOLD) {
          console.log('[PlayingGuideModal] Docking to LEFT')
          onDock('left')
        } else if (e.clientX > window.innerWidth - DOCK_THRESHOLD) {
          console.log('[PlayingGuideModal] Docking to RIGHT')
          onDock('right')
        } else {
          console.log('[PlayingGuideModal] No docking (not close enough to edges)')
        }
      } else {
        console.log('[PlayingGuideModal] Not checking for dock', {
          reason: !isDragging
            ? 'not dragging'
            : !onDock
              ? 'no onDock handler'
              : docked
                ? 'already docked'
                : 'unknown',
        })
      }

      setIsDragging(false)
      setIsResizing(false)
      setResizeDirection('')
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragStart, resizeDirection, resizeStart])

  if (!isOpen && !standalone && !docked) return null

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: t('sections.overview'), icon: '🎯' },
    { id: 'pieces', label: t('sections.pieces'), icon: '♟️' },
    { id: 'capture', label: t('sections.capture'), icon: '⚔️' },
    { id: 'strategy', label: t('sections.strategy'), icon: '🧠' },
    { id: 'harmony', label: t('sections.harmony'), icon: '🎵' },
    { id: 'victory', label: t('sections.victory'), icon: '👑' },
  ]

  // Determine layout mode based on modal width (or window width if standalone)
  const effectiveWidth = standalone ? windowWidth : size.width
  const isVeryNarrow = effectiveWidth < 250
  const isNarrow = effectiveWidth < 400
  const isMedium = effectiveWidth < 600

  const renderResizeHandles = () => {
    if (!isHovered || window.innerWidth < 768 || standalone) return null

    const handleStyle = {
      position: 'absolute' as const,
      bg: 'transparent',
      zIndex: 1,
      _hover: { borderColor: '#3b82f6' },
    }

    return (
      <>
        {/* North */}
        <div
          data-element="resize-n"
          className={css({
            ...handleStyle,
            top: 0,
            left: '8px',
            right: '8px',
            height: '8px',
            cursor: 'ns-resize',
            borderTop: '2px solid transparent',
          })}
          onMouseDown={(e) => handleResizeStart(e, 'n')}
        />
        {/* South */}
        <div
          data-element="resize-s"
          className={css({
            ...handleStyle,
            bottom: 0,
            left: '8px',
            right: '8px',
            height: '8px',
            cursor: 'ns-resize',
            borderBottom: '2px solid transparent',
          })}
          onMouseDown={(e) => handleResizeStart(e, 's')}
        />
        {/* East */}
        <div
          data-element="resize-e"
          className={css({
            ...handleStyle,
            right: 0,
            top: '8px',
            bottom: '8px',
            width: '8px',
            cursor: 'ew-resize',
            borderRight: '2px solid transparent',
          })}
          onMouseDown={(e) => handleResizeStart(e, 'e')}
        />
        {/* West */}
        <div
          data-element="resize-w"
          className={css({
            ...handleStyle,
            left: 0,
            top: '8px',
            bottom: '8px',
            width: '8px',
            cursor: 'ew-resize',
            borderLeft: '2px solid transparent',
          })}
          onMouseDown={(e) => handleResizeStart(e, 'w')}
        />
        {/* NorthEast */}
        <div
          data-element="resize-ne"
          className={css({
            ...handleStyle,
            top: 0,
            right: 0,
            width: '8px',
            height: '8px',
            cursor: 'nesw-resize',
            border: '2px solid transparent',
          })}
          onMouseDown={(e) => handleResizeStart(e, 'ne')}
        />
        {/* NorthWest */}
        <div
          data-element="resize-nw"
          className={css({
            ...handleStyle,
            top: 0,
            left: 0,
            width: '8px',
            height: '8px',
            cursor: 'nwse-resize',
            border: '2px solid transparent',
          })}
          onMouseDown={(e) => handleResizeStart(e, 'nw')}
        />
        {/* SouthEast */}
        <div
          data-element="resize-se"
          className={css({
            ...handleStyle,
            bottom: 0,
            right: 0,
            width: '8px',
            height: '8px',
            cursor: 'nwse-resize',
            border: '2px solid transparent',
          })}
          onMouseDown={(e) => handleResizeStart(e, 'se')}
        />
        {/* SouthWest */}
        <div
          data-element="resize-sw"
          className={css({
            ...handleStyle,
            bottom: 0,
            left: 0,
            width: '8px',
            height: '8px',
            cursor: 'nesw-resize',
            border: '2px solid transparent',
          })}
          onMouseDown={(e) => handleResizeStart(e, 'sw')}
        />
      </>
    )
  }

  const modalContent = (
    <div
      ref={modalRef}
      data-component="playing-guide-modal"
      style={{
        position: docked ? 'relative' : 'fixed',
        background: 'white',
        borderRadius: standalone || docked ? 0 : isVeryNarrow ? '8px' : '12px',
        boxShadow: standalone || docked ? 'none' : '0 20px 60px rgba(0, 0, 0, 0.3)',
        border: standalone || docked ? 'none' : '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...(docked
          ? { width: '100%', height: '100%' }
          : standalone
            ? { top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1 }
            : {
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                zIndex: Z_INDEX.MODAL,
              }),
        // 80% opacity on desktop when not hovered, full opacity otherwise
        opacity: !standalone && !docked && window.innerWidth >= 768 && !isHovered ? 0.8 : 1,
        transition: 'opacity 0.2s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!docked && renderResizeHandles()}

      {/* Header */}
      <div
        data-element="modal-header"
        className={css({
          bg: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          userSelect: 'none',
          flexShrink: 0,
          position: 'relative',
        })}
        style={{
          padding: isVeryNarrow ? '8px' : isNarrow ? '12px' : '24px',
          cursor:
            isDragging && !docked
              ? 'grabbing'
              : !standalone && !docked && window.innerWidth >= 768
                ? 'grab'
                : 'default',
        }}
        onMouseDown={docked ? undefined : handleMouseDown}
      >
        {/* Close and utility buttons - top right */}
        <div
          style={{
            position: 'absolute',
            top: isVeryNarrow ? '4px' : '8px',
            right: isVeryNarrow ? '4px' : '8px',
            display: 'flex',
            alignItems: 'center',
            gap: isVeryNarrow ? '4px' : '8px',
          }}
        >
          {/* Undock button (only when docked) */}
          {docked && onUndock && (
            <button
              type="button"
              data-action="undock-guide"
              onClick={onUndock}
              style={{
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: isVeryNarrow ? '4px' : '6px',
                width: isVeryNarrow ? '24px' : '32px',
                height: isVeryNarrow ? '24px' : '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: isVeryNarrow ? '12px' : '16px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#d1d5db')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#e5e7eb')}
              title="Undock guide (return to floating mode)"
            >
              ⛶
            </button>
          )}
          {/* Bust-out button (only if not already standalone/docked and not very narrow) */}
          {!standalone && !docked && !isVeryNarrow && (
            <button
              type="button"
              data-action="bust-out-guide"
              onClick={handleBustOut}
              style={{
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: isVeryNarrow ? '4px' : '6px',
                width: isVeryNarrow ? '24px' : '32px',
                height: isVeryNarrow ? '24px' : '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: isVeryNarrow ? '12px' : '16px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#d1d5db')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#e5e7eb')}
              title={t('bustOut')}
            >
              ↗
            </button>
          )}

          {/* Close button */}
          <button
            type="button"
            data-action="close-guide"
            onClick={onClose}
            style={{
              background: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: isVeryNarrow ? '4px' : '6px',
              width: isVeryNarrow ? '24px' : '32px',
              height: isVeryNarrow ? '24px' : '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: isVeryNarrow ? '14px' : '18px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#d1d5db')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#e5e7eb')}
          >
            ✕
          </button>
        </div>

        {/* Centered title and subtitle - hide when very narrow */}
        {!isVeryNarrow && (
          <div style={{ textAlign: 'center' }}>
            <h1
              style={{
                fontSize: isNarrow ? '16px' : isMedium ? '20px' : '28px',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: isNarrow ? '4px' : '8px',
                lineHeight: 1.2,
              }}
            >
              {t('title')}
            </h1>
            {!isNarrow && (
              <p
                style={{
                  fontSize: isMedium ? '12px' : '16px',
                  color: '#6b7280',
                  marginBottom: isMedium ? '8px' : '16px',
                  lineHeight: 1.3,
                }}
              >
                {t('subtitle')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs - ultra responsive with scroll indicators */}
      <div
        style={{
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          data-element="guide-nav"
          style={{
            display: 'flex',
            flexDirection: 'row', // Always horizontal, even when very narrow
            borderBottom: '2px solid #e5e7eb',
            background: '#f9fafb',
            overflow: 'auto',
            flexShrink: 0,
            // Hide scrollbar for cleaner look - indicators show scroll availability
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              data-action={`navigate-${section.id}`}
              onClick={() => setActiveSection(section.id)}
              style={{
                flex: '0 0 auto', // Don't grow or shrink, natural size
                minWidth: 'fit-content',
                padding: isVeryNarrow ? '10px 6px' : isNarrow ? '10px 8px' : '14px 20px',
                fontSize: isVeryNarrow ? '16px' : isNarrow ? '12px' : '14px',
                fontWeight: activeSection === section.id ? 'bold' : '500',
                color: activeSection === section.id ? '#7c2d12' : '#6b7280',
                background: activeSection === section.id ? 'white' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: 'none',
                borderBottom: `3px solid ${activeSection === section.id ? '#7c2d12' : 'transparent'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isVeryNarrow ? '0' : isNarrow ? '4px' : '6px',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (activeSection !== section.id) {
                  e.currentTarget.style.background = '#f3f4f6'
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== section.id) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
              title={isVeryNarrow ? section.label : undefined}
            >
              <span style={{ fontSize: isVeryNarrow ? '18px' : 'inherit' }}>{section.icon}</span>
              {!isVeryNarrow && (
                <span>{isNarrow ? section.label.split(' ')[0] : section.label}</span>
              )}
            </button>
          ))}
        </div>

        {/* Fade indicators for horizontal scroll - show at all narrow widths */}
        {(isNarrow || isVeryNarrow) && (
          <>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: isVeryNarrow ? '16px' : '20px',
                background: 'linear-gradient(to right, rgba(249, 250, 251, 0.95), transparent)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: isVeryNarrow ? '16px' : '20px',
                background: 'linear-gradient(to left, rgba(249, 250, 251, 0.95), transparent)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          </>
        )}
      </div>

      {/* Content */}
      <div
        data-element="guide-content"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: isVeryNarrow ? '8px' : isNarrow ? '12px' : '24px',
          fontSize: isVeryNarrow ? '12px' : isNarrow ? '13px' : '14px',
          lineHeight: 1.5,
        }}
      >
        {activeSection === 'overview' && (
          <OverviewSection useNativeAbacusNumbers={useNativeAbacusNumbers} />
        )}
        {activeSection === 'pieces' && (
          <PiecesSection useNativeAbacusNumbers={useNativeAbacusNumbers} />
        )}
        {activeSection === 'capture' && (
          <CaptureSection useNativeAbacusNumbers={useNativeAbacusNumbers} />
        )}
        {activeSection === 'strategy' && (
          <StrategySection useNativeAbacusNumbers={useNativeAbacusNumbers} />
        )}
        {activeSection === 'harmony' && (
          <HarmonySection useNativeAbacusNumbers={useNativeAbacusNumbers} />
        )}
        {activeSection === 'victory' && (
          <VictorySection useNativeAbacusNumbers={useNativeAbacusNumbers} />
        )}
      </div>
    </div>
  )

  // If standalone, just render the content without Dialog wrapper
  if (standalone) {
    return modalContent
  }

  // Otherwise, just render the modal (no backdrop so game is visible)
  return modalContent
}

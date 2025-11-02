'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { css } from '../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import { OverviewSection } from './guide-sections/OverviewSection'
import { PiecesSection } from './guide-sections/PiecesSection'
import { CaptureSection } from './guide-sections/CaptureSection'
import { HarmonySection } from './guide-sections/HarmonySection'
import { VictorySection } from './guide-sections/VictorySection'

interface PlayingGuideModalProps {
  isOpen: boolean
  onClose: () => void
  standalone?: boolean // True when opened in popup window
}

type Section = 'overview' | 'pieces' | 'capture' | 'strategy' | 'harmony' | 'victory'

export function PlayingGuideModal({ isOpen, onClose, standalone = false }: PlayingGuideModalProps) {
  const t = useTranslations('rithmomachia.guide')
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false

  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string>('')
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

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
    if (window.innerWidth < 768 || standalone) return // No dragging on mobile or standalone
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
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(450, Math.min(window.innerWidth * 0.9, resizeStart.width + deltaX))
        }
        if (resizeDirection.includes('w')) {
          const desiredWidth = resizeStart.width - deltaX
          newWidth = Math.max(450, Math.min(window.innerWidth * 0.9, desiredWidth))
          // Move left edge by the amount we actually changed width
          newX = resizeStart.x + (resizeStart.width - newWidth)
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(600, Math.min(window.innerHeight * 0.8, resizeStart.height + deltaY))
        }
        if (resizeDirection.includes('n')) {
          const desiredHeight = resizeStart.height - deltaY
          newHeight = Math.max(600, Math.min(window.innerHeight * 0.8, desiredHeight))
          // Move top edge by the amount we actually changed height
          newY = resizeStart.y + (resizeStart.height - newHeight)
        }

        setSize({ width: newWidth, height: newHeight })
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
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

  if (!isOpen && !standalone) return null

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: t('sections.overview'), icon: '🎯' },
    { id: 'pieces', label: t('sections.pieces'), icon: '♟️' },
    { id: 'capture', label: t('sections.capture'), icon: '⚔️' },
    { id: 'harmony', label: t('sections.harmony'), icon: '🎵' },
    { id: 'victory', label: t('sections.victory'), icon: '👑' },
  ]

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
      className={css({
        position: 'fixed',
        bg: 'white',
        borderRadius: standalone ? 0 : '12px',
        boxShadow: standalone ? 'none' : '0 20px 60px rgba(0, 0, 0, 0.3)',
        border: standalone ? 'none' : '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      })}
      style={{
        ...(standalone
          ? { top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1 }
          : {
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: `${size.width}px`,
              height: `${size.height}px`,
              zIndex: Z_INDEX.MODAL,
            }),
        // 80% opacity on desktop when not hovered, full opacity otherwise
        opacity: !standalone && window.innerWidth >= 768 && !isHovered ? 0.8 : 1,
        transition: 'opacity 0.2s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {renderResizeHandles()}

      {/* Header */}
      <div
        data-element="modal-header"
        className={css({
          bg: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          p: '24px',
          userSelect: 'none',
          flexShrink: 0,
          position: 'relative',
        })}
        onMouseDown={handleMouseDown}
        style={{
          cursor: isDragging
            ? 'grabbing'
            : !standalone && window.innerWidth >= 768
              ? 'grab'
              : 'default',
        }}
      >
        {/* Close and utility buttons - top right */}
        <div
          className={css({
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          })}
        >
          {/* Bust-out button (only if not already standalone) */}
          {!standalone && (
            <button
              type="button"
              data-action="bust-out-guide"
              onClick={handleBustOut}
              className={css({
                bg: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background 0.2s',
                _hover: { bg: '#d1d5db' },
              })}
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
            className={css({
              bg: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              transition: 'background 0.2s',
              _hover: { bg: '#d1d5db' },
            })}
          >
            ✕
          </button>
        </div>

        {/* Centered title and subtitle */}
        <div className={css({ textAlign: 'center' })}>
          <h1
            className={css({
              fontSize: { base: '24px', md: '28px' },
              fontWeight: 'bold',
              color: '#111827',
              mb: '8px',
            })}
          >
            {t('title')}
          </h1>
          <p
            className={css({
              fontSize: { base: '14px', md: '16px' },
              color: '#6b7280',
              mb: '16px',
            })}
          >
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        data-element="guide-nav"
        className={css({
          display: 'flex',
          borderBottom: '2px solid #e5e7eb',
          bg: '#f9fafb',
          overflow: 'auto',
          flexShrink: 0,
        })}
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            data-action={`navigate-${section.id}`}
            onClick={() => setActiveSection(section.id)}
            className={css({
              flex: 1,
              minWidth: 'fit-content',
              p: { base: '12px 16px', md: '14px 20px' },
              fontSize: { base: '13px', md: '14px' },
              fontWeight: activeSection === section.id ? 'bold' : '500',
              color: activeSection === section.id ? '#7c2d12' : '#6b7280',
              bg: activeSection === section.id ? 'white' : 'transparent',
              borderBottom: '3px solid',
              borderBottomColor: activeSection === section.id ? '#7c2d12' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              _hover: {
                bg: activeSection === section.id ? 'white' : '#f3f4f6',
              },
            })}
          >
            <span>{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        data-element="guide-content"
        className={css({
          flex: 1,
          overflow: 'auto',
          p: '24px',
        })}
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

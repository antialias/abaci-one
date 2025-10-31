'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { css } from '../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import '../i18n/config' // Initialize i18n
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
  const { t, i18n } = useTranslation()
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false

  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string>('')
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
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y

        let actualDeltaX = 0
        let actualDeltaY = 0

        setSize((prev) => {
          let newWidth = prev.width
          let newHeight = prev.height
          let newX = position.x
          let newY = position.y

          // Handle different resize directions
          if (resizeDirection.includes('e')) {
            const desiredWidth = prev.width + deltaX
            newWidth = Math.max(450, Math.min(window.innerWidth * 0.9, desiredWidth))
            actualDeltaX = newWidth - prev.width
          }
          if (resizeDirection.includes('w')) {
            const desiredWidth = prev.width - deltaX
            newWidth = Math.max(450, Math.min(window.innerWidth * 0.9, desiredWidth))
            const widthDiff = newWidth - prev.width
            newX = position.x - widthDiff
            actualDeltaX = -widthDiff
          }
          if (resizeDirection.includes('s')) {
            const desiredHeight = prev.height + deltaY
            newHeight = Math.max(600, Math.min(window.innerHeight * 0.8, desiredHeight))
            actualDeltaY = newHeight - prev.height
          }
          if (resizeDirection.includes('n')) {
            const desiredHeight = prev.height - deltaY
            newHeight = Math.max(600, Math.min(window.innerHeight * 0.8, desiredHeight))
            const heightDiff = newHeight - prev.height
            newY = position.y - heightDiff
            actualDeltaY = -heightDiff
          }

          if (newX !== position.x || newY !== position.y) {
            setPosition({ x: newX, y: newY })
          }

          return { width: newWidth, height: newHeight }
        })

        // Only update dragStart by the amount that was actually applied
        setDragStart({
          x: dragStart.x + actualDeltaX,
          y: dragStart.y + actualDeltaY,
        })
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
  }, [isDragging, isResizing, dragStart, position, resizeDirection])

  if (!isOpen && !standalone) return null

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: t('guide.sections.overview', 'Quick Start'), icon: '🎯' },
    { id: 'pieces', label: t('guide.sections.pieces', 'Pieces'), icon: '♟️' },
    { id: 'capture', label: t('guide.sections.capture', 'Capture'), icon: '⚔️' },
    { id: 'harmony', label: t('guide.sections.harmony', 'Harmony'), icon: '🎵' },
    { id: 'victory', label: t('guide.sections.victory', 'Victory'), icon: '👑' },
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
              title={t('guide.bustOut', 'Open in new window')}
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
            {t('guide.title', 'Rithmomachia Playing Guide')}
          </h1>
          <p
            className={css({
              fontSize: { base: '14px', md: '16px' },
              color: '#6b7280',
              mb: '16px',
            })}
          >
            {t('guide.subtitle', "Rithmomachia – The Philosophers' Game")}
          </p>

          {/* Language selector */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            })}
          >
            <label
              htmlFor="language-select"
              className={css({ fontSize: '14px', color: '#374151' })}
            >
              {t('guide.languageSelector.label', 'Language')}:
            </label>
            <select
              id="language-select"
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className={css({
                px: '12px',
                py: '6px',
                fontSize: '14px',
                bg: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#111827',
                _hover: { borderColor: '#9ca3af' },
                _focus: {
                  outline: 'none',
                  borderColor: '#3b82f6',
                  boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
                },
              })}
            >
              <option value="en">{t('guide.languageSelector.en', 'English')}</option>
              <option value="de">{t('guide.languageSelector.de', 'Deutsch')}</option>
            </select>
          </div>
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

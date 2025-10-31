'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { css } from '../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import { PieceRenderer } from './PieceRenderer'
import { RithmomachiaBoard, type ExamplePiece } from './RithmomachiaBoard'
import type { PieceType, Color } from '../types'
import '../i18n/config' // Initialize i18n

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
          p: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
          flexShrink: 0,
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
        <h2
          className={css({
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#111827',
          })}
        >
          {t('guide.title', 'Rithmomachia Playing Guide')}
        </h2>

        <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
          {/* Language switcher */}
          <div className={css({ display: 'flex', gap: '8px' })}>
            {['en', 'de'].map((lang) => (
              <button
                key={lang}
                type="button"
                data-action={`language-${lang}`}
                onClick={() => i18n.changeLanguage(lang)}
                className={css({
                  px: '8px',
                  py: '4px',
                  fontSize: '12px',
                  fontWeight: i18n.language === lang ? 'bold' : 'normal',
                  bg: i18n.language === lang ? '#3b82f6' : '#e5e7eb',
                  color: i18n.language === lang ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  _hover: {
                    bg: i18n.language === lang ? '#2563eb' : '#d1d5db',
                  },
                })}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

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

function OverviewSection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const { t } = useTranslation()

  // Initial board setup - full starting position
  const initialSetup: ExamplePiece[] = [
    // BLACK - Column A
    { square: 'A1', type: 'S', color: 'B', value: 28 },
    { square: 'A2', type: 'S', color: 'B', value: 66 },
    { square: 'A7', type: 'S', color: 'B', value: 225 },
    { square: 'A8', type: 'S', color: 'B', value: 361 },
    // BLACK - Column B
    { square: 'B1', type: 'S', color: 'B', value: 28 },
    { square: 'B2', type: 'S', color: 'B', value: 66 },
    { square: 'B3', type: 'T', color: 'B', value: 36 },
    { square: 'B4', type: 'T', color: 'B', value: 30 },
    { square: 'B5', type: 'T', color: 'B', value: 56 },
    { square: 'B6', type: 'T', color: 'B', value: 64 },
    { square: 'B7', type: 'S', color: 'B', value: 120 },
    { square: 'B8', type: 'P', color: 'B', value: 36 },
    // BLACK - Column C
    { square: 'C1', type: 'T', color: 'B', value: 16 },
    { square: 'C2', type: 'T', color: 'B', value: 12 },
    { square: 'C3', type: 'C', color: 'B', value: 9 },
    { square: 'C4', type: 'C', color: 'B', value: 25 },
    { square: 'C5', type: 'C', color: 'B', value: 49 },
    { square: 'C6', type: 'C', color: 'B', value: 81 },
    { square: 'C7', type: 'T', color: 'B', value: 90 },
    { square: 'C8', type: 'T', color: 'B', value: 100 },
    // BLACK - Column D
    { square: 'D3', type: 'C', color: 'B', value: 3 },
    { square: 'D4', type: 'C', color: 'B', value: 5 },
    { square: 'D5', type: 'C', color: 'B', value: 7 },
    { square: 'D6', type: 'C', color: 'B', value: 9 },
    // WHITE - Column M
    { square: 'M3', type: 'C', color: 'W', value: 8 },
    { square: 'M4', type: 'C', color: 'W', value: 6 },
    { square: 'M5', type: 'C', color: 'W', value: 4 },
    { square: 'M6', type: 'C', color: 'W', value: 2 },
    // WHITE - Column N
    { square: 'N1', type: 'T', color: 'W', value: 81 },
    { square: 'N2', type: 'T', color: 'W', value: 72 },
    { square: 'N3', type: 'C', color: 'W', value: 64 },
    { square: 'N4', type: 'C', color: 'W', value: 16 },
    { square: 'N5', type: 'C', color: 'W', value: 16 },
    { square: 'N6', type: 'C', color: 'W', value: 4 },
    { square: 'N7', type: 'T', color: 'W', value: 6 },
    { square: 'N8', type: 'T', color: 'W', value: 9 },
    // WHITE - Column O
    { square: 'O1', type: 'S', color: 'W', value: 153 },
    { square: 'O2', type: 'P', color: 'W', value: 64 },
    { square: 'O3', type: 'T', color: 'W', value: 72 },
    { square: 'O4', type: 'T', color: 'W', value: 20 },
    { square: 'O5', type: 'T', color: 'W', value: 20 },
    { square: 'O6', type: 'T', color: 'W', value: 25 },
    { square: 'O7', type: 'S', color: 'W', value: 45 },
    { square: 'O8', type: 'S', color: 'W', value: 15 },
    // WHITE - Column P
    { square: 'P1', type: 'S', color: 'W', value: 289 },
    { square: 'P2', type: 'S', color: 'W', value: 169 },
    { square: 'P7', type: 'S', color: 'W', value: 81 },
    { square: 'P8', type: 'S', color: 'W', value: 25 },
  ]

  return (
    <div data-section="overview">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('guide.overview.goalTitle', 'Goal of the Game')}
      </h3>
      <p className={css({ fontSize: '16px', lineHeight: '1.6', mb: '20px', color: '#374151' })}>
        {t(
          'guide.overview.goal',
          'Arrange 3 of your pieces in enemy territory to form a mathematical progression, survive one opponent turn, and win.'
        )}
      </p>

      <h3
        className={css({
          fontSize: { base: '18px', md: '20px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '12px',
          mt: '24px',
        })}
      >
        {t('guide.overview.boardTitle', 'The Board')}
      </h3>

      <div className={css({ mb: '20px' })}>
        <RithmomachiaBoard
          pieces={initialSetup}
          scale={0.6}
          showLabels={true}
          useNativeAbacusNumbers={useNativeAbacusNumbers}
        />
      </div>

      <p className={css({ fontSize: '14px', color: '#6b7280', mb: '20px', fontStyle: 'italic' })}>
        {t(
          'guide.overview.boardCaption',
          'The starting position - Black on the left, White on the right'
        )}
      </p>

      <ul
        className={css({
          fontSize: '15px',
          lineHeight: '1.8',
          pl: '20px',
          mb: '20px',
          color: '#374151',
        })}
      >
        <li>{t('guide.overview.boardSize', '8 rows × 16 columns (columns A-P, rows 1-8)')}</li>
        <li>
          {t(
            'guide.overview.territory',
            'Your half: Black controls rows 5-8, White controls rows 1-4'
          )}
        </li>
        <li>
          {t(
            'guide.overview.enemyTerritory',
            'Enemy territory: Where you need to build your winning progression'
          )}
        </li>
      </ul>

      <h3
        className={css({
          fontSize: { base: '18px', md: '20px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '12px',
          mt: '24px',
        })}
      >
        {t('guide.overview.howToPlayTitle', 'How to Play')}
      </h3>
      <ol
        className={css({
          fontSize: '15px',
          lineHeight: '1.8',
          pl: '20px',
          color: '#374151',
        })}
      >
        <li>{t('guide.overview.step1', 'Move your pieces toward the center')}</li>
        <li>{t('guide.overview.step2', 'Look for ways to capture using math')}</li>
        <li>{t('guide.overview.step3', 'Push into enemy territory')}</li>
        <li>{t('guide.overview.step4', 'Watch for chances to make a progression')}</li>
        <li>{t('guide.overview.step5', 'Win by forming a progression that survives one turn!')}</li>
      </ol>
    </div>
  )
}

function PiecesSection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const { t } = useTranslation()
  const pieces: {
    type: PieceType
    name: string
    movement: string
    count: number
    exampleValues: number[]
  }[] = [
    {
      type: 'C',
      name: t('guide.pieces.circle', 'Circle'),
      movement: t('guide.pieces.circleMove', 'Moves diagonally'),
      count: 12,
      exampleValues: [3, 5, 7, 9],
    },
    {
      type: 'T',
      name: t('guide.pieces.triangle', 'Triangle'),
      movement: t('guide.pieces.triangleMove', 'Moves in straight lines'),
      count: 6,
      exampleValues: [12, 16, 20, 30],
    },
    {
      type: 'S',
      name: t('guide.pieces.square', 'Square'),
      movement: t('guide.pieces.squareMove', 'Moves in any direction'),
      count: 6,
      exampleValues: [25, 28, 45, 66],
    },
  ]

  return (
    <div data-section="pieces">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('guide.pieces.title', 'Your Pieces (25 total)')}
      </h3>
      <p className={css({ fontSize: '15px', mb: '24px', color: '#374151' })}>
        {t(
          'guide.pieces.description',
          'Each side has 25 pieces with different movement patterns. The shape tells you how it moves:'
        )}
      </p>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>
        {pieces.map((piece) => (
          <div
            key={piece.type}
            className={css({
              p: '16px',
              bg: '#f9fafb',
              borderRadius: '8px',
              border: '2px solid #e5e7eb',
            })}
          >
            <div
              className={css({ display: 'flex', alignItems: 'center', gap: '12px', mb: '12px' })}
            >
              <div
                className={css({
                  width: '60px',
                  height: '60px',
                  flexShrink: 0,
                })}
              >
                <PieceRenderer
                  type={piece.type}
                  color="W"
                  value={piece.exampleValues[0]}
                  size={60}
                  useNativeAbacusNumbers={useNativeAbacusNumbers}
                />
              </div>
              <div className={css({ flex: 1 })}>
                <h4
                  className={css({
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#111827',
                    mb: '4px',
                  })}
                >
                  {piece.name} ({piece.count} per side)
                </h4>
                <p className={css({ fontSize: '14px', color: '#6b7280' })}>{piece.movement}</p>
              </div>
            </div>

            {/* Example values */}
            <div className={css({ mt: '12px' })}>
              <p
                className={css({
                  fontSize: '13px',
                  color: '#9ca3af',
                  mb: '8px',
                  fontStyle: 'italic',
                })}
              >
                {t('guide.pieces.exampleValues', 'Example values')}:
              </p>
              <div className={css({ display: 'flex', gap: '12px', flexWrap: 'wrap' })}>
                {piece.exampleValues.map((value) => (
                  <div
                    key={value}
                    className={css({
                      width: '48px',
                      height: '48px',
                    })}
                  >
                    <PieceRenderer
                      type={piece.type}
                      color="W"
                      value={value}
                      size={48}
                      useNativeAbacusNumbers={useNativeAbacusNumbers}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pyramid section */}
      <div
        className={css({
          mt: '32px',
          p: '20px',
          bg: 'rgba(251, 191, 36, 0.1)',
          borderLeft: '4px solid #f59e0b',
          borderRadius: '4px',
        })}
      >
        <h4 className={css({ fontSize: '18px', fontWeight: 'bold', color: '#92400e', mb: '12px' })}>
          {t('guide.pieces.pyramidTitle', '⭐ Pyramids are special')}
        </h4>
        <p className={css({ fontSize: '14px', color: '#78350f', lineHeight: '1.6', mb: '16px' })}>
          {t(
            'guide.pieces.pyramidDescription',
            'Each side has 1 Pyramid. Pyramids have 4 face values - when capturing, you choose which value to use. They move one step in any direction.'
          )}
        </p>

        <div className={css({ display: 'flex', gap: '32px', flexWrap: 'wrap', mt: '16px' })}>
          {/* Black Pyramid */}
          <div>
            <p
              className={css({
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#92400e',
                mb: '8px',
                textAlign: 'center',
              })}
            >
              {t('guide.pieces.blackPyramid', 'Black Pyramid')}
            </p>
            <div className={css({ width: '80px', height: '80px' })}>
              <PieceRenderer
                type="P"
                color="B"
                value="P"
                size={80}
                useNativeAbacusNumbers={useNativeAbacusNumbers}
              />
            </div>
            <p
              className={css({
                fontSize: '12px',
                color: '#78350f',
                mt: '8px',
                textAlign: 'center',
                fontStyle: 'italic',
              })}
            >
              {t('guide.pieces.pyramidValues', 'Values')}: 36, 25, 16, 4
            </p>
          </div>

          {/* White Pyramid */}
          <div>
            <p
              className={css({
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#92400e',
                mb: '8px',
                textAlign: 'center',
              })}
            >
              {t('guide.pieces.whitePyramid', 'White Pyramid')}
            </p>
            <div className={css({ width: '80px', height: '80px' })}>
              <PieceRenderer
                type="P"
                color="W"
                value="P"
                size={80}
                useNativeAbacusNumbers={useNativeAbacusNumbers}
              />
            </div>
            <p
              className={css({
                fontSize: '12px',
                color: '#78350f',
                mt: '8px',
                textAlign: 'center',
                fontStyle: 'italic',
              })}
            >
              {t('guide.pieces.pyramidValues', 'Values')}: 64, 49, 36, 25
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CaptureSection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const { t } = useTranslation()
  return (
    <div data-section="capture">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('guide.capture.title', 'How to Capture')}
      </h3>
      <p className={css({ fontSize: '15px', lineHeight: '1.6', mb: '24px', color: '#374151' })}>
        {t(
          'guide.capture.description',
          "You can capture an enemy piece only if your piece's value relates mathematically to theirs:"
        )}
      </p>

      <h4
        className={css({
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#111827',
          mb: '12px',
          mt: '20px',
        })}
      >
        {t('guide.capture.simpleTitle', 'Simple Relations (no helper needed)')}
      </h4>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px', mb: '24px' })}>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            {t('guide.capture.equality', 'Equal')}
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>
            {t('guide.capture.equalityExample', 'Your 25 captures their 25')}
          </p>
        </div>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            {t('guide.capture.multiple', 'Multiple / Divisor')}
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>
            {t('guide.capture.multipleExample', 'Your 64 captures their 16 (64 ÷ 16 = 4)')}
          </p>
        </div>
      </div>

      <h4
        className={css({
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#111827',
          mb: '12px',
          mt: '20px',
        })}
      >
        {t('guide.capture.advancedTitle', 'Advanced Relations (need one helper piece)')}
      </h4>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            {t('guide.capture.sum', 'Sum')}
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>
            {t('guide.capture.sumExample', 'Your 9 + helper 16 = enemy 25')}
          </p>
        </div>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            {t('guide.capture.difference', 'Difference')}
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>
            {t('guide.capture.differenceExample', 'Your 30 - helper 10 = enemy 20')}
          </p>
        </div>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            {t('guide.capture.product', 'Product')}
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>
            {t('guide.capture.productExample', 'Your 5 × helper 5 = enemy 25')}
          </p>
        </div>
      </div>

      <div
        className={css({
          mt: '24px',
          p: '16px',
          bg: 'rgba(59, 130, 246, 0.1)',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '4px',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#1e40af', mb: '8px' })}>
          {t('guide.capture.helpersTitle', '💡 What are helpers?')}
        </p>
        <p className={css({ fontSize: '14px', color: '#1e3a8a', lineHeight: '1.6' })}>
          {t(
            'guide.capture.helpersDescription',
            "Helpers are your other pieces still on the board — they don't move, just provide their value for the math. The game will show you valid captures when you select a piece."
          )}
        </p>
      </div>
    </div>
  )
}

function HarmonySection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const { t } = useTranslation()
  return (
    <div data-section="harmony">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('guide.harmony.title', 'Harmonies (Progressions)')}
      </h3>
      <p className={css({ fontSize: '15px', lineHeight: '1.6', mb: '24px', color: '#374151' })}>
        {t(
          'guide.harmony.description',
          'Get 3 of your pieces into enemy territory forming one of these progressions:'
        )}
      </p>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
        <div
          className={css({
            p: '16px',
            bg: '#f0fdf4',
            border: '2px solid #86efac',
            borderRadius: '8px',
          })}
        >
          <h4
            className={css({ fontSize: '16px', fontWeight: 'bold', color: '#15803d', mb: '8px' })}
          >
            {t('guide.harmony.arithmetic', 'Arithmetic Progression')}
          </h4>
          <p className={css({ fontSize: '14px', color: '#166534', mb: '8px' })}>
            {t('guide.harmony.arithmeticDesc', 'Middle value is the average')}
          </p>
          <p className={css({ fontSize: '13px', color: '#16a34a', fontFamily: 'monospace' })}>
            {t('guide.harmony.arithmeticExample', 'Example: 6, 9, 12 (because 9 = (6+12)/2)')}
          </p>
        </div>

        <div
          className={css({
            p: '16px',
            bg: '#fef3c7',
            border: '2px solid #fcd34d',
            borderRadius: '8px',
          })}
        >
          <h4
            className={css({ fontSize: '16px', fontWeight: 'bold', color: '#92400e', mb: '8px' })}
          >
            {t('guide.harmony.geometric', 'Geometric Progression')}
          </h4>
          <p className={css({ fontSize: '14px', color: '#78350f', mb: '8px' })}>
            {t('guide.harmony.geometricDesc', 'Middle value is geometric mean')}
          </p>
          <p className={css({ fontSize: '13px', color: '#a16207', fontFamily: 'monospace' })}>
            {t('guide.harmony.geometricExample', 'Example: 4, 8, 16 (because 8² = 4×16)')}
          </p>
        </div>

        <div
          className={css({
            p: '16px',
            bg: '#dbeafe',
            border: '2px solid #93c5fd',
            borderRadius: '8px',
          })}
        >
          <h4
            className={css({ fontSize: '16px', fontWeight: 'bold', color: '#1e40af', mb: '8px' })}
          >
            {t('guide.harmony.harmonic', 'Harmonic Progression')}
          </h4>
          <p className={css({ fontSize: '14px', color: '#1e3a8a', mb: '8px' })}>
            {t('guide.harmony.harmonicDesc', 'Special proportion (formula: 2AB = M(A+B))')}
          </p>
          <p className={css({ fontSize: '13px', color: '#2563eb', fontFamily: 'monospace' })}>
            {t('guide.harmony.harmonicExample', 'Example: 6, 8, 12 (because 2×6×12 = 8×(6+12))')}
          </p>
        </div>
      </div>

      <div
        className={css({
          mt: '24px',
          p: '16px',
          bg: 'rgba(239, 68, 68, 0.1)',
          borderLeft: '4px solid #ef4444',
          borderRadius: '4px',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#991b1b', mb: '8px' })}>
          {t('guide.harmony.rulesTitle', '⚠️ Important Rules')}
        </p>
        <ul className={css({ fontSize: '14px', color: '#7f1d1d', lineHeight: '1.8', pl: '20px' })}>
          <li>
            {t(
              'guide.harmony.rule1',
              'Your 3 pieces must be in a straight line (row, column, or diagonal)'
            )}
          </li>
          <li>{t('guide.harmony.rule2', 'All 3 must be in enemy territory')}</li>
          <li>
            {t(
              'guide.harmony.rule3',
              'When you form a harmony, your opponent gets one turn to break it'
            )}
          </li>
          <li>{t('guide.harmony.rule4', 'If it survives, you win!')}</li>
        </ul>
      </div>
    </div>
  )
}

function VictorySection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const { t } = useTranslation()
  return (
    <div data-section="victory">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('guide.victory.title', 'How to Win')}
      </h3>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>
        <div>
          <h4
            className={css({
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#111827',
              mb: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            })}
          >
            <span>👑</span>
            <span>{t('guide.victory.harmony', 'Victory #1: Harmony (Progression)')}</span>
          </h4>
          <p className={css({ fontSize: '15px', lineHeight: '1.6', color: '#374151', mb: '12px' })}>
            {t(
              'guide.victory.harmonyDesc',
              "Form a mathematical progression with 3 pieces in enemy territory. If it survives your opponent's next turn, you win!"
            )}
          </p>
          <div
            className={css({
              p: '12px',
              bg: '#f0fdf4',
              borderRadius: '6px',
              border: '1px solid #86efac',
            })}
          >
            <p className={css({ fontSize: '13px', color: '#15803d' })}>
              {t(
                'guide.victory.harmonyNote',
                'This is the primary victory condition in Rithmomachia'
              )}
            </p>
          </div>
        </div>

        <div>
          <h4
            className={css({
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#111827',
              mb: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            })}
          >
            <span>🚫</span>
            <span>{t('guide.victory.exhaustion', 'Victory #2: Exhaustion')}</span>
          </h4>
          <p className={css({ fontSize: '15px', lineHeight: '1.6', color: '#374151' })}>
            {t(
              'guide.victory.exhaustionDesc',
              'If your opponent has no legal moves at the start of their turn, they lose.'
            )}
          </p>
        </div>
      </div>

      <h3
        className={css({
          fontSize: { base: '18px', md: '20px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '12px',
          mt: '32px',
        })}
      >
        {t('guide.victory.strategyTitle', 'Quick Strategy Tips')}
      </h3>
      <ul
        className={css({
          fontSize: '14px',
          lineHeight: '1.8',
          pl: '20px',
          color: '#374151',
        })}
      >
        <li>{t('guide.victory.tip1', 'Control the center — easier to invade enemy territory')}</li>
        <li>
          {t(
            'guide.victory.tip2',
            'Small pieces are fast — circles (3, 5, 7, 9) can slip into enemy half quickly'
          )}
        </li>
        <li>
          {t(
            'guide.victory.tip3',
            'Large pieces are powerful — harder to capture due to their size'
          )}
        </li>
        <li>
          {t(
            'guide.victory.tip4',
            "Watch for harmony threats — don't let opponent get 3 pieces deep in your territory"
          )}
        </li>
        <li>
          {t(
            'guide.victory.tip5',
            'Pyramids are flexible — choose the right face value for each situation'
          )}
        </li>
      </ul>
    </div>
  )
}

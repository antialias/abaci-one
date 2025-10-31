'use client'

import { useEffect, useState, useRef } from 'react'
import { css } from '../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import { PieceRenderer } from './PieceRenderer'
import type { PieceType, Color } from '../types'

interface PlayingGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

type Section = 'overview' | 'pieces' | 'capture' | 'harmony' | 'victory'

export function PlayingGuideModal({ isOpen, onClose }: PlayingGuideModalProps) {
  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const modalRef = useRef<HTMLDivElement>(null)

  // Center modal on mount
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect()
      setPosition({
        x: (window.innerWidth - rect.width) / 2,
        y: Math.max(50, (window.innerHeight - rect.height) / 2),
      })
    }
  }, [isOpen])

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (window.innerWidth < 768) return // No dragging on mobile
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart])

  if (!isOpen) return null

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'overview', label: 'Quick Start', icon: '🎯' },
    { id: 'pieces', label: 'Pieces', icon: '♟️' },
    { id: 'capture', label: 'Capture', icon: '⚔️' },
    { id: 'harmony', label: 'Harmony', icon: '🎵' },
    { id: 'victory', label: 'Victory', icon: '👑' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        data-element="guide-backdrop"
        className={css({
          position: 'fixed',
          inset: 0,
          bg: 'rgba(0, 0, 0, 0.5)',
          zIndex: Z_INDEX.MODAL,
          backdropFilter: 'blur(4px)',
        })}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        data-component="playing-guide-modal"
        className={css({
          position: 'fixed',
          zIndex: Z_INDEX.MODAL + 1,
          bg: 'white',
          borderRadius: { base: '0', md: '12px' },
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
          width: { base: '100%', md: '90%', lg: '800px' },
          maxWidth: { base: '100%', md: '90vw' },
          height: { base: '100%', md: 'auto' },
          maxHeight: { base: '100%', md: '90vh' },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        })}
        style={{
          left: window.innerWidth >= 768 ? `${position.x}px` : '0',
          top: window.innerWidth >= 768 ? `${position.y}px` : '0',
          cursor: isDragging ? 'grabbing' : 'auto',
        }}
      >
        {/* Header */}
        <div
          data-element="modal-header"
          className={css({
            bg: 'linear-gradient(135deg, #7c2d12 0%, #92400e 100%)',
            color: 'white',
            p: { base: '16px', md: '20px' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: { base: 'default', md: 'grab' },
            userSelect: 'none',
            borderBottom: '3px solid rgba(251, 191, 36, 0.6)',
          })}
          onMouseDown={handleMouseDown}
          style={{
            cursor: isDragging ? 'grabbing' : window.innerWidth >= 768 ? 'grab' : 'default',
          }}
        >
          <div className={css({ display: 'flex', alignItems: 'center', gap: '12px' })}>
            <span className={css({ fontSize: '28px' })}>📖</span>
            <div>
              <h2
                className={css({
                  fontSize: { base: '20px', md: '24px' },
                  fontWeight: 'bold',
                  letterSpacing: '0.5px',
                })}
              >
                Playing Guide
              </h2>
              <p className={css({ fontSize: '14px', opacity: 0.9, mt: '2px' })}>
                Rithmomachia – The Philosopher's Game
              </p>
            </div>
          </div>
          <button
            type="button"
            data-action="close-guide"
            onClick={onClose}
            className={css({
              bg: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '20px',
              transition: 'background 0.2s',
              _hover: { bg: 'rgba(255, 255, 255, 0.3)' },
            })}
          >
            ✕
          </button>
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
            p: { base: '20px', md: '32px' },
          })}
        >
          {activeSection === 'overview' && <OverviewSection />}
          {activeSection === 'pieces' && <PiecesSection />}
          {activeSection === 'capture' && <CaptureSection />}
          {activeSection === 'harmony' && <HarmonySection />}
          {activeSection === 'victory' && <VictorySection />}
        </div>
      </div>
    </>
  )
}

function OverviewSection() {
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
        Goal of the Game
      </h3>
      <p className={css({ fontSize: '16px', lineHeight: '1.6', mb: '20px', color: '#374151' })}>
        Arrange <strong>3 of your pieces in enemy territory</strong> to form a{' '}
        <strong>mathematical progression</strong>, survive one opponent turn, and win.
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
        The Board
      </h3>
      <ul
        className={css({
          fontSize: '15px',
          lineHeight: '1.8',
          pl: '20px',
          mb: '20px',
          color: '#374151',
        })}
      >
        <li>8 rows × 16 columns (columns A-P, rows 1-8)</li>
        <li>
          <strong>Your half:</strong> Black controls rows 5-8, White controls rows 1-4
        </li>
        <li>
          <strong>Enemy territory:</strong> Where you need to build your winning progression
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
        How to Play
      </h3>
      <ol
        className={css({
          fontSize: '15px',
          lineHeight: '1.8',
          pl: '20px',
          color: '#374151',
        })}
      >
        <li>Start by moving pieces toward the center</li>
        <li>Look for capture opportunities using mathematical relations</li>
        <li>Push into enemy territory (rows 1-4 for Black, rows 5-8 for White)</li>
        <li>Watch for harmony opportunities with your forward pieces</li>
        <li>Win by forming a progression that survives one turn!</li>
      </ol>
    </div>
  )
}

function PiecesSection() {
  const pieces: { type: PieceType; name: string; movement: string; count: number }[] = [
    { type: 'C', name: 'Circle', movement: 'Diagonal (like a bishop)', count: 8 },
    { type: 'T', name: 'Triangle', movement: 'Straight lines (like a rook)', count: 8 },
    { type: 'S', name: 'Square', movement: 'Any direction (like a queen)', count: 7 },
    { type: 'P', name: 'Pyramid', movement: 'One step any way (like a king)', count: 1 },
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
        Your Pieces (24 total)
      </h3>
      <p className={css({ fontSize: '15px', mb: '24px', color: '#374151' })}>
        Each piece has a <strong>number value</strong> and moves differently:
      </p>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
        {pieces.map((piece) => (
          <div
            key={piece.type}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              p: '16px',
              bg: '#f9fafb',
              borderRadius: '8px',
              border: '2px solid #e5e7eb',
            })}
          >
            <div
              className={css({
                width: { base: '60px', md: '80px' },
                height: { base: '60px', md: '80px' },
                flexShrink: 0,
              })}
            >
              <svg viewBox="0 0 100 100" width="100%" height="100%">
                <PieceRenderer
                  piece={{
                    id: `guide-${piece.type}`,
                    color: 'W',
                    type: piece.type,
                    value: piece.type === 'P' ? undefined : 64,
                    pyramidFaces: piece.type === 'P' ? [64, 49, 36, 25] : undefined,
                    activePyramidFace: null,
                    square: 'A1',
                    captured: false,
                  }}
                  x={50}
                  y={50}
                  size={35}
                />
              </svg>
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
                {piece.name}
              </h4>
              <p className={css({ fontSize: '14px', color: '#6b7280', mb: '2px' })}>
                {piece.movement}
              </p>
              <p className={css({ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' })}>
                Count: {piece.count}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className={css({
          mt: '24px',
          p: '16px',
          bg: 'rgba(251, 191, 36, 0.1)',
          borderLeft: '4px solid #f59e0b',
          borderRadius: '4px',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#92400e', mb: '8px' })}>
          ⭐ Pyramids are special
        </p>
        <p className={css({ fontSize: '14px', color: '#78350f', lineHeight: '1.6' })}>
          Pyramids have 4 face values. When capturing, you choose which face to use.
        </p>
      </div>
    </div>
  )
}

function CaptureSection() {
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
        How to Capture
      </h3>
      <p className={css({ fontSize: '15px', lineHeight: '1.6', mb: '24px', color: '#374151' })}>
        You can capture an enemy piece{' '}
        <strong>only if your piece's value relates mathematically</strong> to theirs:
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
        Simple Relations (no helper needed)
      </h4>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px', mb: '24px' })}>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            Equal
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>Your 25 captures their 25</p>
        </div>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            Multiple / Divisor
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>
            Your 64 captures their 16 (64 ÷ 16 = 4)
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
        Advanced Relations (need one helper piece)
      </h4>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            Sum
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>
            Your 9 + helper 16 = enemy 25
          </p>
        </div>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            Difference
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>
            Your 30 - helper 10 = enemy 20
          </p>
        </div>
        <div className={css({ p: '12px', bg: '#f3f4f6', borderRadius: '6px' })}>
          <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '4px' })}>
            Product
          </p>
          <p className={css({ fontSize: '13px', color: '#6b7280' })}>
            Your 5 × helper 5 = enemy 25
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
          💡 What are helpers?
        </p>
        <p className={css({ fontSize: '14px', color: '#1e3a8a', lineHeight: '1.6' })}>
          Helpers are your other pieces still on the board — they don't move, just provide their
          value for the math. The game will show you valid captures when you select a piece.
        </p>
      </div>
    </div>
  )
}

function HarmonySection() {
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
        Harmonies (Progressions)
      </h3>
      <p className={css({ fontSize: '15px', lineHeight: '1.6', mb: '24px', color: '#374151' })}>
        Get <strong>3 of your pieces into enemy territory</strong> forming one of these
        progressions:
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
            Arithmetic Progression
          </h4>
          <p className={css({ fontSize: '14px', color: '#166534', mb: '8px' })}>
            Middle value is the average
          </p>
          <p className={css({ fontSize: '13px', color: '#16a34a', fontFamily: 'monospace' })}>
            Example: 6, 9, 12 (because 9 = (6+12)/2)
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
            Geometric Progression
          </h4>
          <p className={css({ fontSize: '14px', color: '#78350f', mb: '8px' })}>
            Middle value is geometric mean
          </p>
          <p className={css({ fontSize: '13px', color: '#a16207', fontFamily: 'monospace' })}>
            Example: 4, 8, 16 (because 8² = 4×16)
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
            Harmonic Progression
          </h4>
          <p className={css({ fontSize: '14px', color: '#1e3a8a', mb: '8px' })}>
            Special proportion (formula: 2AB = M(A+B))
          </p>
          <p className={css({ fontSize: '13px', color: '#2563eb', fontFamily: 'monospace' })}>
            Example: 6, 8, 12 (because 2×6×12 = 8×(6+12))
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
          ⚠️ Important Rules
        </p>
        <ul className={css({ fontSize: '14px', color: '#7f1d1d', lineHeight: '1.8', pl: '20px' })}>
          <li>Your 3 pieces must be in a straight line (row, column, or diagonal)</li>
          <li>All 3 must be in enemy territory</li>
          <li>When you form a harmony, your opponent gets one turn to break it</li>
          <li>If it survives, you win!</li>
        </ul>
      </div>
    </div>
  )
}

function VictorySection() {
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
        How to Win
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
            <span>Victory #1: Harmony (Progression)</span>
          </h4>
          <p className={css({ fontSize: '15px', lineHeight: '1.6', color: '#374151', mb: '12px' })}>
            Form a mathematical progression with 3 pieces in enemy territory. If it survives your
            opponent's next turn, you win!
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
              This is the primary victory condition in Rithmomachia
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
            <span>Victory #2: Exhaustion</span>
          </h4>
          <p className={css({ fontSize: '15px', lineHeight: '1.6', color: '#374151' })}>
            If your opponent has no legal moves at the start of their turn, they lose.
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
        Quick Strategy Tips
      </h3>
      <ul
        className={css({
          fontSize: '14px',
          lineHeight: '1.8',
          pl: '20px',
          color: '#374151',
        })}
      >
        <li>
          <strong>Control the center</strong> — easier to invade enemy territory
        </li>
        <li>
          <strong>Small pieces are fast</strong> — circles (3, 5, 7, 9) can slip into enemy half
          quickly
        </li>
        <li>
          <strong>Large pieces are powerful</strong> — harder to capture due to their size
        </li>
        <li>
          <strong>Watch for harmony threats</strong> — don't let opponent get 3 pieces deep in your
          territory
        </li>
        <li>
          <strong>Pyramids are flexible</strong> — choose the right face value for each situation
        </li>
      </ul>
    </div>
  )
}

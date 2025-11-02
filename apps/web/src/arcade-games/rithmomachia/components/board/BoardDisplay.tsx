'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import { Z_INDEX } from '@/constants/zIndex'
import { css } from '../../../../../styled-system/css'
import { CaptureProvider } from '../../contexts/CaptureContext'
import { useBoardLayout } from '../../hooks/useBoardLayout'
import { usePieceSelection } from '../../hooks/usePieceSelection'
import { useRithmomachia } from '../../Provider'
import type { Piece, RelationKind } from '../../types'
import { getSquarePosition } from '../../utils/boardCoordinates'
import { getEffectiveValue } from '../../utils/pieceSetup'
import {
  checkDiff,
  checkDivisor,
  checkEqual,
  checkMultiple,
  checkProduct,
  checkRatio,
  checkSum,
} from '../../utils/relationEngine'
import { CaptureErrorDialog } from '../capture/CaptureErrorDialog'
import { CaptureRelationOptions } from '../capture/CaptureRelationOptions'
import { HelperSelectionOptions } from '../capture/HelperSelectionOptions'
import { NumberBondVisualization } from '../capture/NumberBondVisualization'
import { SvgPiece } from './SvgPiece'

/**
 * Board display component (simplified for v1).
 */
export function BoardDisplay() {
  const { state, makeMove, playerColor, isMyTurn } = useRithmomachia()
  const layout = useBoardLayout()
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false

  // Capture dialog state
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false)
  const [closingDialog, setClosingDialog] = useState(false)
  const [captureTarget, setCaptureTarget] = useState<{
    from: string
    to: string
    pieceId: string
  } | null>(null)
  const [selectedRelation, setSelectedRelation] = useState<RelationKind | null>(null)
  const [selectedHelper, setSelectedHelper] = useState<{
    helperPiece: Piece
    moverPiece: Piece
    targetPiece: Piece
  } | null>(null)

  // Handle closing animation completion
  useEffect(() => {
    if (closingDialog) {
      // Wait for animation to complete (400ms allows spring to fully settle)
      const timer = setTimeout(() => {
        setCaptureDialogOpen(false)
        setCaptureTarget(null)
        setSelectedRelation(null)
        setSelectedHelper(null)
        setClosingDialog(false)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [closingDialog])

  // Function to dismiss the dialog with animation
  const dismissDialog = useCallback(() => {
    setSelectedRelation(null)
    setSelectedHelper(null)
    setClosingDialog(true)
  }, [])

  // Piece selection hook
  const { selectedSquare, handleSquareClick, clearSelection } = usePieceSelection(
    state.pieces,
    playerColor,
    isMyTurn,
    {
      onMove: (from, to, pieceId) => {
        makeMove(from, to, pieceId)
      },
      onCaptureAttempt: (from, to, pieceId) => {
        setCaptureTarget({ from, to, pieceId })
        setCaptureDialogOpen(true)
      },
    }
  )

  // Find valid helper pieces for a given relation
  const findValidHelpers = (
    moverValue: number,
    targetValue: number,
    relation: RelationKind
  ): Piece[] => {
    if (!captureTarget) return []

    const validHelpers: Piece[] = []
    const friendlyPieces = Object.values(state.pieces).filter(
      (p) => !p.captured && p.color === playerColor && p.id !== captureTarget.pieceId
    )

    for (const piece of friendlyPieces) {
      const helperValue = getEffectiveValue(piece)
      if (helperValue === undefined || helperValue === null) continue

      let isValid = false
      switch (relation) {
        case 'SUM':
          isValid = checkSum(moverValue, targetValue, helperValue).valid
          break
        case 'DIFF':
          isValid = checkDiff(moverValue, targetValue, helperValue).valid
          break
        case 'PRODUCT':
          isValid = checkProduct(moverValue, targetValue, helperValue).valid
          break
        case 'RATIO':
          isValid = checkRatio(moverValue, targetValue, helperValue).valid
          break
      }

      if (isValid) {
        validHelpers.push(piece)
      }
    }

    return validHelpers
  }

  // Find ALL available relations for this capture
  const findAvailableRelations = (moverValue: number, targetValue: number): RelationKind[] => {
    const available: RelationKind[] = []

    // Check non-helper relations
    if (checkEqual(moverValue, targetValue).valid) available.push('EQUAL')
    if (checkMultiple(moverValue, targetValue).valid) available.push('MULTIPLE')
    if (checkDivisor(moverValue, targetValue).valid) available.push('DIVISOR')

    // Check helper relations - only include if at least one valid helper exists
    if (findValidHelpers(moverValue, targetValue, 'SUM').length > 0) available.push('SUM')
    if (findValidHelpers(moverValue, targetValue, 'DIFF').length > 0) available.push('DIFF')
    if (findValidHelpers(moverValue, targetValue, 'PRODUCT').length > 0) available.push('PRODUCT')
    if (findValidHelpers(moverValue, targetValue, 'RATIO').length > 0) available.push('RATIO')

    console.log('[findAvailableRelations] available:', available)
    return available
  }

  const handleCaptureWithRelation = (relation: RelationKind) => {
    console.log('[handleCaptureWithRelation] Called with relation:', relation)
    console.log('[handleCaptureWithRelation] captureTarget:', captureTarget)

    if (!captureTarget) {
      console.log('[handleCaptureWithRelation] No capture target, returning')
      return
    }

    // Check if this relation requires a helper
    const helperRelations: RelationKind[] = ['SUM', 'DIFF', 'PRODUCT', 'RATIO']
    const needsHelper = helperRelations.includes(relation)
    console.log('[handleCaptureWithRelation] needsHelper:', needsHelper)

    if (needsHelper) {
      // Get mover and target values
      const moverPiece = Object.values(state.pieces).find(
        (p) => p.id === captureTarget.pieceId && !p.captured
      )
      const targetPiece = Object.values(state.pieces).find(
        (p) => p.square === captureTarget.to && !p.captured
      )

      console.log('[handleCaptureWithRelation] moverPiece:', moverPiece)
      console.log('[handleCaptureWithRelation] targetPiece:', targetPiece)

      if (!moverPiece || !targetPiece) {
        console.log('[handleCaptureWithRelation] Missing piece, returning')
        return
      }

      const moverValue = getEffectiveValue(moverPiece)
      const targetValue = getEffectiveValue(targetPiece)

      console.log('[handleCaptureWithRelation] moverValue:', moverValue)
      console.log('[handleCaptureWithRelation] targetValue:', targetValue)

      if (
        moverValue === undefined ||
        moverValue === null ||
        targetValue === undefined ||
        targetValue === null
      ) {
        console.log('[handleCaptureWithRelation] Undefined/null value, returning')
        return
      }

      // Find valid helpers
      const validHelpers = findValidHelpers(moverValue, targetValue, relation)
      console.log('[handleCaptureWithRelation] validHelpers:', validHelpers)

      if (validHelpers.length === 0) {
        // No valid helpers - relation is impossible
        console.log('[handleCaptureWithRelation] No valid helpers found')
        return
      }

      // Automatically select the first valid helper (skip helper selection UI)
      console.log('[handleCaptureWithRelation] Auto-selecting first helper:', validHelpers[0])
      setSelectedRelation(relation)
      setSelectedHelper({
        helperPiece: validHelpers[0],
        moverPiece,
        targetPiece,
      })
    } else {
      console.log('[handleCaptureWithRelation] No helper needed, executing capture immediately')
      // No helper needed - execute capture immediately
      const targetPiece = Object.values(state.pieces).find(
        (p) => p.square === captureTarget.to && !p.captured
      )
      if (!targetPiece) return

      const captureData = {
        relation,
        targetPieceId: targetPiece.id,
      }

      makeMove(captureTarget.from, captureTarget.to, captureTarget.pieceId, undefined, captureData)
      dismissDialog()
      clearSelection()
    }
  }

  const handleHelperSelection = (helperPieceId: string) => {
    if (!captureTarget || !selectedRelation) return

    // Get pieces for number bond visualization
    const moverPiece = Object.values(state.pieces).find(
      (p) => p.id === captureTarget.pieceId && !p.captured
    )
    const targetPiece = Object.values(state.pieces).find(
      (p) => p.square === captureTarget.to && !p.captured
    )
    const helperPiece = Object.values(state.pieces).find(
      (p) => p.id === helperPieceId && !p.captured
    )

    if (!moverPiece || !targetPiece || !helperPiece) return

    // Show number bond visualization
    setSelectedHelper({
      helperPiece,
      moverPiece,
      targetPiece,
    })
  }

  const handleNumberBondConfirm = () => {
    if (!captureTarget || !selectedRelation || !selectedHelper) return

    const captureData = {
      relation: selectedRelation,
      targetPieceId: selectedHelper.targetPiece.id,
      helperPieceId: selectedHelper.helperPiece.id,
    }

    makeMove(captureTarget.from, captureTarget.to, captureTarget.pieceId, undefined, captureData)
    dismissDialog()
    clearSelection()
  }

  // Get all active pieces
  const activePieces = Object.values(state.pieces).filter((p) => !p.captured)

  // SVG dimensions using layout hook
  const { cellSize, gap, padding, rows, columns: cols } = layout
  const labelMargin = 30 // Space for row/column labels
  const boardInnerWidth = cols * cellSize + (cols - 1) * gap
  const boardInnerHeight = rows * cellSize + (rows - 1) * gap
  const boardWidth = boardInnerWidth + padding * 2 + labelMargin
  const boardHeight = boardInnerHeight + padding * 2 + labelMargin

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMyTurn) return

    // If capture dialog is open, dismiss it with animation on any click (buttons have stopPropagation)
    if (captureDialogOpen && !closingDialog) {
      dismissDialog()
      return
    }

    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * boardWidth - labelMargin - padding
    const y = ((e.clientY - rect.top) / rect.height) * boardHeight - padding

    // Convert to grid coordinates
    const col = Math.floor(x / (cellSize + gap))
    const row = Math.floor(y / (cellSize + gap))

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      const square = `${String.fromCharCode(65 + col)}${8 - row}`
      const piece = Object.values(state.pieces).find((p) => p.square === square && !p.captured)
      handleSquareClick(square, piece)
    }
  }

  // Calculate target square position for floating capture options
  const getTargetSquarePosition = useCallback(() => {
    if (!captureTarget) return null
    // Add labelMargin offset to the position from utility function
    const basePos = getSquarePosition(captureTarget.to, layout)
    const pos = { x: basePos.x + labelMargin, y: basePos.y }
    console.log('[getTargetSquarePosition] captureTarget.to:', captureTarget.to, 'position:', pos)
    return pos
  }, [captureTarget, layout, labelMargin])

  const targetPos = getTargetSquarePosition()
  if (targetPos) {
    console.log('[BoardDisplay] targetPos calculated:', targetPos)
  }

  // Prepare helper data with board positions (if showing helpers)
  const helpersWithPositions = (() => {
    console.log('[helpersWithPositions] selectedRelation:', selectedRelation)
    console.log('[helpersWithPositions] captureTarget:', captureTarget)

    if (!selectedRelation || !captureTarget) {
      console.log('[helpersWithPositions] No selectedRelation or captureTarget, returning empty')
      return []
    }

    const moverPiece = Object.values(state.pieces).find(
      (p) => p.id === captureTarget.pieceId && !p.captured
    )
    const targetPiece = Object.values(state.pieces).find(
      (p) => p.square === captureTarget.to && !p.captured
    )

    console.log('[helpersWithPositions] moverPiece:', moverPiece)
    console.log('[helpersWithPositions] targetPiece:', targetPiece)

    if (!moverPiece || !targetPiece) {
      console.log('[helpersWithPositions] Missing pieces, returning empty')
      return []
    }

    const moverValue = getEffectiveValue(moverPiece)
    const targetValue = getEffectiveValue(targetPiece)

    console.log('[helpersWithPositions] moverValue:', moverValue)
    console.log('[helpersWithPositions] targetValue:', targetValue)

    if (
      moverValue === undefined ||
      moverValue === null ||
      targetValue === undefined ||
      targetValue === null
    ) {
      console.log('[helpersWithPositions] Undefined/null values, returning empty')
      return []
    }

    const validHelpers = findValidHelpers(moverValue, targetValue, selectedRelation)
    console.log('[helpersWithPositions] validHelpers found:', validHelpers.length)

    const helpersWithPos = validHelpers.map((piece) => {
      const basePos = getSquarePosition(piece.square, layout)
      return {
        piece,
        boardPos: { x: basePos.x + labelMargin, y: basePos.y },
      }
    })
    console.log('[helpersWithPositions] helpersWithPos:', helpersWithPos)

    return helpersWithPos
  })()

  // Calculate available relations for this capture
  const availableRelations = (() => {
    if (!captureTarget) return []

    const moverPiece = Object.values(state.pieces).find(
      (p) => p.id === captureTarget.pieceId && !p.captured
    )
    const targetPiece = Object.values(state.pieces).find(
      (p) => p.square === captureTarget.to && !p.captured
    )

    if (!moverPiece || !targetPiece) return []

    const moverValue = getEffectiveValue(moverPiece)
    const targetValue = getEffectiveValue(targetPiece)

    if (
      moverValue === undefined ||
      moverValue === null ||
      targetValue === undefined ||
      targetValue === null
    )
      return []

    return findAvailableRelations(moverValue, targetValue)
  })()

  return (
    <div
      className={css({
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        zIndex: Z_INDEX.GAME.OVERLAY,
      })}
    >
      {/* Unified SVG Board */}
      <svg
        viewBox={`0 0 ${boardWidth} ${boardHeight}`}
        className={css({
          width: '100%',
          cursor: isMyTurn ? 'pointer' : 'default',
          overflow: 'visible',
        })}
        onClick={handleSvgClick}
      >
        {/* Board background */}
        <rect x={0} y={0} width={boardWidth} height={boardHeight} fill="#d1d5db" rx={8} />

        {/* Board squares */}
        {Array.from({ length: rows }, (_, row) => {
          const actualRank = 8 - row
          return Array.from({ length: cols }, (_, col) => {
            const square = `${String.fromCharCode(65 + col)}${actualRank}`
            const piece = Object.values(state.pieces).find(
              (p) => p.square === square && !p.captured
            )
            const isLight = (col + actualRank) % 2 === 0
            const isSelected = selectedSquare === square

            const x = labelMargin + padding + col * (cellSize + gap)
            const y = padding + row * (cellSize + gap)

            return (
              <rect
                key={square}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={isSelected ? '#fde047' : isLight ? '#f3f4f6' : '#e5e7eb'}
                stroke={isSelected ? '#9333ea' : 'none'}
                strokeWidth={isSelected ? 2 : 0}
              />
            )
          })
        })}

        {/* Column labels (A-P) at the bottom */}
        {Array.from({ length: cols }, (_, col) => {
          const colLabel = String.fromCharCode(65 + col)
          const x = labelMargin + padding + col * (cellSize + gap) + cellSize / 2
          const y = boardHeight - 10

          return (
            <text
              key={`col-${colLabel}`}
              x={x}
              y={y}
              fontSize="20"
              fontWeight="bold"
              fill="#374151"
              fontFamily="sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {colLabel}
            </text>
          )
        })}

        {/* Row labels (1-8) on the left */}
        {Array.from({ length: rows }, (_, row) => {
          const actualRank = 8 - row
          const x = 15
          const y = padding + row * (cellSize + gap) + cellSize / 2

          return (
            <text
              key={`row-${actualRank}`}
              x={x}
              y={y}
              fontSize="20"
              fontWeight="bold"
              fill="#374151"
              fontFamily="sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {actualRank}
            </text>
          )
        })}

        {/* Pieces */}
        {activePieces.map((piece) => {
          // Show low opacity for pieces currently being shown as helper options or in the number bond
          const isBorrowedHelper = helpersWithPositions.some((h) => h.piece.id === piece.id)
          const isBorrowedMover = selectedHelper && selectedHelper.moverPiece.id === piece.id
          const isInNumberBond = isBorrowedHelper || isBorrowedMover
          return (
            <SvgPiece
              key={piece.id}
              piece={piece}
              cellSize={cellSize + gap}
              padding={padding}
              labelMargin={labelMargin}
              opacity={isInNumberBond ? 0.2 : 1}
              useNativeAbacusNumbers={useNativeAbacusNumbers}
            />
          )
        })}

        {/* Floating capture relation options, helper selection, or number bond */}
        {captureDialogOpen &&
          targetPos &&
          (() => {
            console.log('[Render] captureDialogOpen:', captureDialogOpen)
            console.log('[Render] targetPos:', targetPos)
            console.log('[Render] selectedRelation:', selectedRelation)
            console.log('[Render] selectedHelper:', selectedHelper)
            console.log('[Render] helpersWithPositions.length:', helpersWithPositions.length)
            console.log('[Render] closingDialog:', closingDialog)

            // Extract mover and target pieces
            const moverPiece = Object.values(state.pieces).find(
              (p) => p.id === captureTarget?.pieceId
            )
            const targetPiece = Object.values(state.pieces).find(
              (p) => p.square === captureTarget?.to && !p.captured
            )

            if (!moverPiece || !targetPiece) {
              console.log('[Render] Missing mover or target piece')
              return null
            }

            // Create context value for capture components
            const captureContextValue = {
              layout: {
                targetPos,
                cellSize,
                gap,
                padding,
              },
              pieces: {
                mover: moverPiece,
                target: targetPiece,
                helper: selectedHelper?.helperPiece || null,
              },
              selectedRelation,
              closing: closingDialog,
              allPieces: activePieces,
              findValidHelpers,
              selectRelation: handleCaptureWithRelation,
              selectHelper: handleHelperSelection,
              dismissDialog,
            }

            return (
              <CaptureProvider value={captureContextValue}>
                {/* Phase 3: Show number bond after helper selected */}
                {selectedRelation && selectedHelper && (
                  <NumberBondVisualization
                    onConfirm={handleNumberBondConfirm}
                    moverStartPos={(() => {
                      const moverFile = selectedHelper.moverPiece.square.charCodeAt(0) - 65
                      const moverRank = Number.parseInt(
                        selectedHelper.moverPiece.square.slice(1),
                        10
                      )
                      const moverRow = 8 - moverRank
                      return {
                        x: padding + moverFile * (cellSize + gap) + cellSize / 2,
                        y: padding + moverRow * (cellSize + gap) + cellSize / 2,
                      }
                    })()}
                    helperStartPos={(() => {
                      const helperIndex = helpersWithPositions.findIndex(
                        (h) => h.piece.id === selectedHelper.helperPiece.id
                      )
                      const maxRadius = cellSize * 1.2
                      const angleStep =
                        helpersWithPositions.length > 1 ? 360 / helpersWithPositions.length : 0
                      const angle = helperIndex * angleStep
                      const rad = (angle * Math.PI) / 180
                      return {
                        x: targetPos.x + Math.cos(rad) * maxRadius,
                        y: targetPos.y + Math.sin(rad) * maxRadius,
                      }
                    })()}
                  />
                )}

                {/* Phase 2: Show helper selection */}
                {selectedRelation && !selectedHelper && helpersWithPositions.length > 0 && (
                  <HelperSelectionOptions helpers={helpersWithPositions} />
                )}

                {/* Phase 1: Show relation options OR error */}
                {!selectedRelation && (
                  <>
                    {availableRelations.length === 0 ? (
                      <CaptureErrorDialog />
                    ) : (
                      <CaptureRelationOptions availableRelations={availableRelations} />
                    )}
                  </>
                )}
              </CaptureProvider>
            )
          })()}
      </svg>
    </div>
  )
}

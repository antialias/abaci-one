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
import { validateMove } from '../../utils/pathValidator'
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

  // Hover state for showing error tooltip
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null)

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

      const targetValue = getEffectiveValue(targetPiece)

      console.log('[handleCaptureWithRelation] targetValue:', targetValue)

      if (targetValue === undefined || targetValue === null) {
        console.log('[handleCaptureWithRelation] Undefined/null target value, returning')
        return
      }

      // For pyramids, find helpers using all faces
      if (
        moverPiece.type === 'P' &&
        moverPiece.pyramidFaces &&
        moverPiece.pyramidFaces.length === 4
      ) {
        console.log(
          '[handleCaptureWithRelation] Pyramid - checking all faces for helpers: ' +
            moverPiece.pyramidFaces.join(', ')
        )

        // Collect all valid helpers from all pyramid faces
        const allValidHelpers = new Map<string, Piece>()

        for (const faceValue of moverPiece.pyramidFaces) {
          const helpers = findValidHelpers(faceValue, targetValue, relation)
          console.log(
            '[handleCaptureWithRelation] Face ' +
              faceValue +
              ' found ' +
              helpers.length +
              ' helpers'
          )
          for (const helper of helpers) {
            allValidHelpers.set(helper.id, helper)
          }
        }

        const validHelpers = Array.from(allValidHelpers.values())
        console.log('[handleCaptureWithRelation] Total unique helpers: ' + validHelpers.length)

        if (validHelpers.length === 0) {
          console.log('[handleCaptureWithRelation] No valid helpers found for any pyramid face')
          return
        }

        console.log('[handleCaptureWithRelation] Auto-selecting first helper:', validHelpers[0])
        setSelectedRelation(relation)
        setSelectedHelper({
          helperPiece: validHelpers[0],
          moverPiece,
          targetPiece,
        })
      } else {
        // Non-pyramid logic
        const moverValue = getEffectiveValue(moverPiece)
        console.log('[handleCaptureWithRelation] moverValue:', moverValue)

        if (moverValue === undefined || moverValue === null) {
          console.log('[handleCaptureWithRelation] Undefined/null mover value, returning')
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
      }
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

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    console.log(
      '[HOVER_ERROR] Mouse move - isMyTurn: ' + isMyTurn + ', selectedSquare: ' + selectedSquare
    )
    if (!isMyTurn || !selectedSquare) {
      setHoveredSquare(null)
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

      console.log(
        '[HOVER_ERROR] Square: ' +
          square +
          ', hasPiece: ' +
          !!piece +
          ', pieceColor: ' +
          (piece ? piece.color : 'none') +
          ', playerColor: ' +
          playerColor
      )

      // Only set hovered square if it's an enemy piece
      if (piece && piece.color !== playerColor) {
        console.log('[HOVER_ERROR] Setting hoveredSquare to: ' + square)
        setHoveredSquare(square)
      } else {
        setHoveredSquare(null)
      }
    } else {
      setHoveredSquare(null)
    }
  }

  const handleSvgMouseLeave = () => {
    console.log('[HOVER_ERROR] Mouse leave - clearing hoveredSquare')
    setHoveredSquare(null)
  }

  // Calculate target square position for floating capture options
  const getTargetSquarePosition = useCallback(() => {
    if (!captureTarget) return null
    // Add labelMargin offset to the position from utility function
    const basePos = getSquarePosition(captureTarget.to, layout)
    const pos = { x: basePos.x + labelMargin, y: basePos.y }
    return pos
  }, [captureTarget, layout, labelMargin])

  const targetPos = getTargetSquarePosition()

  // Prepare helper data with board positions (if showing helpers)
  const helpersWithPositions = (() => {
    if (!selectedRelation || !captureTarget) {
      return []
    }

    const moverPiece = Object.values(state.pieces).find(
      (p) => p.id === captureTarget.pieceId && !p.captured
    )
    const targetPiece = Object.values(state.pieces).find(
      (p) => p.square === captureTarget.to && !p.captured
    )

    if (!moverPiece || !targetPiece) {
      return []
    }

    const targetValue = getEffectiveValue(targetPiece)

    if (targetValue === undefined || targetValue === null) {
      return []
    }

    // For pyramids, collect helpers from all faces
    let validHelpers: Piece[]
    if (
      moverPiece.type === 'P' &&
      moverPiece.pyramidFaces &&
      moverPiece.pyramidFaces.length === 4
    ) {
      const allValidHelpers = new Map<string, Piece>()

      for (const faceValue of moverPiece.pyramidFaces) {
        const helpers = findValidHelpers(faceValue, targetValue, selectedRelation)
        for (const helper of helpers) {
          allValidHelpers.set(helper.id, helper)
        }
      }

      validHelpers = Array.from(allValidHelpers.values())
    } else {
      const moverValue = getEffectiveValue(moverPiece)
      if (moverValue === undefined || moverValue === null) {
        return []
      }
      validHelpers = findValidHelpers(moverValue, targetValue, selectedRelation)
    }

    const helpersWithPos = validHelpers.map((piece) => {
      const basePos = getSquarePosition(piece.square, layout)
      return {
        piece,
        boardPos: { x: basePos.x + labelMargin, y: basePos.y },
      }
    })

    return helpersWithPos
  })()

  // Calculate available relations and pyramid face values for this capture
  const { availableRelations, pyramidFaceValues } = (() => {
    if (!captureTarget) return { availableRelations: [], pyramidFaceValues: null }

    const moverPiece = Object.values(state.pieces).find(
      (p) => p.id === captureTarget.pieceId && !p.captured
    )
    const targetPiece = Object.values(state.pieces).find(
      (p) => p.square === captureTarget.to && !p.captured
    )

    if (!moverPiece || !targetPiece) return { availableRelations: [], pyramidFaceValues: null }

    const targetValue = getEffectiveValue(targetPiece)

    if (targetValue === undefined || targetValue === null)
      return { availableRelations: [], pyramidFaceValues: null }

    // For pyramids, collect ALL relations from ALL faces and track which face to use
    if (
      moverPiece.type === 'P' &&
      moverPiece.pyramidFaces &&
      moverPiece.pyramidFaces.length === 4
    ) {
      console.log(
        '[availableRelations] Checking pyramid with faces: ' + moverPiece.pyramidFaces.join(', ')
      )

      const allRelations = new Set<RelationKind>()
      const faceMap = new Map<RelationKind, number>()

      // Check each face and collect all available relations, storing first face that works for each relation
      for (const faceValue of moverPiece.pyramidFaces) {
        const relations = findAvailableRelations(faceValue, targetValue)
        console.log(
          '[availableRelations] Face ' + faceValue + ' relations: ' + relations.join(', ')
        )
        for (const rel of relations) {
          if (!faceMap.has(rel)) {
            faceMap.set(rel, faceValue)
          }
          allRelations.add(rel)
        }
      }

      const result = Array.from(allRelations)
      console.log('[availableRelations] All pyramid relations: ' + result.join(', '))
      console.log(
        '[availableRelations] Pyramid face map: ' +
          Array.from(faceMap.entries())
            .map(([r, v]) => r + '=' + v)
            .join(', ')
      )
      return { availableRelations: result, pyramidFaceValues: faceMap }
    }

    // For non-pyramid pieces, use standard logic
    const moverValue = getEffectiveValue(moverPiece)
    if (moverValue === undefined || moverValue === null)
      return { availableRelations: [], pyramidFaceValues: null }

    return {
      availableRelations: findAvailableRelations(moverValue, targetValue),
      pyramidFaceValues: null,
    }
  })()

  // Calculate if hovered square shows error (for hover preview)
  const showHoverError = (() => {
    console.log(
      '[HOVER_ERROR] Calculating showHoverError - hoveredSquare: ' +
        hoveredSquare +
        ', selectedSquare: ' +
        selectedSquare +
        ', captureDialogOpen: ' +
        captureDialogOpen
    )

    if (!hoveredSquare || !selectedSquare || captureDialogOpen) {
      console.log('[HOVER_ERROR] Early return - missing data or dialog open')
      return false
    }

    const moverPiece = Object.values(state.pieces).find(
      (p) => p.square === selectedSquare && !p.captured
    )
    const targetPiece = Object.values(state.pieces).find(
      (p) => p.square === hoveredSquare && !p.captured
    )

    console.log(
      '[HOVER_ERROR] Found pieces - mover: ' + !!moverPiece + ', target: ' + !!targetPiece
    )

    if (!moverPiece || !targetPiece) {
      console.log('[HOVER_ERROR] Missing mover or target piece')
      return false
    }

    // First check if the move path is valid
    const validation = validateMove(moverPiece, selectedSquare, hoveredSquare, state.pieces)
    console.log('[HOVER_ERROR] Path validation - valid: ' + validation.valid)

    if (!validation.valid) {
      console.log('[HOVER_ERROR] Path not valid - skipping relation check')
      return false
    }

    // Get target value
    const targetValue = getEffectiveValue(targetPiece)
    if (targetValue === undefined || targetValue === null) {
      console.log('[HOVER_ERROR] Target has no value')
      return false
    }

    // For pyramids, check if ANY of the 4 faces can form a valid relation
    if (
      moverPiece.type === 'P' &&
      moverPiece.pyramidFaces &&
      moverPiece.pyramidFaces.length === 4
    ) {
      console.log(
        '[HOVER_ERROR] Checking pyramid with faces: ' + moverPiece.pyramidFaces.join(', ')
      )

      // Check each face to see if any has valid relations
      for (const faceValue of moverPiece.pyramidFaces) {
        const relations = findAvailableRelations(faceValue, targetValue)
        console.log('[HOVER_ERROR] Face ' + faceValue + ' relations: ' + relations.length)
        if (relations.length > 0) {
          console.log('[HOVER_ERROR] Found valid relations with face ' + faceValue + ' - no error')
          return false // At least one face has valid relations, don't show error
        }
      }

      console.log('[HOVER_ERROR] No pyramid face has valid relations - show error')
      return true // None of the faces have valid relations
    }

    // For non-pyramid pieces, use the single value
    const moverValue = getEffectiveValue(moverPiece)
    console.log('[HOVER_ERROR] Non-pyramid value: ' + moverValue)

    if (moverValue === undefined || moverValue === null) {
      console.log('[HOVER_ERROR] Mover has no value')
      return false
    }

    const relations = findAvailableRelations(moverValue, targetValue)
    console.log('[HOVER_ERROR] Relations found: ' + relations.length)
    const shouldShow = relations.length === 0
    console.log('[HOVER_ERROR] Final result - showHoverError: ' + shouldShow)
    return shouldShow
  })()

  // Get position for hover error tooltip
  const hoverErrorPosition = (() => {
    if (!showHoverError || !hoveredSquare) return null

    const file = hoveredSquare.charCodeAt(0) - 65 // A=0
    const rank = Number.parseInt(hoveredSquare.slice(1), 10) // 1-8
    const row = 8 - rank // Invert for display

    const x = labelMargin + padding + file * (cellSize + gap) + cellSize / 2
    const y = padding + row * (cellSize + gap) + cellSize / 2

    return { x, y }
  })()

  // Detect portrait vs landscape and calculate explicit dimensions for rotation
  const boardAspectRatio = boardWidth / boardHeight // ~2:1 for 16x8 board
  const [containerAspectRatio, setContainerAspectRatio] = useState(1)
  const [svgDimensions, setSvgDimensions] = useState<{ width: string; height: string } | null>(null)
  const [updateCounter, setUpdateCounter] = useState(0)

  useEffect(() => {
    const container = document.querySelector('[data-component="board-container"]')
    if (!container) {
      return
    }

    // Watch the parent element - that's what gets resized by the panel
    const parentContainer = container.parentElement
    if (!parentContainer) {
      return
    }

    const updateDimensions = () => {
      // Measure the PARENT container, not the wrapper itself
      const rect = parentContainer.getBoundingClientRect()
      const containerAspect = rect.width / rect.height
      const shouldRotateBoard = containerAspect < 1 && boardAspectRatio > 1

      if (shouldRotateBoard) {
        // When rotating -90°, the board's dimensions swap visually:
        // - pre-rotation width → visual height
        // - pre-rotation height → visual width
        //
        // In portrait mode (tall container), prioritize filling HEIGHT.

        // Start by filling container height
        let visualHeight = rect.height
        let visualWidth = visualHeight / boardAspectRatio

        // If visual width exceeds container width, scale down PROPORTIONALLY
        // (don't switch to filling width - keep height priority)
        if (visualWidth > rect.width) {
          const scale = rect.width / visualWidth
          visualWidth = rect.width
          visualHeight = visualHeight * scale
        }

        // Convert visual dimensions back to pre-rotation SVG dimensions
        const preRotationWidth = visualHeight
        const preRotationHeight = visualWidth

        setSvgDimensions({
          width: `${preRotationWidth}px`,
          height: `${preRotationHeight}px`,
        })
      } else {
        // Normal landscape: use percentage sizing
        setSvgDimensions(null)
      }

      setContainerAspectRatio(containerAspect)
    }

    // Initial check - use requestAnimationFrame to ensure layout is painted
    const initialUpdate = () => {
      requestAnimationFrame(() => {
        updateDimensions()
      })
    }
    initialUpdate()

    // Use ResizeObserver to detect panel resizing (window resize doesn't catch panel changes!)
    const resizeObserver = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to ensure we measure after layout
      requestAnimationFrame(() => {
        updateDimensions()
      })
    })
    // Watch the parent container - that's what gets resized by the panel
    resizeObserver.observe(parentContainer)

    // Also listen to window resize for when the whole window changes
    window.addEventListener('resize', updateDimensions)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateDimensions)
    }
  }, [boardAspectRatio])

  // Rotate board if container is portrait and board is landscape
  const shouldRotate = containerAspectRatio < 1 && boardAspectRatio > 1

  return (
    <div
      data-component="board-container"
      className={css({
        width: '100%',
        height: '100%',
        position: 'relative',
        zIndex: Z_INDEX.GAME.OVERLAY,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {/* Unified SVG Board */}
      <svg
        viewBox={`0 0 ${boardWidth} ${boardHeight}`}
        style={{
          // Use explicit dimensions when rotated, percentage sizing when normal
          width: svgDimensions ? svgDimensions.width : '100%',
          height: svgDimensions ? svgDimensions.height : 'auto',
          // Don't constrain with max dimensions when rotating - we've already calculated exact size
          maxWidth: svgDimensions ? 'none' : '100%',
          maxHeight: svgDimensions ? 'none' : '100%',
          // Don't use aspect-ratio when rotating - it overrides explicit dimensions
          aspectRatio: svgDimensions ? 'auto' : `${boardWidth} / ${boardHeight}`,
          cursor: isMyTurn ? 'pointer' : 'default',
          overflow: 'visible',
          transform: shouldRotate ? 'rotate(-90deg)' : 'none',
          transformOrigin: 'center',
          transition: 'transform 0.3s ease',
        }}
        onClick={handleSvgClick}
        onMouseMove={handleSvgMouseMove}
        onMouseLeave={handleSvgMouseLeave}
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
            <g key={`col-${colLabel}`} transform={`translate(${x}, ${y})`}>
              <text
                x={0}
                y={0}
                fontSize="20"
                fontWeight="bold"
                fill="#374151"
                fontFamily="sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={shouldRotate ? 'rotate(90)' : undefined}
              >
                {colLabel}
              </text>
            </g>
          )
        })}

        {/* Row labels (1-8) on the left */}
        {Array.from({ length: rows }, (_, row) => {
          const actualRank = 8 - row
          const x = 15
          const y = padding + row * (cellSize + gap) + cellSize / 2

          return (
            <g key={`row-${actualRank}`} transform={`translate(${x}, ${y})`}>
              <text
                x={0}
                y={0}
                fontSize="20"
                fontWeight="bold"
                fill="#374151"
                fontFamily="sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={shouldRotate ? 'rotate(90)' : undefined}
              >
                {actualRank}
              </text>
            </g>
          )
        })}

        {/* Pieces */}
        {activePieces.map((piece) => {
          // Show low opacity for pieces currently being shown as helper options or in the number bond
          const isBorrowedHelper = helpersWithPositions.some((h) => h.piece.id === piece.id)
          const isBorrowedMover = selectedHelper && selectedHelper.moverPiece.id === piece.id
          const isInNumberBond = isBorrowedHelper || isBorrowedMover
          const isSelected = piece.square === selectedSquare
          return (
            <SvgPiece
              key={piece.id}
              piece={piece}
              cellSize={cellSize + gap}
              padding={padding}
              labelMargin={labelMargin}
              opacity={isInNumberBond ? 0.2 : 1}
              useNativeAbacusNumbers={useNativeAbacusNumbers}
              selected={isSelected}
              shouldRotate={shouldRotate}
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
              pyramidFaceValues,
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

        {/* Hover error tooltip - shows when hovering over invalid capture target */}
        {showHoverError && hoverErrorPosition && (
          <g transform={`translate(${hoverErrorPosition.x}, ${hoverErrorPosition.y})`}>
            <foreignObject
              x={-cellSize * 1.8}
              y={-cellSize * 0.5}
              width={cellSize * 3.6}
              height={cellSize}
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  color: '#f1f5f9',
                  padding: `${cellSize * 0.12}px ${cellSize * 0.18}px`,
                  borderRadius: `${cellSize * 0.12}px`,
                  fontSize: `${cellSize * 0.16}px`,
                  fontWeight: 500,
                  textAlign: 'center',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: `${cellSize * 0.1}px`,
                  backdropFilter: 'blur(8px)',
                  letterSpacing: '0.01em',
                  pointerEvents: 'none',
                }}
              >
                <span style={{ fontSize: `${cellSize * 0.2}px`, opacity: 0.7 }}>⚠</span>
                <span>No valid relation</span>
              </div>
            </foreignObject>
          </g>
        )}
      </svg>
    </div>
  )
}

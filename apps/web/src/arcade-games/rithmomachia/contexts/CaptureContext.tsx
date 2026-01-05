'use client'

import { createContext, type ReactNode, useContext } from 'react'
import type { Piece, RelationKind } from '../types'

/**
 * Layout information for the capture dialog
 */
export interface CaptureLayout {
  targetPos: { x: number; y: number }
  cellSize: number
  gap: number
  padding: number
}

/**
 * Pieces involved in the current capture attempt
 */
export interface CapturePieces {
  mover: Piece
  target: Piece
  helper: Piece | null
}

/**
 * Context value for the capture dialog subsystem
 */
export interface CaptureContextValue {
  // Layout (calculated once, shared by all capture components)
  layout: CaptureLayout

  // Pieces involved in capture
  pieces: CapturePieces

  // Capture state
  selectedRelation: RelationKind | null
  closing: boolean

  // All pieces on the board (for validation)
  allPieces: Piece[]

  // For pyramid pieces, maps relation to which face value to use
  pyramidFaceValues: Map<RelationKind, number> | null

  // Helper functions
  findValidHelpers: (moverValue: number, targetValue: number, relation: RelationKind) => Piece[]

  // Actions
  selectRelation: (relation: RelationKind) => void
  selectHelper: (pieceId: string) => void
  dismissDialog: () => void
}

const CaptureContext = createContext<CaptureContextValue | null>(null)

/**
 * Hook to access capture context
 */
export function useCaptureContext(): CaptureContextValue {
  const context = useContext(CaptureContext)
  if (!context) {
    throw new Error('useCaptureContext must be used within CaptureProvider')
  }
  return context
}

/**
 * Provider for capture dialog context
 */
export function CaptureProvider({
  children,
  value,
}: {
  children: ReactNode
  value: CaptureContextValue
}) {
  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>
}

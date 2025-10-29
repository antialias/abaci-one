/**
 * Yjs persistence helpers
 * Sync Y.Doc state with arcade sessions database
 */

import type * as Y from 'yjs'
import type { GridCell } from '@/arcade-games/yjs-demo/types'

/**
 * Extract grid cells from a Y.Doc for persistence
 * @param doc - The Yjs document
 * @param arrayName - Name of the Y.Array containing cells (default: 'cells')
 * @returns Array of grid cells
 */
export function extractCellsFromDoc(doc: any, arrayName = 'cells'): GridCell[] {
  const cellsArray = doc.getArray(arrayName)
  if (!cellsArray) return []

  const cells: GridCell[] = []
  cellsArray.forEach((cell: GridCell) => {
    cells.push(cell)
  })
  return cells
}

/**
 * Populate a Y.Doc with cells from persisted state
 * @param doc - The Yjs document
 * @param cells - Array of grid cells to restore
 * @param arrayName - Name of the Y.Array to populate (default: 'cells')
 */
export function populateDocWithCells(doc: any, cells: GridCell[], arrayName = 'cells'): void {
  const cellsArray = doc.getArray(arrayName)

  // Clear existing cells first
  cellsArray.delete(0, cellsArray.length)

  // Add persisted cells
  if (cells.length > 0) {
    doc.transact(() => {
      cellsArray.push(cells)
    })
  }
}

/**
 * Serialize Y.Doc to a compact format for database storage
 * Uses Yjs's built-in state vector encoding
 * @param doc - The Yjs document
 * @returns Base64-encoded document state
 */
export function serializeDoc(doc: any): string {
  const Y = require('yjs')
  const state = Y.encodeStateAsUpdate(doc)
  return Buffer.from(state).toString('base64')
}

/**
 * Restore Y.Doc from serialized state
 * @param doc - The Yjs document to populate
 * @param serialized - Base64-encoded document state
 */
export function deserializeDoc(doc: any, serialized: string): void {
  const Y = require('yjs')
  const state = Buffer.from(serialized, 'base64')
  Y.applyUpdate(doc, state)
}

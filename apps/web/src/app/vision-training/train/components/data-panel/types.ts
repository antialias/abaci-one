import type { QuadCorners } from '@/types/vision'
import type { ModelType } from '../wizard/types'

/**
 * Base interface for all data panel items.
 * Both boundary frames and column images conform to this shape.
 */
export interface DataPanelItem {
  /** Unique identifier for the item */
  id: string
  /** Path to the image file */
  imagePath: string
  /** When the item was captured */
  capturedAt: string
  /** Device that captured the item */
  deviceId: string
  /** Session ID if captured during a session */
  sessionId: string | null
  /** Player ID if associated with a player */
  playerId: string | null
}

/**
 * Boundary detector data item.
 * Represents a frame captured for boundary detector training.
 */
export interface BoundaryDataItem extends DataPanelItem {
  type: 'boundary'
  /** Corner coordinates (normalized 0-1) */
  corners: QuadCorners
  /** Original frame width in pixels */
  frameWidth: number
  /** Original frame height in pixels */
  frameHeight: number
  /** Base name of the file (without extension) */
  baseName: string
}

/**
 * Column classifier data item.
 * Represents an image captured for column classifier training.
 */
export interface ColumnDataItem extends DataPanelItem {
  type: 'column'
  /** Digit value (0-9) */
  digit: number
  /** Filename of the image */
  filename: string
}

/**
 * Union type for all data panel items
 */
export type AnyDataItem = BoundaryDataItem | ColumnDataItem

/**
 * Type guard for boundary data items
 */
export function isBoundaryDataItem(item: AnyDataItem): item is BoundaryDataItem {
  return item.type === 'boundary'
}

/**
 * Type guard for column data items
 */
export function isColumnDataItem(item: AnyDataItem): item is ColumnDataItem {
  return item.type === 'column'
}

/**
 * Filter configuration for data panel items.
 * Shared between both model types.
 */
export type CaptureTypeFilter = 'all' | 'passive' | 'explicit'
export type TimeRangeMode = 'all' | 'before' | 'after' | 'between'

export interface DataPanelFilters {
  /** Filter by capture type */
  captureType: CaptureTypeFilter
  /** Filter by device ID (empty = all) */
  deviceId: string
  /** Filter by session ID (empty = all) */
  sessionId: string
  /** Filter by player ID (empty = all) */
  playerId: string
  /** Time range filter mode */
  timeRangeMode: TimeRangeMode
  /** Before timestamp (for time filtering) */
  beforeTimestamp?: number
  /** After timestamp (for time filtering) */
  afterTimestamp?: number
}

/**
 * Default filter values
 */
export function getDefaultFilters(): DataPanelFilters {
  return {
    captureType: 'all',
    deviceId: '',
    sessionId: '',
    playerId: '',
    timeRangeMode: 'all',
  }
}

/**
 * Determines if a device ID represents passive capture
 */
export function isPassiveDevice(deviceId: string): boolean {
  return deviceId.startsWith('passive-')
}

/**
 * Apply filters to a list of items.
 * Works with any DataPanelItem.
 */
export function applyFilters<T extends DataPanelItem>(items: T[], filters: DataPanelFilters): T[] {
  return items.filter((item) => {
    // Capture type filter
    if (filters.captureType !== 'all') {
      const isPassive = isPassiveDevice(item.deviceId)
      if (filters.captureType === 'passive' && !isPassive) return false
      if (filters.captureType === 'explicit' && isPassive) return false
    }

    // Device filter
    if (filters.deviceId && item.deviceId !== filters.deviceId) {
      return false
    }

    // Session filter
    if (filters.sessionId && item.sessionId !== filters.sessionId) {
      return false
    }

    // Player filter
    if (filters.playerId && item.playerId !== filters.playerId) {
      return false
    }

    // Time range filter
    if (filters.timeRangeMode !== 'all' && item.capturedAt) {
      const itemTime = new Date(item.capturedAt).getTime()
      if (filters.timeRangeMode === 'before' && filters.beforeTimestamp !== undefined) {
        if (itemTime >= filters.beforeTimestamp) return false
      } else if (filters.timeRangeMode === 'after' && filters.afterTimestamp !== undefined) {
        if (itemTime <= filters.afterTimestamp) return false
      } else if (
        filters.timeRangeMode === 'between' &&
        filters.afterTimestamp !== undefined &&
        filters.beforeTimestamp !== undefined
      ) {
        if (itemTime <= filters.afterTimestamp || itemTime >= filters.beforeTimestamp) {
          return false
        }
      }
    }

    return true
  })
}

/**
 * Props for the unified data panel
 */
export interface UnifiedDataPanelProps {
  /** Model type determines which UI elements to show */
  modelType: ModelType
  /** Callback when data changes (for parent refresh) */
  onDataChanged?: () => void
}

/**
 * Sync status for NAS sync
 */
export interface SyncStatus {
  available: boolean
  remote?: { host: string; totalImages: number }
  local?: { totalImages: number }
  needsSync?: boolean
  newOnRemote?: number
  newOnLocal?: number
  excludedByDeletion?: number
  error?: string
}

/**
 * Sync progress state
 */
export interface SyncProgress {
  phase: 'idle' | 'connecting' | 'syncing' | 'complete' | 'error'
  message: string
  filesTransferred?: number
  bytesTransferred?: number
}

/**
 * Room TTL Cleanup Scheduler
 * Periodically cleans up expired rooms
 */

import { cleanupExpiredRooms } from './room-manager'

// Cleanup interval: run every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

let cleanupInterval: NodeJS.Timeout | null = null

/**
 * Start the TTL cleanup scheduler
 * Runs cleanup every 5 minutes
 */
export function startRoomTTLCleanup() {
  if (cleanupInterval) {
    console.log('[Room TTL] Cleanup scheduler already running')
    return
  }

  console.log('[Room TTL] Starting cleanup scheduler (every 5 minutes)')

  // Run immediately on start
  cleanupExpiredRooms()
    .then((count) => {
      if (count > 0) {
        console.log(`[Room TTL] Initial cleanup removed ${count} expired rooms`)
      }
    })
    .catch((error) => {
      console.error('[Room TTL] Initial cleanup failed:', error)
    })

  // Then run periodically
  cleanupInterval = setInterval(async () => {
    try {
      const count = await cleanupExpiredRooms()
      if (count > 0) {
        console.log(`[Room TTL] Cleanup removed ${count} expired rooms`)
      }
    } catch (error) {
      console.error('[Room TTL] Cleanup failed:', error)
    }
  }, CLEANUP_INTERVAL_MS)
}

/**
 * Stop the TTL cleanup scheduler
 */
export function stopRoomTTLCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    console.log('[Room TTL] Cleanup scheduler stopped')
  }
}

/**
 * Socket.IO server instance accessor for API routes
 * This module provides a way for API routes to access the socket.io server
 * to broadcast real-time updates.
 */

import type { Server as SocketIOServerType } from 'socket.io'

// Cache for the socket server module
let socketServerModule: any = null

/**
 * Get the socket.io server instance
 * Returns null if not initialized or if called on client-side
 */
export async function getSocketIO(): Promise<SocketIOServerType | null> {
  // Client-side: return null
  if (typeof window !== 'undefined') {
    return null
  }

  // Lazy-load the socket server module on first call
  if (!socketServerModule) {
    try {
      // Dynamic import to avoid bundling issues
      socketServerModule = await import('../../socket-server')
    } catch (error) {
      console.error('[Socket IO] Failed to load socket server:', error)
      return null
    }
  }

  // Call the exported getSocketIO function from the module
  if (socketServerModule && typeof socketServerModule.getSocketIO === 'function') {
    return socketServerModule.getSocketIO()
  }

  console.warn('[Socket IO] getSocketIO function not found in socket-server module')
  return null
}

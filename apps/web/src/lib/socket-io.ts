/**
 * Socket.IO server instance accessor for API routes
 * This module provides a way for API routes to access the socket.io server
 * to broadcast real-time updates.
 */

import type { Server as SocketIOServerType } from 'socket.io'

// Import the socket server module (this is safe because it's only used in Node.js context)
let socketServer: { getSocketIO: () => SocketIOServerType | null } | null = null

// Lazy-load the socket server module (only works on server-side)
async function loadSocketServer() {
  if (typeof window !== 'undefined') {
    // Client-side: return null
    return null
  }

  if (!socketServer) {
    try {
      // Dynamic import to avoid bundling issues
      socketServer = await import('../../socket-server')
    } catch (error) {
      console.error('[Socket IO] Failed to load socket server:', error)
      return null
    }
  }

  return socketServer
}

/**
 * Get the socket.io server instance
 * Returns null if not initialized or if called on client-side
 */
export async function getSocketIO(): Promise<SocketIOServerType | null> {
  const server = await loadSocketServer()
  return server ? server.getSocketIO() : null
}

/**
 * The socket rooms a viewer joins by who they are: their own user channel
 * `user:<id>` (notifications, moderation, enrollment, print-job rings) and
 * their children's `player:<childId>` channels (session started / ended).
 *
 * Both use the socket's verified viewer (`socket.data.viewer`, from the
 * handshake's cookies). The `userId` older clients send is ignored, so a
 * socket can only join its own channel and only its own children's.
 */

import { type SocketViewerData, socketViewerId } from '@/lib/socket-viewer'

/** The socket surface these joins need (a socket.io `Socket`). */
export interface ViewerChannelSocket {
  on(event: string, handler: (data: any) => void): unknown
  join(room: string): unknown
  leave(room: string): unknown
  data: SocketViewerData
}

/** Register `join-user-channel` and `subscribe-` / `unsubscribe-child-sessions`. */
export function registerViewerChannels(socket: ViewerChannelSocket): void {
  // The viewer's own channel; an anonymous socket has none
  socket.on('join-user-channel', async () => {
    const userId = socketViewerId(socket)
    if (!userId) return
    try {
      await socket.join(`user:${userId}`)
    } catch (error) {
      console.error('Error joining user channel:', error)
    }
  })

  // A parent's children: each child is checked against the verified viewer
  socket.on('subscribe-child-sessions', async (request: { childIds?: unknown }) => {
    const userId = socketViewerId(socket)
    const childIds = Array.isArray(request?.childIds) ? request.childIds : []
    if (!userId) {
      console.log('⚠️ Child-session subscription denied: no verified viewer')
      return
    }
    try {
      const { isParentOf } = await import('@/lib/classroom')
      for (const childId of childIds) {
        if (typeof childId !== 'string' || !childId) continue
        if (await isParentOf(userId, childId)) {
          await socket.join(`player:${childId}`)
          console.log(`👪 Parent ${userId} subscribed to child sessions: ${childId}`)
        } else {
          console.log(`⚠️ Parent subscription denied - ${userId} is not parent of ${childId}`)
        }
      }
    } catch (error) {
      console.error('Error subscribing to child sessions:', error)
    }
  })

  socket.on('unsubscribe-child-sessions', async (request: { childIds?: unknown }) => {
    const childIds = Array.isArray(request?.childIds) ? request.childIds : []
    try {
      for (const childId of childIds) {
        if (typeof childId === 'string' && childId) await socket.leave(`player:${childId}`)
      }
    } catch (error) {
      console.error('Error unsubscribing from child sessions:', error)
    }
  })
}

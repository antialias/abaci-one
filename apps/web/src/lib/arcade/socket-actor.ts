/**
 * Who an arcade socket event acts as: the socket's verified viewer
 * (`socket.data.viewer`, from the handshake's cookies), never the `userId` a
 * payload or a move carries. A room event also needs that viewer to be a
 * member of the room (`room_members`, joined over HTTP first; a game break's
 * kid and its co-playing observers are members too).
 */

import { isMember } from '@/lib/arcade/room-membership'
import { type SocketViewerData, socketViewerId } from '@/lib/socket-viewer'

export type ArcadeActor = { ok: true; userId: string } | { ok: false; error: string }

export const NO_VIEWER_ERROR = 'No signed-in or guest session on this connection'
export const NOT_A_MEMBER_ERROR = 'Not a member of this room'

/**
 * The verified user an arcade event acts as; with a `roomId`, only a member
 * of that room.
 */
export async function arcadeActor(
  socket: { data: SocketViewerData },
  roomId?: string | null
): Promise<ArcadeActor> {
  const userId = socketViewerId(socket)
  if (!userId) return { ok: false, error: NO_VIEWER_ERROR }
  if (roomId && !(await isMember(roomId, userId))) return { ok: false, error: NOT_A_MEMBER_ERROR }
  return { ok: true, userId }
}

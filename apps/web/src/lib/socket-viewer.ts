/**
 * Who a socket.io connection is, as the server verified it at the handshake.
 *
 * `resolveSocketViewer` (`socket-identity.ts`) reads the handshake's cookies
 * once per connection (every reconnect is a new handshake) and the socket
 * server stores the result in `socket.data.viewer`. Handlers read the id from
 * here and ignore any id a payload carries: a client can name any id, it
 * cannot forge the cookie.
 *
 * This module has no imports so the room-access modules and their tests can
 * read the viewer without loading the resolver's auth and database graph.
 */

/**
 * - `user`: a signed-in NextAuth session (`auth()`'s `session.user.id`);
 * - `guest`: a verified guest cookie, and its `users` row (`getUserId()`'s id);
 * - `anonymous`: neither cookie.
 * Share-link holders and remote-camera phones are admitted by their token,
 * never by an id, whatever their viewer is. A phone page gets a guest cookie
 * from the middleware like any signed-out visitor, so its socket is that
 * guest (and a new phone browser gets a `users` row at its first handshake).
 */
export type SocketViewer =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; userId: string }
  | { kind: 'anonymous' }

/** `socket.data`'s part that holds the verified viewer. */
export interface SocketViewerData {
  viewer?: SocketViewer
}

export const ANONYMOUS_VIEWER: SocketViewer = { kind: 'anonymous' }

/** The verified user id of the socket's viewer (a guest's too), or null when anonymous. */
export function socketViewerId(socket: { data: SocketViewerData }): string | null {
  const viewer = socket.data?.viewer
  return viewer && viewer.kind !== 'anonymous' ? viewer.userId : null
}
